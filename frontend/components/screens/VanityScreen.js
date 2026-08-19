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
    <div className="screen" id="screenVanity">
      {isEmpty ? (
        <div className="empty-shelf-card">
          <div className="empty-shelf-image">🧴</div>
          <h4>아직 화장대가 비어있어요</h4>
          <p>갖고 있는 제품을 등록하고 나만의 피부 데이터를 만들어 보세요.</p>
        </div>
      ) : (
        <div className="sechead" style={{ marginTop: 0 }}>
          <h3>내 화장대</h3>
          <button className="linkbtn" onClick={() => openProductModal()}>+ 새 제품 등록</button>
        </div>
      )}

      <div className="sechead" style={{ marginTop: isEmpty ? 12 : 24 }}>
        <h3>제품 등록 방법</h3>
      </div>
      
      <div className="guide-list">
        <div className="guide-item" onClick={() => openProductModal(null, null, "manual")}>
          <div className="guide-icon">✏️</div>
          <div className="guide-content">
            <div className="guide-title">이름/성분 직접 입력</div>
            <div className="guide-desc">제품 이름과 전성분을 직접 입력하여 등록할 수 있어요.</div>
          </div>
          <div className="guide-arrow">›</div>
        </div>

        <div className="guide-item" onClick={() => openProductModal(null, null, "ocr")}>
          <div className="guide-icon">📷</div>
          <div className="guide-content">
            <div className="guide-title">전성표 촬영 (OCR)</div>
            <div className="guide-desc">제품 뒷면의 전성표를 촬영하면 텍스트를 추출하고 매칭 결과를 보여드려요.</div>
          </div>
          <div className="guide-arrow">›</div>
        </div>

        <div className="guide-item" onClick={() => openProductModal()}>
          <div className="guide-icon">🏷️</div>
          <div className="guide-content">
            <div className="guide-title">바코드 스캔</div>
            <div className="guide-desc">공공 데이터베이스에서 정보를 찾아 이름, 이미지, 성분을 자동으로 채워드려요.</div>
          </div>
          <div className="guide-arrow">›</div>
        </div>

        <div className="guide-item warning-style" onClick={() => openProductModal()}>
          <div className="guide-icon">🛡️</div>
          <div className="guide-content">
            <div className="guide-title">의심 성분 자동 체크</div>
            <div className="guide-desc">화장품 전성분 중 내 피부에 맞지 않거나 알레르기를 유발할 수 있는 주의 성분을 똑똑하게 분석해요.</div>
          </div>
          <div className="guide-arrow">›</div>
        </div>
      </div>

      {!isEmpty && (
        <>
          <div className="sechead" style={{ marginTop: 24 }}>
            <h3>등록된 제품 ({products.length})</h3>
          </div>
          <div className="prods">
            {products.map((p) => (
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
