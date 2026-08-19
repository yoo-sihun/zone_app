"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function ProductModal() {
  const { productModal, closeProductModal, saveProduct } = useApp();
  const { open, prefill, editId } = productModal;
  const [name, setName] = useState("");
  const [ing, setIng] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(prefill?.name || "");
      setIng(prefill?.ingredients?.join(", ") || "");
    }
  }, [open, prefill]);

  if (!open) return null;

  async function onOcrFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setOcrLoading(true);
    try {
      const result = await api("/api/products/ocr", { method: "POST", body: fd });
      if (result.name) setName(result.name);
      setIng(result.ingredients.join(", "));
      if (!result.ingredients.length) alert("성분을 인식하지 못했어요. 다시 찍거나 직접 입력해주세요");
    } catch (err) {
      alert(err.message);
    } finally {
      setOcrLoading(false);
      e.target.value = "";
    }
  }

  async function onSave() {
    const nameVal = name.trim();
    const ingVal = ing.split(",").map((s) => s.trim()).filter(Boolean);
    if (!nameVal || !ingVal.length) { alert("제품명과 성분을 입력해주세요"); return; }
    await saveProduct(nameVal, ingVal, editId);
  }

  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeProductModal(); }}>
      <div className="sheet">
        <h2>{editId ? "제품 수정" : "제품 추가"}</h2>
        <div className="sub">성분표 사진을 찍으면 자동으로 인식해요</div>
        <label className="ocrbtn">
          📷 성분표 사진으로 인식하기
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onOcrFile} />
        </label>
        {ocrLoading && <div className="spinner">인식 중…</div>}
        <div className="field">
          <label>제품명</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 세라마이드 수분크림" />
        </div>
        <div className="field">
          <label>성분 (쉼표로 구분)</label>
          <textarea value={ing} onChange={(e) => setIng(e.target.value)} placeholder="정제수, 글리세린, ..." />
        </div>
        <div className="row">
          <button className="btn ghost" onClick={closeProductModal}>취소</button>
          <button className="btn primary" onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
