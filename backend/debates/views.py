from django.conf import settings
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import Debate
from .serializers import DebateSerializer, CreateDebateSerializer


class DebateListCreateView(generics.ListCreateAPIView):
    """
    GET  — list debates for the authenticated user (or all if anon, limited to 20)
    POST — create a new debate (anon allowed; saved with user=None)
    """
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        return CreateDebateSerializer if self.request.method == "POST" else DebateSerializer

    def get_queryset(self):
        qs = Debate.objects.prefetch_related("agent_outputs__citations")
        if self.request.user and self.request.user.is_authenticated:
            return qs.filter(user=self.request.user)
        # Anonymous: return nothing — they don't have a history
        return qs.none()

    def create(self, request, *args, **kwargs):
        ser = CreateDebateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        debate = ser.save(
            user=request.user if request.user.is_authenticated else None
        )
        from agents.tasks import run_debate
        run_debate.delay(str(debate.id))
        return Response(DebateSerializer(debate).data, status=status.HTTP_201_CREATED)


class DebateDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    queryset = Debate.objects.all().prefetch_related("agent_outputs__citations")
    serializer_class = DebateSerializer
    lookup_field = "id"


class DebateSuggestionsView(APIView):
    permission_classes = [AllowAny]

    SUGGESTIONS = [
        "Should AI replace traditional university exams?",
        "Is remote work killing team culture?",
        "Should social media platforms be regulated like utilities?",
        "Is React dying as a frontend framework?",
        "Should IITs switch to a 4-day work week?",
        "Will large language models replace software engineers by 2030?",
        "Should college attendance be made optional?",
        "Is open source AI development dangerous?",
        "Should startups prioritize growth over profitability?",
        "Is cryptocurrency a legitimate asset class?",
    ]

    def get(self, request):
        return Response({"suggestions": self.SUGGESTIONS})


class DebateImproveTopicView(APIView):
    """
    POST /api/debates/improve-topic/
    Body: { "topic": "AI is bad" }
    Returns: { "original": "...", "improved": "...", "explanation": "..." }

    Uses a quick LLM call to rewrite a vague topic into a proper debate motion.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        topic = (request.data.get("topic") or "").strip()
        if len(topic) < 3:
            return Response({"error": "Topic too short."}, status=400)

        try:
            improved, explanation = _improve_topic(topic)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

        return Response({
            "original":    topic,
            "improved":    improved,
            "explanation": explanation,
        })


def _improve_topic(topic: str):
    """Call LLM to turn a raw topic into a sharp debate motion."""
    import re, json
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage

    llm = ChatOpenAI(
        model="meta-llama/llama-3.3-70b-instruct",
        temperature=0.4,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
    )

    system = """You are a debate coach who rewrites vague topics into sharp, arguable debate motions.

Rules for a good debate motion:
- Clear and specific — no ambiguous terms
- Arguable from both sides — not obviously one-sided
- Present tense statement ("This house believes that…" style, but without the "This house" prefix)
- 10–20 words max
- No questions — must be a statement

Respond ONLY in this JSON format:
{
  "improved": "<the rewritten motion>",
  "explanation": "<one sentence: what you changed and why>"
}"""

    user = f'Rewrite this debate topic into a sharp motion: "{topic}"'

    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    raw = re.sub(r"```json\s*|```\s*", "", response.content.strip())
    data = json.loads(raw)
    return data["improved"], data["explanation"]


class DebateStanceView(APIView):
    """
    POST /api/debates/<id>/stance/
    Body: { "stance": "advocate" | "critic", "thought": "optional user text" }
    Submitted after round 1 when interactive_mode is enabled.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        try:
            debate = Debate.objects.get(id=id)
        except Debate.DoesNotExist:
            return Response({"error": "Debate not found."}, status=404)

        if not debate.interactive_mode:
            return Response({"error": "This debate is not in interactive mode."}, status=400)
        if not debate.awaiting_stance:
            return Response({"error": "Not awaiting a stance choice."}, status=400)

        stance = (request.data.get("stance") or "").strip().lower()
        if stance not in ("advocate", "critic"):
            return Response({"error": "Stance must be 'advocate' or 'critic'."}, status=400)

        thought = (request.data.get("thought") or "").strip()[:2000]

        debate.user_stance = stance
        debate.user_thought = thought
        debate.awaiting_stance = False
        debate.save(update_fields=["user_stance", "user_thought", "awaiting_stance"])

        from agents.tasks import continue_debate
        continue_debate.delay(str(debate.id))

        return Response(DebateSerializer(debate).data)


class DebateExportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, id):
        try:
            debate = Debate.objects.prefetch_related("agent_outputs__citations").get(id=id)
        except Debate.DoesNotExist:
            return Response({"error": "Debate not found."}, status=404)

        if debate.status != Debate.Status.COMPLETED:
            return Response({"error": "PDF only available for completed debates."}, status=400)

        from .export import generate_debate_pdf
        buffer = generate_debate_pdf(debate)
        safe_topic = debate.topic[:40].replace(" ", "_").replace("/", "-")
        response = HttpResponse(buffer, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="aria_debate_{safe_topic}.pdf"'
        return response

