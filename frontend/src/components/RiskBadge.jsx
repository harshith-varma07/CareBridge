import React from "react";

const CONFIG = {
  RED: { bg: "#e74c3c", label: "🔴 HIGH RISK", text: "white" },
  YELLOW: { bg: "#f39c12", label: "🟡 MODERATE", text: "white" },
  GREEN: { bg: "#27ae60", label: "🟢 LOW RISK", text: "white" },
};

export default function RiskBadge({ risk, size = "medium" }) {
  const cfg = CONFIG[risk] || CONFIG.GREEN;
  const isRed = risk === "RED";
  const padding = size === "small" ? "3px 8px" : "5px 12px";
  const fontSize = size === "small" ? "11px" : "13px";

  return (
    <span
      className={isRed ? "badge-red" : ""}
      style={{
        display: "inline-block",
        background: cfg.bg,
        color: cfg.text,
        borderRadius: "20px",
        padding,
        fontSize,
        fontWeight: "700",
        letterSpacing: "0.3px",
      }}
    >
      {cfg.label}
    </span>
  );
}
