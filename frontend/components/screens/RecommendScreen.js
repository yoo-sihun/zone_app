"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function RecommendScreen() {
  const {
    config, setScreen, setMode,
    selectedProductIds, toggleProductSelection, setSelectedProductIds,
    pushToast, openProductModal,
  } = useApp();
  const [zoneFilter, setZoneFilter] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const path = zoneFilter ? `/api/products/recommended?zone=${zoneFilter}` : "/api/products/recommended";
        const list = await api(path);
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [zoneFilter]);

  // 화장대에 없는 외부 카탈로그 추천 — 부위 필터와 무관하게 한 번만 불러옴(의심 성분 배제만 적용됨)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api("/api/catalog/recommended");
        if (!cancelled) setCatalogItems(list);
      } catch (e) {
        if (!cancelled) setCatalogItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function addCatalogItem(item) {
    openProductModal({ name: item.name, ingredients: item.ingredients, category: item.category }, null, null);
  }

  if (!config) return null;
  const ZONES = Object.keys(config.sub_zones);
  const ZONE_LABELS = config.zone_labels;

  function closeScreen() {
    setSelectedProductIds([]);
    setScreen("home");
  }

  function onProdClick(p) {
    if (p.locked) { pushToast("실험 진행 중이라 잠긴 제품입니다", "warn"); return; }
    toggleProductSelection(p.id);
  }

  function goApply() {
    if (!selectedProductIds.length) { pushToast("먼저 제품을 골라주세요", "warn"); return; }
    setScreen("record");
    setMode("apply");
    pushToast("얼굴에서 바른 부위를 탭해주세요", "ok");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="screen" id="screenRecommend">
      <div className="datebar">
        <button className="navbtn" onClick={closeScreen} title="뒤로">‹</button>
        <div className="dlabel"><b>제품 추천</b></div>
        <span style={{ width: 36 }} />
      </div>
      <div className="sub" style={{ marginBottom: 16 }}>
        오늘 아직 안 바른 제품 중에서 골라보세요. 여러 개를 골라 한 번에 바를 수도 있어요.
      </div>

      <div className="chip-row">
        <button className={`chip ${!zoneFilter ? "on" : ""}`} onClick={() => setZoneFilter(null)}>전체</button>
        {ZONES.map((z) => (
          <button key={z} className={`chip ${zoneFilter === z ? "on" : ""}`} onClick={() => setZoneFilter(z)}>
            {ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" style={{ display: "block" }}>추천 제품을 불러오는 중…</div>}

      {!loading && (
        <div className="prods">
          {items.length ? items.map((p) => (
            <div key={p.id} className={`prod ${selectedProductIds.includes(p.id) ? "on" : ""} ${p.locked ? "locked" : ""}`} onClick={() => onProdClick(p)}>
              <div className={`prod-checkbox ${selectedProductIds.includes(p.id) ? "checked" : ""}`}>{selectedProductIds.includes(p.id) ? "✓" : ""}</div>
              <div className="swatch" />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {p.category && <span className="record-entry-zone" style={{ flexShrink: 0 }}>{p.category}</span>}
                  <div className="pname">{p.name}{p.locked ? " 🔒" : ""}</div>
                </div>
                <div className="ping">{p.ingredients.slice(0, 4).join(" · ")}</div>
              </div>
            </div>
          )) : <div className="empty">오늘 등록된 제품을 다 바르셨거나, 이 부위에 추천할 제품이 없어요.</div>}
        </div>
      )}

      {catalogItems.length > 0 && (
        <>
          <div className="sechead" style={{ marginTop: 24 }}>
            <h3>새로 추천하는 제품</h3>
          </div>
          <div className="sub" style={{ marginBottom: 12 }}>
            아직 화장대에 없는 제품이에요. 의심 성분이 든 제품은 자동으로 빠져있어요.
          </div>
          <div className="prods">
            {catalogItems.map((item, i) => (
              <div key={i} className="prod">
                <div className="swatch" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {item.category && <span className="record-entry-zone" style={{ flexShrink: 0 }}>{item.category}</span>}
                    <div className="pname">{item.name}</div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{item.brand}</div>
                  <div className="ping">{item.ingredients.slice(0, 4).join(" · ")}</div>
                </div>
                <button className="btn ghost" style={{ flexShrink: 0, padding: "6px 10px", fontSize: 11 }} onClick={() => addCatalogItem(item)}>
                  화장대에 등록
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row utility-buttons" style={{ marginTop: 20 }}>
        <button className="btn primary" style={{ width: "100%" }} disabled={!selectedProductIds.length} onClick={goApply}>
          {selectedProductIds.length ? `선택한 제품 ${selectedProductIds.length}개 바르러 가기` : "제품을 선택해주세요"}
        </button>
      </div>
    </div>
  );
}
