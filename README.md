# CareBridge SSI Monitor

A hospital tool to monitor post-surgical wound infections via a WhatsApp-style chat for patients and a doctor dashboard.

## Tech Stack
- **Frontend**: React + Vite (port 5173)
- **Backend**: Node.js + Express (port 3001)
- **Database**: JSON file (`backend/data/db.json`)

## Getting Started

### Backend
```bash
cd backend
npm install
npm start
# Runs on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Features
- 🔐 **Login Screen**: Doctor or Patient (select from dropdown)
- 💬 **Patient Chat UI**: WhatsApp-style daily check-in with sequential questions
- 🏥 **Doctor Dashboard**: Patient overview sorted by risk, with stats
- 📊 **Patient Detail**: Historical responses table + SVG pain chart
- 🚦 **Risk Scoring**:
  - 🔴 RED: fever = Yes OR discharge = Yes OR pain ≥ 8
  - 🟡 YELLOW: pain 5–7 OR redness = Yes
  - 🟢 GREEN: pain < 5 AND no fever/redness/discharge

## Demo Patients
| Patient | Surgery | Risk |
|---------|---------|------|
| Alice Johnson | Appendectomy | 🟢 GREEN |
| Bob Smith | Knee Replacement | 🟡 YELLOW |
| Carol Davis | Abdominal Surgery | 🔴 RED |

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List all patients with latest risk |
| GET | `/api/patients/:id` | Patient details + all responses |
| POST | `/api/patients/:id/responses` | Submit daily check-in |
| GET | `/api/patients/:id/responses` | Get all responses |
