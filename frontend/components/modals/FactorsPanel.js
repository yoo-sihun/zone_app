"use client";

import { useApp } from "@/lib/AppContext";
import { useExternalFactors } from "@/lib/useExternalFactors";

function fmt(dt) {
  const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, "0"), day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FactorsPanel() {
  const { currentDate, closeMisc, pushToast } = useApp();
  const d = fmt(currentDate);
  const f = useExternalFactors(d);

  async function onSync() {
    try {
      await f.syncPm25();
    } catch (err) {
      alert(err.message);
    }
  }

  async function onSave() {
    await f.save();
    closeMisc();
    pushToast("저장했어요", "ok");
  }

  if (!f.loaded) return null;

  return (
    <>
      <h2>오늘의 외부 요인</h2>
      <div className="sub">{d}</div>
      <div className="field">
        <label>수면 시간 (시간)</label>
        <input type="number" step="0.5" min="0" max="24" value={f.sleep} onChange={(e) => f.setSleep(e.target.value)} />
      </div>
      <div className="field">
        <label>생리 주기</label>
        <select value={f.phase} onChange={(e) => f.setPhase(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="menstrual">생리기</option>
          <option value="follicular">난포기</option>
          <option value="ovulation">배란기</option>
          <option value="luteal">황체기</option>
        </select>
      </div>
      <div className="field">
        <label>오늘의 피부 상태</label>
        <select value={f.skinCondition} onChange={(e) => f.setSkinCondition(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="건성">건성</option>
          <option value="보통">보통</option>
          <option value="유분성">유분성</option>
          <option value="복합성">복합성</option>
        </select>
      </div>
      <div className="field">
        <label>메모</label>
        <textarea value={f.memo} onChange={(e) => f.setMemo(e.target.value)} placeholder="특이사항" />
      </div>
      <div className="field">
        <label>미세먼지 (PM2.5)</label>
        <div className="pm25row">
          <span>{f.pm25Status || (f.pm25 != null ? `${f.pm25} ㎍/㎥` : "아직 조회 안 함")}</span>
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
