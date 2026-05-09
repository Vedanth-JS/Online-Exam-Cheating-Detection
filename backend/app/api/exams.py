from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import base, models
from ..services import ai_service

router = APIRouter()

class ExamCreate(BaseModel):
    title: str
    description: str
    topic: str
    question_count: int
    duration_minutes: int

@router.post("/generate")
async def create_ai_exam(exam_data: ExamCreate, db: Session = Depends(base.get_db)):
    # 1. Generate questions via AI
    questions = await ai_service.generate_questions(exam_data.topic, exam_data.question_count)
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate questions")

    # 2. Create exam in DB
    new_exam = models.Exam(
        title=exam_data.title,
        description=exam_data.description,
        duration_minutes=exam_data.duration_minutes,
        config={"ai_generated": True, "topic": exam_data.topic}
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    # 3. Add questions to DB
    for q in questions:
        db_q = models.Question(
            exam_id=new_exam.id,
            text=q['text'],
            type="mcq",
            options=q['options'],
            correct_answer=q['correct_answer'],
            points=q.get('points', 1)
        )
        db.add(db_q)

    db.commit()
    return {"exam_id": new_exam.id, "question_count": len(questions)}

@router.get("/{exam_id}")
def get_exam(exam_id: int, db: Session = Depends(base.get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "questions": [
            {
                "id": q.id,
                "text": q.text,
                "options": q.options,
                "correct_answer": q.correct_answer
            } for q in exam.questions
        ]
    }
