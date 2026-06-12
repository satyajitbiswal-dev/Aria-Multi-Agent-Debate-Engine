"""
judge.py — evaluates full transcript of N rounds.
"""
import re, json
from typing import TypedDict, Optional
from django.conf import settings
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage


class JudgeState(TypedDict):
    debate_id: str
    topic: str
    advocate_full: str    # all advocate turns concatenated with labels
    critic_full: str      # all critic turns concatenated with labels
    num_rounds: int
    advocate_evidence_score: Optional[float]
    critic_evidence_score:   Optional[float]
    advocate_logic_score:    Optional[float]
    critic_logic_score:      Optional[float]
    verdict:  str
    analysis: str
    error:    Optional[str]


def evaluate_node(state: JudgeState) -> JudgeState:
    from agents.utils import push_status, push_token, push_score, push_done

    debate_id  = state["debate_id"]
    num_rounds = state.get("num_rounds", 2)

    push_status(debate_id, "judge", f"Reading all {num_rounds} round(s)…")

    system_prompt = f"""You are an impartial debate judge evaluating a {num_rounds}-round debate.

Score each side on:
1. Evidence Quality (0-10): quality, relevance, and credibility of sources
2. Logical Coherence (0-10): clarity, structure, avoidance of fallacies

Consider ALL rounds. Reward effective counter-arguments and penalise repetition.

CRITICAL: Respond ONLY in this exact JSON format, nothing else:
{{
  "advocate_evidence": <float 0-10>,
  "critic_evidence": <float 0-10>,
  "advocate_logic": <float 0-10>,
  "critic_logic": <float 0-10>,
  "verdict": "<one sentence: who won and why>",
  "analysis": "<2-3 sentences citing specific strengths/weaknesses across all rounds>"
}}"""

    user_prompt = f"""Topic: {state['topic']}

ADVOCATE (argues FOR):
{state['advocate_full']}

CRITIC (argues AGAINST):
{state['critic_full']}

Evaluate both sides across all {num_rounds} round(s). Return JSON only."""

    llm = ChatOpenAI(
        model="meta-llama/llama-3.3-70b-instruct",
        temperature=0.2,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
    )

    try:
        push_status(debate_id, "judge", "Calculating scores…")
        response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
        raw = re.sub(r"```json\s*|```\s*", "", response.content.strip())
        scores = json.loads(raw)

        advocate_evidence = float(scores.get("advocate_evidence", 5.0))
        critic_evidence   = float(scores.get("critic_evidence",   5.0))
        advocate_logic    = float(scores.get("advocate_logic",    5.0))
        critic_logic      = float(scores.get("critic_logic",      5.0))
        verdict           = scores.get("verdict",  "Both sides made compelling arguments.")
        analysis          = scores.get("analysis", "")

    except Exception as e:
        advocate_evidence = critic_evidence = advocate_logic = critic_logic = 5.0
        verdict  = "Both sides made valid arguments. Unable to determine a clear winner."
        analysis = str(e)

    push_score(debate_id,
        advocate_evidence=advocate_evidence, critic_evidence=critic_evidence,
        advocate_logic=advocate_logic, critic_logic=critic_logic, verdict=verdict,
    )

    push_status(debate_id, "judge", "Writing analysis…")
    for word in analysis.split():
        push_token(debate_id, "judge", word + " ")

    push_done(debate_id, "judge")

    return {
        **state,
        "advocate_evidence_score": advocate_evidence,
        "critic_evidence_score":   critic_evidence,
        "advocate_logic_score":    advocate_logic,
        "critic_logic_score":      critic_logic,
        "verdict": verdict, "analysis": analysis,
    }


def build_judge_graph():
    graph = StateGraph(JudgeState)
    graph.add_node("evaluate", evaluate_node)
    graph.set_entry_point("evaluate")
    graph.add_edge("evaluate", END)
    return graph.compile()


judge_graph = build_judge_graph()
