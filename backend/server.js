const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const db = require('./db');

// ─── Gemini AI Setup ─────────────────────────────────────────────────────────
let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'your_gemini_api_key_here') {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized');
  } else {
    console.log('⚠️  No valid GEMINI_API_KEY — AI generation will use mock fallback');
  }
} catch (e) {
  console.warn('Gemini SDK not available, using mock fallback:', e.message);
}

// ─── Mock question bank for demo without API key ──────────────────────────────
const MOCK_QUESTION_BANKS = {
  default: [
    { text: 'Which keyword is used to declare a constant in JavaScript?', options: ['let', 'var', 'const', 'static'], correct_answer: 'const' },
    { text: 'What is the output of `typeof null` in JavaScript?', options: ['"null"', '"undefined"', '"object"', '"boolean"'], correct_answer: '"object"' },
    { text: 'Which HTTP method is idempotent?', options: ['POST', 'PATCH', 'DELETE', 'PUT'], correct_answer: 'PUT' },
    { text: 'What does SQL stand for?', options: ['Structured Query Language', 'Simple Query Logic', 'Standard Query List', 'Sequential Query Language'], correct_answer: 'Structured Query Language' },
    { text: 'Which data structure uses FIFO ordering?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correct_answer: 'Queue' },
    { text: 'What is the Big-O complexity of accessing an element in a hash map?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], correct_answer: 'O(1)' },
    { text: 'Which of the following is a NoSQL database?', options: ['MySQL', 'PostgreSQL', 'MongoDB', 'SQLite'], correct_answer: 'MongoDB' },
    { text: 'In React, what hook manages local component state?', options: ['useEffect', 'useContext', 'useRef', 'useState'], correct_answer: 'useState' },
    { text: 'What does CORS stand for?', options: ['Cross-Origin Resource Sharing', 'Cross-Object Reference Service', 'Client-Origin Routing System', 'Cached Object Response Strategy'], correct_answer: 'Cross-Origin Resource Sharing' },
    { text: 'Which protocol is used for secure web communication?', options: ['HTTP', 'FTP', 'SMTP', 'HTTPS'], correct_answer: 'HTTPS' },
  ]
};

async function generateQuestionsWithGemini(topic, count) {
  // Mock fallback helper
  const useMock = (reason) => {
    console.warn(`Using mock questions (${reason})`);
    const bank = MOCK_QUESTION_BANKS.default;
    const shuffled = [...bank].sort(() => Math.random() - 0.5);
    return { questions: shuffled.slice(0, Math.min(count, shuffled.length)), source: 'mock' };
  };

  if (!genAI) return useMock('no API key');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `Generate exactly ${count} multiple-choice questions on the topic: "${topic}".
Return ONLY a valid JSON array, no markdown, no code blocks, no explanation.
Each object must have these exact keys:
  "text": (string) the question,
  "options": (array of 4 strings) the answer choices,
  "correct_answer": (string) must exactly match one of the options.

Example format:
[{"text":"What is X?","options":["A","B","C","D"],"correct_answer":"A"}]`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const questions = JSON.parse(jsonStr);

    if (!Array.isArray(questions) || questions.length === 0) {
      return useMock('invalid Gemini response format');
    }
    return { questions, source: 'gemini' };
  } catch (err) {
    const reason = err.status === 429 ? 'rate limit exceeded' : err.message;
    console.warn(`Gemini call failed (${reason}), using mock fallback`);
    return useMock(reason);
  }
}

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active WebSocket connections for admin broadcasting
// Key: session_id, Value: ws connection
const activeStudentConnections = new Map();
const activeAdminConnections = new Set();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role'); // 'student' or 'admin'
  const sessionId = url.searchParams.get('sessionId');

  if (role === 'student' && sessionId) {
    activeStudentConnections.set(sessionId, ws);
    console.log(`Student connected for session: ${sessionId}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'event') {
          // Broadcast to all admins
          const eventData = JSON.stringify({
            type: 'student_event',
            sessionId,
            event: data.event
          });
          activeAdminConnections.forEach((adminWs) => {
            if (adminWs.readyState === WebSocket.OPEN) {
              adminWs.send(eventData);
            }
          });
        }
      } catch (err) {
        console.error('Invalid WS message', err);
      }
    });

    ws.on('close', () => {
      activeStudentConnections.delete(sessionId);
      console.log(`Student disconnected: ${sessionId}`);
      
      // Notify admin that student disconnected
      const eventData = JSON.stringify({
         type: 'student_event',
         sessionId,
         event: { event_type: 'websocket_disconnected', timestamp: new Date().toISOString() }
      });
      activeAdminConnections.forEach((adminWs) => {
         if (adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(eventData);
         }
      });
    });
  } else if (role === 'admin') {
    activeAdminConnections.add(ws);
    console.log('Admin connected');

    ws.on('close', () => {
      activeAdminConnections.delete(ws);
      console.log('Admin disconnected');
    });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// POST /api/session/start
app.post('/api/session/start', (req, res) => {
  const { student_id, exam_id } = req.body;
  const sessionId = require('crypto').randomUUID();
  
  db.run(`INSERT INTO sessions (id, student_id, exam_id) VALUES (?, ?, ?)`, 
    [sessionId, student_id, exam_id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ sessionId, student_id, exam_id });
    }
  );
});

// POST /api/event/log
app.post('/api/event/log', (req, res) => {
  const { session_id, event_type, metadata } = req.body;
  
  db.run(`INSERT INTO events (session_id, event_type, metadata) VALUES (?, ?, ?)`,
    [session_id, event_type, JSON.stringify(metadata || {})],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Broadcast event to all connected admins
      const eventData = JSON.stringify({
        type: 'student_event',
        sessionId: session_id,
        event: { event_type, metadata, timestamp: new Date().toISOString(), id: this.lastID }
      });
      activeAdminConnections.forEach((adminWs) => {
        if (adminWs.readyState === WebSocket.OPEN) {
          adminWs.send(eventData);
        }
      });
      
      res.json({ success: true, eventId: this.lastID });
    }
  );
});

// GET /api/exams/:id  ← NEW — matches what ExamPage.jsx calls
app.get('/api/exams/:id', (req, res) => {
  db.get(`SELECT * FROM exams WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });

    let questions = [];
    try {
      questions = JSON.parse(row.questions_json);
    } catch (_) {
      questions = [];
    }

    res.json({
      id: row.id,
      title: row.title,
      description: row.description || '',
      duration_minutes: row.duration,
      questions,
    });
  });
});

