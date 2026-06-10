"""
judge.py — LangGraph graph for the Judge agent.

Receives both Advocate and Critic arguments (including rebuttal).
Scores on:
  - Evidence quality (0–10)
  - Logical coherence (0–10)
Delivers a final cited verdict.
"""

import re
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage


class JudgeState(TypedDict):
    debate_id: str
    topic: str
    advocate_argument: str
    advocate_rebuttal: str
    critic_argument: str
    # Scores (populated by judge)
    advocate_evidence_score: Optional[float]
    critic_evidence_score: Optional[float]
    advocate_logic_score: Optional[float]
    critic_logic_score: Optional[float]
    verdict: str
    analysis: str
    error: Optional[str]


def evaluate_node(state: JudgeState) -> JudgeState:
    from agents.utils import push_status, push_token, push_score, push_done

    debate_id = state["debate_id"]
    topic = state["topic"]
    advocate_argument = state.get("advocate_argument", "")
    advocate_rebuttal = state.get("advocate_rebuttal", "")
    critic_argument = state.get("critic_argument", "")

    push_status(debate_id, "judge", "Evaluating both sides...")

    full_advocate = advocate_argument
    if advocate_rebuttal:
        full_advocate += f"\n\n[REBUTTAL]\n{advocate_rebuttal}"

    system_prompt = """You are an impartial debate judge. You must evaluate two sides of a debate.

Evaluate each side on:
1. Evidence Quality (0-10): Quality, relevance, and credibility of sources and data used
2. Logical Coherence (0-10): Clarity of reasoning, avoidance of fallacies, structure

Then provide a verdict: which side made the stronger overall case, and why in 2-3 sentences.

CRITICAL: You MUST respond in EXACTLY this JSON format, nothing else:
{
  "advocate_evidence": <float 0-10>,
  "critic_evidence": <float 0-10>,
  "advocate_logic": <float 0-10>,
  "critic_logic": <float 0-10>,
  "verdict": "<one sentence: who won and why>",
  "analysis": "<2-3 sentences expanding on the verdict, citing specific strengths/weaknesses>"
}"""

    user_prompt = f"""Topic: {topic}

ADVOCATE (argues FOR):
{full_advocate}

CRITIC (argues AGAINST):
{critic_argument}

Evaluate both sides and return your scores in the required JSON format."""

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    try:
        push_status(debate_id, "judge", "Calculating scores...")
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        raw = response.content.strip()

        # Strip markdown fences if present
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)

        import json
        scores = json.loads(raw)

        advocate_evidence = float(scores.get("advocate_evidence", 5.0))
        critic_evidence = float(scores.get("critic_evidence", 5.0))
        advocate_logic = float(scores.get("advocate_logic", 5.0))
        critic_logic = float(scores.get("critic_logic", 5.0))
        verdict = scores.get("verdict", "Both sides made compelling arguments.")
        analysis = scores.get("analysis", "")

    except Exception as e:
        # Fallback if JSON parsing fails
        advocate_evidence = critic_evidence = advocate_logic = critic_logic = 5.0
        verdict = "Both sides made valid arguments. Unable to determine a clear winner."
        analysis = str(e)

    # Push scores to the judge WebSocket panel
    push_score(
        debate_id,
        advocate_evidence=advocate_evidence,
        critic_evidence=critic_evidence,
        advocate_logic=advocate_logic,
        critic_logic=critic_logic,
        verdict=verdict,
    )

    # Stream the analysis text
    push_status(debate_id, "judge", "Writing analysis...")
    for word in analysis.split():
        push_token(debate_id, "judge", word + " ")

    push_done(debate_id, "judge")

    return {
        **state,
        "advocate_evidence_score": advocate_evidence,
        "critic_evidence_score": critic_evidence,
        "advocate_logic_score": advocate_logic,
        "critic_logic_score": critic_logic,
        "verdict": verdict,
        "analysis": analysis,
    }


def build_judge_graph():
    graph = StateGraph(JudgeState)
    graph.add_node("evaluate", evaluate_node)
    graph.set_entry_point("evaluate")
    graph.add_edge("evaluate", END)
    return graph.compile()


judge_graph = build_judge_graph()
