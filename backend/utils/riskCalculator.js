// Numeric ordering so we can compare risk levels easily
const RISK_ORDER = { GREEN: 0, YELLOW: 1, RED: 2 };

/** Rule-based risk from symptom answers. */
function calculateRisk({ pain, fever, redness, discharge }) {
  const painNum = Number(pain);
  if (fever === "Yes" || discharge === "Yes" || painNum >= 8) {
    return "RED";
  }
  if ((painNum >= 5 && painNum <= 7) || redness === "Yes") {
    return "YELLOW";
  }
  return "GREEN";
}

/**
 * Return the higher of two risk levels.
 * imageRisk may be null (no image submitted) — falls back to ruleRisk.
 */
function aggregateRisk(ruleRisk, imageRisk) {
  if (!imageRisk) return ruleRisk;
  return RISK_ORDER[imageRisk] > RISK_ORDER[ruleRisk] ? imageRisk : ruleRisk;
}

/**
 * Detect whether risk has been escalating over the last 3 check-ins.
 * @param {Array} responses – already sorted newest-first
 */
function analyzeTrend(responses) {
  if (responses.length < 3) return { escalating: false, message: null };
  const [r0, r1, r2] = responses.slice(0, 3).map((r) => RISK_ORDER[r.risk] ?? 0);
  // Escalating = risk went up on each of the last 2 steps (oldest→newest)
  const escalating = r0 > r1 && r1 >= r2;
  return {
    escalating,
    message: escalating
      ? "Risk has been escalating over the past 3 days."
      : null,
  };
}

/**
 * Build a human-readable explanation string for the final risk decision.
 */
function buildExplanation({ pain, fever, redness, discharge, ruleRisk, imageRisk,
  imageExplanation, imageConfidence, finalRisk, trend }) {
  const parts = [];

  // Symptom-driven reasons
  if (fever === "Yes") parts.push("fever reported");
  if (discharge === "Yes") parts.push("wound discharge reported");
  if (Number(pain) >= 8) parts.push(`high pain level (${pain}/10)`);
  if (redness === "Yes" && ruleRisk !== "RED") parts.push("wound redness noted");
  if (Number(pain) >= 5 && Number(pain) <= 7 && ruleRisk !== "RED")
    parts.push(`moderate pain (${pain}/10)`);

  let text = "";
  if (parts.length > 0) {
    text += `Symptom-based risk (${ruleRisk}): ${parts.join(", ")}. `;
  } else {
    text += `Symptom-based risk (${ruleRisk}): all clear. `;
  }

  if (imageRisk) {
    const pct = Math.round((imageConfidence || 0) * 100);
    text += `Image AI (${imageRisk}, ${pct}% confidence): ${imageExplanation || ""}. `;
  }

  if (trend && trend.escalating && trend.message) {
    text += `⚠️ Trend alert: ${trend.message} `;
  }

  const riskAdvice = {
    GREEN: "Recovery appears on track — keep following your care plan.",
    YELLOW: "Monitor closely. Contact your doctor if symptoms worsen.",
    RED: "Immediate medical attention is recommended.",
  };
  text += riskAdvice[finalRisk];

  return text.trim();
}

module.exports = { calculateRisk, aggregateRisk, analyzeTrend, buildExplanation };
