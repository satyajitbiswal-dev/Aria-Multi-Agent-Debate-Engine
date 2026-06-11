"""
advocate.py — LangGraph graph for the Advocate agent.

Flow:
  START → search_node → argue_node → END

search_node:  Uses web search to gather evidence FOR the topic.
argue_node:   Reasons over search results, builds structured argument,
              streams tokens back via Django Channels.
"""
import json
import re
from typing import TypedDict, Annotated, List, Optional
from django.conf import settings
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.tools.tavily_search import TavilySearchResults


# ── State schema ──────────────────────────────────────────────────────────────

class AdvocateState(TypedDict):
    debate_id: str
    topic: str
    search_results: List[dict]          # [{url, title, snippet}]
    argument: str                        # Final argument text
    citations: List[dict]               # [{index, url, title, snippet}]
    error: Optional[str]
    critic_argument: Optional[str]
    is_rebuttal: bool


# ── Tools ─────────────────────────────────────────────────────────────────────

# LangChain automatically picks up settings.TAVILY_API_KEY if passed,
# or you can pass it directly via the kwargs initialization.
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
            # Tavily returns 'url' and 'content'. 
            # We map 'content' -> 'snippet' to preserve your existing state schema.
            results.append({
                "url": item.get("url", ""),
                "title": item.get("title", "Web Source"), # Tavily list wrapper sometimes omits titles
                "snippet": item.get("content", ""),       # <-- CHANGED FROM 'body'/'snippet'
            })
    return results


# ── Nodes ─────────────────────────────────────────────────────────────────────

def search_node(state: AdvocateState) -> AdvocateState:
    """Search the web for evidence supporting the topic."""
    from agents.utils import push_status, push_citation

    topic = state["topic"]
    debate_id = state["debate_id"]
    is_rebuttal = state.get("is_rebuttal", False)

    if is_rebuttal:
        query = f"evidence supporting {topic} counter-arguments rebuttal"
        push_status(debate_id, "advocate", "Preparing rebuttal...")
    else:
        query = f"arguments in favor of: {topic}"
        push_status(debate_id, "advocate", "Searching the web...")

    try:
        # LangChain tools expect a dict context or raw string query passed to invoke()
        raw = search_tool.invoke({"query": query})
        results = _parse_search_results(raw)
    except Exception as e:
        results = []
        push_status(debate_id, "advocate", f"Search failed: {str(e)}. Reasoning from knowledge...")

    # Push citations to client as they're found
    citations = []
    for i, r in enumerate(results[:4], start=1):
        push_citation(debate_id, "advocate", i, r["url"], r["title"], r["snippet"])
        citations.append({"index": i, **r})

    return {**state, "search_results": results, "citations": citations}


def argue_node(state: AdvocateState) -> AdvocateState:
    """Build the argument using LLM, streaming tokens to WebSocket."""
    from agents.utils import push_status, push_token, push_done

    debate_id = state["debate_id"]
    topic = state["topic"]
    search_results = state.get("search_results", [])
    is_rebuttal = state.get("is_rebuttal", False)
    critic_argument = state.get("critic_argument", "")

    push_status(debate_id, "advocate", "Building argument..." if not is_rebuttal else "Writing rebuttal...")

    # Format search context
    context = "\n\n".join([
        f"[{i+1}] {r['title']}\n{r['snippet']}\nSource: {r['url']}"
        for i, r in enumerate(search_results[:4])
    ])

    if is_rebuttal:
        system_prompt = """You are a skilled debater arguing IN FAVOR of the given topic.
You are in the REBUTTAL round. The Critic has made their argument against the topic.
Your job is to:
1. Directly counter the Critic's specific points with evidence
2. Reinforce your strongest pro arguments
3. Cite your sources using [1], [2], [3] notation inline

Keep your rebuttal focused and under 200 words. Be sharp and specific."""

        user_prompt = f"""Topic: {topic}

Critic's argument you must rebut:
{critic_argument}

Supporting evidence from web search:
{context if context else "Use your knowledge to rebut."}

Write a concise, sharp rebuttal that directly addresses the Critic's points."""

    else:
        system_prompt = """You are a skilled debater arguing IN FAVOR of the given topic.
Your job is to:
1. Make 2-3 strong arguments supporting the topic
2. Cite your web search sources using [1], [2], [3] notation inline
3. Be persuasive but grounded in evidence

Keep your argument under 250 words. Use clear structure: make each point distinct."""

        user_prompt = f"""Topic: {topic}

Evidence from web search:
{context if context else "Use your knowledge to argue in favor."}

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


# ── Build graph ────────────────────────────────────────────────────────────────

def build_advocate_graph():
    graph = StateGraph(AdvocateState)
    graph.add_node("search", search_node)
    graph.add_node("argue", argue_node)
    graph.set_entry_point("search")
    graph.add_edge("search", "argue")
    graph.add_edge("argue", END)
    return graph.compile()


advocate_graph = build_advocate_graph()