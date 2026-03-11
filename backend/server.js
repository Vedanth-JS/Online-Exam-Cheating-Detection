const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const db = require('./db');

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

// API Routes
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

app.post('/api/event/log', (req, res) => {
  const { session_id, event_type, metadata } = req.body;
  
  db.run(`INSERT INTO events (session_id, event_type, metadata) VALUES (?, ?, ?)`,
    [session_id, event_type, JSON.stringify(metadata)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Optionally broadcast this event to admin
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

app.get('/api/exam/:id', (req, res) => {
  db.get(`SELECT * FROM exams WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Exam not found' });
    res.json(row);
  });
});

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

app.post('/api/session/end', (req, res) => {
  const { session_id } = req.body;
  
  db.run(`UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [session_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC`, [session_id], (err, events) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Mocked AI Report due to no API key
      let riskScore = 0;
      let verdict = 'Clean';
      
      const suspiciousEvents = events.filter(e => ['tab_switch', 'focus_lost', 'face_missing', 'multiple_faces', 'copy_paste_attempt'].includes(e.event_type));
      
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
        summary: `The AI analysed the session and found \${suspiciousEvents.length} suspicious events. Overall integrity is \${verdict}.`,
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
  console.log(`Server listening on port ${PORT}`);
});
