"use client";

import { useApp } from "@/lib/AppContext";
import HistoryScreen from "@/components/screens/HistoryScreen";

const STEPS = [
  { icon: "💧", label: "데이터 수집" },
  { icon: "🔍", label: "성분 분석" },
  { icon: "📋", label: "결과 확인" },
];

export default function AnalysisScreen() {
  const { openAnalysisModal } = useApp();

  return (
    <div className="screen" id="screenAnalysis">
      <div className="analysis-hero">
        <span className="chip on" style={{ display: "inline-block", marginBottom: 10 }}>✨ AI 피부 진단</span>
        <h2 style={{ marginBottom: 4 }}>내 피부 트러블의<br />진짜 원인은 무엇일까?</h2>
        <div className="sub" style={{ marginBottom: 16 }}>정밀 원인 분석을 실행해보세요</div>
        <button className="btn primary main-action" onClick={() => openAnalysisModal(null)}>🔍 원인 분석 시작하기</button>
      </div>

      <div className="analysis-note">
        <b>분석이 어려운 경우</b>
        <div className="sub">기록된 데이터가 부족하면 분석할 수 없다고 안내해드려요.</div>
      </div>

      <div className="analysis-steps">
        {STEPS.map((s, i) => (
          <div key={s.label} className="analysis-step">
            <div className="analysis-step-icon">{s.icon}</div>
            <div className="analysis-step-label">{i + 1}. {s.label}</div>
          </div>
        ))}
      </div>

      <div className="sechead"><h3>기록 히스토리</h3></div>
      <HistoryScreen />
    </div>
  );
}
