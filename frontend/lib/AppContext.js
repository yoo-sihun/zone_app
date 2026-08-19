"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, API_BASE } from "./api";

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function AppProvider({ children }) {
  // ── 설정 (GET /api/config) ──
  const [config, setConfig] = useState(null);

  // ── 프로필 ──
  const [profileId, setProfileId] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalAllowCancel, setProfileModalAllowCancel] = useState(false);
  const [profileList, setProfileList] = useState([]);

  // ── 화면/모드 ──
  const [screen, setScreenState] = useState("home");
  const [mode, setModeState] = useState("apply");
  const [slot, setSlot] = useState("am");
  const [troubleType, setTroubleType] = useState(null);
  const [focusedParentZone, setFocusedParentZone] = useState(null);

  const todayRef = useRef(startOfToday());
  const [currentDate, setCurrentDate] = useState(startOfToday());

  // ── 데이터 ──
  const [products, setProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  // 얼굴 탭은 즉시 저장하지 않고 여기 쌓아뒀다가 "기록 저장" 버튼을 눌러야 서버에 반영됨.
  // {zone, productId, date, slot, intent}. date/slot을 커밋 시점이 아니라 탭한 시점 값으로 저장해둬야
  // 저장 전에 날짜/시간대를 바꿔도 엉뚱한 날짜에 적용되지 않음.
  const [pendingApplications, setPendingApplications] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [activeExperiment, setActiveExperiment] = useState(null);
  const [dayData, setDayData] = useState({ log: {}, dots: [] });
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState(null);

  const [weather, setWeather] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [historyDays, setHistoryDays] = useState(7);
  const [historySummary, setHistorySummary] = useState(null);
  const [pastExperiments, setPastExperiments] = useState([]);
  const [bellLogged, setBellLogged] = useState(true);

  // ── 모달 ──
  const [productModal, setProductModal] = useState({ open: false, prefill: null, editId: null, mode: null });
  const [analysisModal, setAnalysisModal] = useState({ open: false, data: null });
  const [miscModal, setMiscModal] = useState({ open: false, kind: null });

  // ── 토스트 ──
  const [toasts, setToasts] = useState([]);
  const pushToast = useCallback((msg, kind = "warn") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  const showInteractionWarnings = useCallback((warnings) => {
    (warnings || []).forEach((w) => pushToast(`⚠ ${w.a} + ${w.b} — ${w.description}`, "warn"));
  }, [pushToast]);

  const [hint, setHint] = useState("");
  const flashTimer = useRef(null);
  const flash = useCallback((msg) => {
    setHint(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setHint(null), 1400);
  }, []);

  // ── 초기 설정 로드 ──
  useEffect(() => {
    api("/api/config").then((cfg) => {
      setConfig(cfg);
      setTroubleType(cfg.trouble_types[0]);
    });
  }, []);

  // ── 프로필 관련 ──
  const fetchProfiles = useCallback(async () => {
    try {
      return await api("/api/profiles");
    } catch (e) {
      return [];
    }
  }, []);

  const openProfilePicker = useCallback(async (allowCancel) => {
    const list = await fetchProfiles();
    setProfileList(list);
    setProfileModalAllowCancel(allowCancel);
    setProfileModalOpen(true);
  }, [fetchProfiles]);

  const createProfile = useCallback(async (name) => {
    const p = await api("/api/profiles", { method: "POST", body: JSON.stringify({ name }) });
    return p;
  }, []);

  const selectProfile = useCallback((id, name) => {
    const idStr = String(id);
    setProfileId(idStr);
    setProfileName(name);
    localStorage.setItem("zone_profile_id", idStr);
    localStorage.setItem("zone_profile_name", name);
    setProfileModalOpen(false);
  }, []);

  const deleteCurrentProfile = useCallback(async () => {
    await api(`/api/profiles/${profileId}`, { method: "DELETE" });
    localStorage.removeItem("zone_profile_id");
    localStorage.removeItem("zone_profile_name");
    setProfileId(null);
    pushToast("프로필을 삭제했어요", "ok");
    await openProfilePicker(false);
  }, [profileId, pushToast, openProfilePicker]);

  // ── 데이터 로더 ──
  const loadProducts = useCallback(async () => {
    const list = await api("/api/products");
    setProducts(list);
    return list;
  }, []);

  const loadDay = useCallback(async () => {
    const d = await api(`/api/day/${fmt(currentDate)}`);
    setDayData(d);
    return d;
  }, [currentDate]);

  const loadSuspects = useCallback(async () => {
    const list = await api("/api/suspects");
    setSuspects(list);
    return list;
  }, []);

  const loadActiveExperiment = useCallback(async () => {
    const exp = await api("/api/experiments/active");
    setActiveExperiment(exp);
    return exp;
  }, []);

  const loadWeather = useCallback(async () => {
    const d = fmt(todayRef.current);
    try {
      setWeather(await api(`/api/external-factors/${d}`));
    } catch (e) {
      setWeather(null);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    try {
      setRecommendations(await api("/api/products/recommended"));
    } catch (e) {
      setRecommendations([]);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const end = fmt(todayRef.current);
    const start = historyDays > 0
      ? fmt(new Date(todayRef.current.getTime() - historyDays * 86400000))
      : "2000-01-01";
    try {
      const summary = await api(`/api/history/summary?start=${start}&end=${end}`);
      setHistorySummary(summary);
    } catch (err) {
      pushToast(err.message, "warn");
    }
    try {
      setPastExperiments(await api("/api/experiments"));
    } catch (e) {
      setPastExperiments([]);
    }
  }, [historyDays, pushToast]);

  const refreshBell = useCallback(async () => {
    try {
      const s = await api("/api/today-status");
      setBellLogged(s.logged);
    } catch (e) { /* ignore */ }
  }, []);

  // ── 화면 전환 ──
  const setScreen = useCallback((name) => {
    setScreenState(name);
    setFocusedParentZone(null);
    if (name === "home") { loadWeather(); loadRecommendations(); refreshBell(); }
    if (name === "analysis") loadHistory();
  }, [loadWeather, loadRecommendations, refreshBell, loadHistory]);

  const setMode = useCallback((m) => {
    setModeState(m);
  }, []);

  // 기록 화면 안에서 "트러블도 기록할까요?"로 진입하는 별도 화면 — 하단 탭엔 없고 기록 화면의 하위 흐름
  const openTroubleScreen = useCallback(() => {
    setScreenState("trouble");
    setFocusedParentZone(null);
    setModeState("trouble");
  }, []);
  const closeTroubleScreen = useCallback(() => {
    setScreenState("record");
    setFocusedParentZone(null);
    setModeState("apply");
  }, []);

  // ── 줌 ──
  const zoomTo = useCallback((parentZone) => {
    setFocusedParentZone(parentZone);
  }, []);
  const zoomOut = useCallback(() => {
    setFocusedParentZone(null);
  }, []);

  // ── 날짜 네비게이션 ──
  const goPrevDay = useCallback(() => {
    setCurrentDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 1);
      return nd;
    });
    setFocusedParentZone(null);
  }, []);
  const goNextDay = useCallback(() => {
    setCurrentDate((d) => {
      if (d >= todayRef.current) return d;
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 1);
      return nd;
    });
    setFocusedParentZone(null);
  }, []);
  const goToDate = useCallback((date) => {
    if (date > todayRef.current) return; // 미래 날짜는 선택 불가
    setCurrentDate(new Date(date));
    setFocusedParentZone(null);
  }, []);

  // currentDate가 바뀔 때마다 하루치 기록을 다시 불러옴
  useEffect(() => {
    if (profileId) loadDay();
  }, [currentDate, profileId, loadDay]);

  // 분석 화면(히스토리 포함)에 있는 동안 기간(historyDays)이 바뀌면 다시 불러옴
  useEffect(() => {
    if (profileId && screen === "analysis") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDays, profileId]);

  // ── 얼굴 탭 액션 (제품 도포는 바로 저장하지 않고 대기열에 쌓았다가 "기록 저장"으로 한 번에 커밋) ──
  const stageApply = useCallback((zone) => {
    if (!selectedProductIds.length) { flash("먼저 제품을 고르세요"); return; }
    const dateStr = fmt(currentDate);
    const savedIds = (dayData.log[zone] && dayData.log[zone][slot]) || [];
    setPendingApplications((prev) => {
      let next = [...prev];
      for (const productId of selectedProductIds) {
        const idx = next.findIndex((e) => e.zone === zone && e.productId === productId && e.date === dateStr && e.slot === slot);
        if (idx !== -1) {
          next.splice(idx, 1); // 같은 걸 다시 탭하면 대기 취소
          continue;
        }
        next.push({ zone, productId, date: dateStr, slot, intent: savedIds.includes(productId) ? "remove" : "add" });
      }
      return next;
    });
  }, [selectedProductIds, currentDate, slot, dayData, flash]);

  const cancelPendingApplication = useCallback((zone, productId, date, entrySlot) => {
    setPendingApplications((prev) => prev.filter((e) => !(e.zone === zone && e.productId === productId && e.date === date && e.slot === entrySlot)));
  }, []);

  // 대기열에 쌓인 걸 순서대로 커밋 — 같은 배치 안에서 상성 경고가 서로를 올바르게 반영하도록 Promise.all 대신 순서대로 await
  const commitPendingApplications = useCallback(async () => {
    if (!pendingApplications.length) { flash("변경사항이 없어요"); return; }
    let appliedCount = 0, removedCount = 0;
    const allWarnings = [];
    try {
      for (const { zone, productId, date, slot: entrySlot } of pendingApplications) {
        const r = await api("/api/log/toggle", {
          method: "POST",
          body: JSON.stringify({ date, zone, time_slot: entrySlot, product_id: productId }),
        });
        if (r.applied) appliedCount++; else removedCount++;
        if (r.warnings && r.warnings.length) allWarnings.push(...r.warnings);
      }
      if (appliedCount && removedCount) pushToast(`${appliedCount}개 저장, ${removedCount}개 지웠어요`, "ok");
      else if (appliedCount) pushToast(appliedCount > 1 ? `${appliedCount}개 저장됐어요 ✓` : "저장됐어요 ✓", "ok");
      else pushToast(removedCount > 1 ? `${removedCount}개 지웠어요` : "지웠어요", "ok");
      showInteractionWarnings(allWarnings);
      refreshBell();
      setPendingApplications([]);
    } catch (err) {
      alert(err.message);
    }
    await loadDay();
  }, [pendingApplications, flash, pushToast, showInteractionWarnings, refreshBell, loadDay]);

  const toggleProductSelection = useCallback((id) => {
    setSelectedProductIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }, []);

  // 얼굴을 다시 탭하지 않고, 기록 목록에서 특정 항목 하나만 바로 지울 때 씀(선택 상태와 무관)
  const removeProductFromZone = useCallback(async (zone, productId) => {
    try {
      const r = await api("/api/log/toggle", {
        method: "POST",
        body: JSON.stringify({ date: fmt(currentDate), zone, time_slot: slot, product_id: productId }),
      });
      pushToast(r.applied ? "저장됐어요 ✓" : "지웠어요", "ok");
      refreshBell();
    } catch (err) {
      alert(err.message);
    }
    await loadDay();
  }, [currentDate, slot, pushToast, refreshBell, loadDay]);

  const placeDot = useCallback(async (zone, x, y) => {
    await api("/api/dots", {
      method: "POST",
      body: JSON.stringify({ date: fmt(currentDate), zone, type: troubleType, x, y }),
    });
    await loadDay();
  }, [currentDate, troubleType, loadDay]);

  const deleteDot = useCallback(async (id) => {
    await api(`/api/dots/${id}`, { method: "DELETE" });
    await loadDay();
  }, [loadDay]);

  // ── 제품 ──
  const openProductModal = useCallback((prefill, editId, mode) => {
    setProductModal({ open: true, prefill: prefill || null, editId: editId || null, mode: mode || null });
  }, []);
  const closeProductModal = useCallback(() => setProductModal({ open: false, prefill: null, editId: null, mode: null }), []);

  const saveProduct = useCallback(async (name, ingredients, editId) => {
    const body = JSON.stringify({ name, ingredients });
    const r = editId
      ? await api(`/api/products/${editId}`, { method: "PATCH", body })
      : await api("/api/products", { method: "POST", body });
    if (r.warnings && r.warnings.length) pushToast(`⚠ 의심 성분 포함: ${r.warnings.join(", ")}`, "warn");
    closeProductModal();
    await loadProducts();
  }, [pushToast, closeProductModal, loadProducts]);

  const deleteProduct = useCallback(async (id) => {
    await api(`/api/products/${id}`, { method: "DELETE" });
    setSelectedProductIds((ids) => ids.filter((x) => x !== id));
    setPendingApplications((prev) => prev.filter((e) => e.productId !== id));
    await loadProducts();
    await loadDay();
  }, [loadProducts, loadDay]);

  const copyPrevious = useCallback(async () => {
    const r = await api(`/api/log/copy-previous?day=${fmt(currentDate)}`, { method: "POST" });
    if (r.skipped && r.skipped.length) pushToast(`실험 진행 중이라 제외됨: ${r.skipped.join(", ")}`, "warn");
    showInteractionWarnings(r.warnings);
    await loadDay();
  }, [currentDate, pushToast, showInteractionWarnings, loadDay]);

  const clearDay = useCallback(async () => {
    await api(`/api/log/${fmt(currentDate)}`, { method: "DELETE" });
    const dateStr = fmt(currentDate);
    setPendingApplications((prev) => prev.filter((e) => e.date !== dateStr));
    await loadDay();
  }, [currentDate, loadDay]);

  // ── 분석 ──
  const openAnalysisModal = useCallback(async (typeFilter) => {
    const filter = typeFilter !== undefined ? typeFilter : analysisTypeFilter;
    setAnalysisTypeFilter(filter);
    const r = await api(`/api/analysis${filter ? "?type=" + filter : ""}`);
    setAnalysisModal({ open: true, data: r });
  }, [analysisTypeFilter]);
  const closeAnalysisModal = useCallback(() => setAnalysisModal({ open: false, data: null }), []);

  const saveSuspectFromAnalysis = useCallback(async (ingredient) => {
    await api("/api/suspects", { method: "POST", body: JSON.stringify({ ingredient }) });
    pushToast(`"${ingredient}" 의심 성분으로 저장했어요`, "ok");
  }, [pushToast]);

  // ── 실험 ──
  const startExperiment = useCallback(async (ingredient, durationDays) => {
    try {
      await api("/api/experiments", { method: "POST", body: JSON.stringify({ ingredient, duration_days: durationDays || 3 }) });
      await loadActiveExperiment();
      await loadProducts();
      closeAnalysisModal();
      setMiscModal({ open: false, kind: null });
      pushToast(`"${ingredient}" ${durationDays || 3}일 실험을 시작했어요`, "ok");
    } catch (err) {
      alert(err.message);
    }
  }, [loadActiveExperiment, loadProducts, closeAnalysisModal, pushToast]);

  const stopExperiment = useCallback(async () => {
    await api(`/api/experiments/${activeExperiment.id}`, { method: "PATCH" });
    await loadActiveExperiment();
    await loadProducts();
  }, [activeExperiment, loadActiveExperiment, loadProducts]);

  const closeMisc = useCallback(() => setMiscModal({ open: false, kind: null }), []);

  const openSuspectsModal = useCallback(async () => {
    await loadSuspects();
    setMiscModal({ open: true, kind: "suspects" });
  }, [loadSuspects]);

  const openFactorsModal = useCallback(() => {
    setMiscModal({ open: true, kind: "factors" });
  }, []);

  const openReportModal = useCallback(() => {
    setMiscModal({ open: true, kind: "report" });
  }, []);

  const openExpResultModal = useCallback((experimentId) => {
    setMiscModal({ open: true, kind: "expResult", experimentId: experimentId || activeExperiment?.id });
  }, [activeExperiment]);

  const openStartExperimentModal = useCallback(async () => {
    await loadSuspects();
    setMiscModal({ open: true, kind: "startExperiment" });
  }, [loadSuspects]);

  // ── 시작 시퀀스 ──
  const startApp = useCallback(async () => {
    await loadProducts();
    await loadDay();
    await loadActiveExperiment();
    setScreen("home");
    refreshBell();
  }, [loadProducts, loadDay, loadActiveExperiment, setScreen, refreshBell]);

  const initRanRef = useRef(false);
  useEffect(() => {
    if (initRanRef.current || !config) return;
    initRanRef.current = true;
    (async () => {
      const savedId = localStorage.getItem("zone_profile_id");
      const savedName = localStorage.getItem("zone_profile_name") || "";
      if (savedId) {
        const list = await fetchProfiles();
        if (list.some((p) => String(p.id) === savedId)) {
          setProfileId(savedId);
          setProfileName(savedName);
          return;
        }
        localStorage.removeItem("zone_profile_id");
        localStorage.removeItem("zone_profile_name");
      }
      openProfilePicker(false);
    })();
  }, [config, fetchProfiles, openProfilePicker]);

  useEffect(() => {
    if (profileId) startApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const value = {
    API_BASE,
    config,
    fmt,
    today: todayRef.current,
    profileId, profileName,
    profileModalOpen, profileModalAllowCancel, profileList,
    openProfilePicker, createProfile, selectProfile,
    closeProfileModal: () => setProfileModalOpen(false),
    deleteCurrentProfile,
    screen, setScreen,
    openTroubleScreen, closeTroubleScreen,
    mode, setMode,
    slot, setSlot,
    troubleType, setTroubleType,
    focusedParentZone, zoomTo, zoomOut,
    currentDate, goPrevDay, goNextDay, goToDate,
    products, selectedProductIds, setSelectedProductIds, toggleProductSelection,
    suspects, activeExperiment, loadActiveExperiment,
    dayData,
    analysisTypeFilter,
    weather, loadWeather,
    recommendations,
    historyDays, setHistoryDays, historySummary, pastExperiments,
    bellLogged, refreshBell,
    pendingApplications, stageApply, cancelPendingApplication, commitPendingApplications,
    removeProductFromZone, placeDot, deleteDot,
    productModal, openProductModal, closeProductModal, saveProduct, deleteProduct,
    copyPrevious, clearDay,
    analysisModal, openAnalysisModal, closeAnalysisModal, saveSuspectFromAnalysis,
    startExperiment, stopExperiment, openExpResultModal, openStartExperimentModal,
    miscModal, closeMisc, openSuspectsModal, openFactorsModal, openReportModal,
    loadSuspects,
    hint, flash, setHint,
    toasts, pushToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
