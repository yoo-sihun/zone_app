"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api, API_BASE, getProfileId } from "@/lib/api";

const STATUS_COLOR = {
  "양호": "green",
  "정상범위": "teal",
  "진행중": "amber",
  "주의": "coral",
};

function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReportPanel() {
  const { today, closeMisc, pushToast } = useApp();
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const [start, setStart] = useState(fmt(weekAgo));
  const [end, setEnd] = useState(fmt(today));
  const [zoneStatus, setZoneStatus] = useState(null);
  const [recos, setRecos] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!start || !end || start > end) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await api(`/api/history/zone-status?start=${start}&end=${end}`);
        if (cancelled) return;
        setZoneStatus(list);
        const needyZones = list.filter((z) => z.status !== "양호");
        const entries = await Promise.all(
          needyZones.map(async (z) => {
            try {
              const products = await api(`/api/products/recommended?zone=${z.zone}`);
              return [z.zone, products[0] || null];
            } catch (e) {
              return [z.zone, null];
            }
          })
        );
        if (!cancelled) setRecos(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) pushToast(err.message, "warn");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

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
      <h2>피부 분석 리포트</h2>
      <div className="sub">기간을 골라서 부위별 상태와 관리 팁, 트러블/도포 히스토리를 확인해요</div>
      <div className="field"><label>시작일</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="field"><label>종료일</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>

      {loading && <div className="spinner">불러오는 중…</div>}

      {zoneStatus && !loading && (
        <div className="zonestatus-list">
          {zoneStatus.map((z) => (
            <div key={z.zone} className="zonestatus-card">
              <div className="zonestatus-head">
                <span className="zonestatus-name">{z.zone_label}</span>
                <span className={`zonestatus-badge ${STATUS_COLOR[z.status]}`}>{z.status}</span>
              </div>
              <div className="zonestatus-tip">{z.tip}</div>
              {recos[z.zone] && (
                <div className="zonestatus-reco">💡 추천: {recos[z.zone].name}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <button className="btn ghost" onClick={closeMisc}>닫기</button>
        <button className="btn primary" onClick={onDownload}>PDF 다운로드</button>
      </div>
    </>
  );
}
