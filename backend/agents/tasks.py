"""
tasks.py — Configurable N-round debate pipeline.

1 round  = Adv(R1) → Crit(R1)
2 rounds = Adv(R1) → Crit(R1) → Adv(R2) → Crit(R2)   ← default
3 rounds = … → Adv(R3) → Crit(R3)
4 rounds = … → Adv(R4) → Crit(R4)

Then Judge evaluates all turns.
"""
import os
from celery import shared_task


def _save_output(debate, role_const, round_number, turn, result):
    from debates.models import AgentOutput, Citation
    output = AgentOutput.objects.create(
        debate=debate,
        role=role_const,
        round_number=round_number,
        turn=turn,
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


def _round_label(round_number: int, num_rounds: int) -> str:
    """Human label for a round number given total rounds."""
    if num_rounds == 1:
        return "Opening" if round_number == 1 else f"Round {round_number}"
    labels = {1: "Opening", num_rounds: "Closing"}
    return labels.get(round_number, f"Round {round_number}")


@shared_task(bind=True, max_retries=1)
def run_debate(self, debate_id: str):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate, AgentOutput
    from agents.advocate import advocate_graph
    from agents.critic import critic_graph
    from agents.judge import judge_graph
    from agents.utils import push_status, push_error, push_round_start

    try:
        debate = Debate.objects.get(id=debate_id)
        num_rounds = debate.num_rounds  # 1–4

        debate.status = Debate.Status.RUNNING
        debate.save()

        push_status(debate_id, "judge", "Waiting for all rounds…")

        previous_rounds = []   # [{role, round, turn, text}]

        # ── N rounds ────────────────────────────────────────────────────────
        for rn in range(1, num_rounds + 1):
            label = _round_label(rn, num_rounds)
            is_rebuttal = rn > 1

            # ── Advocate turn ────────────────────────────────────────────
            push_round_start(debate_id, "advocate", rn, label)
            push_status(debate_id, "advocate", f"{label} – Building argument…")

            critic_last = next(
                (r["text"] for r in reversed(previous_rounds) if r["role"] == "critic"), ""
            )

            adv_result = advocate_graph.invoke({
                "debate_id": debate_id,
                "topic": debate.topic,
                "search_results": [],
                "argument": "",
                "citations": [],
                "error": None,
                "critic_argument": critic_last,
                "previous_rounds": previous_rounds,
                "is_rebuttal": is_rebuttal,
                "round_number": rn,
            })
            _save_output(debate, AgentOutput.Role.ADVOCATE, rn, "advocate", adv_result)
            adv_text = adv_result.get("argument", "")
            previous_rounds.append({"role": "advocate", "round": rn, "turn": "advocate", "text": adv_text})

            # ── Critic turn ──────────────────────────────────────────────
            push_round_start(debate_id, "critic", rn, label)
            push_status(debate_id, "critic", f"{label} – Building counter-argument…")

            crit_result = critic_graph.invoke({
                "debate_id": debate_id,
                "topic": debate.topic,
                "search_results": [],
                "argument": "",
                "citations": [],
                "error": None,
                "advocate_argument": adv_text,
                "previous_rounds": previous_rounds,
                "is_rebuttal": is_rebuttal,
                "round_number": rn,
            })
            _save_output(debate, AgentOutput.Role.CRITIC, rn, "critic", crit_result)
            crit_text = crit_result.get("argument", "")
            previous_rounds.append({"role": "critic", "round": rn, "turn": "critic", "text": crit_text})

        # ── Judge ────────────────────────────────────────────────────────────
        debate.status = Debate.Status.JUDGING
        debate.save()
        push_status(debate_id, "judge", f"Reviewing all {num_rounds} round(s)…")

        # Build full transcript for judge
        adv_turns  = [r for r in previous_rounds if r["role"] == "advocate"]
        crit_turns = [r for r in previous_rounds if r["role"] == "critic"]

        advocate_full = "\n\n".join(
            f"[{_round_label(r['round'], num_rounds)}]\n{r['text']}" for r in adv_turns
        )
        critic_full = "\n\n".join(
            f"[{_round_label(r['round'], num_rounds)}]\n{r['text']}" for r in crit_turns
        )

        judge_result = judge_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "advocate_full": advocate_full,
            "critic_full": critic_full,
            "num_rounds": num_rounds,
            "advocate_evidence_score": None,
            "critic_evidence_score":   None,
            "advocate_logic_score":    None,
            "critic_logic_score":      None,
            "verdict":  "",
            "analysis": "",
            "error":    None,
        })

        AgentOutput.objects.create(
            debate=debate,
            role=AgentOutput.Role.JUDGE,
            round_number=1,
            turn="judge",
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
        for role in ("advocate", "critic", "judge"):
            push_error(debate_id, role, str(e))
        try:
            debate = Debate.objects.get(id=debate_id)
            debate.status = Debate.Status.FAILED
            debate.save()
        except Exception:
            pass
        raise self.retry(exc=e, countdown=5)
