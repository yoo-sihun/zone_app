"use client";

import { useApp } from "@/lib/AppContext";

export default function VanityScreen() {
  const { products, openProductModal, deleteProduct } = useApp();

  async function onDeleteProduct(e, id) {
    e.stopPropagation();
    if (!confirm("이 제품을 삭제할까요? (기록된 사용 이력도 함께 지워집니다)")) return;
    await deleteProduct(id);
  }

  const isEmpty = products.length === 0;

  return (
    <div className="screen" id="screenVanity" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <h2 style={{ fontSize: "20px", fontWeight: "900", textAlign: "center", color: "var(--text)", margin: "8px 0 20px" }}>내 화장대</h2>

      {/* ── Empty Shelf Warning Banner ── */}
      {isEmpty && (
        <div className="card" style={{ padding: "20px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ width: "64px", height: "64px", flexShrink: 0, position: "relative" }}>
            {/* Cute cloud character with a plus sign */}
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <defs>
                <linearGradient id="creamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F5F3FF" />
                </linearGradient>
              </defs>
              <path d="M15,60 C5,60 0,50 5,40 C0,30 10,20 25,25 C32,10 50,5 65,15 C80,5 92,20 88,35 C98,43 92,60 80,60 Z" fill="url(#creamGrad)" filter="drop-shadow(0 3px 6px rgba(124,111,232,0.1))" />
              <path d="M38,23 C42,17 55,8 50,4 C45,0 35,12 38,23 Z" fill="url(#creamGrad)" />
              <circle cx="38" cy="40" r="3" fill="#1E1B4B" />
              <circle cx="58" cy="40" r="3" fill="#1E1B4B" />
              <ellipse cx="32" cy="45" rx="3" ry="1.5" fill="#FDA4AF" />
              <ellipse cx="64" cy="45" rx="3" ry="1.5" fill="#FDA4AF" />
              <path d="M45,44 Q48,47 51,44" fill="none" stroke="#1E1B4B" strokeWidth="1.2" strokeLinecap="round" />
              {/* Plus Badge */}
              <circle cx="80" cy="50" r="11" fill="var(--teal)" />
              <path d="M80,45 L80,55 M75,50 L85,50" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "14px", fontWeight: "900", color: "var(--text)", margin: "0 0 4px 0" }}>아직 화장대가 비어있어요</h4>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
              갖고 있는 제품을 등록하고<br />나만의 피부 데이터를 만들어 보세요.
            </p>
          </div>
        </div>
      )}

      {/* ── Product Registration Methods ── */}
      <div className="sechead" style={{ marginBottom: "12px", marginTop: "12px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>제품 등록 방법</h3>
      </div>

      <div className="guide-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        {/* 1. 이름/선성분 직접 입력 */}
        <div 
          className="guide-item" 
          onClick={() => openProductModal(null, null, "manual")}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "16px", 
            padding: "16px", 
            background: "var(--surface)", 
            border: "1px solid var(--border)", 
            borderRadius: "20px", 
            cursor: "pointer",
            transition: "all 0.2s ease" 
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "var(--teal)", flexShrink: 0 }}>
            🖊️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: "900", color: "var(--teal)", marginBottom: "4px" }}>이름/선성분 직접 입력</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>제품 이름과 전성분을 직접 입력하여 등록할 수 있어요.</div>
          </div>
          <div style={{ fontSize: "14px", color: "var(--teal)", fontWeight: "800" }}>&gt;</div>
        </div>

        {/* 2. 전성표 촬영 (OCR) */}
        <div 
          className="guide-item" 
          onClick={() => openProductModal(null, null, "ocr")}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "16px", 
            padding: "16px", 
            background: "var(--surface)", 
            border: "1px solid var(--border)", 
            borderRadius: "20px", 
            cursor: "pointer",
            transition: "all 0.2s ease" 
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "var(--teal)", flexShrink: 0 }}>
            📷
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: "900", color: "var(--teal)", marginBottom: "4px" }}>전성표 촬영 (OCR)</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>제품 뒷면의 전성표를 촬영하면 텍스트를 추출하고 매칭 결과를 보여드려요.</div>
          </div>
          <div style={{ fontSize: "14px", color: "var(--teal)", fontWeight: "800" }}>&gt;</div>
        </div>

        {/* 3. 바코드 스캔 */}
        <div 
          className="guide-item" 
          onClick={() => openProductModal()}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "16px", 
            padding: "16px", 
            background: "var(--surface)", 
            border: "1px solid var(--border)", 
            borderRadius: "20px", 
            cursor: "pointer",
            transition: "all 0.2s ease" 
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "var(--teal)", flexShrink: 0 }}>
            🔍
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: "900", color: "var(--teal)", marginBottom: "4px" }}>바코드 스캔</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>공공 데이터베이스에서 정보를 찾아 이름·이미지·성분을 자동으로 채워드려요.</div>
          </div>
          <div style={{ fontSize: "14px", color: "var(--teal)", fontWeight: "800" }}>&gt;</div>
        </div>

        {/* 4. 의심 성분 자동 체크 */}
        <div 
          className="guide-item" 
          onClick={() => openProductModal()}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "16px", 
            padding: "16px", 
            background: "rgba(239, 68, 68, 0.02)", 
            border: "1px solid rgba(239, 68, 68, 0.1)", 
            borderRadius: "20px", 
            cursor: "pointer",
            transition: "all 0.2s ease" 
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "#EF4444", flexShrink: 0 }}>
            🛡️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: "900", color: "#EF4444", marginBottom: "4px" }}>의심 성분 자동 체크</div>
            <div style={{ fontSize: "11px", color: "rgba(239, 68, 68, 0.8)", lineHeight: "1.4" }}>화장품 전성분 중 내 피부에 맞지 않거나 알레르기를 유발할 수 있는 주의 성분을 똑똑하게 분석해요.</div>
          </div>
          <div style={{ fontSize: "14px", color: "#EF4444", fontWeight: "800" }}>&gt;</div>
        </div>
      </div>

      {/* ── Registered Products List (Shown below the methods when products exist) ── */}
      {!isEmpty && (
        <>
          <div className="sechead" style={{ marginTop: 24, marginBottom: 12 }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>등록된 제품 목록 ({products.length})</h3>
          </div>
          <div className="prods">
            {products.map((p) => (
              <div key={p.id} className={`prod ${p.locked ? "locked" : ""}`} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="swatch" style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--teal-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🧴</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pname" style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{p.name}{p.locked ? " 🔒" : ""}</div>
                  <div className="ping" style={{ fontSize: "10px", color: "var(--text-faint)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginTop: "2px" }}>{p.ingredients.join(" · ")}</div>
                </div>
                <div className="prodactions" style={{ display: "flex", gap: "8px", fontSize: "11px", fontWeight: "800" }}>
                  <span className="edit" onClick={(e) => { e.stopPropagation(); openProductModal(p, p.id); }} style={{ color: "var(--teal)", cursor: "pointer" }}>수정</span>
                  <span className="del" onClick={(e) => onDeleteProduct(e, p.id)} style={{ color: "#EF4444", cursor: "pointer" }}>삭제</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
