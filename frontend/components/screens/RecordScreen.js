"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";
import { useExternalFactors } from "@/lib/useExternalFactors";
import FaceRecord from "@/components/FaceRecord";
import WeekStrip from "@/components/WeekStrip";

export default function RecordScreen() {
  const {
    config, slot, setSlot, currentDate, fmt,
    mode, setMode,
    focusedParentZone, hint,
    products, selectedProductIds, toggleProductSelection,
    deleteProduct, openProductModal,
    copyPrevious, clearDay, flash,
    dayData, removeProductFromZone,
    pendingApplications, cancelPendingApplication, commitPendingApplications,
    deleteDot, troubleType, setTroubleType, weather, loadWeather, pushToast
  } = useApp();

  const dateStr = fmt(currentDate);
  const f = useExternalFactors(dateStr);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  if (!config) return null;
  const ZONE_LABELS = config.zone_labels;
  const TROUBLE_TYPE_LABELS = config.trouble_type_labels;
  const TYPE_EMOJI = { comedonal: "🟡", papule: "🟠", pustule: "🔴", redness: "💗" };

  function hintText() {
    if (hint) return hint;
    if (mode === "trouble") {
      return "얼굴 부위를 선택한 후(세부 확대 가능) 터치하면 트러블 위치가 기록됩니다.";
    }
    if (!selectedProductIds.length) return "아래에서 제품을 선택한 후(여러 개 가능) 얼굴을 탭해 상세 부위를 지정하세요.";
    const countLabel = selectedProductIds.length > 1 ? `제품 ${selectedProductIds.length}개 선택됨. ` : "";
    const saveHint = " 탭해도 바로 저장되지 않아요 — 다 고른 뒤 '기록 저장'을 눌러주세요.";
    return focusedParentZone
      ? `${countLabel}세부 영역(${ZONE_LABELS[focusedParentZone]})을 탭하여 표시하세요.${saveHint}`
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

  async function onSaveTroubleRecord() {
    try {
      await f.save();
      pushToast("외부 요인 및 수면기록이 저장되었습니다", "ok");
    } catch (err) {
      pushToast(err.message, "warn");
    }
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
    pendingApplications
      .filter((e) => e.date === dateStr && e.slot === slot)
      .forEach((e) => {
        if (e.intent === "add") appliedProductIds.add(e.productId);
        else appliedProductIds.delete(e.productId);
      });

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
      if (hasA && hasB) warnings.push(pair);
    });
    return warnings;
  }

  const slotWarnings = getSlotWarnings();

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

  const pendingForView = pendingApplications
    .map((e, idx) => ({ ...e, idx }))
    .filter((e) => e.date === dateStr && e.slot === slot)
    .map((e) => ({ ...e, product: products.find((p) => p.id === e.productId) }))
    .filter((e) => e.product);
  const otherPendingCount = pendingApplications.length - pendingForView.length;

  return (
    <div className="screen" id="screenRecord" style={{ background: "var(--bg)" }}>
      
      {/* ── UNIFIED MODE SELECTOR ── */}
      <div className="record-mode-selector" style={{ display: "flex", background: "var(--surface-alt)", borderRadius: "14px", padding: "4px", marginBottom: "20px" }}>
        <button 
          style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "12px", fontWeight: "800", background: mode === "apply" || mode === "trouble" ? (mode === "apply" ? "var(--teal)" : "none") : "var(--teal)", color: mode === "apply" ? "#FFFFFF" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
          onClick={() => setMode("apply")}
        >
          🧴 화장품 도포 기록
        </button>
        <button 
          style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "12px", fontWeight: "800", background: mode === "trouble" ? "var(--teal)" : "none", color: mode === "trouble" ? "#FFFFFF" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s ease" }}
          onClick={() => setMode("trouble")}
        >
          🔴 트러블 발생 기록
        </button>
      </div>

      {/* ── Mode Specific slot banner ── */}
      {mode === "apply" ? (
        <div className="record-slot-hero" style={{ marginBottom: "16px" }}>
          <div className="record-slot-icon">{slot === "am" ? "☀️" : "🌙"}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "13px", fontWeight: "800" }}>{slot === "am" ? "아침 스킨케어 기록하기" : "저녁 스킨케어 기록하기"}</h3>
          </div>
          <div className="record-slot-toggle">
            <button className={slot === "am" ? "on" : ""} onClick={() => setSlot("am")}>☀️ 아침</button>
            <button className={slot === "pm" ? "on" : ""} onClick={() => setSlot("pm")}>🌙 저녁</button>
          </div>
        </div>
      ) : (
        <div className="record-slot-hero" style={{ marginBottom: "16px" }}>
          <div className="record-slot-icon">📝</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "13px", fontWeight: "800" }}>트러블과 외부 유해 요소를 기록하세요</h3>
          </div>
        </div>
      )}

      {/* Date Navigator Calendar strip */}
      <WeekStrip />

      {/* Guide hint text */}
      <div className="hint" style={hint ? { color: "var(--teal)" } : undefined}>{hintText()}</div>

      {/* Interactive Face Canvas */}
      <FaceRecord />

      {/* ── Mode 1: Skincare apply UI content ── */}
      {mode === "apply" && (
        <div id="applyUI" style={{ marginTop: "16px" }}>
          {pendingForView.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div className="sechead" style={{ marginTop: 0 }}>
                <h3>저장 대기 중 ({pendingForView.length})</h3>
              </div>
              <div className="record-entry-list">
                {pendingForView.map((e) => (
                  <div key={`${e.zone}-${e.productId}-${e.idx}`} className="record-entry-row pending">
                    <span className="record-entry-zone">{ZONE_LABELS[e.zone] || e.zone}</span>
                    <span className="record-entry-name">
                      {e.product.name}{e.intent === "remove" ? " (삭제 예정)" : ""}
                    </span>
                    <button className="record-entry-del" onClick={() => cancelPendingApplication(e.zone, e.productId, e.date, e.slot)}>취소</button>
                  </div>
                ))}
              </div>
              {otherPendingCount > 0 && (
                <div className="hint" style={{ marginBottom: 8 }}>다른 날짜/시간대에 대기 중인 항목 {otherPendingCount}개 더 있어요.</div>
              )}
              <button className="btn primary" style={{ width: "100%", marginTop: "10px" }} onClick={commitPendingApplications}>
                기록 저장 ({pendingApplications.length}건)
              </button>
            </div>
          )}

          {slotEntries.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div className="sechead">
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
            </div>
          )}

          <div className="sechead">
            <h3>최근 사용 제품</h3>
            <button className="linkbtn" onClick={() => openProductModal()}>+ 제품 추가</button>
          </div>

          {focusedParentZone && (
            <div className="subzone-header-card" style={{ marginBottom: "14px" }}>
              <span className="parent-title">{ZONE_LABELS[focusedParentZone]}</span>
              <span className="desc">세부 영역을 선택하고 아래 화장품을 체크하세요.</span>
            </div>
          )}

          <div className="prods" style={{ marginBottom: "16px" }}>
            {products.length ? products.map((p) => (
              <div key={p.id} className={`prod ${selectedProductIds.includes(p.id) ? "on" : ""} ${p.locked ? "locked" : ""}`} onClick={() => onProdClick(p)} style={{ borderRadius: "14px" }}>
                <div className={`prod-checkbox ${selectedProductIds.includes(p.id) ? "checked" : ""}`}>{selectedProductIds.includes(p.id) ? "✓" : ""}</div>
                <div className="swatch" />
                <div style={{ flex: 1 }}>
                  <div className="pname">{p.name}{p.locked ? " 🔒" : ""}</div>
                  <div className="ping">{p.ingredients.slice(0, 4).join(" · ")}</div>
                </div>
                <div className="prodactions">
                  <span className="edit" onClick={(e) => { e.stopPropagation(); openProductModal(p, p.id); }}>수정</span>
                  <span className="del" onClick={(e) => onDeleteProduct(e, p.id)}>삭제</span>
                </div>
              </div>
            )) : <div className="empty">등록된 제품이 없습니다. 화장대에서 먼저 등록해주세요.</div>}
          </div>

          {/* Dynamic Ingredient warnings */}
          {slotWarnings.map((w, idx) => (
            <div key={idx} className="warning-alert-card" style={{ marginBottom: "12px" }}>
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
      )}

      {/* ── Mode 2: Trouble dots logging UI content ── */}
      {mode === "trouble" && (
        <div id="troubleUI" style={{ marginTop: "16px" }}>
          
          {/* Trouble bullets selection toggle */}
          <div className="typeToggle" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {config.trouble_types.map((t) => {
              let emoji = "🟡";
              if (t === "papule") emoji = "🟠";
              if (t === "pustule") emoji = "🔴";
              if (t === "redness") emoji = "💗";
              return (
                <button 
                  key={t} 
                  className={troubleType === t ? "on" : ""} 
                  onClick={() => setTroubleType(t)}
                  style={{ 
                    flex: 1, 
                    padding: "8px 4px", 
                    borderRadius: "10px", 
                    fontSize: "11px", 
                    fontWeight: "800",
                    background: troubleType === t ? "var(--teal)" : "var(--surface)",
                    color: troubleType === t ? "#FFFFFF" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    cursor: "pointer"
                  }}
                >
                  {emoji} {TROUBLE_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>

          {/* AI scan input */}
          <label className="ocrbtn trouble-ai-btn" style={{ marginBottom: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", border: "1px solid var(--border)", borderRadius: "14px", background: "var(--surface)" }}>
            <span className="btn-icon" style={{ marginRight: "6px" }}>📸</span> 
            <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--text)" }}>AI 사진 분석 유형 판단 (베타)</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const fd = new FormData();
              fd.append("file", file);
              pushToast("AI가 사진을 분석 중입니다...", "ok");
              try {
                const res = await api("/api/dots/classify", { method: "POST", body: fd });
                if (res.type) {
                  setTroubleType(res.type);
                  pushToast(`AI 매칭 결과: ${TROUBLE_TYPE_LABELS[res.type]}`, "ok");
                } else {
                  pushToast("AI 분석 실패. 직접 지정해주세요.", "warn");
                }
              } catch (err) {
                pushToast(err.message, "warn");
              } finally {
                e.target.value = "";
              }
            }} />
          </label>

          {/* List of registered dots */}
          {dayData?.dots?.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div className="sechead">
                <h3>이 날 기록된 트러블 ({dayData.dots.length})</h3>
              </div>
              <div className="record-entry-list">
                {dayData.dots.map((d) => (
                  <div key={d.id} className="record-entry-row">
                    <span className="record-entry-zone">{ZONE_LABELS[d.zone] || d.zone}</span>
                    <span className="record-entry-name">{TYPE_EMOJI[d.type]} {TROUBLE_TYPE_LABELS[d.type]}</span>
                    <button className="record-entry-del" onClick={() => deleteDot(d.id)}>삭제</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2x2 factor grid */}
          <div className="sechead" style={{ marginTop: "24px" }}>
            <h3>외부 / 생활 요인</h3>
          </div>
          <div className="factor-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "20px" }}>
            <div className="factor-card" style={{ display: "flex", gap: "10px", padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", alignItems: "center" }}>
              <div className="factor-icon" style={{ fontSize: "20px", color: "var(--teal)" }}>☁️</div>
              <div>
                <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700" }}>오늘 날씨</div>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--text)" }}>{weather?.pm25 != null ? `${weather.pm25} ㎍/㎥` : "-"}</div>
              </div>
            </div>
            
            <div className="factor-card" style={{ display: "flex", gap: "10px", padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", alignItems: "center" }}>
              <div className="factor-icon" style={{ fontSize: "20px", color: "var(--orange)" }}>☀️</div>
              <div>
                <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700" }}>자외선 지수</div>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--text)" }}>{weather?.uv_index != null ? `높음 (${weather.uv_index})` : "-"}</div>
              </div>
            </div>

            <div className="factor-card" style={{ display: "flex", gap: "10px", padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", alignItems: "center" }}>
              <div className="factor-icon" style={{ fontSize: "20px", color: "#8B5CF6" }}>🌙</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700" }}>수면 시간</div>
                <input 
                  type="number" 
                  step="0.5" 
                  min="0" 
                  max="24" 
                  value={f.sleep} 
                  onChange={(e) => f.setSleep(e.target.value)} 
                  placeholder="시간 입력"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: "11px", fontWeight: "800", padding: 0, marginTop: "2px", color: 'var(--text)', width: '100%' }}
                />
              </div>
            </div>

            <div className="factor-card" style={{ display: "flex", gap: "10px", padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", alignItems: "center" }}>
              <div className="factor-icon" style={{ fontSize: "20px", color: "#EC4899" }}>💧</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", color: "var(--text-faint)", fontWeight: "700" }}>현재 피부</div>
                <select 
                  value={f.skinCondition} 
                  onChange={(e) => f.setSkinCondition(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: "11px", fontWeight: "800", padding: 0, marginTop: "2px", color: 'var(--text)', width: '100%' }}
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

          <div className="row" style={{ marginTop: "20px" }}>
            <button className="btn primary main-action" onClick={onSaveTroubleRecord} style={{ width: "100%", padding: "14px", borderRadius: "18px", fontSize: "14px", fontWeight: "800" }}>
              생활 요인 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
