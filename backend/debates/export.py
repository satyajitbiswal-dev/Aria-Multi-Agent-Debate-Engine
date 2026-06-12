"""
export.py — Generate a PDF transcript of a completed debate using reportlab.

Called from DebateExportView. Returns a BytesIO buffer ready to stream.
"""

from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Colour palette ─────────────────────────────────────────────────────────────
RED    = colors.HexColor("#ef4444")
BLUE   = colors.HexColor("#3b82f6")
GREEN  = colors.HexColor("#22c55e")
DARK   = colors.HexColor("#111827")
GRAY   = colors.HexColor("#6b7280")
LIGHT  = colors.HexColor("#f3f4f6")
WHITE  = colors.white


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"],
            fontSize=22, textColor=WHITE, spaceAfter=4,
            alignment=TA_CENTER, fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"],
            fontSize=11, textColor=colors.HexColor("#d1d5db"),
            alignment=TA_CENTER, spaceAfter=2,
        ),
        "topic": ParagraphStyle(
            "topic", parent=base["Normal"],
            fontSize=13, textColor=WHITE,
            alignment=TA_CENTER, fontName="Helvetica-Bold", spaceAfter=0,
        ),
        "section_header": ParagraphStyle(
            "section_header", parent=base["Normal"],
            fontSize=12, fontName="Helvetica-Bold", spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=10, textColor=DARK, leading=15, spaceAfter=6,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"],
            fontSize=8, textColor=GRAY, spaceAfter=2,
        ),
        "verdict": ParagraphStyle(
            "verdict", parent=base["Normal"],
            fontSize=11, textColor=DARK, leading=16,
            fontName="Helvetica-BoldOblique", spaceAfter=0,
        ),
    }


def _cover_table(topic: str, created_at: str) -> Table:
    s = _styles()
    data = [[
        Paragraph("⚡ ARIA — Debate Transcript", s["title"]),
    ], [
        Paragraph(f'"{topic}"', s["topic"]),
    ], [
        Paragraph(f"Generated {created_at}", s["subtitle"]),
    ]]
    t = Table(data, colWidths=[17 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e40af")),
        ("TOPPADDING",    (0, 0), (-1, 0),  18),
        ("BOTTOMPADDING", (0, 2), (-1, 2),  18),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
        ("ROUNDEDCORNERS", [6]),
    ]))
    return t


def _agent_block(role: str, content: str, round_label: str, citations) -> list:
    s = _styles()
    colour_map = {
        "advocate": (RED,   colors.HexColor("#fef2f2"),   "🔴 Advocate"),
        "critic":   (BLUE,  colors.HexColor("#eff6ff"),   "🔵 Critic"),
        "judge":    (GREEN, colors.HexColor("#f0fdf4"),   "⚖️  Judge"),
    }
    accent, bg, label = colour_map.get(role, (GRAY, LIGHT, role.title()))

    header_data = [[Paragraph(f"<b>{label}</b> — {round_label}", ParagraphStyle(
        "ah", fontSize=11, fontName="Helvetica-Bold", textColor=WHITE,
    ))]]
    header = Table(header_data, colWidths=[17 * cm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), accent),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
    ]))

    body_para = Paragraph(content or "(no output)", ParagraphStyle(
        "ab", fontSize=10, textColor=DARK, leading=15,
        leftIndent=0, spaceAfter=0,
    ))
    body_data = [[body_para]]
    body_tbl = Table(body_data, colWidths=[17 * cm])
    body_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))

    elements = [KeepTogether([header, body_tbl])]

    # Citations
    if citations:
        elements.append(Spacer(1, 4))
        cite_rows = [[
            Paragraph("<b>Sources</b>", ParagraphStyle(
                "ch", fontSize=8, textColor=GRAY, fontName="Helvetica-Bold",
            ))
        ]]
        for c in citations:
            cite_rows.append([Paragraph(
                f"[{c.index}] <b>{c.title or c.url}</b><br/>"
                f"<font color='#6b7280'>{c.snippet[:120]}{'...' if len(c.snippet) > 120 else ''}</font>",
                ParagraphStyle("cb", fontSize=8, textColor=DARK, leading=12),
            )])
        ct = Table(cite_rows, colWidths=[17 * cm])
        ct.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 12),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.3, colors.HexColor("#e5e7eb")),
        ]))
        elements.append(ct)

    elements.append(Spacer(1, 14))
    return elements


