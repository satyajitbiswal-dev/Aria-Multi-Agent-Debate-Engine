"""
critic.py — LangGraph graph for the Critic agent.

Mirrors advocate.py exactly in structure.
Argues AGAINST the topic.
"""
import json
from typing import TypedDict, List, Optional
from django.conf import settings
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.tools.tavily_search import TavilySearchResults


class CriticState(TypedDict):
    debate_id: str
    topic: str
    search_results: List[dict]
    argument: str
    citations: List[dict]
    error: Optional[str]
    advocate_argument: Optional[str]
    previous_rounds: List[dict]   # [{role, round, text}]
    is_rebuttal: bool
    round_number: int
    user_stance: Optional[str]
    user_thought: Optional[str]
    is_interactive_address: bool


WORD_LIMIT = 120


search_tool = TavilySearchResults(
    max_results=5,
    output_format="list",
    search_depth="advanced",
    tavily_api_key=settings.TAVILY_API_KEY,
)


def _parse_search_results(raw) -> List[dict]:
    results = []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return []
    if isinstance(raw, list):
        for item in raw:
            results.append({
                "url":     item.get("url", ""),
                "title":   item.get("title", "Web Source"),
                "snippet": item.get("content", ""),
            })
    return results


def search_node(state: CriticState) -> CriticState:
    from agents.utils import push_status, push_citation

    topic      = state["topic"]
    debate_id  = state["debate_id"]
    round_num  = state.get("round_number", 2)
    is_rebuttal = state.get("is_rebuttal", False)

    if is_rebuttal:
        query = f"evidence against {topic} weaknesses problems criticism"
        push_status(debate_id, "critic", f"Round {round_num} – Searching for rebuttal evidence…")
    else:
        query = f"arguments against: {topic} problems disadvantages criticism"
        push_status(debate_id, "critic", f"Round {round_num} – Searching for counter-evidence…")

    try:
        raw = search_tool.invoke({"query": query})
        results = _parse_search_results(raw)
    except Exception:
        results = []
        push_status(debate_id, "critic", "Search failed, reasoning from knowledge…")

    citations = []
    for i, r in enumerate(results[:4], start=1):
        push_citation(debate_id, "critic", i, r["url"], r["title"], r["snippet"])
        citations.append({"index": i, **r})

    return {**state, "search_results": results, "citations": citations}


def argue_node(state: CriticState) -> CriticState:
    from agents.utils import push_status, push_token, push_done

    debate_id        = state["debate_id"]
    topic            = state["topic"]
    search_results   = state.get("search_results", [])
    is_rebuttal      = state.get("is_rebuttal", False)
    advocate_argument = state.get("advocate_argument", "")
    previous_rounds  = state.get("previous_rounds", [])
    round_num        = state.get("round_number", 2)

    push_status(debate_id, "critic", f"Round {round_num} – Writing argument…")

    context = "\n\n".join([
        f"[{i+1}] {r['title']}\n{r['snippet']}\nSource: {r['url']}"
        for i, r in enumerate(search_results[:4])
    ])

    history_text = ""
    if previous_rounds:
        history_text = "\n\n".join([
            f"=== Round {r['round']} — {r['role'].title()} ===\n{r['text']}"
            for r in previous_rounds
        ])

    user_stance = state.get("user_stance")
    user_thought = (state.get("user_thought") or "").strip()
    is_interactive = state.get("is_interactive_address", False)

    thought_block = ""
    if user_thought:
        thought_block = (
            f'\n\nThe human audience member wrote:\n"{user_thought}"\n'
            "Respond directly to their written thoughts — quote or reference their points."
        )

    limit = f"STRICT LIMIT: maximum {WORD_LIMIT} words. Never exceed {WORD_LIMIT} words."

    if is_interactive and user_stance:
        aligned = user_stance == "critic"
        if aligned:
            system_prompt = f"""You are the Critic speaking DIRECTLY to a human who sided WITH you.
Encourage them, validate their skepticism, and strengthen their conviction with evidence.
Cite [1], [2], [3] inline. Use "you". {limit}"""
        else:
            system_prompt = f"""You are the Critic speaking DIRECTLY to a human who sided with the ADVOCATE.
Acknowledge their view, then persuade them to reconsider with sharp objections.
Cite [1], [2], [3] inline. Use "you". {limit}"""

        user_prompt = f"""Topic: {topic}

Debate so far:
{history_text or 'See opening round above.'}

Counter-evidence:
{context or 'Use your knowledge.'}
{thought_block}

Address the human listener and try to convince them."""

    elif is_rebuttal:
        system_prompt = f"""You are a skilled debater arguing AGAINST the given topic.
Counter the Advocate's rebuttal with evidence. Cite [1], [2], [3] inline. {limit}"""
        if user_stance == "critic":
            system_prompt += "\nThe human sided WITH you — encourage them while rebutting."
        elif user_stance == "advocate":
            system_prompt += "\nThe human sided with the Advocate — persuade them while rebutting."

        user_prompt = f"""Topic: {topic}

Debate history:
{history_text}

Advocate's rebuttal:
{advocate_argument}

Counter-evidence:
{context or 'Use your knowledge.'}
{thought_block}

Write a focused rebuttal."""

    else:
        system_prompt = f"""You are a skilled debater arguing AGAINST the given topic.
Attack the Advocate's claims with 2-3 counter-arguments. Cite [1], [2], [3] inline. {limit}"""

        user_prompt = f"""Topic: {topic}

Advocate argued:
{advocate_argument}

Counter-evidence:
{context or 'Use your knowledge.'}
{thought_block}

Argue AGAINST this topic."""

    llm = ChatOpenAI(
        model="meta-llama/llama-3.3-70b-instruct",
        temperature=0.7,
        streaming=True,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1",
    )

    full_argument = ""
    try:
        for chunk in llm.stream([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]):
            token = chunk.content
            if token:
                push_token(debate_id, "critic", token)
                full_argument += token
    except Exception as e:
        error_msg = f"Agent error: {str(e)}"
        push_token(debate_id, "critic", error_msg)
        full_argument = error_msg

    push_done(debate_id, "critic")
    return {**state, "argument": full_argument}


def build_critic_graph():
    graph = StateGraph(CriticState)
    graph.add_node("search", search_node)
    graph.add_node("argue",  argue_node)
    graph.set_entry_point("search")
    graph.add_edge("search", "argue")
    graph.add_edge("argue",  END)
    return graph.compile()


critic_graph = build_critic_graph()