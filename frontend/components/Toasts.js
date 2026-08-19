"use client";

import { useApp } from "@/lib/AppContext";

export default function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toastwrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind} show`}>{t.msg}</div>
      ))}
    </div>
  );
}
