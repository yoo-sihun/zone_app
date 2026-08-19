"use client";

import { useApp } from "@/lib/AppContext";
import FaceHistory from "@/components/FaceHistory";

const RANGES = [
  { days: 7, label: "최근 7일" },
  { days: 30, label: "최근 30일" },
  { days: 0, label: "전체 기록" },
];

const STATUS_LABEL = { active: "진행 중", completed: "완료", stopped: "중단" };

export default function HistoryScreen() {
  const {
    historyDays, setHistoryDays, historySummary, pastExperiments,
    openReportModal, openExpResultModal,
  } = useApp();

  const rangeLabel = historyDays > 0 ? `최근 ${historyDays}일` : "전체 기간";
  const summaryText = historySummary
    ? `${rangeLabel} · 도포 ${historySummary.total_applies}회 · 트러블 ${historySummary.dots.length}건`
    : "";

  return (
    <div className="screen" id="screenHistory">
      <div className="segrow">
        {RANGES.map((r) => (
          <button key={r.days} className={historyDays === r.days ? "on" : ""} onClick={() => setHistoryDays(r.days)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="summary-badge-card">{summaryText}</div>

      <FaceHistory summary={historySummary} />

      <div className="historylegend">
        <div className="legenditem"><span className="legendswatch applied" />바른 횟수</div>
        <div className="legenditem"><span className="legendswatch comedonal" />면포성</div>
        <div className="legenditem"><span className="legendswatch papule" />구진</div>
        <div className="legenditem"><span className="legendswatch pustule" />화농성</div>
        <div className="legenditem"><span className="legendswatch redness" />붉은기</div>
      </div>

      <div className="row">
        <button className="btn ghost secondary-action" onClick={() => openReportModal()}>📄 PDF 종합 리포트 출력</button>
      </div>

      <div className="sechead"><h3>지난 성분 배제 실험</h3></div>
      <div className="explist">
        {pastExperiments.length ? pastExperiments.map((e) => (
          <div key={e.id} className="expitem" onClick={() => openExpResultModal(e.id)}>
            <div>
              <div className="expitemname">{e.ingredient}</div>
              <div className="expitemdate">{e.start_date} 시작</div>
            </div>
            <span className={`expstatus ${e.status}`}>{STATUS_LABEL[e.status] || e.status}</span>
          </div>
        )) : <div className="empty">아직 진행한 실험이 없습니다.</div>}
      </div>
    </div>
  );
}
