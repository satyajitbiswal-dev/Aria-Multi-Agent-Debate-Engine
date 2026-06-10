"""
utils.py — Helpers for pushing WebSocket messages from Celery tasks.

Celery tasks run in a synchronous context, so we use
async_to_sync to call the channel layer's group_send.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group_name: str, message: dict):
    """Synchronously send a message to a channel group."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(group_name, message)


def _group(debate_id: str, role: str) -> str:
    return f"debate_{debate_id}_{role}"


# ── Push helpers ──────────────────────────────────────────────────────────────

def push_token(debate_id: str, role: str, content: str):
    """Stream a text token to the agent's panel."""
    _send(_group(debate_id, role), {
        "type": "debate.token",
        "content": content,
    })


def push_status(debate_id: str, role: str, content: str):
    """Push a status update (e.g. 'Searching...') to the panel."""
    _send(_group(debate_id, role), {
        "type": "debate.status",
        "content": content,
    })


def push_citation(debate_id: str, role: str, index: int, url: str, title: str, snippet: str):
    """Push a found source/citation to the panel."""
    _send(_group(debate_id, role), {
        "type": "debate.citation",
        "index": index,
        "url": url,
        "title": title,
        "snippet": snippet,
    })


def push_score(
    debate_id: str,
    advocate_evidence: float,
    critic_evidence: float,
    advocate_logic: float,
    critic_logic: float,
    verdict: str,
):
    """Push scoring results to the judge panel."""
    _send(_group(debate_id, "judge"), {
        "type": "debate.score",
        "advocate_evidence": advocate_evidence,
        "critic_evidence": critic_evidence,
        "advocate_logic": advocate_logic,
        "critic_logic": critic_logic,
        "verdict": verdict,
    })


def push_done(debate_id: str, role: str):
    """Signal that an agent has finished."""
    _send(_group(debate_id, role), {
        "type": "debate.done",
    })


def push_error(debate_id: str, role: str, content: str):
    """Push an error message to an agent panel."""
    _send(_group(debate_id, role), {
        "type": "debate.error",
        "content": content,
    })
