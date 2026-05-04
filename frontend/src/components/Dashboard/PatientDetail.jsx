import React from "react";
import RiskBadge from "../RiskBadge";

function PainChart({ responses }) {
  if (!responses || responses.length === 0) return null;

  const W = 340, H = 140, PAD = { top: 20, right: 20, bottom: 30, left: 30 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxPain = 10;
  const n = responses.length;

  function xPos(i) {
    return PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  }
  function yPos(v) {
    return PAD.top + innerH - (v / maxPain) * innerH;
  }

  const points = responses.map((r, i) => `${xPos(i)},${yPos(r.pain)}`).join(" ");
  const riskColor = { RED: "#e74c3c", YELLOW: "#f39c12", GREEN: "#27ae60" };

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", margin: "0 auto" }}>
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="#f0f0f0" strokeWidth="1" />
            <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor="end" fontSize="10" fill="#aaa">{v}</text>
          </g>
        ))}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${points} ${xPos(n - 1)},${PAD.top + innerH}`}
          fill="rgba(7,94,84,0.08)"
        />
        <polyline points={points} fill="none" stroke="#075e54" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {responses.map((r, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(r.pain)} r={5} fill={riskColor[r.risk] || "#27ae60"} stroke="white" strokeWidth="2" />
        ))}
        {responses.map((r, i) => {
          const d = new Date(r.date + "T00:00:00");
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#999">
              {label}
            </text>
          );
        })}
        <text x={PAD.left - 20} y={PAD.top - 6} fontSize="10" fill="#888">Pain</text>
      </svg>
    </div>
  );
}

export default function PatientDetail({ patient, onBack }) {
  const { responses = [] } = patient;
  const sorted = [...responses].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Show the AI Image column only if at least one response has imageRisk data
  const hasImageData = sorted.some((r) => r.imageRisk);

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* Patient header */}
      <div style={{ background: "#075e54", color: "white", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}>
          ←
        </button>
        <div>
          <div style={{ fontWeight: "700", fontSize: "18px" }}>{patient.name}</div>
          <div style={{ fontSize: "13px", opacity: 0.85 }}>{patient.surgeryType} · {patient.daysPostDischarge} days post-discharge</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <RiskBadge risk={patient.latestRisk} />
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Pain chart */}
        <div style={{ background: "white", borderRadius: "12px", padding: "16px", marginBottom: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: "600", fontSize: "15px", marginBottom: "12px", color: "#333" }}>
            📈 Pain Level Over Time
          </div>
          {sorted.length > 0 ? <PainChart responses={sorted} /> : (
            <div style={{ textAlign: "center", color: "#aaa", padding: "20px" }}>No data yet</div>
          )}
        </div>

        {/* Responses table */}
        <div style={{ background: "white", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflowX: "auto" }}>
          <div style={{ fontWeight: "600", fontSize: "15px", marginBottom: "12px", color: "#333" }}>
            📋 Daily Check-in History
          </div>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", color: "#aaa", padding: "20px" }}>No responses yet</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pain</th>
                  <th>Fever</th>
                  <th>Redness</th>
                  <th>Discharge</th>
                  <th>Risk</th>
                  {hasImageData && <th>AI Image</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td>{formatDate(r.date)}</td>
                      <td><strong>{r.pain}/10</strong></td>
                      <td style={{ color: r.fever === "Yes" ? "#e74c3c" : "#27ae60" }}>{r.fever}</td>
                      <td style={{ color: r.redness === "Yes" ? "#f39c12" : "#27ae60" }}>{r.redness}</td>
                      <td style={{ color: r.discharge === "Yes" ? "#e74c3c" : "#27ae60" }}>{r.discharge}</td>
                      <td>
                        <RiskBadge risk={r.risk} size="small" />
                        {r.trendAlert && (
                          <span style={{ marginLeft: "6px", fontSize: "11px", color: "#8e44ad" }} title="Risk trend is escalating">📈</span>
                        )}
                      </td>
                      {hasImageData && (
                        <td>
                          {r.imageRisk
                            ? <RiskBadge risk={r.imageRisk} size="small" />
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                      )}
                    </tr>
                    {/* Explanation row — shown only when present */}
                    {r.explanation && (
                      <tr>
                        <td colSpan={hasImageData ? 7 : 6} style={{ fontSize: "11px", color: "#777", fontStyle: "italic", paddingTop: "2px", paddingBottom: "8px", borderBottom: "1px solid #f0f0f0" }}>
                          {r.explanation}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
