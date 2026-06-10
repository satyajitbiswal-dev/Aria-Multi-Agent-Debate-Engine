from django.urls import path
from .views import AgentHealthView

urlpatterns = [
    path("health/", AgentHealthView.as_view(), name="agent-health"),
]
