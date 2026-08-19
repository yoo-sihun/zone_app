"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { API_BASE, getProfileId } from "@/lib/api";

function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReportPanel() {
  const { today, closeMisc, pushToast } = useApp();
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const [start, setStart] = useState(fmt(weekAgo));
  const [end, setEnd] = useState(fmt(today));

  async function onDownload() {
    if (!start || !end) { alert("기간을 선택해주세요"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/reports/pdf?start=${start}&end=${end}`, {
        headers: { "X-Profile-Id": getProfileId() },
      });
      if (!res.ok) throw new Error("리포트 생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `zone-report-${start}_${end}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushToast(err.message, "warn");
    }
  }

  return (
    <>
      <h2>PDF 리포트</h2>
      <div className="sub">기간을 골라서 트러블/도포 히스토리/의심 성분 요약을 PDF로 받아요</div>
      <div className="field"><label>시작일</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="field"><label>종료일</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div className="row">
        <button className="btn ghost" onClick={closeMisc}>닫기</button>
        <button className="btn primary" onClick={onDownload}>다운로드</button>
      </div>
    </>
  );
}
