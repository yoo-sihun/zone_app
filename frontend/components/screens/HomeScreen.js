"use client";

import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function HomeScreen() {
  const {
    weather, loadWeather, setScreen, setSelectedProductIds,
    setMode, openSuspectsModal, openReportModal, activeExperiment, openExpResultModal,
    pushToast, profileName, dayData, products, openProductModal, openAnalysisModal,
    bellLogged,
  } = useApp();

  async function onSyncWeather() {
    const results = await Promise.allSettled([
      api(`/api/external-factors/${fmtToday()}/sync-pm25`, { method: "POST" }),
      api(`/api/external-factors/${fmtToday()}/sync-weather`, { method: "POST" }),
    ]);
    const [pm25, weather] = results;
    if (pm25.status === "fulfilled" || weather.status === "fulfilled") {
      pushToast("날씨 정보를 갱신했어요", "ok");
    }
    if (pm25.status === "rejected") pushToast(`미세먼지: ${pm25.reason.message}`, "warn");
    if (weather.status === "rejected") pushToast(`습도: ${weather.reason.message}`, "warn");
    loadWeather();
  }

  function fmtToday() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function pickRecommendation(id) {
    setSelectedProductIds([id]);
    setScreen("record");
    setMode("apply");
    pushToast("제품을 선택했어요 — 얼굴에서 바른 부위를 탭해주세요", "ok");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Calculate dynamic stats for the summary card
  const troubleCount = dayData?.dots?.length || 0;
  const redMarkCount = dayData?.dots?.filter(d => d.type === "redness" || d.type === "papule").length || 0;
  const drynessText = weather?.humidity != null && weather.humidity < 40 ? "주의" : "보통";
  const oilinessText = weather?.uv_index != null && weather.uv_index > 6 ? "많음" : "보통";

  return (
    <div className="screen" id="screenHome" style={{ background: "var(--bg)" }}>

      {!bellLogged && (
        <div className="today-cta-card" onClick={() => setScreen("record")}>
          <span>📝 오늘 아직 스킨케어 기록이 없어요</span>
          <span className="linkbtn">기록하러 가기</span>
        </div>
      )}

      {/* ── 1. MUDI Hero Section ── */}
      <div className="mudi-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", marginTop: "8px", position: "relative" }}>
        <div className="hero-text-wrap" style={{ flex: 1, paddingRight: "10px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "900", color: "var(--text)", margin: "0 0 8px 0", lineHeight: "1.4" }}>
            {profileName || "무디"}님, 오늘도<br />피부기록 시작해볼까요?
          </h2>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: "1.5" }}>
            기록할수록 더 정확하게,<br />나에게 딱 맞는 피부 루틴을 찾아드려요.
          </p>
        </div>
        
        {/* Cute Cloud/Cream Cartoon SVG */}
        <div className="hero-char-wrap" style={{ width: "110px", height: "90px", flexShrink: 0 }}>
          <svg viewBox="0 0 120 100" width="100%" height="100%">
            <defs>
              <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#F5F3FF" />
              </linearGradient>
            </defs>
            {/* Fluffy cream body */}
            <path d="M20,65 C10,65 5,55 10,45 C5,35 15,25 30,30 C38,15 58,10 75,20 C90,10 105,25 100,40 C110,50 105,65 90,65 Z" fill="url(#cloudGrad)" filter="drop-shadow(0 4px 10px rgba(124,111,232,0.12))" />
            <path d="M45,28 C50,22 65,12 60,8 C55,4 42,16 45,28 Z" fill="url(#cloudGrad)" />
            {/* Blushing Face */}
            <circle cx="45" cy="46" r="3" fill="#1E1B4B" />
            <circle cx="65" cy="46" r="3" fill="#1E1B4B" />
            <ellipse cx="38" cy="51" rx="4" ry="2" fill="#FDA4AF" />
            <ellipse cx="72" cy="51" rx="4" ry="2" fill="#FDA4AF" />
            <path d="M52,50 Q55,53 58,50" fill="none" stroke="#1E1B4B" strokeWidth="1.5" strokeLinecap="round" />
            {/* Purple Magnifying Glass */}
            <circle cx="85" cy="45" r="8" fill="none" stroke="var(--teal)" strokeWidth="2.5" />
            <line x1="91" y1="51" x2="98" y2="58" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>      {/* 오늘의 피부 날씨 Card */}
      <div className="card" style={{ padding: "16px", borderRadius: "20px", position: "relative", marginBottom: "24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--text)" }}>☀️ 오늘의 피부 날씨</span>
          <button 
            type="button" 
            onClick={onSyncWeather} 
            title="날씨 동기화"
            style={{
              background: "none",
              border: "none",
              fontSize: "14px",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "50%",
              color: "var(--text-faint)",
              transition: "all 0.2s ease",
              lineHeight: 1
            }}
          >
            🔄
          </button>
        </div>
        
        <div className="weathergrid" style={{ display: "flex", gap: "10px" }}>
          <div className="weatheritem" style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 8px", textAlign: "center" }}>
            <div className="wlabel" style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700", marginBottom: "4px" }}>미세먼지</div>
            <div className="wvalue" style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)" }}>
              {weather?.pm25 != null ? `${weather.pm25} ㎍/㎥` : "-"}
            </div>
          </div>
          <div className="weatheritem" style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 8px", textAlign: "center" }}>
            <div className="wlabel" style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700", marginBottom: "4px" }}>습도</div>
            <div className="wvalue" style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)" }}>
              {weather?.humidity != null ? `${weather.humidity}%` : "-"}
            </div>
          </div>
          <div className="weatheritem" style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "10px 8px", textAlign: "center" }}>
            <div className="wlabel" style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700", marginBottom: "4px" }}>자외선</div>
            <div className="wvalue" style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)" }}>
              {weather?.uv_index != null ? weather.uv_index : "-"}
            </div>
          </div>
        </div>
      </div>
      {/* ── 2. Menu Grid (4 Quick Cards) ── */}
      <div className="quick-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "24px" }}>
        <button className="qlbtn" onClick={() => setScreen("recommend")} style={{ height: "82px", padding: "12px 4px", borderRadius: "18px" }}>
          <div className="qlbtn-icon" style={{ fontSize: "20px", background: "none", width: "auto", height: "auto", marginBottom: "4px" }}>☀️</div>
          <span style={{ fontSize: "11px", fontWeight: "800" }}>제품 추천</span>
        </button>
        <button className="qlbtn" onClick={() => openAnalysisModal(null)} style={{ height: "82px", padding: "12px 4px", borderRadius: "18px" }}>
          <div className="qlbtn-icon" style={{ fontSize: "20px", background: "none", width: "auto", height: "auto", marginBottom: "4px" }}>🧪</div>
          <span style={{ fontSize: "11px", fontWeight: "800" }}>성분 분석</span>
        </button>
        <button className="qlbtn" onClick={() => { setScreen("record"); setMode("trouble"); }} style={{ height: "82px", padding: "12px 4px", borderRadius: "18px" }}>
          <div className="qlbtn-icon" style={{ fontSize: "20px", background: "none", width: "auto", height: "auto", marginBottom: "4px" }}>📝</div>
          <span style={{ fontSize: "11px", fontWeight: "800" }}>트러블 기록</span>
        </button>
        <button className="qlbtn" onClick={() => openReportModal()} style={{ height: "82px", padding: "12px 4px", borderRadius: "18px" }}>
          <div className="qlbtn-icon" style={{ fontSize: "20px", background: "none", width: "auto", height: "auto", marginBottom: "4px" }}>📊</div>
          <span style={{ fontSize: "11px", fontWeight: "800" }}>분석 리포트</span>
        </button>
      </div>

      {/* ── 3. Active Experiment Card ── */}
      {activeExperiment && (
        <div className="card" style={{ padding: "16px", borderRadius: "20px", marginBottom: "24px", border: "1.5px solid var(--teal)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--text)" }}>
              🧪 {activeExperiment.ingredient} 제외 실험 진행 중
            </span>
            <button className="linkbtn" onClick={() => openExpResultModal()} style={{ fontSize: "11px" }}>자세히 보기 &gt;</button>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
            의심성분을 화장대 및 스킨케어 루틴에서 제외한 실험 {activeExperiment.day}일차입니다.
          </div>
        </div>
      )}

      {/* ── 4. 오늘의 한눈에 요약 Card ── */}
      <div className="sechead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>오늘의 한눈에 요약</h3>
        <button className="linkbtn" onClick={() => openReportModal()} style={{ fontSize: "11px", color: "var(--text-faint)" }}>자세히 보기 &gt;</button>
      </div>

      <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
          {/* Static mini outline face */}
          <div style={{ width: "70px", height: "80px", flexShrink: 0, position: "relative" }}>
            <svg viewBox="0 0 400 440" width="100%" height="100%">
              <path d="M165,380 C165,420 155,430 155,430 L245,430 C245,430 235,420 235,380" fill="#FAF9FE" stroke="#D2D0DF" strokeWidth="4" />
              <path d="M78,200 C68,200 64,220 68,235 C72,250 78,245 78,245" fill="#FFFFFF" stroke="#D2D0DF" strokeWidth="4" />
              <path d="M322,200 C332,200 336,220 332,235 C328,250 322,245 322,245" fill="#FFFFFF" stroke="#D2D0DF" strokeWidth="4" />
              <path d="M200,72 C272,72 322,140 322,232 C322,334 266,398 200,398 C134,398 78,334 78,232 C78,140 128,72 200,72 Z" fill="#FFFFFF" stroke="#D2D0DF" strokeWidth="5" />
              <path d="M78,190 C78,130 110,68 200,68 C290,68 322,130 322,190 C298,160 270,165 240,152 C220,144 200,160 180,150 C150,135 100,165 78,190 Z" fill="#EBE9F5" stroke="#CBD5E1" strokeWidth="3" />
              <ellipse cx="145" cy="195" rx="14" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="4" />
              <circle cx="145" cy="195" r="5" fill="#1E1B4B" />
              <ellipse cx="255" cy="195" rx="14" ry="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="4" />
              <circle cx="255" cy="195" r="5" fill="#1E1B4B" />
              <path d="M190,195 L190,245 M210,195 L210,245 M190,245 L210,245" fill="none" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
              <path d="M170,325 Q200,318 230,325 Q200,340 170,325 Z" fill="#FEE2E2" stroke="#FDA4AF" strokeWidth="4" />
            </svg>
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)" }}>피부 상태</span>
              <span className="status-badge good" style={{ fontSize: "9px", padding: "1px 6px", background: "var(--teal-light)", color: "var(--teal)" }}>복합성</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: "700" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span><span style={{ color: "var(--coral)", marginRight: "4px" }}>●</span>트러블</span>
                <span style={{ color: "var(--text)" }}>{troubleCount}개</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span><span style={{ color: "var(--orange)", marginRight: "4px" }}>●</span>붉은 자국</span>
                <span style={{ color: "var(--text)" }}>{redMarkCount}개</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span><span style={{ color: "var(--amber)", marginRight: "4px" }}>●</span>건조함</span>
                <span style={{ color: "var(--text)" }}>{drynessText}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span><span style={{ color: "var(--green)", marginRight: "4px" }}>●</span>유분</span>
                <span style={{ color: "var(--text)" }}>{oilinessText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Soft violet recommendation tip bar */}
        <div 
          onClick={() => setScreen("record")}
          style={{ 
            background: "var(--teal-light)", 
            borderRadius: "12px", 
            padding: "10px 12px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            cursor: "pointer",
            border: "1px solid var(--teal-border)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px" }}>🧴</span>
            <span style={{ fontSize: "11px", color: "var(--teal-dark)", fontWeight: "800" }}>
              {oilinessText === "많음" ? "T존 유분이 조금 많아요! 유분 케어 제품을 추천드릴게요." : "피부 장벽 케어를 위해 순한 보습 제품을 써보세요."}
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--teal)", fontWeight: "bold" }}>&gt;</span>
        </div>
      </div>

      {/* ── 5. 최근 사용 제품 Section ── */}
      <div className="sechead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>최근 사용 제품</h3>
        <button className="linkbtn" onClick={() => setScreen("vanity")} style={{ fontSize: "11px", color: "var(--text-faint)" }}>전체 보기 &gt;</button>
      </div>

      <div className="recorow-container" style={{ paddingBottom: "10px" }}>
        <div className="recorow">
          {products.slice(0, 3).map((p, idx) => {
            let emoji = "🧴";
            if (idx === 0) emoji = "🧪";
            if (idx === 1) emoji = "🧴";
            if (idx === 2) emoji = "🧴";
            return (
              <div 
                key={p.id} 
                className="recocard" 
                onClick={() => pickRecommendation(p.id)}
                style={{ width: "100px", padding: "12px 8px", textAlign: "center", flexShrink: 0, borderRadius: "14px" }}
              >
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>{emoji}</div>
                <div className="reconame" style={{ fontSize: "11px", fontWeight: "800", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                {p.category && <div style={{ fontSize: "9px", color: "var(--text-faint)", marginTop: "4px" }}>{p.category}</div>}
              </div>
            );
          })}
          
          {/* Dash bordered plus button */}
          <div 
            className="recocard" 
            onClick={() => openProductModal()}
            style={{ 
              width: "100px", 
              padding: "12px 8px", 
              textAlign: "center", 
              flexShrink: 0, 
              border: "1.5px dashed var(--border)", 
              background: "none", 
              boxShadow: "none", 
              display: "flex", 
              flexDirection: "column", 
              justifyContent: "center", 
              alignItems: "center",
              cursor: "pointer",
              borderRadius: "14px"
            }}
          >
            <div style={{ fontSize: "20px", color: "var(--text-faint)", fontWeight: "bold" }}>+</div>
            <div style={{ fontSize: "10px", color: "var(--text-faint)", fontWeight: "700", marginTop: "4px" }}>제품 추가</div>
          </div>
        </div>
      </div>
    </div>
  );
}
