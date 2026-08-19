"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function FactorsPanel() {
  const { currentDate, closeMisc, pushToast } = useApp();
  const d = fmt(currentDate);
  const [loaded, setLoaded] = useState(false);
  const [sleep, setSleep] = useState("");
  const [phase, setPhase] = useState("");
  const [memo, setMemo] = useState("");
  const [pm25, setPm25] = useState(null);
  const [pm25Status, setPm25Status] = useState(null);

  function fmt(dt) {
    const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, "0"), day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  useEffect(() => {
    (async () => {
      let data = null;
      try { data = await api(`/api/external-factors/${d}`); } catch (e) { data = null; }
      data = data || {};
      setSleep(data.sleep_hours ?? "");
      setPhase(data.menstrual_phase || "");
      setMemo(data.memo || "");
      setPm25(data.pm25 ?? null);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  async function onSync() {
    setPm25Status("조회 중…");
    try {
      const r = await api(`/api/external-factors/${d}/sync-pm25`, { method: "POST" });
      setPm25(r.pm25 ?? null);
      setPm25Status(null);
    } catch (err) {
      setPm25Status("조회 실패");
      alert(err.message);
    }
  }

  async function onSave() {
    await api("/api/external-factors", {
      method: "POST",
      body: JSON.stringify({
        date: d,
        sleep_hours: sleep === "" ? null : parseFloat(sleep),
        menstrual_phase: phase || null,
        memo: memo.trim() || null,
      }),
    });
    closeMisc();
    pushToast("저장했어요", "ok");
  }

  if (!loaded) return null;

  return (
    <>
      <h2>오늘의 외부 요인</h2>
      <div className="sub">{d}</div>
      <div className="field">
        <label>수면 시간 (시간)</label>
        <input type="number" step="0.5" min="0" max="24" value={sleep} onChange={(e) => setSleep(e.target.value)} />
      </div>
      <div className="field">
        <label>생리 주기</label>
        <select value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="menstrual">생리기</option>
          <option value="follicular">난포기</option>
          <option value="ovulation">배란기</option>
          <option value="luteal">황체기</option>
        </select>
      </div>
      <div className="field">
        <label>메모</label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이사항" />
      </div>
      <div className="field">
        <label>미세먼지 (PM2.5)</label>
        <div className="pm25row">
          <span>{pm25Status || (pm25 != null ? `${pm25} ㎍/㎥` : "아직 조회 안 함")}</span>
          <button className="btn ghost small" type="button" onClick={onSync}>동기화</button>
        </div>
      </div>
      <div className="row">
        <button className="btn ghost" onClick={closeMisc}>닫기</button>
        <button className="btn primary" onClick={onSave}>저장</button>
      </div>
    </>
  );
}
