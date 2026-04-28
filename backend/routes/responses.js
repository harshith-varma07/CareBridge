const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

// GET /api/responses - get all responses
router.get("/", (req, res) => {
  const db = readDB();
  res.json(db.responses);
});

module.exports = router;
