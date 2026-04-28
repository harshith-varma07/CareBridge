import React, { useState } from "react";
import Login from "./components/Login";
import DoctorDashboard from "./components/Dashboard/DoctorDashboard";
import ChatUI from "./components/Chat/ChatUI";

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) return <Login onLogin={setUser} />;
  if (user.role === "doctor") return <DoctorDashboard onLogout={() => setUser(null)} />;
  return <ChatUI patient={user.patient} onLogout={() => setUser(null)} />;
}
