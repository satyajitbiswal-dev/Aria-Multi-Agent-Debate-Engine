from django.urls import re_path
from .consumers import DebateConsumer

websocket_urlpatterns = [
    re_path(
        r"ws/debate/(?P<debate_id>[0-9a-f-]+)/(?P<agent_role>advocate|critic|judge)/$",
        DebateConsumer.as_asgi(),
    ),
]
