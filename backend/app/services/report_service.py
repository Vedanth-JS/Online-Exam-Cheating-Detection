"""
AI-powered report generation using Google Gemini + ReportLab PDF.
Uses GEMINI_API_KEY from settings (same key as exam generation).
"""
import io
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.session import ExamSession
from ..models.user import User
from ..models.violation import ViolationEvent, ViolationType

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Gemini AI Summary ────────────────────────────────────────────────────────

async def generate_ai_summary(session_id: str, db: AsyncSession) -> str:
    """
    Query violations for session_id, build structured prompt, call Gemini,
    and return the AI-generated proctoring report text.
    """
    # Fetch session + student info
    sess_result = await db.execute(
        select(ExamSession, User)
        .join(User, ExamSession.student_id == User.id)
        .where(ExamSession.id == session_id)
    )
    row = sess_result.first()
    if not row:
        return "Session not found."

    session, student = row

    duration_mins = 0
    if session.ended_at and session.started_at:
        duration_mins = int((session.ended_at - session.started_at).total_seconds() / 60)

    # Fetch all violations
    viol_result = await db.execute(
        select(ViolationEvent)
        .where(ViolationEvent.session_id == session_id)
        .order_by(ViolationEvent.created_at.asc())
    )
    violations = viol_result.scalars().all()

    if not violations:
        return (
            f"Session for {student.full_name} ({duration_mins} minutes) "
            f"completed with no violations detected. Risk assessment: LOW. "
            f"Recommendation: PASS."
        )

    # Build violation list for prompt
    violation_lines = []
    for v in violations:
        ts = v.created_at.strftime("%H:%M:%S")
        violation_lines.append(
            f"  - [{ts}] {v.type.value} violation (confidence: {v.confidence:.2f})"
        )

    prompt = f"""You are a proctoring AI analyst. Write a professional exam integrity report.

Session ID: {session_id}
Duration: {duration_mins} minutes
Student: {student.full_name}
Total Violations: {len(violations)}

Violations detected:
{chr(10).join(violation_lines)}

Provide a concise proctoring report with:
1. Risk Assessment: one of LOW / MEDIUM / HIGH / CRITICAL
2. Key Findings: 2-3 sentences summarizing patterns observed
3. Recommendation: one of PASS / FLAG_FOR_REVIEW / FAIL
4. Brief justification (1-2 sentences)

Keep the response under 400 words. Be precise and professional."""

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini report generation failed: {e}")
        # Fallback: build a structured summary without AI
        type_counts: dict[str, int] = {}
        for v in violations:
            type_counts[v.type.value] = type_counts.get(v.type.value, 0) + 1
        count = len(violations)
        risk = "LOW" if count <= 2 else "MEDIUM" if count <= 5 else "HIGH" if count <= 10 else "CRITICAL"
        rec = "PASS" if count <= 2 else "FLAG_FOR_REVIEW" if count <= 8 else "FAIL"
        breakdown_str = ", ".join(f"{k}: {v}" for k, v in type_counts.items())
        return (
            f"Risk Assessment: {risk}\n"
            f"Key Findings: {count} total violations detected — {breakdown_str}. "
            f"Review the timeline for patterns.\n"
            f"Recommendation: {rec}"
        )


# ─── PDF Report ───────────────────────────────────────────────────────────────

async def generate_pdf_report(session_id: str, db: AsyncSession) -> bytes:
    """
    Generate a full PDF report using ReportLab.
    Returns the PDF as bytes.
    """
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    # ── Fetch data ──
    sess_result = await db.execute(
        select(ExamSession, User)
        .join(User, ExamSession.student_id == User.id)
        .where(ExamSession.id == session_id)
    )
    row = sess_result.first()
    if not row:
        raise ValueError(f"Session {session_id} not found")

    session, student = row

    viol_result = await db.execute(
        select(ViolationEvent)
        .where(ViolationEvent.session_id == session_id)
        .order_by(ViolationEvent.created_at.asc())
    )
    violations = viol_result.scalars().all()

    ai_summary = await generate_ai_summary(session_id, db)
    exam_date = session.started_at.strftime("%Y-%m-%d %H:%M UTC")

    # ── Per-type breakdown ──
    type_data: dict[str, dict] = {t.value: {"count": 0, "conf_sum": 0.0} for t in ViolationType}
    for v in violations:
        type_data[v.type.value]["count"] += 1
        type_data[v.type.value]["conf_sum"] += v.confidence

    # ── Timeline: violations per minute ──
    minute_counts: dict[int, int] = {}
    start_ts = session.started_at
    for v in violations:
        minute = int((v.created_at - start_ts).total_seconds() // 60)
        minute_counts[minute] = minute_counts.get(minute, 0) + 1

    # ── Build PDF ──
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=16, spaceAfter=6)
    heading_style = ParagraphStyle("Heading2", parent=styles["Heading2"], fontSize=13, spaceBefore=12, spaceAfter=4)
    normal_style = styles["Normal"]
    normal_style = styles["Normal"]

    story = []

    # Header
    story.append(Paragraph("Proctoring Report", title_style))
    story.append(Paragraph(f"{student.full_name} — {exam_date}", styles["Heading3"]))
    story.append(Paragraph(f"Session ID: {session_id}", normal_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey, spaceAfter=10))

    # AI Summary
    story.append(Paragraph("AI Analysis Summary", heading_style))
    for line in ai_summary.split("\n"):
        if line.strip():
            story.append(Paragraph(line.strip(), normal_style))
            story.append(Spacer(1, 4))

    # Violation Breakdown Table
    story.append(Spacer(1, 10))
    story.append(Paragraph("Violation Breakdown", heading_style))

    table_data = [["Type", "Count", "Avg Confidence"]]
    for vtype, stats in type_data.items():
        count = stats["count"]
        avg_conf = (stats["conf_sum"] / count) if count > 0 else 0.0
        table_data.append([vtype, str(count), f"{avg_conf:.2f}"])

    table = Table(table_data, colWidths=[6 * cm, 3 * cm, 5 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE",    (0, 0), (-1, -1), 10),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)

    # Timeline Bar Chart (violations per minute)
    if minute_counts:
        story.append(Spacer(1, 14))
        story.append(Paragraph("Violation Timeline (per minute)", heading_style))

        max_minute = max(minute_counts.keys()) + 1
        bar_data = [minute_counts.get(i, 0) for i in range(max_minute)]

        drawing = Drawing(400, 150)
        chart = VerticalBarChart()
        chart.x = 30
        chart.y = 10
        chart.height = 120
        chart.width = 360
        chart.data = [bar_data]
        chart.bars[0].fillColor = colors.HexColor("#3b82f6")
        chart.categoryAxis.categoryNames = [str(i) for i in range(max_minute)]
        chart.categoryAxis.labels.boxAnchor = "ne"
        chart.categoryAxis.labels.angle = 30
        chart.categoryAxis.labels.dx = -8
        chart.categoryAxis.labels.dy = -2
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueStep = 1
        drawing.add(chart)
        story.append(drawing)

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph(
        f"Generated by ExamGuard AI — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("Footer", parent=normal_style, fontSize=8, textColor=colors.grey)
    ))

    doc.build(story)
    return buffer.getvalue()
