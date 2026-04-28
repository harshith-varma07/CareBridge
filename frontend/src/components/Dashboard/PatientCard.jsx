import React from "react";
import RiskBadge from "../RiskBadge";

export default function PatientCard({ patient, onClick }) {
  const borderColor = { RED: "#e74c3c", YELLOW: "#f39c12", GREEN: "#27ae60" }[patient.latestRisk] || "#27ae60";

  return (
    <div
      className={`card card-${patient.latestRisk?.toLowerCase()}`}
      onClick={() => onClick(patient)}
      style={patient.latestRisk === "RED" ? { background: "#fff5f5" } : {}}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: "700", fontSize: "17px", marginBottom: "4px" }}>
            {patient.latestRisk === "RED" && <span style={{ marginRight: "6px" }}>🚨</span>}
            {patient.name}
          </div>
          <div style={{ fontSize: "13px", color: "#666", marginBottom: "2px" }}>
            🔪 {patient.surgeryType}
          </div>
          <div style={{ fontSize: "13px", color: "#888" }}>
            📅 {patient.daysPostDischarge} days post-discharge
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <RiskBadge risk={patient.latestRisk} />
          <span style={{ fontSize: "12px", color: "#aaa" }}>View Details →</span>
        </div>
      </div>
      {patient.latestResponse && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f0f0f0", fontSize: "12px", color: "#777" }}>
          Last check-in: Pain {patient.latestResponse.pain}/10 · Fever {patient.latestResponse.fever} · Redness {patient.latestResponse.redness}
        </div>
      )}
    </div>
  );
}
