"""
tasks.py — Celery tasks for the full debate pipeline.

Pipeline:
  run_debate(debate_id)
    → chord([run_advocate.s(), run_critic.s()], run_judge.s())

Advocate and Critic run in PARALLEL (chord).
Judge runs as a callback AFTER both complete.
Rebuttal: after critic finishes, advocate fires a rebuttal task, then judge runs.
"""
import os
from celery import shared_task, chord


@shared_task(bind=True, max_retries=1)
def run_advocate(self, debate_id: str, is_rebuttal: bool = False, critic_argument: str = ""):
    """Run the Advocate LangGraph agent."""
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate, AgentOutput
    from agents.advocate import advocate_graph

    try:
        debate = Debate.objects.get(id=debate_id)

        result = advocate_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
            "critic_argument": critic_argument,
            "is_rebuttal": is_rebuttal,
        })

        round_number = 2 if is_rebuttal else 1

        # Save output to DB
        output = AgentOutput.objects.create(
            debate=debate,
            role=AgentOutput.Role.ADVOCATE,
            round_number=round_number,
            content=result.get("argument", ""),
        )

        # Save citations
        from debates.models import Citation
        for c in result.get("citations", []):
            Citation.objects.create(
                agent_output=output,
                url=c.get("url", ""),
                title=c.get("title", ""),
                snippet=c.get("snippet", ""),
                index=c.get("index", 1),
            )

        return {
            "role": "advocate",
            "argument": result.get("argument", ""),
            "round": round_number,
        }

    except Exception as e:
        from agents.utils import push_error
        push_error(debate_id, "advocate", str(e))
        raise self.retry(exc=e, countdown=3)


@shared_task(bind=True, max_retries=1)
def run_critic(self, debate_id: str):
    """Run the Critic LangGraph agent."""
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate, AgentOutput
    from agents.critic import critic_graph

    try:
        debate = Debate.objects.get(id=debate_id)

        result = critic_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "search_results": [],
            "argument": "",
            "citations": [],
            "error": None,
        })

        output = AgentOutput.objects.create(
            debate=debate,
            role=AgentOutput.Role.CRITIC,
            round_number=1,
            content=result.get("argument", ""),
        )

        from debates.models import Citation
        for c in result.get("citations", []):
            Citation.objects.create(
                agent_output=output,
                url=c.get("url", ""),
                title=c.get("title", ""),
                snippet=c.get("snippet", ""),
                index=c.get("index", 1),
            )

        return {
            "role": "critic",
            "argument": result.get("argument", ""),
        }

    except Exception as e:
        from agents.utils import push_error
        push_error(debate_id, "critic", str(e))
        raise self.retry(exc=e, countdown=3)


@shared_task(bind=True, max_retries=1)
def run_judge(self, results: list, debate_id: str):
    """
    Run the Judge agent.
    Called as chord callback — receives list of [advocate_result, critic_result].
    """
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate, AgentOutput
    from agents.judge import judge_graph
    from agents.utils import push_status

    try:
        debate = Debate.objects.get(id=debate_id)
        debate.status = Debate.Status.JUDGING
        debate.save()

        push_status(debate_id, "judge", "Reviewing both arguments...")

        # Extract arguments from chord results
        advocate_result = next((r for r in results if r and r.get("role") == "advocate" and r.get("round") == 1), {})
        critic_result = next((r for r in results if r and r.get("role") == "critic"), {})

        # Check for rebuttal output
        advocate_rebuttal_obj = AgentOutput.objects.filter(
            debate=debate, role=AgentOutput.Role.ADVOCATE, round_number=2
        ).first()
        advocate_rebuttal = advocate_rebuttal_obj.content if advocate_rebuttal_obj else ""

        result = judge_graph.invoke({
            "debate_id": debate_id,
            "topic": debate.topic,
            "advocate_argument": advocate_result.get("argument", ""),
            "advocate_rebuttal": advocate_rebuttal,
            "critic_argument": critic_result.get("argument", ""),
            "advocate_evidence_score": None,
            "critic_evidence_score": None,
            "advocate_logic_score": None,
            "critic_logic_score": None,
            "verdict": "",
            "analysis": "",
            "error": None,
        })

        # Save judge output
        AgentOutput.objects.create(
            debate=debate,
            role=AgentOutput.Role.JUDGE,
            round_number=1,
            content=result.get("analysis", ""),
            advocate_score=result.get("advocate_evidence_score"),
            critic_score=result.get("critic_evidence_score"),
            advocate_logic_score=result.get("advocate_logic_score"),
            critic_logic_score=result.get("critic_logic_score"),
            verdict=result.get("verdict", ""),
        )

        debate.status = Debate.Status.COMPLETED
        debate.save()

    except Exception as e:
        from agents.utils import push_error
        push_error(debate_id, "judge", str(e))
        try:
            debate = Debate.objects.get(id=debate_id)
            debate.status = Debate.Status.FAILED
            debate.save()
        except Exception:
            pass
        raise self.retry(exc=e, countdown=3)


@shared_task(bind=True)
def run_debate(self, debate_id: str):
    """
    Main orchestrator task.

    Phase 1: Advocate + Critic run in PARALLEL
    Phase 2: Advocate REBUTS Critic
    Phase 3: Judge evaluates all outputs
    """
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aria.settings")

    from debates.models import Debate
    from agents.utils import push_status

    debate = Debate.objects.get(id=debate_id)
    debate.status = Debate.Status.RUNNING
    debate.save()

    push_status(debate_id, "advocate", "Starting...")
    push_status(debate_id, "critic", "Starting...")
    push_status(debate_id, "judge", "Waiting for arguments...")

    # Phase 1: Run Advocate + Critic concurrently, then trigger the async rebuttal callback step
    chord(
        [run_advocate.s(debate_id), run_critic.s(debate_id)],
        rebuttal_then_judge.s(debate_id),
    ).apply_async()


@shared_task(bind=True)
def rebuttal_then_judge(self, phase_1_results: list, debate_id: str):
    """
    Called after Advocate + Critic both finish.
    Runs Phase 2 (Rebuttal) asynchronously, then chains into Phase 3 (Judge).
    """
    from debates.models import Debate
    from agents.utils import push_status

    debate = Debate.objects.get(id=debate_id)
    debate.status = Debate.Status.REBUTTAL
    debate.save()

    # Get Critic argument for rebuttal setup
    critic_result = next((r for r in phase_1_results if r and r.get("role") == "critic"), {})
    critic_argument = critic_result.get("argument", "")

    push_status(debate_id, "advocate", "Preparing rebuttal...")

    # We launch the rebuttal task asynchronously. 
    # The 'link' signature acts as a callback that triggers when the rebuttal concludes.
    run_advocate.apply_async(
        args=[debate_id],
        kwargs={"is_rebuttal": True, "critic_argument": critic_argument},
        link=run_judge_after_rebuttal.s(phase_1_results, debate_id)
    )


@shared_task
def run_judge_after_rebuttal(rebuttal_result: dict, phase_1_results: list, debate_id: str):
    """
    Intermediary callback helper to securely merge execution data lists 
    without resorting to blocking runtime processes like .get()
    """
    all_results = phase_1_results + [rebuttal_result]
    run_judge(all_results, debate_id)