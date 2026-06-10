from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Debate
from .serializers import DebateSerializer, CreateDebateSerializer


class DebateListCreateView(generics.ListCreateAPIView):
    queryset = Debate.objects.all().prefetch_related("agent_outputs__citations")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateDebateSerializer
        return DebateSerializer

    def create(self, request, *args, **kwargs):
        serializer = CreateDebateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        debate = serializer.save()

        # Fire off the Celery task — import here to avoid circular imports
        from agents.tasks import run_debate
        run_debate.delay(str(debate.id))

        return Response(
            DebateSerializer(debate).data,
            status=status.HTTP_201_CREATED,
        )


class DebateDetailView(generics.RetrieveAPIView):
    queryset = Debate.objects.all().prefetch_related("agent_outputs__citations")
    serializer_class = DebateSerializer
    lookup_field = "id"


class DebateSuggestionsView(APIView):
    """Returns seeded topic suggestions for the UI."""

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
