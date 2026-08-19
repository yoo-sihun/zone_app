"use client";

import { useApp } from "@/lib/AppContext";

export default function VanityScreen() {
  const { products, openProductModal, deleteProduct } = useApp();

  async function onDeleteProduct(e, id) {
    e.stopPropagation();
    if (!confirm("이 제품을 삭제할까요? (기록된 사용 이력도 함께 지워집니다)")) return;
    await deleteProduct(id);
  }

  return (
    <div className="screen" id="screenVanity">
      {products.length === 0 ? (
        <div className="vanity-empty">
          <div className="vanity-empty-icon">🧴</div>
          <h3>아직 화장대가 비어있어요</h3>
          <div className="sub">갖고 있는 제품들을 등록하고 나만의 피부 데이터를 만들어보세요.</div>
        </div>
      ) : (
        <div className="sechead"><h3>내 화장대</h3></div>
      )}

      <div className="sechead"><h3>제품 등록 방법</h3></div>
      <div className="menu-list">
        <button className="menu-item" onClick={() => openProductModal()}>
          <span className="menu-icon">✏️</span>
          <span className="menu-title">이름/성분 직접 입력 — 제품 이름과 성분을 직접 입력해서 등록할 수 있어요</span>
          <span className="menu-arrow">›</span>
        </button>
        <button className="menu-item" onClick={() => openProductModal()}>
          <span className="menu-icon">📷</span>
          <span className="menu-title">전성표 촬영(OCR) — 제품 뒷면의 전성분표를 촬영하면 텍스트를 추출하고 매칭 결과를 보여드려요</span>
          <span className="menu-arrow">›</span>
        </button>
      </div>

      <div className="sechead">
        <h3>등록된 제품</h3>
        <button className="linkbtn" onClick={() => openProductModal()}>+ 새 제품 등록</button>
      </div>
      <div className="prods">
        {products.length ? products.map((p) => (
          <div key={p.id} className={`prod ${p.locked ? "locked" : ""}`}>
            <div className="swatch" />
            <div style={{ flex: 1 }}>
              <div className="pname">{p.name}{p.locked ? " 🔒" : ""}</div>
              <div className="ping">{p.ingredients.join(" · ")}</div>
            </div>
            <div className="prodactions">
              <span className="edit" onClick={(e) => { e.stopPropagation(); openProductModal(p, p.id); }}>수정</span>
              <span className="del" onClick={(e) => onDeleteProduct(e, p.id)}>삭제</span>
            </div>
          </div>
        )) : <div className="empty">등록된 제품이 없습니다. 위에서 등록해보세요.</div>}
      </div>
    </div>
  );
}
