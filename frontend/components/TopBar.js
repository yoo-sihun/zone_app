"use client";

import { useApp } from "@/lib/AppContext";

export default function TopBar() {
  const { profileName, bellLogged, refreshBell, pushToast, setScreen } = useApp();

  async function onBellClick() {
    await refreshBell();
    if (bellLogged) pushToast("오늘 기록 완료했어요 👍", "ok");
    else { pushToast("오늘 아직 기록 안 하셨어요 — 지금 기록해볼까요?", "warn"); setScreen("record"); }
  }

  return (
    <header className="topbar">
      <div className="brand" onClick={() => setScreen("home")} style={{ cursor: "pointer" }}>
        <span className="brandmark" style={{ fontSize: "26px", fontWeight: "900", color: "var(--teal)", letterSpacing: "-0.02em" }}>MUDI</span>
      </div>
      <div className="topactions">
        <button className="bellbtn" title="오늘 기록 알림" onClick={onBellClick} style={{ background: "none", border: "none", boxShadow: "none", width: "36px", height: "36px" }}>
          <span className="bell-icon" style={{ fontSize: "20px" }}>🔔</span>
          {!bellLogged && <span className="bellbadge" style={{ top: "4px", right: "4px" }} />}
        </button>
      </div>
    </header>
  );
}
