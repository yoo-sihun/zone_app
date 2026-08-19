"use client";

import { useApp } from "@/lib/AppContext";

export default function ExpBar() {
  const { activeExperiment, config, openExpResultModal, stopExperiment } = useApp();
  if (!activeExperiment || !config) return null;

  async function onStop() {
    if (!confirm("실험을 중단할까요?")) return;
    await stopExperiment();
  }

  return (
    <div className="expbar">
      <div className="expinfo">
        🧪 <b>{activeExperiment.ingredient}</b> 제외 실험 · {activeExperiment.day}/{config.experiment_days}일차
      </div>
      <div className="exbtns">
        <button className="expbtn" onClick={() => openExpResultModal()}>
          {activeExperiment.is_complete ? "결과 보기" : "중간 확인"}
        </button>
        <button className="expbtn stop" onClick={onStop}>중단</button>
      </div>
    </div>
  );
}
