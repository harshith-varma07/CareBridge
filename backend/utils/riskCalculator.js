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

module.exports = { calculateRisk };
