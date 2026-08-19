"use client";

import { useApp } from "@/lib/AppContext";

const ITEMS = [
  { key: "home", icon: "🏠", label: "홈" },
  { key: "history", icon: "🗂️", label: "히스토리" },
  { key: "record", icon: "+", label: null, add: true },
  { key: "my", icon: "👤", label: "마이" },
];

export default function BottomNav() {
  const { screen, setScreen } = useApp();
  return (
    <nav className="bottomnav">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`navitem ${screen === it.key ? "on" : ""} ${it.add ? "navadd" : ""}`.trim()}
          onClick={() => setScreen(it.key)}
        >
          <span className="navicon">{it.icon}</span>
          {it.label && <span>{it.label}</span>}
        </button>
      ))}
    </nav>
  );
}
