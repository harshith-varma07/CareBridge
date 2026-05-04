import React, { useState, useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import RiskBadge from "../RiskBadge";
import { calculateRisk } from "../../utils/riskCalculator";

const STEPS = [
  { key: "pain",      question: "Rate your pain level today (0–10):", type: "number" },
  { key: "fever",     question: "Do you have a fever?",                type: "yesno" },
  { key: "redness",   question: "Is there any redness around the wound?", type: "yesno" },
  { key: "discharge", question: "Is there any discharge from the wound?",  type: "yesno" },
  {
    key: "image",
    question: "📷 Optionally upload a photo of your wound for AI analysis — or tap Skip:",
    type: "image",
  },
];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ChatUI({ patient, onLogout }) {
  const [history, setHistory]       = useState([]);
  const [messages, setMessages]     = useState([]);
  const [step, setStep]             = useState(0);
  const [answers, setAnswers]       = useState({});
  const [painInput, setPainInput]   = useState("");
  const [imageFile, setImageFile]   = useState(null);
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [todayDone, setTodayDone]   = useState(false);
  const bottomRef    = useRef(null);
  const imageInputRef = useRef(null);

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
    if (!loading) initChat();
  }, [loading, todayDone]); // initChat is stable across renders (no external deps)

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
        { id: "q0", role: "bot", content: STEPS[0].question, time: now() },
      ]);
      setStep(0);
    }
  }

  function now() {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function handleYesNo(value) {
    const current  = STEPS[step];
    const newAnswers = { ...answers, [current.key]: value };
    const userMsg  = { id: `u${step}`, role: "patient", content: value, time: now() };
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
      // Shouldn't normally be reached now that the last step is "image"
      handleImageSubmit(null, newAnswers, userMsg);
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

  /** Called when the user submits (or skips) the image step. */
  function handleImageSubmit(file, currentAnswers = answers, precedingMsg = null) {
    const userMsg = precedingMsg || {
      id: "u-image",
      role: "patient",
      content: file ? `📷 Wound photo attached: ${file.name}` : "⏭ Skipped photo upload",
      time: now(),
    };
    finishChat(currentAnswers, userMsg, file);
  }

  /**
   * Sends the completed check-in to the backend.
   * Uses FormData so an optional image can be included.
   * Waits for the backend response (which includes AI analysis + explanation)
   * before showing the result bubble.
   */
  async function finishChat(finalAnswers, lastUserMsg, imageFile = null) {
    const loadingMsg = {
      id: "loading",
      role: "bot",
      content: imageFile
        ? "🤖 Analysing your wound image with AI… please wait."
        : "⏳ Processing your check-in…",
      time: now(),
    };
    setMessages((m) => [...m, lastUserMsg, loadingMsg]);
    setSubmitted(true);

    // Build multipart form — works with or without an image
    const formData = new FormData();
    formData.append("pain",      String(finalAnswers.pain));
    formData.append("fever",     finalAnswers.fever);
    formData.append("redness",   finalAnswers.redness);
    formData.append("discharge", finalAnswers.discharge);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(`/api/patients/${patient.id}/responses`, {
        method: "POST",
        // Do NOT set Content-Type — the browser sets multipart/form-data + boundary automatically
        body: formData,
      });
      const newResp = await res.json();

      const summaryMsg = {
        id: "summary",
        role: "bot",
        content: { type: "result", answers: finalAnswers, ...newResp },
        time: now(),
      };
      setMessages((m) => m.map((msg) => (msg.id === "loading" ? summaryMsg : msg)));
      setHistory((h) => [...h, newResp]);
    } catch (err) {
      console.error(err);
      // Graceful fallback: compute risk locally
      const fallbackRisk = calculateRisk(finalAnswers);
      const summaryMsg = {
        id: "summary",
        role: "bot",
        content: { type: "result", answers: finalAnswers, risk: fallbackRisk },
        time: now(),
      };
      setMessages((m) => m.map((msg) => (msg.id === "loading" ? summaryMsg : msg)));
    }
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
              {resp.imageRisk && (
                <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
                  🤖 AI Image: <RiskBadge risk={resp.imageRisk} size="small" />
                </div>
              )}
              <div style={{ marginTop: "6px" }}>
                <RiskBadge risk={resp.risk} size="small" />
              </div>
              {resp.trendAlert && (
                <div style={{ fontSize: "11px", color: "#8e44ad", marginTop: "4px" }}>📈 Trend alert</div>
              )}
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

        {messages.map((msg) => {
          if (msg.role === "bot") {
            if (msg.content?.type === "result") {
              const { answers: a, risk, imageRisk, imageConfidence, imageExplanation, explanation, trendAlert } = msg.content;
              return (
                <div key={msg.id} className="bubble-bot">
                  <div style={{ fontWeight: "600", marginBottom: "6px" }}>✅ Check-in Complete!</div>
                  <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
                    Pain: <strong>{a.pain}/10</strong><br />
                    Fever: <strong>{a.fever}</strong><br />
                    Redness: <strong>{a.redness}</strong><br />
                    Discharge: <strong>{a.discharge}</strong>
                  </div>

                  {/* AI image analysis panel */}
                  {imageRisk && (
                    <div style={{ marginTop: "8px", padding: "8px 10px", background: "#f0f8ff", borderRadius: "8px", border: "1px solid #bee3f8", fontSize: "12px" }}>
                      <div style={{ fontWeight: "600", marginBottom: "4px" }}>🤖 AI Image Analysis</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <RiskBadge risk={imageRisk} size="small" />
                        <span style={{ color: "#555" }}>({Math.round((imageConfidence || 0) * 100)}% confidence)</span>
                      </div>
                      {imageExplanation && (
                        <div style={{ color: "#555", marginTop: "4px" }}>{imageExplanation}</div>
                      )}
                    </div>
                  )}

                  {/* Overall risk + explanation */}
                  <div style={{ marginTop: "10px", padding: "10px", background: riskColors[risk] + "22", borderRadius: "8px", borderLeft: `4px solid ${riskColors[risk]}` }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>Your Risk Assessment:</div>
                    <RiskBadge risk={risk} />

                    {trendAlert && (
                      <div style={{ fontSize: "12px", color: "#8e44ad", marginTop: "6px" }}>
                        📈 Trend alert: risk has been escalating. Extra monitoring recommended.
                      </div>
                    )}

                    {explanation ? (
                      <div style={{ fontSize: "12px", color: "#444", marginTop: "6px", fontStyle: "italic" }}>
                        {explanation}
                      </div>
                    ) : (
                      <>
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
                      </>
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
          {/* Pain number input */}
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

          {/* Yes / No buttons */}
          {STEPS[step]?.type === "yesno" && (
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => handleYesNo("Yes")}
                style={{ flex: 1, padding: "12px", background: "#e74c3c", color: "white", border: "none", borderRadius: "24px", fontSize: "16px", fontWeight: "600" }}
              >
                Yes
              </button>
              <button
                onClick={() => handleYesNo("No")}
                style={{ flex: 1, padding: "12px", background: "#27ae60", color: "white", border: "none", borderRadius: "24px", fontSize: "16px", fontWeight: "600" }}
              >
                No
              </button>
            </div>
          )}

          {/* Image upload step */}
          {STEPS[step]?.type === "image" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Hidden file input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: "#075e54",
                    color: "white",
                    border: "none",
                    borderRadius: "24px",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  📷 Choose Photo
                </button>
                <button
                  onClick={() => handleImageSubmit(null)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: "#95a5a6",
                    color: "white",
                    border: "none",
                    borderRadius: "24px",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  ⏭ Skip
                </button>
              </div>

              {imageFile && (
                <div style={{ textAlign: "center", fontSize: "13px", color: "#555" }}>
                  ✓ {imageFile.name}
                  <button
                    onClick={() => handleImageSubmit(imageFile)}
                    style={{
                      marginLeft: "10px",
                      padding: "6px 18px",
                      background: "#25d366",
                      color: "white",
                      border: "none",
                      borderRadius: "16px",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    📤 Upload &amp; Analyze
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
