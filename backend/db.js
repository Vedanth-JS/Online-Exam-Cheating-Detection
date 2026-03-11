const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create tables
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        duration INTEGER NOT NULL, -- in minutes
        questions_json TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, -- UUID
        student_id INTEGER,
        exam_id INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        risk_score INTEGER DEFAULT 0,
        verdict TEXT, -- 'Clean', 'Suspicious', 'High Risk'
        report_json TEXT, -- Claude AI report
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(exam_id) REFERENCES exams(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT DEFERRABLE INITIALLY DEFERRED,
        event_type TEXT NOT NULL, -- 'tab_switch', 'focus_lost', 'face_missing', 'multiple_faces', copy_paste_attempt etc.
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT, -- JSON string
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      )`);
      
      // Insert some seeded data for testing
      db.run(`INSERT OR IGNORE INTO exams (id, title, duration, questions_json) VALUES (
        1, 'Computer Science 101 Midterm', 60, '[{"id": 1, "text": "What does CPU stand for?", "type":"short_answer"}]'
      )`);
      db.run(`INSERT OR IGNORE INTO students (id, name, email) VALUES (
        1, 'Test Student', 'test@example.com'
      )`);
    });
  }
});

module.exports = db;
