import React, { useState, useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import RiskBadge from "../RiskBadge";
import { calculateRisk } from "../../utils/riskCalculator";

const STEPS = [
  { key: "pain", question: "Rate your pain level today (0–10):", type: "number" },
  { key: "fever", question: "Do you have a fever?", type: "yesno" },
  { key: "redness", question: "Is there any redness around the wound?", type: "yesno" },
  { key: "discharge", question: "Is there any discharge from the wound?", type: "yesno" },
];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ChatUI({ patient, onLogout }) {
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [painInput, setPainInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todayDone, setTodayDone] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`/api/patients/${patient.id}/responses`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data);
        const today = new Date().toISOString().split("T")[0];
        const doneToday = data.some((r) => r.date === today);
        setTodayDone(doneToday);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patient.id]);

  useEffect(() => {
    if (!loading) {
      initChat();
    }
  }, [loading, todayDone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function initChat() {
    const greet = [
      {
        id: "greet",
        role: "bot",
        content: `👋 Hello! I'm CareBridge Bot. I'm here to help monitor your recovery after surgery.\n\nHow are you feeling today, ${patient.name.split(" ")[0]}?`,
        time: now(),
      },
    ];
    if (todayDone) {
      setMessages([
        ...greet,
        {
          id: "done",
          role: "bot",
          content: "✅ You've already completed today's check-in. Great job staying on top of your recovery! Check back tomorrow.",
          time: now(),
        },
      ]);
      setSubmitted(true);
    } else {
      setMessages([
        ...greet,
        {
          id: "q0",
          role: "bot",
          content: STEPS[0].question,
          time: now(),
        },
      ]);
      setStep(0);
    }
  }

  function now() {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function handleYesNo(value) {
    const current = STEPS[step];
    const newAnswers = { ...answers, [current.key]: value };
    const userMsg = { id: `u${step}`, role: "patient", content: value, time: now() };
    const nextStep = step + 1;

    if (nextStep < STEPS.length) {
      setMessages((m) => [
        ...m,
        userMsg,
        { id: `q${nextStep}`, role: "bot", content: STEPS[nextStep].question, time: now() },
      ]);
      setStep(nextStep);
      setAnswers(newAnswers);
    } else {
      finishChat(newAnswers, userMsg);
    }
  }

  function handlePainSubmit() {
    const val = Number(painInput);
    if (isNaN(val) || val < 0 || val > 10) return;
    const newAnswers = { ...answers, pain: val };
    const userMsg = { id: "u0", role: "patient", content: `Pain: ${val}/10`, time: now() };
    setMessages((m) => [
      ...m,
      userMsg,
      { id: "q1", role: "bot", content: STEPS[1].question, time: now() },
    ]);
    setStep(1);
    setAnswers(newAnswers);
    setPainInput("");
  }

  function finishChat(finalAnswers, lastUserMsg) {
    const risk = calculateRisk(finalAnswers);
    const summaryMsg = {
      id: "summary",
      role: "bot",
      content: { type: "result", answers: finalAnswers, risk },
      time: now(),
    };
    setMessages((m) => [...m, lastUserMsg, summaryMsg]);
    setSubmitted(true);

    fetch(`/api/patients/${patient.id}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalAnswers),
    })
      .then((r) => r.json())
      .then((newResp) => setHistory((h) => [...h, newResp]))
      .catch(console.error);
  }

  const riskColors = { RED: "#e74c3c", YELLOW: "#f39c12", GREEN: "#27ae60" };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <button
          onClick={onLogout}
          style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer", marginRight: "4px" }}
        >
          ←
        </button>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#128c7e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
          🤖
        </div>
        <div>
          <div style={{ fontWeight: "700", fontSize: "16px" }}>CareBridge Bot</div>
          <div style={{ fontSize: "12px", opacity: 0.85 }}>Daily Check-in for {patient.name}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {/* History section */}
        {history.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <span style={{ background: "#e0e0e0", borderRadius: "12px", padding: "4px 12px", fontSize: "12px", color: "#666" }}>
              Previous Check-ins
            </span>
          </div>
        )}
        {history.map((resp) => (
          <div key={resp.id} style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ background: "#e0e0e0", borderRadius: "12px", padding: "3px 10px", fontSize: "11px", color: "#666" }}>
                {formatDate(resp.date)}
              </span>
            </div>
            <div className="bubble-bot">
              <div style={{ fontSize: "13px", color: "#555", marginBottom: "4px" }}>Daily check-in completed</div>
              <div style={{ fontSize: "13px" }}>
                Pain: <strong>{resp.pain}/10</strong> · Fever: <strong>{resp.fever}</strong> · Redness: <strong>{resp.redness}</strong> · Discharge: <strong>{resp.discharge}</strong>
              </div>
              <div style={{ marginTop: "6px" }}>
                <RiskBadge risk={resp.risk} size="small" />
              </div>
            </div>
          </div>
        ))}

        {history.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ background: "#e0e0e0", borderRadius: "12px", padding: "4px 12px", fontSize: "12px", color: "#666" }}>
              Today
            </span>
          </div>
        )}

        {/* Current chat messages */}
        {messages.map((msg) => {
          if (msg.role === "bot") {
            if (msg.content?.type === "result") {
              const { answers: a, risk } = msg.content;
              return (
                <div key={msg.id} className="bubble-bot">
                  <div style={{ fontWeight: "600", marginBottom: "6px" }}>✅ Check-in Complete!</div>
                  <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
                    Pain: <strong>{a.pain}/10</strong><br />
                    Fever: <strong>{a.fever}</strong><br />
                    Redness: <strong>{a.redness}</strong><br />
                    Discharge: <strong>{a.discharge}</strong>
                  </div>
                  <div style={{ marginTop: "10px", padding: "10px", background: riskColors[risk] + "22", borderRadius: "8px", borderLeft: `4px solid ${riskColors[risk]}` }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Your Risk Assessment:</div>
                    <RiskBadge risk={risk} />
                    {risk === "RED" && (
                      <div style={{ fontSize: "12px", color: "#c0392b", marginTop: "6px" }}>
                        ⚠️ Please contact your doctor or visit the clinic as soon as possible.
                      </div>
                    )}
                    {risk === "YELLOW" && (
                      <div style={{ fontSize: "12px", color: "#d68910", marginTop: "6px" }}>
                        ℹ️ Monitor your symptoms closely. Contact your doctor if symptoms worsen.
                      </div>
                    )}
                    {risk === "GREEN" && (
                      <div style={{ fontSize: "12px", color: "#1e8449", marginTop: "6px" }}>
                        😊 Looking good! Keep resting and follow your recovery plan.
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>{msg.time}</div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="bubble-bot">
                <div style={{ whiteSpace: "pre-line" }}>{msg.content}</div>
                <div style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>{msg.time}</div>
              </div>
            );
          }
          return (
            <div key={msg.id} className="bubble-patient">
              {msg.content}
              <div style={{ fontSize: "10px", color: "#888", marginTop: "4px", textAlign: "right" }}>{msg.time}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!submitted && !loading && (
        <div className="chat-input-area">
          {STEPS[step]?.type === "number" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                min="0"
                max="10"
                value={painInput}
                onChange={(e) => setPainInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePainSubmit()}
                placeholder="Enter 0–10"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "24px",
                  border: "1px solid #ddd",
                  fontSize: "15px",
                  outline: "none",
                }}
              />
              <button
                onClick={handlePainSubmit}
                style={{
                  background: "#075e54",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "42px",
                  height: "42px",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ➤
              </button>
            </div>
          )}
          {STEPS[step]?.type === "yesno" && (
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => handleYesNo("Yes")}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#e74c3c",
                  color: "white",
                  border: "none",
                  borderRadius: "24px",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleYesNo("No")}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#27ae60",
                  color: "white",
                  border: "none",
                  borderRadius: "24px",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
