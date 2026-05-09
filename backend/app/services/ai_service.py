import google.generativeai as genai
import os
import json

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

async def generate_questions(topic: str, count: int = 5, difficulty: str = "medium"):
    prompt = f"""
    Generate {count} multiple choice questions about {topic} at a {difficulty} level.
    Format the output strictly as a JSON array of objects without any markdown formatting.
    [
        {{
            "text": "Question text?",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "A",
            "points": 1
        }}
    ]
    """
    response = model.generate_content(prompt)
    try:
        text = response.text
        # Clean markdown code blocks if Gemini ignores the prompt
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        start = text.find('[')
        end = text.rfind(']') + 1
        return json.loads(text[start:end])
    except Exception as e:
        print(f"Error generating questions: {e}")
        return []

async def score_subjective_answer(question: str, user_answer: str, rubric: str = ""):
    prompt = f"""
    Question: {question}
    User Answer: {user_answer}
    Rubric: {rubric}
    Score the answer out of 10 and provide a brief feedback. 
    Format: {{"score": 8, "feedback": "Good explanation but missed X."}}
    """
    response = model.generate_content(prompt)
    try:
        text = response.text
        start = text.find('{')
        end = text.rfind('}') + 1
        return json.loads(text[start:end])
    except Exception:
        return {"score": 0, "feedback": "Failed to evaluate."}
