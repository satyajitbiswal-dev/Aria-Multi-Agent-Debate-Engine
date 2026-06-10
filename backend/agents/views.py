from rest_framework.views import APIView
from rest_framework.response import Response


class AgentHealthView(APIView):
    def get(self, request):
        return Response({"status": "agents ready"})
