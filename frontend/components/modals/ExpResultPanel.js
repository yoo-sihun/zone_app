"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function ExpResultPanel({ experimentId }) {
  const { config, closeMisc, loadActiveExperiment } = useApp();
  const [r, setR] = useState(null);

  useEffect(() => {
    if (!experimentId) return;
    (async () => {
      const result = await api(`/api/experiments/${experimentId}/result`);
      setR(result);
      await loadActiveExperiment();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId]);

  if (!r || !config) return null;

  return (
    <>
      <h2>{r.ingredient} 실험 결과</h2>
      <div className="sub">{r.is_complete ? "실험 종료" : `진행 중 · ${r.day}/${config.experiment_days}일차 (중간 결과)`}</div>
      <div className="card">
        <div className="explabel">실험 전 {config.experiment_days}일</div>
        <div className="expnum">{r.before_count}건</div>
      </div>
      <div className={`card ${r.improved ? "top" : ""}`}>
        <div className="explabel">실험 중 {config.experiment_days}일</div>
        <div className="expnum">{r.during_count}건</div>
      </div>
      <div className="ask">
        <p>{r.improved ? "트러블이 줄었어요. 이 성분이 원인일 가능성이 있습니다." : "큰 변화가 없어요. 다른 요인도 함께 살펴보는 게 좋겠어요."}</p>
      </div>
      <div className="row"><button className="btn ghost" onClick={closeMisc}>닫기</button></div>
    </>
  );
}
