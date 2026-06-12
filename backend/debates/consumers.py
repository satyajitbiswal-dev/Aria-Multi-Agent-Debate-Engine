import json
from channels.generic.websocket import AsyncWebsocketConsumer


class DebateConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.debate_id  = self.scope["url_route"]["kwargs"]["debate_id"]
        self.agent_role = self.scope["url_route"]["kwargs"]["agent_role"]

        if self.agent_role not in ("advocate", "critic", "judge"):
            await self.close(code=4001)
            return

        self.group_name = f"debate_{self.debate_id}_{self.agent_role}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(json.dumps({
            "type": "connected",
            "debate_id": self.debate_id,
            "agent_role": self.agent_role,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def debate_token(self, event):
        await self.send(json.dumps({"type": "token", "content": event["content"]}))

    async def debate_status(self, event):
        await self.send(json.dumps({"type": "status", "content": event["content"]}))

    async def debate_citation(self, event):
        await self.send(json.dumps({
            "type": "citation",
            "index": event["index"], "url": event["url"],
            "title": event["title"], "snippet": event["snippet"],
        }))

    async def debate_round_start(self, event):
        """New message type — frontend opens a fresh bubble."""
        await self.send(json.dumps({
            "type": "round_start",
            "round_number": event["round_number"],
            "label": event["label"],
        }))

    async def debate_score(self, event):
        await self.send(json.dumps({
            "type": "score",
            "advocate_evidence": event.get("advocate_evidence"),
            "critic_evidence":   event.get("critic_evidence"),
            "advocate_logic":    event.get("advocate_logic"),
            "critic_logic":      event.get("critic_logic"),
            "verdict":           event.get("verdict", ""),
        }))

    async def debate_done(self, event):
        await self.send(json.dumps({"type": "done"}))

    async def debate_error(self, event):
        await self.send(json.dumps({"type": "error", "content": event["content"]}))
