"use client";

import { useRef } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";
import FaceRecord from "@/components/FaceRecord";

export default function RecordScreen() {
  const {
    config, currentDate, today, goPrevDay, goNextDay,
    mode, setMode, slot, setSlot, troubleType, setTroubleType,
    focusedParentZone, hint, flash,
    products, selectedProductId, setSelectedProductId,
    loadProducts, loadDay, deleteProduct, openProductModal,
    copyPrevious, clearDay, openAnalysisModal, pushToast,
  } = useApp();

  const aiFileRef = useRef(null);

  if (!config) return null;
  const ZONE_LABELS = config.zone_labels;
  const TROUBLE_TYPES = config.trouble_types;
  const TROUBLE_TYPE_LABELS = config.trouble_type_labels;

  const diffDays = Math.round((today - currentDate) / 86400000);
  const dlabel = diffDays === 0 ? <b>오늘</b> : diffDays > 0 ? <b>{diffDays}일 전</b> : <b>{-diffDays}일 후</b>;

  function hintText() {
    if (hint) return hint;
    if (mode === "apply") {
      if (!selectedProductId) return "아래에서 제품을 선택한 후 얼굴을 탭해 상세 부위를 지정하세요.";
      return focusedParentZone
        ? `세부 영역(${ZONE_LABELS[focusedParentZone]})을 탭하여 제품을 바르거나 지우세요.`
        : "얼굴 부위를 탭하면 세부 영역이 확대됩니다.";
    }
    return focusedParentZone
      ? `뾰루지가 난 부위(${ZONE_LABELS[focusedParentZone]})를 얼굴 위에서 직접 탭하세요 (다시 탭하면 삭제)`
      : "얼굴 부위를 탭하여 해당 영역을 확대한 뒤 트러블 위치를 지정하세요.";
  }

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

      <div className="tabs">
        <button className={mode === "apply" ? "on" : ""} onClick={() => setMode("apply")}>✨ 바른 제품</button>
        <button className={mode === "trouble" ? "on" : ""} onClick={() => setMode("trouble")}>🔴 트러블 표시</button>
      </div>

      {mode === "apply" && (
        <div className="segrow">
          <button className={slot === "am" ? "on" : ""} onClick={() => setSlot("am")}>☀️ 아침 스킨케어</button>
          <button className={slot === "pm" ? "on" : ""} onClick={() => setSlot("pm")}>🌙 저녁 스킨케어</button>
        </div>
      )}

      {mode === "trouble" && (
        <div className="typeToggle">
          {TROUBLE_TYPES.map((t) => (
            <button key={t} className={troubleType === t ? "on" : ""} onClick={() => setTroubleType(t)}>
              {TROUBLE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {mode === "trouble" && (
        <label className="ocrbtn trouble-ai-btn">
          <span className="btn-icon">📸</span> AI로 사진 분석 유형 판단 (베타)
          <input ref={aiFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onAiFile} />
        </label>
      )}

      <div className="hint" style={hint ? { color: "#E14B48" } : undefined}>{hintText()}</div>

      <FaceRecord />

      {mode === "apply" && (
        <div id="applyUI">
          <div className="sechead">
            <h3>오늘 바른 화장품</h3>
            <button className="linkbtn" onClick={() => openProductModal()}>+ 새 제품 등록</button>
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
            )) : <div className="empty">등록된 제품이 없습니다. 위 &apos;+ 제품 추가&apos;로 시작하세요.</div>}
          </div>

          <div className="row utility-buttons">
            <button className="btn ghost" onClick={copyPrevious}>🔄 어제와 동일하게</button>
            <button className="btn ghost" onClick={clearDay}>🗑️ 전체 기록 초기화</button>
          </div>
        </div>
      )}

      <div className="row action-buttons">
        <button className="btn primary main-action" onClick={() => openAnalysisModal(null)}>🔍 트러블 원인 의심 성분 분석</button>
      </div>
    </div>
  );
}
