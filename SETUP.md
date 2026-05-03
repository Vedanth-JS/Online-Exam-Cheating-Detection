# Setup Instructions: Advanced AI Proctoring Platform

Follow these steps to deploy the production-ready assessment platform.

## 📋 Prerequisites
- **Docker & Docker Compose**
- **Google Gemini API Key** (Get it from [Google AI Studio](https://aistudio.google.com/))
- **Node.js 18+** (for local development)
- **Python 3.10+** (for local development)

## 🛠️ Step-by-Step Installation

### 1. Environment Configuration
Create a `.env` file in the root directory:
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=exam_db
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_URL=redis://redis:6379/0
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/exam_db
```

### 2. Launch with Docker Compose
Run the entire stack (Database, Redis, API, Celery Worker, Frontend):
```bash
docker-compose up --build
```
This will start:
- **FastAPI Backend**: `http://localhost:8000`
- **React Frontend**: `http://localhost:5173`
- **PostgreSQL**: Internal port `5432`
- **Redis**: Internal port `6379`

### 3. Database Migrations (Manual/First Time)
If you are running without Docker or need to initialize the DB manually:
```bash
cd backend
pip install -r requirements.txt
# The app will automatically create tables on first run via Base.metadata.create_all
```

## 🔐 Role-Based Access
- **Admin**: Access statistics and real-time violation feeds.
- **Examiner**: Generate exams using the Gemini AI Question Engine.
- **Candidate**: Take exams under browser lockdown and AI monitoring.

## 🚀 Key Features for Testing
1. **Lockdown Check**: Try switching tabs during an exam; the system will log a `medium` severity violation.
2. **AI Question Generation**: Navigate to `/exams/generate` to create a new exam on any topic using Gemini.
3. **Audio Check**: Speak loudly or play music to trigger the audio monitoring violation.
4. **Face Verification**: Cover your webcam or look away to trigger a `high` severity alert.

## 📄 License
Production-ready code provided under MIT License.
