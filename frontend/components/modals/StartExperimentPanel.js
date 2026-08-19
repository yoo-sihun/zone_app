"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";

export default function StartExperimentPanel() {
  const { config, suspects, activeExperiment, closeMisc, startExperiment } = useApp();
  const [picked, setPicked] = useState(null);
  const [customIngredient, setCustomIngredient] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const DAY_OPTIONS = config?.experiment_day_options || [3, 7];

  const ingredient = picked ?? customIngredient.trim();

  function pick(ing) {
    setPicked(ing);
    setCustomIngredient("");
  }

  function onCustomChange(e) {
    setCustomIngredient(e.target.value);
    setPicked(null);
  }

  function onStart() {
    if (!ingredient) return;
    startExperiment(ingredient, durationDays);
  }

  return (
    <>
      <h2>실험 바로 시작하기</h2>
      <div className="sub">원인 분석 없이도 의심되는 성분을 골라 바로 3일/7일 제외 실험을 시작할 수 있어요.</div>

      {activeExperiment ? (
        <div className="empty">이미 &quot;{activeExperiment.ingredient}&quot; 실험이 진행 중이에요. 새 실험을 시작하려면 먼저 중단해주세요.</div>
      ) : (
        <>
          <div className="field">
            <label>저장해둔 의심 성분에서 고르기</label>
            <div className="chiprow">
              {suspects.length ? suspects.map((s) => (
                <button key={s.id} className={picked === s.ingredient ? "chip on" : "chip"} onClick={() => pick(s.ingredient)}>
                  {s.ingredient}
                </button>
              )) : <div className="sub" style={{ margin: 0 }}>저장된 의심 성분이 없어요. 아래에 직접 입력해주세요.</div>}
            </div>
          </div>

          <div className="field">
            <label>또는 직접 입력</label>
            <input value={customIngredient} onChange={onCustomChange} placeholder="예: 레티놀" />
          </div>

          <div className="field">
            <label>실험 기간</label>
            <div className="chiprow">
              {DAY_OPTIONS.map((d) => (
                <button key={d} className={durationDays === d ? "chip on" : "chip"} onClick={() => setDurationDays(d)}>{d}일</button>
              ))}
            </div>
          </div>

          <div className="row">
            <button className="btn ghost" onClick={closeMisc}>취소</button>
            <button className="btn primary" disabled={!ingredient} onClick={onStart}>
              {ingredient ? `"${ingredient}" ${durationDays}일 실험 시작` : "성분을 선택해주세요"}
            </button>
          </div>
        </>
      )}

      {activeExperiment && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={closeMisc}>닫기</button>
        </div>
      )}
    </>
  );
}