// GET /api/exam/:id  ← keep for backward compat
app.get('/api/exam/:id', (req, res) => {
  db.get(`SELECT * FROM exams WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });
    res.json(row);
  });
});

// POST /api/exams/generate  ← NEW — Admin AI exam generation
app.post('/api/exams/generate', async (req, res) => {
  const { title, description, topic, question_count = 5, duration_minutes = 60 } = req.body;

  if (!topic || !title) {
    return res.status(400).json({ error: 'topic and title are required' });
  }

  try {
    const { questions, source } = await generateQuestionsWithGemini(topic, question_count);
    const questionsJson = JSON.stringify(questions);
    const examDescription = description || `AI-generated exam on ${topic}.`;
    const isAI = source === 'gemini';

    db.run(
      `INSERT INTO exams (title, description, duration, questions_json) VALUES (?, ?, ?, ?)`,
      [title, examDescription, duration_minutes, questionsJson],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          exam_id: this.lastID,
          title,
          description: examDescription,
          duration_minutes,
          question_count: questions.length,
          source,
          message: isAI
            ? `✨ Exam generated with Gemini AI (${questions.length} questions)`
            : `📋 Exam created with sample questions (Gemini rate limit — try again in 1 min)`
        });
      }
    );
  } catch (err) {
    console.error('Exam generation error:', err);
    res.status(500).json({ error: 'Failed to generate exam: ' + err.message });
  }
});

// GET /api/sessions/active
app.get('/api/sessions/active', (req, res) => {
  // Return all sessions that haven't ended
  db.all(`SELECT s.*, st.name as student_name, e.title as exam_title 
          FROM sessions s 
          JOIN students st ON s.student_id = st.id 
          JOIN exams e ON s.exam_id = e.id 
          WHERE s.ended_at IS NULL`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Add real-time connected status
    const result = rows.map(r => ({
       ...r,
       is_connected: activeStudentConnections.has(r.id)
    }));
    res.json(result);
  });
});

// POST /api/session/end
app.post('/api/session/end', (req, res) => {
  const { session_id } = req.body;
  
  db.run(`UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [session_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC`, [session_id], (err, events) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Score-based risk calculation
      let riskScore = 0;
      let verdict = 'Clean';
      
      const suspiciousEvents = events.filter(e => 
        ['tab_switch', 'focus_lost', 'face_missing', 'multiple_faces', 'copy_paste_attempt'].includes(e.event_type)
      );
      
      if (suspiciousEvents.length > 5) {
        riskScore = Math.min(100, 50 + suspiciousEvents.length * 10);
        verdict = 'High Risk';
      } else if (suspiciousEvents.length > 0) {
        riskScore = suspiciousEvents.length * 10;
        verdict = 'Suspicious';
      }
      
      const report = {
        verdict,
        risk_score: riskScore,
        summary: `The AI analysed the session and found ${suspiciousEvents.length} suspicious events. Overall integrity is ${verdict}.`,
        flagged_events: suspiciousEvents
      };
      
      db.run(`UPDATE sessions SET risk_score = ?, verdict = ?, report_json = ? WHERE id = ?`,
        [riskScore, verdict, JSON.stringify(report), session_id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          
          // Notify admin of completed session
          const eventData = JSON.stringify({
            type: 'session_ended',
            sessionId: session_id,
            report
          });
          activeAdminConnections.forEach((adminWs) => {
            if (adminWs.readyState === WebSocket.OPEN) {
              adminWs.send(eventData);
            }
          });
          
          res.json({ success: true, report });
        }
      );
    });
  });
});

// GET /api/report/:session_id
app.get('/api/report/:session_id', (req, res) => {
  db.get(`SELECT s.*, st.name as student_name, e.title as exam_title 
          FROM sessions s
          JOIN students st ON s.student_id = st.id
          JOIN exams e ON s.exam_id = e.id
          WHERE s.id = ?`, [req.params.session_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Report not found' });
    
    db.all(`SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC`, [req.params.session_id], (err, events) => {
       if (err) return res.status(500).json({ error: err.message });
       
       res.json({
          session: row,
          report: row.report_json ? JSON.parse(row.report_json) : null,
          events
       });
    });
  });
});

// POST /api/admin/broadcast
app.post('/api/admin/broadcast', (req, res) => {
  const { session_id, message } = req.body;
  const studentWs = activeStudentConnections.get(session_id);
  
  if (studentWs && studentWs.readyState === WebSocket.OPEN) {
    studentWs.send(JSON.stringify({ type: 'admin_warning', message }));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Student not connected' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ExamGuard server listening on port ${PORT}`);
});
