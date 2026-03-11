# ExamGuard: AI-Powered Online Exam Proctoring System

ExamGuard is a full-stack automated proctoring solution designed to detect and deter academic dishonesty during online examinations. It uses real-time AI face detection, tab activity monitoring, and WebSocket-based live alerts to ensure exam integrity.

## 🚀 Features

- **Real-time AI Monitoring**: Uses TensorFlow.js (BlazeFace) to track the student's face via webcam. Detects face missing or multiple faces.
- **Cheating Detection Hierarchy**:
  - **Tab Switching**: Detects when the student switches away from the exam tab.
  - **Focus Loss**: Detects when the browser window loses focus.
  - **Copy-Paste Block**: Block `Ctrl+C`, `Ctrl+V`, and other common shortcuts.
  - **Context Menu Block**: Disables right-click to prevent unauthorized inspections.
- **Admin Dashboard**:
  - **Live Feed**: Monitor active sessions in real-time via WebSockets.
  - **Broadcast Warnings**: Admins can send targeted warning messages to students.
  - **Automated Reports**: Generates an integrity report with a "Risk Score" and "Severity Heatmap".
- **Responsive UI**: A modern, premium deep navy and red alert aesthetic built with Tailwind CSS.

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, WebSocket (`ws`), SQLite3
- **Frontend**: React 18, Vite, Tailwind CSS, TensorFlow.js (BlazeFace)

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd exam-system
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   ```

3. **Setup Frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

For the application to function correctly, both servers must be running simultaneously.

1. **Start Backend Server**:
   ```bash
   cd backend
   npm start
   ```
   The backend will start on `http://localhost:3000`.

2. **Start Frontend Dev Server**:
   ```bash
   cd frontend
   npm run dev -- --host 127.0.0.1
   ```
   The frontend will be available at `http://127.0.0.1:5173`.

## 📂 Project Structure

```text
exam-system/
├── backend/            # Express Node.js application
│   ├── db.js           # Database initialization and seeding
│   ├── server.js       # Main API and WebSocket server logic
│   └── database.sqlite # SQLite database file
└── frontend/           # React Vite application
    ├── src/
    │   ├── components/ # Shared UI components (Webcam, Timer, Alerts)
    │   ├── pages/      # Application pages (Home, Exam, Admin, Report)
    │   ├── App.jsx     # Main routing and layout
    │   └── index.css   # Main CSS with custom design system
    └── vite.config.js  # Vite configuration with proxy settings
```

## 📝 License

ISC License.
