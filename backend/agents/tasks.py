"""
tasks.py — 4-round sequential debate pipeline.

Round 1: Advocate argues FOR
Round 2: Critic argues AGAINST (sees round 1)
Round 3: Advocate rebuts (sees rounds 1+2)
Round 4: Critic rebuts (sees rounds 1+2+3)
Judge:   Evaluates all 4 rounds
"""
import os
from celery import shared_task


def _save_output(debate, role_const, round_number, result):
    """Persist AgentOutput + Citations. Returns the AgentOutput."""
    from debates.models import AgentOutput, Citation
    output = AgentOutput.objects.create(
        debate=debate,
        role=role_const,
        round_number=round_number,
        content=result.get("argument", ""),
    )
    for c in result.get("citations", []):
        Citation.objects.create(
            agent_output=output,
            url=c.get("url", ""),
            title=c.get("title", ""),
            snippet=c.get("snippet", ""),
            index=c.get("index", 1),
        )
    return output


@shared_task(bind=True, max_retries=1)
def run_debate(self, debate_id: str):
    """
    Orchestrates the full 4-round debate synchronously inside one task.
    Each round pushes tokens to the frontend via WebSocket.
    """
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate, AgentOutput
    from agents.advocate import advocate_graph
    from agents.critic import critic_graph
    from agents.judge import judge_graph
    from agents.utils import push_status, push_error

    try:
        debate = Debate.objects.get(id=debate_id)

        # ── Round 1: Advocate ────────────────────────────────────────────────
        debate.status = Debate.Status.RUNNING
        debate.save()
        push_status(debate_id, "advocate", "Round 1 – Building opening argument...")
        push_status(debate_id, "critic",   "Waiting for Advocate…")
        push_status(debate_id, "judge",    "Waiting for all rounds…")

        r1_adv = advocate_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
            "critic_argument": "",
            "previous_rounds": [],
            "is_rebuttal": False,
            "round_number": 1,
        })
        _save_output(debate, AgentOutput.Role.ADVOCATE, 1, r1_adv)
        adv1_text = r1_adv.get("argument", "")

        # ── Round 2: Critic ──────────────────────────────────────────────────
        debate.status = Debate.Status.ROUND_2
        debate.save()
        push_status(debate_id, "critic", "Round 2 – Building counter-argument...")

        r2_crit = critic_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
            "advocate_argument": adv1_text,
            "previous_rounds": [
                {"role": "advocate", "round": 1, "text": adv1_text},
            ],
            "is_rebuttal": False,
            "round_number": 2,
        })
        _save_output(debate, AgentOutput.Role.CRITIC, 2, r2_crit)
        crit2_text = r2_crit.get("argument", "")

        # ── Round 3: Advocate rebuttal ────────────────────────────────────────
        debate.status = Debate.Status.ROUND_3
        debate.save()
        push_status(debate_id, "advocate", "Round 3 – Rebutting Critic...")

        r3_adv = advocate_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
            "critic_argument": crit2_text,
            "previous_rounds": [
                {"role": "advocate", "round": 1, "text": adv1_text},
                {"role": "critic",   "round": 2, "text": crit2_text},
            ],
            "is_rebuttal": True,
            "round_number": 3,
        })
        _save_output(debate, AgentOutput.Role.ADVOCATE, 3, r3_adv)
        adv3_text = r3_adv.get("argument", "")

        # ── Round 4: Critic final rebuttal ────────────────────────────────────
        debate.status = Debate.Status.ROUND_4
        debate.save()
        push_status(debate_id, "critic", "Round 4 – Final rebuttal...")

        r4_crit = critic_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
            "advocate_argument": adv3_text,
            "previous_rounds": [
                {"role": "advocate", "round": 1, "text": adv1_text},
                {"role": "critic",   "round": 2, "text": crit2_text},
                {"role": "advocate", "round": 3, "text": adv3_text},
            ],
            "is_rebuttal": True,
            "round_number": 4,
        })
        _save_output(debate, AgentOutput.Role.CRITIC, 4, r4_crit)
        crit4_text = r4_crit.get("argument", "")

        # ── Judge ─────────────────────────────────────────────────────────────
        debate.status = Debate.Status.JUDGING
        debate.save()
        push_status(debate_id, "judge", "Reviewing all 4 rounds…")

        judge_result = judge_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "advocate_argument": adv1_text,
            "advocate_rebuttal": adv3_text,
            "critic_argument": crit2_text,
            "critic_rebuttal": crit4_text,
            "advocate_evidence_score": None,
            "critic_evidence_score":   None,
            "advocate_logic_score":    None,
            "critic_logic_score":      None,
            "verdict":   "",
            "analysis":  "",
            "error":     None,
        })

        AgentOutput.objects.create(
            debate=debate,
            role=AgentOutput.Role.JUDGE,
            round_number=1,
            content=judge_result.get("analysis", ""),
            advocate_score=judge_result.get("advocate_evidence_score"),
            critic_score=judge_result.get("critic_evidence_score"),
            advocate_logic_score=judge_result.get("advocate_logic_score"),
            critic_logic_score=judge_result.get("critic_logic_score"),
            verdict=judge_result.get("verdict", ""),
        )

        debate.status = Debate.Status.COMPLETED
        debate.save()

    except Exception as e:
        push_error(debate_id, "advocate", str(e))
        push_error(debate_id, "critic",   str(e))
        push_error(debate_id, "judge",    str(e))
        try:
            debate = Debate.objects.get(id=debate_id)
            debate.status = Debate.Status.FAILED
            debate.save()
        except Exception:
            pass
        raise self.retry(exc=e, countdown=5)