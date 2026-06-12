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
    is_interactive_address: bool


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
    is_interactive = state.get("is_interactive_address", False)

    if is_interactive and user_stance:
        aligned = user_stance == "advocate"
        if aligned:
            system_prompt = """You are the Advocate speaking DIRECTLY to a human audience member who sided WITH you.
Your job:
1. Encourage and validate their choice — tell them they're on the right side
2. Strengthen their conviction with 2-3 sharp supporting points
3. Cite sources using [1], [2], [3] notation inline
Keep under 200 words. Be warm, confident, and personally engaging (use "you")."""
        else:
            system_prompt = """You are the Advocate speaking DIRECTLY to a human who sided with the CRITIC.
Your job:
1. Respectfully acknowledge their position
2. Try to persuade them to reconsider with 2-3 compelling counter-points
3. Cite sources using [1], [2], [3] notation inline
Keep under 200 words. Be persuasive but not condescending (use "you")."""

        user_prompt = f"""Topic: {topic}

Debate so far:
{history_text or 'See opening round above.'}

Evidence:
{context or 'Use your knowledge.'}

Address the human listener directly based on which side they chose."""

    elif is_rebuttal:
        system_prompt = """You are a skilled debater arguing IN FAVOR of the given topic.
This is a REBUTTAL round. The Critic has attacked your position.
Your job:
1. Directly counter each of the Critic's specific points with evidence
2. Reinforce your strongest arguments from earlier rounds
3. Cite sources using [1], [2], [3] notation inline
Keep your rebuttal under 220 words. Be sharp, specific, and don't repeat yourself."""
        if user_stance:
            if user_stance == "advocate":
                system_prompt += "\n\nA human audience member sided WITH you — briefly encourage them while rebutting."
            else:
                system_prompt += "\n\nA human sided with the Critic — try to persuade them while rebutting."

        user_prompt = f"""Topic: {topic}

Debate history so far:
{history_text}

Critic's argument you must rebut:
{critic_argument}

Supporting evidence:
{context or 'Use your knowledge.'}

Write a focused rebuttal that directly counters the Critic's points."""

    else:
        system_prompt = """You are a skilled debater arguing IN FAVOR of the given topic.
Your job:
1. Make 2-3 strong arguments supporting the topic
2. Cite sources using [1], [2], [3] notation inline
3. Be persuasive but grounded in evidence
Keep your argument under 250 words. Be direct and structured."""

        user_prompt = f"""Topic: {topic}

Evidence from web search:
{context or 'Use your knowledge to argue in favor.'}

Argue clearly and persuasively IN FAVOR of this topic, citing sources inline."""

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