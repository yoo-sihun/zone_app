"use client";

import { useState } from "react";
import { useApp } from "@/lib/AppContext";

export default function ProfileModal() {
  const { profileModalOpen, profileModalAllowCancel, profileList, selectProfile, createProfile, closeProfileModal } = useApp();
  const [name, setName] = useState("");

  if (!profileModalOpen) return null;

  async function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) { alert("이름을 입력해주세요"); return; }
    const p = await createProfile(trimmed);
    setName("");
    selectProfile(p.id, p.name);
  }

  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget && profileModalAllowCancel) closeProfileModal(); }}>
      <div className="sheet">
        <h2>프로필 선택</h2>
        <div className="sub">비밀번호 없이 프로필만 골라서 써요. 각자 기록이 따로 저장됩니다.</div>
        <div className="suslist">
          {profileList.length ? profileList.map((p) => (
            <div key={p.id} className="susitem profileitem" onClick={() => selectProfile(p.id, p.name)}>
              <span>👤 {p.name}</span>
            </div>
          )) : <div className="empty">아직 프로필이 없습니다. 아래에서 새로 만들어주세요.</div>}
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>새 프로필 만들기</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 입력 (예: 민지)" />
        </div>
        <div className="row"><button className="btn primary" onClick={onCreate}>만들고 시작하기</button></div>
        {profileModalAllowCancel && (
          <div className="row"><button className="btn ghost" onClick={closeProfileModal}>취소</button></div>
        )}
      </div>
    </div>
  );
}
