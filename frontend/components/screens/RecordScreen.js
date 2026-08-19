"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import FaceRecord from "@/components/FaceRecord";
import WeekStrip from "@/components/WeekStrip";

export default function RecordScreen() {
  const {
    config, slot, setSlot,
    setMode,
    focusedParentZone, hint,
    products, selectedProductIds, toggleProductSelection,
    deleteProduct, openProductModal,
    copyPrevious, clearDay, openTroubleScreen, flash,
    dayData, removeProductFromZone,
  } = useApp();

  useEffect(() => { setMode("apply"); }, [setMode]);

  if (!config) return null;
  const ZONE_LABELS = config.zone_labels;

  function hintText() {
    if (hint) return hint;
    if (!selectedProductIds.length) return "아래에서 제품을 선택한 후(여러 개 가능) 얼굴을 탭해 상세 부위를 지정하세요.";
    const countLabel = selectedProductIds.length > 1 ? `제품 ${selectedProductIds.length}개 선택됨. ` : "";
    return focusedParentZone
      ? `${countLabel}세부 영역(${ZONE_LABELS[focusedParentZone]})을 탭하여 제품을 바르거나 지우세요.`
      : `${countLabel}얼굴 부위를 탭하면 세부 영역이 확대됩니다.`;
  }

  function onProdClick(p) {
    if (p.locked) { flash("실험 진행 중이라 잠긴 제품입니다"); return; }
    toggleProductSelection(p.id);
  }

  async function onDeleteProduct(e, id) {
    e.stopPropagation();
    if (!confirm("이 제품을 삭제할까요? (기록된 사용 이력도 함께 지워집니다)")) return;
    await deleteProduct(id);
  }

  // Live client-side calculation of combination warnings
  const INGREDIENT_INTERACTIONS = [
    { a: "비타민C", b: "레티놀", desc: "동시 사용 시 피부 자극이 커질 수 있어요. 아침/저녁으로 나눠 바르는 걸 권장합니다." },
    { a: "AHA", b: "레티놀", desc: "각질 제거 효과가 겹쳐 자극·홍조 위험이 높습니다." },
    { a: "BHA", b: "레티놀", desc: "각질 제거 효과가 겹쳐 자극·홍조 위험이 높습니다." },
    { a: "벤조일퍼옥사이드", b: "레티놀", desc: "레티놀을 산화시켜 효과를 떨어뜨리고 자극을 유발할 수 있습니다." },
    { a: "비타민C", b: "나이아신아마이드", desc: "낮은 pH에서 만나면 일시적으로 홍조를 유발할 수 있습니다." },
    { a: "AHA", b: "BHA", desc: "각질 제거 성분을 동시에 고농도로 사용하면 자극이 커질 수 있습니다." }
  ];

  function getSlotWarnings() {
    const activeIngredients = new Set();
    const appliedProductIds = new Set();
    
    if (dayData && dayData.log) {
      Object.keys(dayData.log).forEach((zone) => {
        const slotProdIds = dayData.log[zone][slot] || [];
        slotProdIds.forEach((pid) => appliedProductIds.add(pid));
      });
    }
    
    appliedProductIds.forEach((pid) => {
      const prod = products.find((p) => p.id === pid);
      if (prod) {
        prod.ingredients.forEach((ing) => activeIngredients.add(ing));
      }
    });

    const activeList = Array.from(activeIngredients);
    const warnings = [];
    INGREDIENT_INTERACTIONS.forEach((pair) => {
      const hasA = activeList.some((ing) => ing.includes(pair.a));
      const hasB = activeList.some((ing) => ing.includes(pair.b));
      if (hasA && hasB) {
        warnings.push(pair);
      }
    });
    return warnings;
  }

  const slotWarnings = getSlotWarnings();

  // 얼굴 하이라이트는 현재 선택한 제품 기준이라, 선택을 안 하면 이 슬롯에 뭘 발랐는지 안 보임 —
  // 그래서 선택 여부와 무관하게 이 날짜/슬롯 기록을 항상 목록으로 보여주고 항목별로 바로 지울 수 있게 함
  const slotEntries = [];
  if (dayData && dayData.log) {
    Object.keys(dayData.log).forEach((zone) => {
      const slotProdIds = dayData.log[zone][slot] || [];
      slotProdIds.forEach((pid) => {
        const prod = products.find((p) => p.id === pid);
        if (prod) slotEntries.push({ zone, product: prod });
      });
    });
  }

  return (
    <div className="screen" id="screenRecord">
      <div className="record-slot-hero">
        <div className="record-slot-icon">{slot === "am" ? "☀️" : "🌙"}</div>
        <div style={{ flex: 1 }}>
          <h3>{slot === "am" ? "오늘 아침에 사용한 제품을 기록해볼까요?" : "오늘 저녁에 사용한 제품을 기록해볼까요?"}</h3>
        </div>
        <div className="record-slot-toggle">
          <button className={slot === "am" ? "on" : ""} onClick={() => setSlot("am")}>☀️ 아침</button>
          <button className={slot === "pm" ? "on" : ""} onClick={() => setSlot("pm")}>🌙 저녁</button>
        </div>
      </div>

      <WeekStrip />

      <div className="hint" style={hint ? { color: "#E14B48" } : undefined}>{hintText()}</div>

      <FaceRecord />

      {slotEntries.length > 0 && (
        <>
          <div className="sechead" style={{ marginTop: 16 }}>
            <h3>{slot === "am" ? "오늘 아침" : "오늘 저녁"} 기록 ({slotEntries.length})</h3>
          </div>
          <div className="record-entry-list">
            {slotEntries.map(({ zone, product }) => (
              <div key={`${zone}-${product.id}`} className="record-entry-row">
                <span className="record-entry-zone">{ZONE_LABELS[zone] || zone}</span>
                <span className="record-entry-name">{product.name}</span>
                <button className="record-entry-del" onClick={() => removeProductFromZone(zone, product.id)}>삭제</button>
              </div>
            ))}
          </div>
        </>
      )}

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
            <div key={p.id} className={`prod ${selectedProductIds.includes(p.id) ? "on" : ""} ${p.locked ? "locked" : ""}`} onClick={() => onProdClick(p)}>
              <div className={`prod-checkbox ${selectedProductIds.includes(p.id) ? "checked" : ""}`}>{selectedProductIds.includes(p.id) ? "✓" : ""}</div>
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

        {/* Dynamic Combination warnings banner list */}
        {slotWarnings.map((w, idx) => (
          <div key={idx} className="warning-alert-card">
            <span className="warning-alert-icon">⚠️</span>
            <div className="warning-alert-content">
              <span className="warning-alert-title">{w.a} + {w.b} 조합 주의</span>
              <span className="warning-alert-desc">{w.desc}</span>
            </div>
          </div>
        ))}

        <div className="row utility-buttons" style={{ marginTop: 20 }}>
          <button className="btn ghost" onClick={copyPrevious}>🔄 어제와 동일하게</button>
          <button className="btn ghost" onClick={clearDay}>🗑️ 전체 기록 초기화</button>
        </div>
      </div>
    </div>
  );
}
