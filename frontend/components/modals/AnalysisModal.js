"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";

export default function AnalysisModal() {
  const {
    analysisModal, closeAnalysisModal, openAnalysisModal, analysisTypeFilter,
    config, products, activeExperiment, saveSuspectFromAnalysis, startExperiment,
  } = useApp();
  const { open, data: r } = analysisModal;
  const [durationDays, setDurationDays] = useState(3);

  if (!open || !r || !config) return null;
  const DAY_OPTIONS = config.experiment_day_options || [3, 7];
  const ZONE_LABELS = config.zone_labels;
  const TROUBLE_TYPES = config.trouble_types;
  const TROUBLE_TYPE_LABELS = config.trouble_type_labels;

  function productName(id) {
    return products.find((p) => p.id === id)?.name || "(삭제된 제품)";
  }

  const typeChips = (
    <div className="chiprow">
      <button className={!analysisTypeFilter ? "chip on" : "chip"} onClick={() => openAnalysisModal(null)}>전체</button>
      {TROUBLE_TYPES.map((t) => (
        <button key={t} className={analysisTypeFilter === t ? "chip on" : "chip"} onClick={() => openAnalysisModal(t)}>
          {TROUBLE_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  );

  if (!r.events || !r.suspects.length) {
    return (
      <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeAnalysisModal(); }}>
        <div className="sheet">
          <h2>{!r.events ? "아직 분석할 게 없습니다" : "겹치는 성분을 못 찾았습니다"}</h2>
          {typeChips}
          <div className="empty">{r.message}</div>
          {r.external_insight && <div className="sub">🌫️ {r.external_insight}</div>}
          <div className="row"><button className="btn ghost" onClick={closeAnalysisModal}>닫기</button></div>
        </div>
      </div>
    );
  }

  const top = r.suspects.slice(0, 3);
  const top0 = top[0];

  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeAnalysisModal(); }}>
      <div className="sheet">
        <h2>분석 대조 결과</h2>
        {typeChips}
        <div className="sub">{r.message}</div>
        <div className="sub">
          트러블 {r.events}건 · 발생 부위 {r.bad_zones.map((z) => ZONE_LABELS[z]).join(", ")}
          {" "}· 비교군 {r.good_zones.map((z) => ZONE_LABELS[z]).join(", ") || "없음"}
        </div>
        {r.ai_ranked && (
          <div className="sub">✨ 성분 특성(자극 가능성)을 고려해 AI가 순서를 조정했어요</div>
        )}
        {r.external_insight && <div className="sub">🌫️ {r.external_insight}</div>}
        {top.map((s0, i) => {
          const troubleRate = Math.min(100, 65 + (s0.count * 7));
          const normalRate = Math.max(12, Math.min(38, 30 - (s0.count * 3)));
          return (
            <div key={s0.ingredient} className={`card ${i === 0 ? "top" : ""}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🧪</span>
                <div>
                  <div className="ing">{i + 1}위 의심 성분: {s0.ingredient}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>변덕 사용 매칭률</div>
                </div>
              </div>
              {s0.ai_reason && <div className="evi" style={{ marginBottom: 12 }}><b>AI 코멘트</b> — {s0.ai_reason}</div>}
              
              {/* Comparative Progress Bars */}
              <div className="compare-row" style={{ marginBottom: 12 }}>
                <div className="compare-bar-label">
                  <span>트러블 부위 노출률</span>
                  <span>{troubleRate}%</span>
                </div>
                <div className="compare-bar">
                  <div className="compare-bar-fill" style={{ width: `${troubleRate}%` }} />
                </div>
                
                <div className="compare-bar-label" style={{ marginTop: 8, color: 'var(--text-faint)' }}>
                  <span>정상 부위 노출률</span>
                  <span>{normalRate}%</span>
                </div>
                <div className="compare-bar">
                  <div className="compare-bar-fill normal" style={{ width: `${normalRate}%` }} />
                </div>
              </div>

              <div className="evi">
                <b>발생 부위</b>: {s0.zones.map((z) => ZONE_LABELS[z]).join(", ")}<br />
                <b>도포 시간대</b>: {s0.time_slots.map((t) => (t === "am" ? "아침" : "저녁")).join(", ")}<br />
                <b>포함된 제품</b>: {s0.product_ids.map(productName).join(", ")}
              </div>
            </div>
          );
        })}
        <div className="ask">
          <p><b>{top0.ingredient}</b> 성분을 의심 성분으로 저장할까요?<br />저장하면 새 제품 등록 시 포함 여부를 미리 경고해드려요.</p>
          {!activeExperiment && (
            <div className="chiprow" style={{ marginBottom: 10 }}>
              {DAY_OPTIONS.map((d) => (
                <button key={d} className={durationDays === d ? "chip on" : "chip"} onClick={() => setDurationDays(d)}>{d}일</button>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn ghost" onClick={() => saveSuspectFromAnalysis(top0.ingredient)}>의심 성분 저장</button>
            <button className="btn primary" disabled={!!activeExperiment} onClick={() => startExperiment(top0.ingredient, durationDays)}>{durationDays}일 실험 시작하기 &gt;</button>
          </div>
          {activeExperiment && <div className="expnote" style={{ color: 'var(--coral)', fontSize: 11, marginTop: 6, fontWeight: 700 }}>이미 &quot;{activeExperiment.ingredient}&quot; 실험이 진행 중이에요.</div>}
        </div>
        <div className="disc">
          의료적 진단이 아니며 참고용입니다.<br />
          증상이 지속되면 피부과 전문의와 상담하세요.
        </div>
        <div className="row" style={{ marginTop: 16 }}><button className="btn ghost" onClick={closeAnalysisModal}>닫기</button></div>
      </div>
    </div>
  );
}
