import React, { useState, useEffect } from "react";
import PatientCard from "./PatientCard";
import PatientDetail from "./PatientDetail";

export default function DoctorDashboard({ onLogout }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => {
        const order = { RED: 0, YELLOW: 1, GREEN: 2 };
        data.sort((a, b) => (order[a.latestRisk] ?? 3) - (order[b.latestRisk] ?? 3));
        setPatients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSelectPatient(patient) {
    fetch(`/api/patients/${patient.id}`)
      .then((r) => r.json())
      .then((detail) => setSelected(detail))
      .catch(console.error);
  }

  const redCount = patients.filter((p) => p.latestRisk === "RED").length;
  const yellowCount = patients.filter((p) => p.latestRisk === "YELLOW").length;
  const greenCount = patients.filter((p) => p.latestRisk === "GREEN").length;

  if (selected) {
    return (
      <div className="dashboard-container">
        <PatientDetail patient={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "2px" }}>
              🏥 CareBridge SSI Monitor
            </h1>
            <div style={{ fontSize: "13px", opacity: 0.8 }}>Post-Surgical Wound Infection Dashboard</div>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "white",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "Total Patients", value: patients.length, color: "#075e54", bg: "#e8f5e9" },
            { label: "High Risk", value: redCount, color: "#e74c3c", bg: "#fdecea" },
            { label: "Moderate", value: yellowCount, color: "#f39c12", bg: "#fef9e7" },
            { label: "Low Risk", value: greenCount, color: "#27ae60", bg: "#eafaf1" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: s.bg,
                borderRadius: "12px",
                padding: "12px 8px",
                textAlign: "center",
                border: `1px solid ${s.color}33`,
              }}
            >
              <div style={{ fontSize: "28px", fontWeight: "700", color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: s.color, fontWeight: "600", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Alert banner for RED patients */}
        {redCount > 0 && (
          <div
            className="badge-red"
            style={{
              background: "#fdecea",
              border: "1px solid #e74c3c",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🚨</span>
            <div>
              <div style={{ fontWeight: "700", color: "#c0392b", fontSize: "14px" }}>
                {redCount} patient{redCount > 1 ? "s" : ""} require{redCount === 1 ? "s" : ""} immediate attention
              </div>
              <div style={{ fontSize: "12px", color: "#e74c3c" }}>
                Please review high-risk patients below
              </div>
            </div>
          </div>
        )}

        {/* Patient list */}
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#333", marginBottom: "12px" }}>
          Patients ({patients.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>Loading patients...</div>
        ) : (
          patients.map((p) => (
            <PatientCard key={p.id} patient={p} onClick={handleSelectPatient} />
          ))
        )}
      </div>
    </div>
  );
}
