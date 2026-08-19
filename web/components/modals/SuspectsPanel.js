"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function SuspectsPanel() {
  const { suspects, loadSuspects, closeMisc } = useApp();
  const [val, setVal] = useState("");

  async function onAdd() {
    const trimmed = val.trim();
    if (!trimmed) return;
    await api("/api/suspects", { method: "POST", body: JSON.stringify({ ingredient: trimmed }) });
    setVal("");
    await loadSuspects();
  }

  async function onDelete(id) {
    await api(`/api/suspects/${id}`, { method: "DELETE" });
    await loadSuspects();
  }

  return (
    <>
      <h2>의심 성분</h2>
      <div className="sub">저장해두면 새 제품 등록할 때 자동으로 겹치는지 확인해줘요</div>
      <div className="field"><input value={val} onChange={(e) => setVal(e.target.value)} placeholder="성분명 입력" /></div>
      <div className="row"><button className="btn primary" onClick={onAdd}>추가</button></div>
      <div className="suslist">
        {suspects.length ? suspects.map((s) => (
          <div key={s.id} className="susitem">
            <span>{s.ingredient}</span>
            <span className="del" onClick={() => onDelete(s.id)}>삭제</span>
          </div>
        )) : <div className="empty">저장된 의심 성분이 없습니다.</div>}
      </div>
      <div className="row"><button className="btn ghost" onClick={closeMisc}>닫기</button></div>
    </>
  );
}
