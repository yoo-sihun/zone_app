"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";
import HistoryScreen from "@/components/screens/HistoryScreen";

const STEPS = [
  { icon: "💧", label: "데이터 수집", desc: "스킨케어/트러블 기록" },
  { icon: "🧪", label: "성분 분석", desc: "트러블 유발 가능 성분 추적" },
  { icon: "📋", label: "결과 확인", desc: "의심 성분 제외 후 관찰" },
];

export default function AnalysisScreen() {
  const { activeExperiment, stopExperiment, openAnalysisModal, openReportModal, openStartExperimentModal, config, setScreen } = useApp();
  const [expResult, setExpResult] = useState(null);
  const [trackInfo, setTrackInfo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/api/analysis");
        setTrackInfo({ days_tracked: res.days_tracked, confidence: res.confidence });
      } catch (e) {
        setTrackInfo(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeExperiment) {
      (async () => {
        try {
          const res = await api(`/api/experiments/${activeExperiment.id}/result`);
          setExpResult(res);
        } catch (e) {
          console.error("실험 결과를 가져오는데 실패했습니다", e);
        }
      })();
    } else {
      setExpResult(null);
    }
  }, [activeExperiment]);

  if (activeExperiment && expResult) {
    const totalDays = activeExperiment.duration_days || config?.experiment_days || 3;
    const progressPercent = ((activeExperiment.day - 1) / (totalDays - 1)) * 100;
    const beforeCount = expResult.before_count || 0;
    const duringCount = expResult.during_count || 0;
    const improved = expResult.improved;
    const reductionPercent = beforeCount > 0 
      ? Math.round(((beforeCount - duringCount) / beforeCount) * 100)
      : 0;

    return (
      <div className="screen" id="screenAnalysis">
        <div className="sechead" style={{ marginTop: 0 }}>
          <h3>{totalDays}일 실험 진행 중</h3>
        </div>

        {/* Timeline Tracker */}
        <div className="card" style={{ padding: '20px 8px 30px', marginBottom: 20, background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="experiment-timeline">
            <div className="experiment-timeline-fill" style={{ width: `${progressPercent}%` }} />
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
              const isActive = activeExperiment.day === d;
              const isPassed = activeExperiment.day > d;
              let nodeClass = "experiment-day-node";
              if (isActive) nodeClass += " active";
              if (isPassed) nodeClass += " passed";
              return (
                <div key={d} className={nodeClass}>
                  {d}
                  <span className="experiment-day-sub">{d}일차</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", margin: "10px 0 0" }}>
            매일 자정이 지나면 자동으로 다음 날로 넘어가요 — 따로 누를 건 없어요
          </p>
        </div>

        {/* Guide Card */}
        <div className="empty-shelf-card" style={{ flexDirection: 'row', gap: 14, padding: 16, textAlign: 'left', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32 }}>🧴</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 13, marginBottom: 4 }}>실험 가이드</h4>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: "0 0 10px 0", lineHeight: "1.4" }}>
              의심 성분(<b>{activeExperiment.ingredient}</b>)이 포함된 제품 사용을 중단하고, 평소처럼 피부 변화를 계속 기록해 주세요.
            </p>
            <button 
              onClick={() => setScreen("record")} 
              style={{ 
                background: "var(--teal-light)", 
                border: "1px solid var(--teal-border)", 
                color: "var(--teal-dark)", 
                fontSize: "11px", 
                fontWeight: "800", 
                padding: "6px 12px", 
                borderRadius: "10px", 
                cursor: "pointer"
              }}
            >
              👉 오늘의 피부 상태 기록하러 가기
            </button>
          </div>
        </div>

        {/* Compare Results Card */}
        <div className="sechead" style={{ marginTop: 24 }}>
          <h3>실험 결과 비교</h3>
        </div>

        <div className="experiment-results-row" style={{ marginBottom: 14 }}>
          <div className="experiment-result-card">
            <div className="card-label">실험 전 {totalDays}일</div>
            <div className="card-num">{beforeCount}건</div>
          </div>
          <div className={`experiment-result-card ${improved ? 'success-style' : ''}`}>
            <div className="card-label">실험 중 {totalDays}일</div>
            <div className="card-num">{duringCount}건</div>
            {reductionPercent > 0 && (
              <span className="reduction-badge">{reductionPercent}% 감소</span>
            )}
          </div>
        </div>

        {improved && (
          <div className="subzone-header-card" style={{ marginTop: 14, background: 'var(--green-light)', borderColor: 'var(--green-border)' }}>
            <span className="parent-title" style={{ color: '#047857', background: 'white' }}>✓ 성공</span>
            <span className="desc" style={{ color: '#047857', fontWeight: 700 }}>
              트러블이 감소했어요! 의심성분이 원인일 가능성이 높아요.
            </span>
          </div>
        )}

        <div className="disc">{config?.disclaimer}</div>

        <div style={{ marginTop: 20, marginBottom: 24 }}>
          <button className="btn primary" style={{ width: '100%' }} onClick={openReportModal}>
            📊 피부 분석 리포트 보기 &gt;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" id="screenAnalysis">
      {trackInfo && (
        <div className="track-badge-row">
          <span className={`track-badge ${trackInfo.confidence}`}>
            기록 {trackInfo.days_tracked}일차 / 최소 3일 필요
          </span>
        </div>
      )}

      <div className="analysis-hero" style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="chip on" style={{ display: "inline-block", marginBottom: 10 }}>✨ AI 원인 분석</span>
            <h2 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, lineHeight: 1.4 }}>내 피부 트러블의<br />진짜 원인은 무엇일까?</h2>
            <div className="sub" style={{ marginBottom: 16 }}>정밀 원인 분석을 실행해보세요</div>
          </div>
          <img src="/mascot1.png" alt="" style={{ width: 64, height: 64, flexShrink: 0, marginTop: 2 }} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button 
            className="btn primary" 
            style={{ flex: 1, padding: "12px 6px", fontSize: "11px", fontWeight: "800" }} 
            onClick={() => openAnalysisModal(null)}
          >
            🔍 원인 분석 시작
          </button>
          <button 
            className="btn ghost" 
            style={{ flex: 1, padding: "12px 6px", fontSize: "11px", fontWeight: "800", background: "#FFFFFF", borderColor: "var(--teal)", color: "var(--teal)" }} 
            onClick={openStartExperimentModal}
          >
            🧪 실험 바로 시작
          </button>
        </div>

        <div style={{ marginTop: "16px", fontSize: "10.5px", color: "var(--text-muted)", textAlign: "center", lineHeight: "1.4" }}>
          ℹ️ 기록된 피부 데이터가 부족하면 정확한 원인 분석이 일시적으로 제한될 수 있습니다.
        </div>
      </div>

      <div className="sechead" style={{ marginTop: 24 }}>
        <h3>분석 과정</h3>
      </div>
      <div className="process-flow" style={{ marginBottom: 24 }}>
        <div className="process-steps">
          {STEPS.map((s, i) => (
            <div key={s.label} className={`process-step ${i === 0 ? "active" : ""}`}>
              <div className="process-step-icon">{s.icon}</div>
              <div className="process-step-label">{s.label}</div>
              <div className="process-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sechead"><h3>기록 히스토리</h3></div>
      <HistoryScreen />
    </div>
  );
}
