"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

export default function ProductModal() {
  const { productModal, closeProductModal, saveProduct } = useApp();
  const { open, prefill, editId, mode } = productModal;
  const [name, setName] = useState("");
  const [ing, setIng] = useState("");
  const [category, setCategory] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  useEffect(() => {
    if (open) {
      setName(prefill?.name || "");
      setIng(prefill?.ingredients?.join(", ") || "");
      setCategory(prefill?.category || "");
      setOcrDone(false);
    }
  }, [open, prefill]);

  if (!open) return null;

  // editId(수정)나 mode 없이 연 경우("+ 새 제품 등록")는 기존처럼 OCR+직접입력을 한 화면에 같이 보여줌
  const isManualOnly = mode === "manual" && !editId;
  const isOcrOnly = mode === "ocr" && !editId;
  const showOcrButton = !isManualOnly;
  const showFields = !isOcrOnly || ocrDone;

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
      setOcrDone(true);
      e.target.value = "";
    }
  }

  async function onSave() {
    const nameVal = name.trim();
    const ingVal = ing.split(",").map((s) => s.trim()).filter(Boolean);
    if (!nameVal || !ingVal.length) { alert("제품명과 성분을 입력해주세요"); return; }
    await saveProduct(nameVal, ingVal, editId, category);
  }

  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeProductModal(); }}>
      <div className="sheet">
        <h2>{editId ? "제품 수정" : "제품 추가"}</h2>
        <div className="sub">
          {isManualOnly
            ? "제품명과 전성분을 입력해 등록해주세요."
            : "성분표 사진을 찍으면 자동으로 인식해요"}
        </div>

        {showOcrButton && (
          <label className={`ocrbtn ${isOcrOnly && !ocrDone ? "big" : ""}`}>
            <span className={isOcrOnly && !ocrDone ? "ocrbtn-emoji" : undefined}>📷</span>
            {isOcrOnly && !ocrDone ? "성분표 사진 촬영하기" : "성분표 사진으로 인식하기"}
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onOcrFile} />
          </label>
        )}
        {ocrLoading && <div className="spinner" style={{ display: "block" }}>인식 중…</div>}

        {isOcrOnly && !ocrDone && !ocrLoading && (
          <div className="sub" style={{ marginTop: -8, marginBottom: 16 }}>
            <span className="linkbtn" onClick={() => setOcrDone(true)}>사진 없이 직접 입력할게요</span>
          </div>
        )}

        {showFields && (
          <>
            <div className="field">
              <label>제품명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 세라마이드 수분크림" />
            </div>
            <div className="field">
              <label>카테고리 (선택)</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">선택안함</option>
                <option value="토너">토너</option>
                <option value="에센스/세럼">에센스/세럼</option>
                <option value="크림/로션">크림/로션</option>
                <option value="선크림">선크림</option>
                <option value="클렌저">클렌저</option>
                <option value="팩/마스크">팩/마스크</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div className="field">
              <label>성분 (쉼표로 구분)</label>
              <textarea value={ing} onChange={(e) => setIng(e.target.value)} placeholder="정제수, 글리세린, ..." />
            </div>
            <div className="row">
              <button className="btn ghost" onClick={closeProductModal}>취소</button>
              <button className="btn primary" onClick={onSave}>저장</button>
            </div>
          </>
        )}
        {!showFields && (
          <div className="row">
            <button className="btn ghost" onClick={closeProductModal}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}
