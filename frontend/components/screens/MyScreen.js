"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/AppContext";

export default function MyScreen() {
  const {
    profileName, openProfilePicker, openFactorsModal, openSuspectsModal,
    openReportModal, deleteCurrentProfile,
    aiEnabled, loadAiSetting, setAiEnabled,
  } = useApp();

  useEffect(() => { loadAiSetting(); }, [loadAiSetting]);

  async function onDelete() {
    if (!confirm(`"${profileName}" 프로필을 삭제할까요?\n제품·기록·트러블 등 모든 데이터가 함께 삭제되고 되돌릴 수 없습니다.`)) return;
    try {
      await deleteCurrentProfile();
    } catch (e) {
      alert("삭제에 실패했어요");
    }
  }

  return (
    <div className="screen" id="screenMy">
      <div className="profilecard">
        <div className="profileavatar">👤</div>
        <div className="profilename">{profileName || "-"}</div>
        <button className="btn ghost small" onClick={() => openProfilePicker(true)}>다른 프로필로 전환</button>
      </div>

      <div className="sechead"><h3>개인 기록 관리</h3></div>
      <div className="menu-list">
        <button className="menu-item" onClick={() => openFactorsModal()}>
          <span className="menu-icon">📋</span>
          <span className="menu-title">오늘의 외부 요인 (수면/생리/메모)</span>
          <span className="menu-arrow">›</span>
        </button>
        <button className="menu-item" onClick={() => openSuspectsModal()}>
          <span className="menu-icon">⚠️</span>
          <span className="menu-title">의심 성분 관리</span>
          <span className="menu-arrow">›</span>
        </button>
        <button className="menu-item" onClick={() => openReportModal()}>
          <span className="menu-icon">📊</span>
          <span className="menu-title">피부 분석 리포트 보기</span>
          <span className="menu-arrow">›</span>
        </button>
      </div>

      <div className="sechead"><h3>앱 설정</h3></div>
      <div className="menu-list">
        <button className="menu-item" onClick={() => setAiEnabled(!aiEnabled)}>
          <span className="menu-icon">🤖</span>
          <span className="menu-title">
            AI 기능 (원인분석 코멘트·관리팁·사진 판단)
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>
              OpenAI 비용이 걱정될 때 잠시 꺼둘 수 있어요. 꺼도 핵심 분석 기능은 그대로 동작해요.
            </div>
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: aiEnabled ? "var(--teal)" : "var(--text-faint)", flexShrink: 0 }}>
            {aiEnabled ? "켜짐" : "꺼짐"}
          </span>
        </button>
      </div>

      <div className="danger-zone">
        <div className="sechead"><h3 className="danger-title">위험 설정</h3></div>
        <button className="btn danger" onClick={onDelete}>❌ 현재 프로필 데이터 영구 삭제</button>
      </div>
    </div>
  );
}
