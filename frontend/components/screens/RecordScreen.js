"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import FaceRecord from "@/components/FaceRecord";

export default function RecordScreen() {
  const {
    config, currentDate, today, goPrevDay, goNextDay,
    setMode, slot, setSlot,
    focusedParentZone, hint,
    products, selectedProductId, setSelectedProductId,
    deleteProduct, openProductModal,
    copyPrevious, clearDay, openTroubleScreen, flash,
  } = useApp();

  useEffect(() => { setMode("apply"); }, [setMode]);

  if (!config) return null;
  const ZONE_LABELS = config.zone_labels;

  const diffDays = Math.round((today - currentDate) / 86400000);
  const dlabel = diffDays === 0 ? <b>오늘</b> : diffDays > 0 ? <b>{diffDays}일 전</b> : <b>{-diffDays}일 후</b>;

  function hintText() {
    if (hint) return hint;
    if (!selectedProductId) return "아래에서 제품을 선택한 후 얼굴을 탭해 상세 부위를 지정하세요.";
    return focusedParentZone
      ? `세부 영역(${ZONE_LABELS[focusedParentZone]})을 탭하여 제품을 바르거나 지우세요.`
      : "얼굴 부위를 탭하면 세부 영역이 확대됩니다.";
  }

  function onProdClick(p) {
    if (p.locked) { flash("실험 진행 중이라 잠긴 제품입니다"); return; }
    setSelectedProductId(selectedProductId === p.id ? null : p.id);
  }

  async function onDeleteProduct(e, id) {
    e.stopPropagation();
    if (!confirm("이 제품을 삭제할까요? (기록된 사용 이력도 함께 지워집니다)")) return;
    await deleteProduct(id);
  }

  return (
    <div className="screen" id="screenRecord">
      <div className="datebar">
        <button className="navbtn" onClick={goPrevDay}>‹</button>
        <div className="dlabel">{dlabel}</div>
        <button className="navbtn" disabled={currentDate >= today} onClick={goNextDay}>›</button>
      </div>

      <div className="segrow">
        <button className={slot === "am" ? "on" : ""} onClick={() => setSlot("am")}>☀️ 아침 스킨케어</button>
        <button className={slot === "pm" ? "on" : ""} onClick={() => setSlot("pm")}>🌙 저녁 스킨케어</button>
      </div>

      <div className="hint" style={hint ? { color: "#E14B48" } : undefined}>{hintText()}</div>

      <FaceRecord />

      <div className="trouble-prompt-card" onClick={openTroubleScreen}>
        <span>🔴 트러블도 기록할까요?</span>
        <span className="linkbtn">+ 기록하기</span>
      </div>

      <div id="applyUI">
        <div className="sechead">
          <h3>최근 사용 제품</h3>
          <button className="linkbtn" onClick={() => openProductModal()}>+ 제품 추가</button>
        </div>

        {focusedParentZone && (
          <div className="subzone-header-card">
            <span className="parent-title">{ZONE_LABELS[focusedParentZone]}</span>
            <span className="desc">세부 영역을 선택하고 아래 화장품을 체크하세요.</span>
          </div>
        )}

        <div className="prods">
          {products.length ? products.map((p) => (
            <div key={p.id} className={`prod ${selectedProductId === p.id ? "on" : ""} ${p.locked ? "locked" : ""}`} onClick={() => onProdClick(p)}>
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
          )) : <div className="empty">등록된 제품이 없습니다. 화장대에서 먼저 등록해주세요.</div>}
        </div>

        <div className="row utility-buttons">
          <button className="btn ghost" onClick={copyPrevious}>🔄 어제와 동일하게</button>
          <button className="btn ghost" onClick={clearDay}>🗑️ 전체 기록 초기화</button>
        </div>
      </div>
    </div>
  );
}
