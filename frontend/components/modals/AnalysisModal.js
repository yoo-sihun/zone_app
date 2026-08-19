"use client";

import { useApp } from "@/lib/AppContext";

export default function AnalysisModal() {
  const {
    analysisModal, closeAnalysisModal, openAnalysisModal, analysisTypeFilter,
    config, products, activeExperiment, saveSuspectFromAnalysis, startExperiment,
  } = useApp();
  const { open, data: r } = analysisModal;

  if (!open || !r || !config) return null;
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
        {top.map((s0, i) => (
          <div key={s0.ingredient} className={`card ${i === 0 ? "top" : ""}`}>
            <div className="ing">{s0.ingredient}</div>
            {s0.ai_reason && <div className="evi"><b>AI 코멘트</b> — {s0.ai_reason}</div>}
            <div className="evi">
              <b>{s0.zones.map((z) => ZONE_LABELS[z]).join(", ")}</b>에서만 발랐고, 그 부위에서 트러블이 났습니다.<br />
              {r.good_zones.length > 0 && <>
                <b>{r.good_zones.map((z) => ZONE_LABELS[z]).join(", ")}</b>에는 바르지 않았고 괜찮았습니다.<br />
              </>}
              도포 시간대 → {s0.time_slots.map((t) => (t === "am" ? "아침" : "저녁")).join(", ")}<br />
              해당 성분이 든 제품 → {s0.product_ids.map(productName).join(", ")}
            </div>
            <div className="meter">
              {[0, 1, 2, 3, 4].map((n) => <i key={n} className={n < Math.min(5, Math.ceil(s0.count / 2)) ? "f" : ""} />)}
            </div>
          </div>
        ))}
        <div className="ask">
          <p><b>{top0.ingredient}</b>이(가) 반복해서 겹칩니다. 다음 단계로 넘어가볼까요?</p>
          <div className="row">
            <button className="btn ghost" onClick={() => saveSuspectFromAnalysis(top0.ingredient)}>의심 성분 저장</button>
            <button className="btn primary" disabled={!!activeExperiment} onClick={() => startExperiment(top0.ingredient)}>3일 실험 시작</button>
          </div>
          {activeExperiment && <div className="expnote">이미 &quot;{activeExperiment.ingredient}&quot; 실험이 진행 중이에요.</div>}
        </div>
        <div className="disc">
          의료적 진단이 아니며 참고용입니다.<br />
          증상이 지속되면 피부과 전문의와 상담하세요.
        </div>
        <div className="row"><button className="btn ghost" onClick={closeAnalysisModal}>닫기</button></div>
      </div>
    </div>
  );
}
