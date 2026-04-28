import React, { useEffect, useState } from "react";

const PATIENTS = [
  { id: "p1", name: "Alice Johnson" },
  { id: "p2", name: "Bob Smith" },
  { id: "p3", name: "Carol Davis" },
];

export default function Login({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(PATIENTS[0].id);

  function handleDoctorLogin() {
    onLogin({ role: "doctor" });
  }

  function handlePatientLogin() {
    const patient = PATIENTS.find((p) => p.id === selectedPatient);
    onLogin({ role: "patient", patient });
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logo}>🏥</div>
        <h1 style={styles.title}>CareBridge SSI Monitor</h1>
        <p style={styles.subtitle}>Post-Surgical Wound Infection Monitoring</p>

        {!mode && (
          <div style={styles.buttonGroup}>
            <button style={styles.btnDoctor} onClick={() => setMode("doctor")}>
              🩺 Login as Doctor
            </button>
            <button style={styles.btnPatient} onClick={() => setMode("patient")}>
              🧑‍⚕️ Login as Patient
            </button>
          </div>
        )}

        {mode === "doctor" && (
          <div style={styles.section}>
            <p style={styles.sectionText}>Logging in as <strong>Doctor</strong></p>
            <button style={styles.btnDoctor} onClick={handleDoctorLogin}>
              Enter Dashboard
            </button>
            <button style={styles.btnBack} onClick={() => setMode(null)}>← Back</button>
          </div>
        )}

        {mode === "patient" && (
          <div style={styles.section}>
            <label style={styles.label}>Select Patient:</label>
            <select
              style={styles.select}
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
            >
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button style={styles.btnPatient} onClick={handlePatientLogin}>
              Open Chat
            </button>
            <button style={styles.btnBack} onClick={() => setMode(null)}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #075e54 0%, #128c7e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  card: {
    background: "white",
    borderRadius: "20px",
    padding: "40px 32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  logo: { fontSize: "56px", marginBottom: "8px" },
  title: { fontSize: "24px", fontWeight: "700", color: "#075e54", marginBottom: "6px" },
  subtitle: { fontSize: "14px", color: "#888", marginBottom: "32px" },
  buttonGroup: { display: "flex", flexDirection: "column", gap: "12px" },
  btnDoctor: {
    background: "#075e54",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "14px 24px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  },
  btnPatient: {
    background: "#25d366",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "14px 24px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    marginTop: "8px",
  },
  btnBack: {
    background: "transparent",
    border: "none",
    color: "#075e54",
    fontSize: "14px",
    marginTop: "12px",
    cursor: "pointer",
    width: "100%",
  },
  section: { display: "flex", flexDirection: "column", gap: "4px" },
  sectionText: { fontSize: "15px", color: "#444", marginBottom: "12px" },
  label: { textAlign: "left", fontSize: "14px", color: "#555", marginBottom: "4px" },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "15px",
    marginBottom: "8px",
  },
};
