"use client";

import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function HomeScreen() {
  const {
    weather, loadWeather, recommendations, setScreen, setSelectedProductId,
    setMode, openSuspectsModal, openReportModal, activeExperiment, openExpResultModal,
    pushToast,
  } = useApp();

  async function onSyncWeather() {
    try {
      await api(`/api/external-factors/${fmtToday()}/sync-pm25`, { method: "POST" });
      pushToast("미세먼지 정보를 갱신했어요", "ok");
      loadWeather();
    } catch (err) {
      pushToast(err.message, "warn");
    }
  }

  function fmtToday() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function pickRecommendation(id) {
    setSelectedProductId(id);
    setScreen("record");
    setMode("apply");
  }

  return (
    <div className="screen" id="screenHome">
      <div className="weathercard">
        <div className="weathertitle">오늘의 피부 날씨</div>
        <div className="weathergrid">
          <div className="weatheritem">
            <div className="wlabel">미세먼지</div>
            <div className="wvalue">{weather?.pm25 != null ? `${weather.pm25} ㎍/㎥` : "-"}</div>
          </div>
          <div className="weatheritem">
            <div className="wlabel">습도</div>
            <div className="wvalue">{weather?.humidity != null ? `${weather.humidity}%` : "준비 중"}</div>
          </div>
          <div className="weatheritem">
            <div className="wlabel">자외선</div>
            <div className="wvalue">{weather?.uv_index != null ? weather.uv_index : "준비 중"}</div>
          </div>
        </div>
        <button className="btn ghost small" type="button" onClick={onSyncWeather}>미세먼지 동기화</button>
      </div>

      <div className="sechead"><h3>오늘의 스킨케어 추천</h3></div>
      <div className="recorow-container">
        <div className="recorow">
          {recommendations.length ? recommendations.map((p) => (
            <div key={p.id} className="recocard" onClick={() => pickRecommendation(p.id)}>
              <div className="reconame">{p.name}</div>
              <div className="recoing">{p.ingredients.slice(0, 3).join(" · ")}</div>
            </div>
          )) : <div className="empty">오늘 등록된 제품을 다 바르셨거나, 아직 등록한 제품이 없어요.</div>}
        </div>
      </div>

      <div className="sechead"><h3>빠른 메뉴</h3></div>
      <div className="quicklinks">
        <button className="qlbtn" onClick={() => setScreen("record")}>
          <div className="qlbtn-icon">📝</div><span>기록하기</span>
        </button>
        <button className="qlbtn" onClick={() => openSuspectsModal()}>
          <div className="qlbtn-icon">⚠️</div><span>의심 성분</span>
        </button>
        <button className="qlbtn" onClick={() => { if (!activeExperiment) { pushToast("진행 중인 실험이 없어요", "warn"); return; } openExpResultModal(); }}>
          <div className="qlbtn-icon">🧪</div><span>실험 관리</span>
        </button>
        <button className="qlbtn" onClick={() => openReportModal()}>
          <div className="qlbtn-icon">📄</div><span>리포트</span>
        </button>
      </div>
    </div>
  );
}
