"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// 외부 요인(수면/생리주기/메모/자가진단 피부상태) 폼 상태 + 저장 로직 공용 훅.
// FactorsPanel(마이 화면 모달)과 RecordScreen(트러블 모드 인라인)이 같이 씀.
export function useExternalFactors(dateStr) {
  const [loaded, setLoaded] = useState(false);
  const [sleep, setSleep] = useState("");
  const [phase, setPhase] = useState("");
  const [memo, setMemo] = useState("");
  const [skinCondition, setSkinCondition] = useState("");
  const [pm25, setPm25] = useState(null);
  const [pm25Status, setPm25Status] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      let data = null;
      try { data = await api(`/api/external-factors/${dateStr}`); } catch (e) { data = null; }
      if (cancelled) return;
      data = data || {};
      setSleep(data.sleep_hours ?? "");
      setPhase(data.menstrual_phase || "");
      setMemo(data.memo || "");
      setSkinCondition(data.skin_condition || "");
      setPm25(data.pm25 ?? null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [dateStr]);

  async function syncPm25() {
    setPm25Status("조회 중…");
    try {
      const r = await api(`/api/external-factors/${dateStr}/sync-pm25`, { method: "POST" });
      setPm25(r.pm25 ?? null);
      setPm25Status(null);
    } catch (err) {
      setPm25Status("조회 실패");
      throw err;
    }
  }

  async function save() {
    await api("/api/external-factors", {
      method: "POST",
      body: JSON.stringify({
        date: dateStr,
        sleep_hours: sleep === "" ? null : parseFloat(sleep),
        menstrual_phase: phase || null,
        memo: memo.trim() || null,
        skin_condition: skinCondition || null,
      }),
    });
  }

  return {
    loaded,
    sleep, setSleep,
    phase, setPhase,
    memo, setMemo,
    skinCondition, setSkinCondition,
    pm25, pm25Status,
    syncPm25, save,
  };
}
