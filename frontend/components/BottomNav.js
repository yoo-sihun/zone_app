"use client";

import { useApp } from "@/lib/AppContext";

const ITEMS = [
  { key: "home", icon: "🏠", label: "홈" },
  { key: "record", icon: "📝", label: "기록" },
  { key: "analysis", icon: "🔍", label: "분석" },
  { key: "vanity", icon: "🧴", label: "화장대" },
  { key: "my", icon: "👤", label: "MY" },
];

export default function BottomNav() {
  const { screen, setScreen } = useApp();
  const active = screen === "trouble" ? "record" : screen;
  return (
    <nav className="bottomnav">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`navitem ${active === it.key ? "on" : ""}`}
          onClick={() => setScreen(it.key)}
        >
          <span className="navicon">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
