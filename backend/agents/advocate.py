"""
advocate.py — LangGraph graph for the Advocate agent.

Flow:
  START → search_node → argue_node → END

search_node:  Uses web search to gather evidence FOR the topic.
argue_node:   Reasons over search results, builds structured argument,
              streams tokens back via Django Channels.
"""

import json
from typing import TypedDict, List, Optional
from django.conf import settings
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.tools.tavily_search import TavilySearchResults


class AdvocateState(TypedDict):
    debate_id: str
    topic: str
    search_results: List[dict]
    argument: str
    citations: List[dict]
    error: Optional[str]
    critic_argument: Optional[str]
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


def search_node(state: AdvocateState) -> AdvocateState:
    from agents.utils import push_status, push_citation

    topic      = state["topic"]
    debate_id  = state["debate_id"]
    round_num  = state.get("round_number", 1)
    is_rebuttal = state.get("is_rebuttal", False)

    if is_rebuttal:
        query = f"evidence supporting {topic} counter-arguments rebuttal"
        push_status(debate_id, "advocate", f"Round {round_num} – Searching for rebuttal evidence…")
    else:
        query = f"arguments in favor of: {topic}"
        push_status(debate_id, "advocate", f"Round {round_num} – Searching for evidence…")

    try:
        raw = search_tool.invoke({"query": query})
        results = _parse_search_results(raw)
    except Exception as e:
        results = []
        push_status(debate_id, "advocate", f"Search failed, reasoning from knowledge…")

    citations = []
    for i, r in enumerate(results[:4], start=1):
        push_citation(debate_id, "advocate", i, r["url"], r["title"], r["snippet"])
        citations.append({"index": i, **r})

    return {**state, "search_results": results, "citations": citations}


def argue_node(state: AdvocateState) -> AdvocateState:
    from agents.utils import push_status, push_token, push_done

    debate_id       = state["debate_id"]
    topic           = state["topic"]
    search_results  = state.get("search_results", [])
    is_rebuttal     = state.get("is_rebuttal", False)
    critic_argument = state.get("critic_argument", "")
    previous_rounds = state.get("previous_rounds", [])
    round_num       = state.get("round_number", 1)

    push_status(debate_id, "advocate", f"Round {round_num} – Writing argument…")

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
        aligned = user_stance == "advocate"
        if aligned:
            system_prompt = f"""You are the Advocate speaking DIRECTLY to a human who sided WITH you.
Encourage them, validate their choice, and strengthen their conviction with evidence.
Cite sources using [1], [2], [3] inline. Use "you". {limit}"""
        else:
            system_prompt = f"""You are the Advocate speaking DIRECTLY to a human who sided with the CRITIC.
Acknowledge their view, then persuade them to reconsider with sharp counter-points.
Cite sources using [1], [2], [3] inline. Use "you". {limit}"""

        user_prompt = f"""Topic: {topic}

Debate so far:
{history_text or 'See opening round above.'}

Evidence:
{context or 'Use your knowledge.'}
{thought_block}

Address the human listener and try to convince them."""

    elif is_rebuttal:
        system_prompt = f"""You are a skilled debater arguing IN FAVOR of the given topic.
Rebut the Critic's points with evidence. Cite [1], [2], [3] inline. {limit}"""
        if user_stance == "advocate":
            system_prompt += "\nThe human sided WITH you — encourage them while rebutting."
        elif user_stance == "critic":
            system_prompt += "\nThe human sided with the Critic — persuade them while rebutting."

        user_prompt = f"""Topic: {topic}

Debate history:
{history_text}

Critic's argument:
{critic_argument}

Evidence:
{context or 'Use your knowledge.'}
{thought_block}

Write a focused rebuttal."""

    else:
        system_prompt = f"""You are a skilled debater arguing IN FAVOR of the given topic.
Make 2-3 strong arguments. Cite [1], [2], [3] inline. {limit}"""

        user_prompt = f"""Topic: {topic}

Evidence:
{context or 'Use your knowledge.'}
{thought_block}

Argue IN FAVOR of this topic."""

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
                push_token(debate_id, "advocate", token)
                full_argument += token
    except Exception as e:
        error_msg = f"Agent error: {str(e)}"
        push_token(debate_id, "advocate", error_msg)
        full_argument = error_msg

    push_done(debate_id, "advocate")
    return {**state, "argument": full_argument}


def build_advocate_graph():
    graph = StateGraph(AdvocateState)
    graph.add_node("search", search_node)
    graph.add_node("argue",  argue_node)
    graph.set_entry_point("search")
    graph.add_edge("search", "argue")
    graph.add_edge("argue",  END)
    return graph.compile()


advocate_graph = build_advocate_graph()