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


search_tool = TavilySearchResults(
    max_results=5,
    output_format="list",
    search_depth="advanced",
    tavily_api_key=settings.TAVILY_API_KEY
)


def _parse_search_results(raw) -> List[dict]:
    """Normalise Tavily results into [{url, title, snippet}]."""
    results = []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return []
    if isinstance(raw, list):
        for item in raw:
            results.append({
                "url": item.get("url", ""),
                "title": item.get("title", "Web Source"),
                "snippet": item.get("content", ""),  # Tavily uses 'content'
            })
    return results


def search_node(state: CriticState) -> CriticState:
    from agents.utils import push_status, push_citation

    topic = state["topic"]
    debate_id = state["debate_id"]
    query = f"arguments against: {topic} problems disadvantages criticism"

    push_status(debate_id, "critic", "Searching for counter-evidence...")

    try:
        raw = search_tool.invoke({"query": query})
        results = _parse_search_results(raw)
    except Exception:
        results = []
        push_status(debate_id, "critic", "Search failed, reasoning from knowledge...")

    citations = []
    for i, r in enumerate(results[:4], start=1):
        push_citation(debate_id, "critic", i, r["url"], r["title"], r["snippet"])
        citations.append({"index": i, **r})

    return {**state, "search_results": results, "citations": citations}


def argue_node(state: CriticState) -> CriticState:
    from agents.utils import push_status, push_token, push_done

    debate_id = state["debate_id"]
    topic = state["topic"]
    search_results = state.get("search_results", [])

    push_status(debate_id, "critic", "Building counter-argument...")

    context = "\n\n".join([
        f"[{i+1}] {r['title']}\n{r['snippet']}\nSource: {r['url']}"
        for i, r in enumerate(search_results[:4])
    ])

    system_prompt = """You are a skilled debater arguing AGAINST the given topic.
Your job is to:
1. Make 2-3 strong arguments opposing the topic
2. Cite your web search sources using [1], [2], [3] notation inline
3. Identify weaknesses and risks in the pro position
4. Be persuasive but grounded in evidence

Keep your argument under 250 words. Be direct and critical."""

    user_prompt = f"""Topic: {topic}

Evidence from web search:
{context if context else "Use your knowledge to argue against."}

Argue clearly and persuasively AGAINST this topic, citing sources inline."""

    llm = ChatOpenAI(
                     model="meta-llama/llama-3.3-70b-instruct", 
                     temperature=0.7, 
                     streaming=True,
                     openai_api_key=settings.OPENROUTER_API_KEY , 
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
    graph.add_node("argue", argue_node)
    graph.set_entry_point("search")
    graph.add_edge("search", "argue")
    graph.add_edge("argue", END)
    return graph.compile()


critic_graph = build_critic_graph()
