"""
utils.py — WebSocket push helpers. Added push_round_start for round tracking.
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group_name: str, message: dict):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(group_name, message)


def _group(debate_id: str, role: str) -> str:
    return f"debate_{debate_id}_{role}"


def push_token(debate_id: str, role: str, content: str):
    _send(_group(debate_id, role), {"type": "debate.token", "content": content})


def push_status(debate_id: str, role: str, content: str):
    _send(_group(debate_id, role), {"type": "debate.status", "content": content})


def push_citation(debate_id: str, role: str, index: int, url: str, title: str, snippet: str):
    _send(_group(debate_id, role), {
        "type": "debate.citation",
        "index": index, "url": url, "title": title, "snippet": snippet,
    })


def push_round_start(debate_id: str, role: str, round_number: int, label: str):
    """Explicit round boundary — frontend uses this to open a new bubble."""
    _send(_group(debate_id, role), {
        "type": "debate.round_start",
        "round_number": round_number,
        "label": label,
    })


def push_score(debate_id, advocate_evidence, critic_evidence, advocate_logic, critic_logic, verdict):
    _send(_group(debate_id, "judge"), {
        "type": "debate.score",
        "advocate_evidence": advocate_evidence,
        "critic_evidence":   critic_evidence,
        "advocate_logic":    advocate_logic,
        "critic_logic":      critic_logic,
        "verdict":           verdict,
    })


def push_done(debate_id: str, role: str):
    _send(_group(debate_id, role), {"type": "debate.done"})


def push_error(debate_id: str, role: str, content: str):
    _send(_group(debate_id, role), {"type": "debate.error", "content": content})
