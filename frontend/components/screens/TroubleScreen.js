"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";
import { useExternalFactors } from "@/lib/useExternalFactors";
import FaceRecord from "@/components/FaceRecord";

export default function TroubleScreen() {
  const {
    config, currentDate, fmt, closeTroubleScreen, troubleType, setTroubleType,
    weather, loadWeather, pushToast,
  } = useApp();
  const aiFileRef = useRef(null);
  const dateStr = fmt(currentDate);
  const f = useExternalFactors(dateStr);

  useEffect(() => { loadWeather(); }, [loadWeather]);

  if (!config) return null;
  const TROUBLE_TYPES = config.trouble_types;
  const TROUBLE_TYPE_LABELS = config.trouble_type_labels;

  async function onAiFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    pushToast("AI가 사진을 확인하고 있어요…", "ok");
    try {
      const result = await api("/api/dots/classify", { method: "POST", body: fd });
      if (result.type) {
        setTroubleType(result.type);
        pushToast(`AI 추천: ${TROUBLE_TYPE_LABELS[result.type]} — 다르면 위에서 직접 골라주세요`, "ok");
      } else {
        pushToast("AI가 유형을 판단하지 못했어요. 직접 선택해주세요", "warn");
      }
    } catch (err) {
      pushToast(err.message, "warn");
    } finally {
      e.target.value = "";
    }
  }

  async function onSaveRecord() {
    try {
      await f.save();
      pushToast("기록을 저장했어요", "ok");
      closeTroubleScreen();
    } catch (err) {
      pushToast(err.message, "warn");
    }
  }

  return (
    <div className="screen" id="screenTrouble">
      <div className="datebar">
        <button className="navbtn" onClick={closeTroubleScreen} title="뒤로">‹</button>
        <div className="dlabel"><b>트러블 기록</b></div>
        <span style={{ width: 36 }} />
      </div>
      <div className="sub">트러블이 난 위치와 유형을 기록해주세요.</div>

      <div className="typeToggle" style={{ marginBottom: 16 }}>
        {TROUBLE_TYPES.map((t) => {
          let emoji = "🟡";
          if (t === "papule") emoji = "🟠";
          if (t === "pustule") emoji = "🔴";
          if (t === "redness") emoji = "💗";
          return (
            <button key={t} className={troubleType === t ? "on" : ""} onClick={() => setTroubleType(t)}>
              {emoji} {TROUBLE_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <label className="ocrbtn trouble-ai-btn" style={{ marginBottom: 14 }}>
        <span className="btn-icon">📸</span> AI로 사진 분석 유형 판단 (베타)
        <input ref={aiFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onAiFile} />
      </label>

      <div className="hint" style={{ marginBottom: 12 }}>얼굴 부위를 터치하면 유형이 선택됩니다.</div>

      <FaceRecord />

      <div className="sechead" style={{ marginTop: 20 }}><h3>외부 / 생활 요인</h3></div>
      <div className="factor-grid">
        <div className="factor-card">
          <div className="factor-icon" style={{ color: '#5F5AF6' }}>☁️</div>
          <div className="factor-info">
            <span className="factor-label">오늘 날씨</span>
            <span className="factor-value">{weather?.pm25 != null ? `${weather.pm25} ㎍/㎥` : "-"}</span>
          </div>
        </div>
        
        <div className="factor-card">
          <div className="factor-icon" style={{ color: '#F97316' }}>☀️</div>
          <div className="factor-info">
            <span className="factor-label">자외선 지수</span>
            <span className="factor-value">{weather?.uv_index != null ? `높음 (${weather.uv_index})` : "-"}</span>
          </div>
        </div>

        <div className="factor-card">
          <div className="factor-icon" style={{ color: '#8B5CF6' }}>🌙</div>
          <div className="factor-info" style={{ flex: 1 }}>
            <span className="factor-label">수면 시간</span>
            <input 
              type="number" 
              step="0.5" 
              min="0" 
              max="24" 
              value={f.sleep} 
              onChange={(e) => f.setSleep(e.target.value)} 
              placeholder="시간 입력"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontWeight: 800, padding: 0, marginTop: 2, color: 'var(--text)', width: '100%' }}
            />
          </div>
        </div>

        <div className="factor-card">
          <div className="factor-icon" style={{ color: '#EC4899' }}>💧</div>
          <div className="factor-info" style={{ flex: 1 }}>
            <span className="factor-label">현재 피부</span>
            <select 
              value={f.skinCondition} 
              onChange={(e) => f.setSkinCondition(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontWeight: 800, padding: 0, marginTop: 2, color: 'var(--text)', width: '100%' }}
            >
              <option value="">선택안함</option>
              <option value="건성">건성</option>
              <option value="보통">보통</option>
              <option value="유분성">유분성</option>
              <option value="복합성">복합성</option>
            </select>
          </div>
        </div>
      </div>

      <div className="row action-buttons" style={{ marginTop: 20 }}>
        <button className="btn primary main-action" onClick={onSaveRecord}>기록 저장</button>
      </div>
    </div>
  );
}
