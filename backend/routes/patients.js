const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { calculateRisk } = require("../utils/riskCalculator");

const DB_PATH = path.join(__dirname, "../data/db.json");

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

// POST /api/patients/:id/responses
router.post("/:id/responses", (req, res) => {
  const db = readDB();
  const patient = db.patients.find((p) => p.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const { pain, fever, redness, discharge } = req.body;
  if (pain === undefined || !fever || !redness || !discharge) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const risk = calculateRisk({ pain, fever, redness, discharge });
  const newResponse = {
    id: `r${req.params.id}-${Date.now()}`,
    patientId: req.params.id,
    date: new Date().toISOString().split("T")[0],
    pain: Number(pain),
    fever,
    redness,
    discharge,
    risk,
  };

  db.responses.push(newResponse);

  const patientIndex = db.patients.findIndex((p) => p.id === req.params.id);
  db.patients[patientIndex].latestRisk = risk;

  writeDB(db);
  res.status(201).json(newResponse);
});

module.exports = router;
