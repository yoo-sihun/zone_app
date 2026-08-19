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
      <div className="brand">
        <span className="brandmark">ZONE</span>
        <span className="brandsub">{profileName ? `${profileName}님의 스킨케어 기록` : "스킨케어 기록"}</span>
      </div>
      <div className="topactions">
        <button className="bellbtn" title="오늘 기록 알림" onClick={onBellClick}>
          <span className="bell-icon">🔔</span>
          {!bellLogged && <span className="bellbadge" />}
        </button>
      </div>
    </header>
  );
}
