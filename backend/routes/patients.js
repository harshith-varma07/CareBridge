const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const {
  calculateRisk,
  aggregateRisk,
  analyzeTrend,
  buildExplanation,
} = require("../utils/riskCalculator");

const DB_PATH = path.join(__dirname, "../data/db.json");

// AI service base URL — set AI_SERVICE_URL env var to override
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Store uploaded images in memory; never persisted to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// GET /api/patients
router.get("/", (req, res) => {
  const db = readDB();
  const patientsWithRisk = db.patients.map((p) => {
    const patientResponses = db.responses
      .filter((r) => r.patientId === p.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = patientResponses[0] || null;
    return {
      ...p,
      latestRisk: latest ? latest.risk : "GREEN",
      latestResponse: latest,
    };
  });
  res.json(patientsWithRisk);
});

// GET /api/patients/:id
router.get("/:id", (req, res) => {
  const db = readDB();
  const patient = db.patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const responses = db.responses
    .filter((r) => r.patientId === req.params.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({ ...patient, responses });
});

// GET /api/patients/:id/responses
router.get("/:id/responses", (req, res) => {
  const db = readDB();
  const responses = db.responses
    .filter((r) => r.patientId === req.params.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json(responses);
});

/**
 * POST /api/patients/:id/responses
 *
 * Accepts multipart/form-data with fields:
 *   pain       {number}  0-10
 *   fever      {string}  "Yes" | "No"
 *   redness    {string}  "Yes" | "No"
 *   discharge  {string}  "Yes" | "No"
 *   image      {file}    optional wound photo
 *
 * Data-flow:
 *   1. Rule-based risk from symptoms
 *   2. AI image inference (if image provided and AI service is reachable)
 *   3. Aggregate: take the higher of rule-based and image risk
 *   4. Trend analysis: escalate YELLOW → RED if last 3 check-ins are worsening
 *   5. Build explanation string
 */
router.post("/:id/responses", upload.single("image"), async (req, res) => {
  const db = readDB();
  const patient = db.patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const { pain, fever, redness, discharge } = req.body;
  if (pain === undefined || !fever || !redness || !discharge) {
    return res.status(400).json({ error: "Missing required fields: pain, fever, redness, discharge" });
  }

  // ── Step 1: rule-based risk ──────────────────────────────────────────────
  const ruleRisk = calculateRisk({ pain, fever, redness, discharge });

  // ── Step 2: AI image inference (optional) ────────────────────────────────
  let imageRisk = null;
  let imageExplanation = null;
  let imageConfidence = null;

  if (req.file) {
    try {
      const form = new FormData();
      form.append("file", req.file.buffer, {
        filename: req.file.originalname || "wound.jpg",
        contentType: req.file.mimetype,
      });
      const aiRes = await axios.post(`${AI_SERVICE_URL}/predict-image`, form, {
        headers: form.getHeaders(),
        timeout: 5000,
      });
      imageRisk = aiRes.data.risk;
      imageExplanation = aiRes.data.explanation;
      imageConfidence = aiRes.data.confidence;
    } catch (err) {
      // AI service is optional — log and continue without it
      console.warn("[backend] AI service unavailable:", err.message);
    }
  }

  // ── Step 3: aggregate worst risk ─────────────────────────────────────────
  const aggregatedRisk = aggregateRisk(ruleRisk, imageRisk);

  // ── Step 4: trend analysis ────────────────────────────────────────────────
  const priorResponses = db.responses
    .filter((r) => r.patientId === req.params.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const trend = analyzeTrend(priorResponses);

  // Escalate YELLOW → RED when the last 3 days show a worsening trend
  const finalRisk =
    trend.escalating && aggregatedRisk === "YELLOW" ? "RED" : aggregatedRisk;

  // ── Step 5: explanation string ────────────────────────────────────────────
  const explanation = buildExplanation({
    pain: Number(pain),
    fever,
    redness,
    discharge,
    ruleRisk,
    imageRisk,
    imageExplanation,
    imageConfidence,
    aggregatedRisk,
    finalRisk,
    trend,
  });

  const newResponse = {
    id: `r${req.params.id.replace("p", "")}-${Date.now()}`,
    patientId: req.params.id,
    date: new Date().toISOString().split("T")[0],
    pain: Number(pain),
    fever,
    redness,
    discharge,
    risk: finalRisk,
    imageRisk,
    imageExplanation,
    imageConfidence,
    trendAlert: trend.escalating,
    explanation,
  };

  db.responses.push(newResponse);

  const patientIndex = db.patients.findIndex((p) => p.id === req.params.id);
  db.patients[patientIndex].latestRisk = finalRisk;

  writeDB(db);
  res.status(201).json(newResponse);
});

module.exports = router;
