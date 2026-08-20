"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { api } from "@/lib/api";

// 사진을 그대로 base64로 넣으면 폰 카메라 원본(수 MB)이라 DB가 무거워지므로,
// 캔버스로 가로 480px 이하로 줄이고 JPEG로 압축해서 넣음(별도 오브젝트 스토리지 없이
// products.image 컬럼에 data URI로 직접 저장하는 방식이라 크기를 미리 줄여야 함).
function resizeImageFile(file, maxWidth = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 불러오지 못했어요"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductModal() {
  const { productModal, closeProductModal, saveProduct } = useApp();
  const { open, prefill, editId, mode } = productModal;
  const [name, setName] = useState("");
  const [ing, setIng] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  useEffect(() => {
    if (open) {
      setName(prefill?.name || "");
      setIng(prefill?.ingredients?.join(", ") || "");
      setCategory(prefill?.category || "");
      setImage(prefill?.image || null);
      setOcrDone(false);
    }
  }, [open, prefill]);

  async function onPhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setImage(await resizeImageFile(file));
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = "";
    }
  }

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
    await saveProduct(nameVal, ingVal, editId, category, image);
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
              <label>제품 사진 (선택)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {image && (
                  <img src={image} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)" }} />
                )}
                <label className="btn ghost" style={{ fontSize: 11, padding: "6px 12px", cursor: "pointer" }}>
                  {image ? "사진 바꾸기" : "📷 사진 선택"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPhotoFile} />
                </label>
                {image && (
                  <button type="button" className="linkbtn" onClick={() => setImage(null)}>제거</button>
                )}
              </div>
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
