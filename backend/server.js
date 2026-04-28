const express = require("express");
const cors = require("cors");
const patientsRouter = require("./routes/patients");
const responsesRouter = require("./routes/responses");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/api/patients", patientsRouter);
app.use("/api/responses", responsesRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`CareBridge backend running on http://localhost:${PORT}`);
});
