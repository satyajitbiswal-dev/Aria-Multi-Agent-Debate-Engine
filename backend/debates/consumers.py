import json
from channels.generic.websocket import AsyncWebsocketConsumer


class DebateConsumer(AsyncWebsocketConsumer):
    """
    One consumer instance per agent panel.

    URL: ws://localhost:8000/ws/debate/<debate_id>/<agent_role>/
    Roles: advocate | critic | judge

    The frontend connects to all three simultaneously.
    Celery tasks push messages to the channel group.
    This consumer just forwards them to the WebSocket client.

    Message types sent to client:
        { "type": "token",   "content": "..." }   — streaming token
        { "type": "status",  "content": "..." }   — phase update e.g. "Researching..."
        { "type": "citation","index": 1, "url": "...", "title": "...", "snippet": "..." }
        { "type": "score",   "advocate": 7.5, "critic": 8.2, "verdict": "..." }
        { "type": "done" }                         — agent finished
        { "type": "error",   "content": "..." }   — something went wrong
    """

    async def connect(self):
        self.debate_id = self.scope["url_route"]["kwargs"]["debate_id"]
        self.agent_role = self.scope["url_route"]["kwargs"]["agent_role"]

        # Validate role
        if self.agent_role not in ("advocate", "critic", "judge"):
            await self.close(code=4001)
            return

        self.group_name = f"debate_{self.debate_id}_{self.agent_role}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Let client know they're connected
        await self.send(json.dumps({
            "type": "connected",
            "debate_id": self.debate_id,
            "agent_role": self.agent_role,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Receive from WebSocket client (not used much, but handle gracefully) ──
    async def receive(self, text_data=None, bytes_data=None):
        pass  # Clients are read-only; they only receive

    # ── Channel layer message handlers ────────────────────────────────────────
    # These are called by Celery tasks via channel_layer.group_send()
    # Method name = message["type"] with dots replaced by underscores

    async def debate_token(self, event):
        await self.send(json.dumps({
            "type": "token",
            "content": event["content"],
        }))

    async def debate_status(self, event):
        await self.send(json.dumps({
            "type": "status",
            "content": event["content"],
        }))

    async def debate_citation(self, event):
        await self.send(json.dumps({
            "type": "citation",
            "index": event["index"],
            "url": event["url"],
            "title": event["title"],
            "snippet": event["snippet"],
        }))

    async def debate_score(self, event):
        await self.send(json.dumps({
            "type": "score",
            "advocate_evidence": event.get("advocate_evidence"),
            "critic_evidence": event.get("critic_evidence"),
            "advocate_logic": event.get("advocate_logic"),
            "critic_logic": event.get("critic_logic"),
            "verdict": event.get("verdict", ""),
        }))

    async def debate_done(self, event):
        await self.send(json.dumps({"type": "done"}))

    async def debate_error(self, event):
        await self.send(json.dumps({
            "type": "error",
            "content": event["content"],
        }))
