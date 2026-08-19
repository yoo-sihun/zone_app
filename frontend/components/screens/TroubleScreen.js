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

      <div className="typeToggle">
        {TROUBLE_TYPES.map((t) => (
          <button key={t} className={troubleType === t ? "on" : ""} onClick={() => setTroubleType(t)}>
            {TROUBLE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <label className="ocrbtn trouble-ai-btn">
        <span className="btn-icon">📸</span> AI로 사진 분석 유형 판단 (베타)
        <input ref={aiFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onAiFile} />
      </label>

      <div className="hint">얼굴 부위를 탭하여 해당 영역을 확대한 뒤 트러블 위치를 지정하세요.</div>

      <FaceRecord />

      <div className="sechead"><h3>외부 / 생활 요인</h3></div>
      <div className="factorgrid">
        <div className="weatheritem">
          <div className="wlabel">오늘 날씨</div>
          <div className="wvalue">{weather?.pm25 != null ? `${weather.pm25} ㎍/㎥` : "-"}</div>
        </div>
        <div className="weatheritem">
          <div className="wlabel">자외선 지수</div>
          <div className="wvalue">{weather?.uv_index != null ? weather.uv_index : "-"}</div>
        </div>
        <div className="weatheritem">
          <div className="wlabel">수면 시간</div>
          <input type="number" step="0.5" min="0" max="24" value={f.sleep} onChange={(e) => f.setSleep(e.target.value)} placeholder="시간" />
        </div>
        <div className="weatheritem">
          <div className="wlabel">현재 피부</div>
          <select value={f.skinCondition} onChange={(e) => f.setSkinCondition(e.target.value)}>
            <option value="">선택</option>
            <option value="건성">건성</option>
            <option value="보통">보통</option>
            <option value="유분성">유분성</option>
            <option value="복합성">복합성</option>
          </select>
        </div>
      </div>

      <div className="row action-buttons">
        <button className="btn primary main-action" onClick={onSaveRecord}>기록 저장</button>
      </div>
    </div>
  );
}
