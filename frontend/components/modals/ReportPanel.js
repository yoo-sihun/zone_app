"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api, API_BASE, getProfileId } from "@/lib/api";

const STATUS_COLOR_CLASS = {
  "양호": "good",
  "정상범위": "good",
  "진행중": "warning",
  "주의": "danger",
};

const MOCKUP_STATUS = {
  "양호": "양호",
  "정상범위": "보통",
  "진행중": "주의",
  "주의": "위험",
};

function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReportPanel() {
  const { today, closeMisc, pushToast, config } = useApp();
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
        
        // Fetch recommendations for each zone
        const entries = await Promise.all(
          list.map(async (z) => {
            try {
              const products = await api(`/api/products/recommended?zone=${z.zone}`);
              return [z.zone, products.slice(0, 2)]; // Get up to 2 recommendations
            } catch (e) {
              return [z.zone, []];
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
      <div className="sub" style={{ marginBottom: 16 }}>기간별 부위별 상태 및 관리 가이드를 확인해보세요</div>
      <div className="field" style={{ marginBottom: 8 }}><label>시작일</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="field" style={{ marginBottom: 16 }}><label>종료일</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>

      {loading && <div className="spinner">분석 데이터 생성 중…</div>}

      {zoneStatus && !loading && (
        <>
          <div className="card" style={{ padding: 14, background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 800 }}>부위별 기록 요약</h4>
            <table className="report-zone-table">
              <thead>
                <tr>
                  <th>부위</th>
                  <th>상태</th>
                  <th style={{ textAlign: 'right' }}>기록 건수</th>
                </tr>
              </thead>
              <tbody>
                {zoneStatus.map((z) => (
                  <tr key={z.zone}>
                    <td style={{ fontWeight: 800 }}>{z.zone_label}</td>
                    <td>
                      <span className={`status-badge ${STATUS_COLOR_CLASS[z.status]}`}>
                        {MOCKUP_STATUS[z.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-faint)' }}>{z.count}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sechead" style={{ marginTop: 20 }}>
            <h3>부위별 분석 &amp; 관리 가이드</h3>
          </div>

          <div className="guide-details">
            {zoneStatus.map((z) => {
              const statusClass = STATUS_COLOR_CLASS[z.status];
              const zoneRecos = recos[z.zone] || [];
              return (
                <div key={z.zone} className="guide-detail-card">
                  <div className="guide-detail-header">
                    <span className="guide-detail-title">
                      <b>{z.zone_label}</b>
                    </span>
                    <span className={`status-badge ${statusClass}`}>
                      {MOCKUP_STATUS[z.status]}
                    </span>
                  </div>
                  <div className="guide-detail-body">
                    {z.tip}
                    {z.suspects.length > 0 && (
                      <div style={{ marginTop: 8, color: 'var(--coral)', fontSize: 10, fontWeight: 700 }}>
                        ⚠️ 의심 성분 노출: {z.suspects.join(", ")}
                      </div>
                    )}
                  </div>
                  {zoneRecos.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-faint)', marginBottom: 6 }}>추천 관리 제품</div>
                      <div className="guide-detail-products">
                        {zoneRecos.map((p) => (
                          <div key={p.id} className="guide-detail-product-card">
                            <span className="prod-icon">🧴</span>
                            <span className="prod-name">{p.name}{p.category ? ` (${p.category})` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {zoneStatus && !loading && (
        <div className="disc">{config?.disclaimer}</div>
      )}

      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn ghost" onClick={closeMisc}>닫기</button>
        <button className="btn primary" onClick={onDownload}>PDF 다운로드</button>
      </div>
    </>
  );
}
