import React from "react";

export default function ChatMessage({ role, children, time }) {
  const isBot = role === "bot";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isBot ? "flex-start" : "flex-end" }}>
      {isBot && (
        <span style={{ fontSize: "11px", color: "#888", marginBottom: "2px", marginLeft: "4px" }}>
          CareBridge Bot
        </span>
      )}
      <div className={isBot ? "bubble-bot" : "bubble-patient"}>
        {children}
      </div>
      {time && (
        <span style={{ fontSize: "10px", color: "#aaa", marginTop: "2px", marginRight: isBot ? 0 : "4px", marginLeft: isBot ? "4px" : 0 }}>
          {time}
        </span>
      )}
    </div>
  );
}
