"""
judge.py — LangGraph graph for the Judge agent.

Receives both Advocate and Critic arguments (including rebuttal).
Scores on:
  - Evidence quality (0–10)
  - Logical coherence (0–10)
Delivers a final cited verdict.
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
    advocate_argument: str
    advocate_rebuttal: str
    critic_argument: str
    critic_rebuttal: str
    advocate_evidence_score: Optional[float]
    critic_evidence_score:   Optional[float]
    advocate_logic_score:    Optional[float]
    critic_logic_score:      Optional[float]
    verdict:  str
    analysis: str
    error:    Optional[str]


def evaluate_node(state: JudgeState) -> JudgeState:
    from agents.utils import push_status, push_token, push_score, push_done

    debate_id = state["debate_id"]
    topic     = state["topic"]

    push_status(debate_id, "judge", "Reading all 4 rounds…")

    full_advocate = f"Opening:\n{state.get('advocate_argument','')}"
    if state.get("advocate_rebuttal"):
        full_advocate += f"\n\nRound 3 Rebuttal:\n{state['advocate_rebuttal']}"

    full_critic = f"Opening:\n{state.get('critic_argument','')}"
    if state.get("critic_rebuttal"):
        full_critic += f"\n\nRound 4 Rebuttal:\n{state['critic_rebuttal']}"

    system_prompt = """You are an impartial debate judge evaluating a 4-round debate.

Score each side on:
1. Evidence Quality (0-10): Quality, relevance, and credibility of sources used
2. Logical Coherence (0-10): Clarity, structure, avoidance of fallacies

Consider ALL rounds including rebuttals. Reward effective counter-arguments.

CRITICAL: Respond ONLY in this exact JSON format:
{
  "advocate_evidence": <float 0-10>,
  "critic_evidence": <float 0-10>,
  "advocate_logic": <float 0-10>,
  "critic_logic": <float 0-10>,
  "verdict": "<one sentence: who won and why>",
  "analysis": "<2-3 sentences expanding on the verdict, citing specific strengths/weaknesses across all rounds>"
}"""

    user_prompt = f"""Topic: {topic}

ADVOCATE (argues FOR) — Rounds 1 & 3:
{full_advocate}

CRITIC (argues AGAINST) — Rounds 2 & 4:
{full_critic}

Evaluate both sides across all rounds. Return scores in the required JSON format."""

    llm = ChatOpenAI(
        model="meta-llama/llama-3.3-70b-instruct",
        temperature=0.2,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
    )

    try:
        push_status(debate_id, "judge", "Calculating scores…")
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        raw = response.content.strip()
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*",     "", raw)
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

    push_score(
        debate_id,
        advocate_evidence=advocate_evidence,
        critic_evidence=critic_evidence,
        advocate_logic=advocate_logic,
        critic_logic=critic_logic,
        verdict=verdict,
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
        "verdict":  verdict,
        "analysis": analysis,
    }


def build_judge_graph():
    graph = StateGraph(JudgeState)
    graph.add_node("evaluate", evaluate_node)
    graph.set_entry_point("evaluate")
    graph.add_edge("evaluate", END)
    return graph.compile()


judge_graph = build_judge_graph()