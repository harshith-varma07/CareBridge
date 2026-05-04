# CareBridge AI

A hackathon-ready MVP for post-surgical wound infection monitoring combining a WhatsApp-style patient chat, AI wound image analysis, rule-based risk scoring, and a doctor dashboard.

## Project Layout

```
CareBridge/
├── frontend/          React + Vite SPA (port 5173)
├── backend/           Node.js + Express REST API (port 3001)
├── ai-service/        FastAPI AI inference microservice (port 8000)
└── ml-training/       PyTorch CNN training script
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, plain CSS |
| Backend | Node.js + Express, JSON flat-file DB |
| AI Service | FastAPI + uvicorn (Python 3.9+) |
| ML Training | PyTorch 2.x, NumPy |

---

## Getting Started

### 1 — Backend

```bash
cd backend
npm install
npm start
# ➜ http://localhost:3001
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
# ➜ http://localhost:5173
```

### 3 — AI Service *(optional but recommended)*

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# ➜ http://localhost:8000
```

Without the AI service the backend still works — image analysis is skipped gracefully and risk is calculated from symptoms alone.

### 4 — ML Training *(optional demo)*

```bash
cd ml-training
pip install -r requirements.txt
python train.py
# Generates wound_classifier.pt + class_mapping.json

# Copy trained weights to ai-service to enable real inference:
cp wound_classifier.pt ../ai-service/
```

After copying the model, restart the AI service — it will load the weights automatically.

---

## Features

- 🔐 **Login**: Doctor or Patient (pick from dropdown — no passwords in the MVP)
- 💬 **Patient Chat UI**: WhatsApp-style sequential check-in
  - Pain rating (0–10), Fever/Redness/Discharge (Yes/No)
  - **📷 Optional wound photo upload** → forwarded to AI service for analysis
- 🤖 **AI Image Inference**: FastAPI `/predict-image`
  - Mock mode (deterministic from image hash) by default
  - Real CNN mode when `wound_classifier.pt` is present
- 🚦 **Risk Aggregation** (backend):
  1. Rule-based from symptoms
  2. AI image inference (if image provided)
  3. Aggregate: take the higher of the two
  4. Trend escalation: YELLOW → RED when last 3 days are worsening
- 📝 **Explanation strings**: every response includes a plain-English risk rationale
- 🏥 **Doctor Dashboard**: patients sorted by risk, alert banner for RED
- 📊 **Patient Detail**: SVG pain chart, historical table with AI Image column + explanation rows

## Risk Rules

| Level | Conditions |
|-------|-----------|
| 🔴 RED | Fever = Yes **OR** Discharge = Yes **OR** Pain ≥ 8 |
| 🟡 YELLOW | Pain 5–7 **OR** Redness = Yes |
| 🟢 GREEN | Pain < 5 AND no fever / redness / discharge |

Image AI and trend analysis can escalate the final risk above the rule-based level.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List all patients with latest risk |
| GET | `/api/patients/:id` | Patient details + all responses |
| GET | `/api/patients/:id/responses` | All responses for a patient |
| POST | `/api/patients/:id/responses` | Submit daily check-in (multipart/form-data) |
| GET | `/api/health` | Backend health check |

### POST body fields (`multipart/form-data`)

| Field | Type | Required |
|-------|------|----------|
| `pain` | number 0–10 | ✅ |
| `fever` | `"Yes"` \| `"No"` | ✅ |
| `redness` | `"Yes"` \| `"No"` | ✅ |
| `discharge` | `"Yes"` \| `"No"` | ✅ |
| `image` | image file | ☐ optional |

### AI Service endpoint

```
POST http://localhost:8000/predict-image
Content-Type: multipart/form-data; boundary=…
field: file (image)

Response:
{
  "risk": "GREEN" | "YELLOW" | "RED",
  "confidence": 0.78,
  "explanation": "Wound image appears normal. No visible signs of infection detected."
}
```

## Demo Patients

| Patient | Surgery | Seed Risk |
|---------|---------|-----------|
| Alice Johnson | Appendectomy | 🟢 GREEN |
| Bob Smith | Knee Replacement | 🟡 YELLOW |
| Carol Davis | Abdominal Surgery | 🔴 RED |

## Data Flow

```
Patient (browser)
  └─ FormData (symptoms + optional image)
       └─▶ POST /api/patients/:id/responses   (Express backend)
                ├─ Rule-based risk          (riskCalculator.js)
                ├─ AI inference             (POST :8000/predict-image)
                ├─ Aggregate + trend        (riskCalculator.js)
                ├─ Build explanation string
                └─▶ JSON response with risk, imageRisk, explanation, trendAlert
                         └─▶ ChatUI displays result bubble
Doctor Dashboard
  └─ GET /api/patients  →  PatientCard list sorted by risk
  └─ GET /api/patients/:id  →  PatientDetail (chart + table with AI Image column)
```

## Extension Points

- **Real model**: replace `mock_predict` in `ai-service/main.py` with `_predict_with_model` — already wired, just copy `wound_classifier.pt`
- **Notifications**: add a `POST /api/alert` endpoint to trigger SMS/email when risk is RED
- **Auth**: swap the mock login with JWT + a real user store
- **Database**: replace `backend/data/db.json` with PostgreSQL/MongoDB — all DB access is isolated in route handlers
- **Multi-modal**: extend the chat with voice notes or video uploads