def _scores_block(judge_output) -> list:
    if not judge_output:
        return []

    s = _styles()
    elements = []

    # Score table
    adv_ev  = judge_output.advocate_score or 0
    crit_ev = judge_output.critic_score or 0
    adv_lg  = judge_output.advocate_logic_score or 0
    crit_lg = judge_output.critic_logic_score or 0
    adv_tot = (adv_ev + adv_lg) / 2
    crit_tot = (crit_ev + crit_lg) / 2
    winner  = "🔴 Advocate" if adv_tot >= crit_tot else "🔵 Critic"

    header_data = [[Paragraph("<b>⚖️  Scores</b>", ParagraphStyle(
        "sh", fontSize=11, fontName="Helvetica-Bold", textColor=WHITE,
    ))]]
    header = Table(header_data, colWidths=[17 * cm])
    header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GREEN),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
    ]))

    score_data = [
        ["", "Evidence", "Logic", "Overall"],
        ["🔴 Advocate", f"{adv_ev:.1f}/10",  f"{adv_lg:.1f}/10",  f"{adv_tot:.1f}/10"],
        ["🔵 Critic",   f"{crit_ev:.1f}/10", f"{crit_lg:.1f}/10", f"{crit_tot:.1f}/10"],
    ]
    st = Table(score_data, colWidths=[5*cm, 4*cm, 4*cm, 4*cm])
    st.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#f0fdf4")),
        ("BACKGROUND",    (0, 1), (-1, 1),  colors.HexColor("#fef2f2")),
        ("BACKGROUND",    (0, 2), (-1, 2),  colors.HexColor("#eff6ff")),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("GRID",          (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
    ]))

    elements.append(KeepTogether([header, st]))
    elements.append(Spacer(1, 10))

    # Winner banner
    winner_data = [[Paragraph(
        f"<b>Winner: {winner}</b>  (Overall {max(adv_tot, crit_tot):.1f}/10)",
        ParagraphStyle("wb", fontSize=11, textColor=WHITE, fontName="Helvetica-Bold"),
    )]]
    wt = Table(winner_data, colWidths=[17 * cm])
    wt.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#166534")),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
    ]))
    elements.append(wt)
    elements.append(Spacer(1, 10))

    # Verdict text
    if judge_output.verdict:
        elements.append(Paragraph("Verdict", ParagraphStyle(
            "vl", fontSize=9, textColor=GRAY, fontName="Helvetica-Bold", spaceAfter=4,
        )))
        elements.append(Paragraph(judge_output.verdict, s["verdict"]))

    return elements


def generate_debate_pdf(debate) -> BytesIO:
    """
    Takes a Debate model instance (with prefetched agent_outputs + citations).
    Returns a BytesIO PDF buffer.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Aria Debate — {debate.topic[:60]}",
    )

    elements = []
    created = debate.created_at.strftime("%d %B %Y, %H:%M UTC")

    # Cover
    elements.append(_cover_table(debate.topic, created))
    elements.append(Spacer(1, 20))

    # Organise outputs
    outputs = {
        (o.role, o.round_number): o
        for o in debate.agent_outputs.prefetch_related("citations").all()
    }

    # Round 1 — Advocate
    adv1 = outputs.get(("advocate", 1))
    if adv1:
        elements += _agent_block("advocate", adv1.content, "Initial Argument", adv1.citations.all())

    # Round 1 — Critic
    crit1 = outputs.get(("critic", 1))
    if crit1:
        elements += _agent_block("critic", crit1.content, "Counter-Argument", crit1.citations.all())

    # Round 2 — Advocate rebuttal
    adv2 = outputs.get(("advocate", 2))
    if adv2:
        elements += _agent_block("advocate", adv2.content, "Rebuttal", adv2.citations.all())

    # Scores
    judge = outputs.get(("judge", 1))
    if judge:
        elements += _scores_block(judge)
        if judge.content:
            elements.append(Spacer(1, 6))
            elements += _agent_block("judge", judge.content, "Analysis", [])

    # Footer note
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "Generated by Aria — Multi-Agent Debate Engine",
        ParagraphStyle("ft", fontSize=8, textColor=GRAY, alignment=TA_CENTER),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
