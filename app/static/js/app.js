const ZONES = window.__ZONES;
const ZONE_LABELS = window.__ZONE_LABELS;
const LAG = 3;

const $ = s => document.querySelector(s);
const svg = $('#face');

let today = new Date(); today.setHours(0,0,0,0);
let currentDate = new Date(today);
let mode = 'apply';
let products = [];
let selectedProductId = null;
let dayData = { log: {}, dots: [] };

function fmt(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

async function api(path, opts = {}){
  const res = await fetch(path, {
    headers: opts.body && !(opts.body instanceof FormData) ? {'Content-Type': 'application/json'} : undefined,
    ...opts,
  });
  if(res.status === 401){ location.href = '/login'; throw new Error('unauthorized'); }
  if(!res.ok){
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `요청 실패 (${res.status})`);
  }
  if(res.status === 204) return null;
  return res.json();
}

// ── 날짜 ──
function dlabel(){
  const diffDays = Math.round((today - currentDate) / 86400000);
  $('#dlabel').innerHTML = diffDays === 0 ? '<b>오늘</b>'
    : diffDays > 0 ? `<b>${diffDays}일 전</b>`
    : `<b>${-diffDays}일 후</b>`;
  $('#next').disabled = currentDate >= today;
}
$('#prev').onclick = async () => {
  currentDate.setDate(currentDate.getDate() - 1);
  await loadDay(); dlabel();
};
$('#next').onclick = async () => {
  if(currentDate >= today) return;
  currentDate.setDate(currentDate.getDate() + 1);
  await loadDay(); dlabel();
};

// ── 모드 ──
function setMode(m){
  mode = m;
  $('#mApply').classList.toggle('on', m==='apply');
  $('#mTrouble').classList.toggle('on', m==='trouble');
  $('#mTrouble').classList.toggle('trouble', m==='trouble');
  $('#applyUI').style.display = m==='apply' ? '' : 'none';
  $('#hint').textContent = m==='apply'
    ? (selectedProductId ? `"${products.find(p=>p.id===selectedProductId)?.name}" → 바른 부위를 탭하세요`
           : '아래에서 제품을 고른 뒤 부위를 탭하세요')
    : '뾰루지가 난 자리를 얼굴 위에서 자유롭게 탭하세요 (다시 탭하면 삭제)';
}
$('#mApply').onclick = () => setMode('apply');
$('#mTrouble').onclick = () => setMode('trouble');

// ── 제품 목록 ──
async function loadProducts(){
  products = await api('/api/products');
  renderProds();
}
function renderProds(){
  $('#prods').innerHTML = products.map(p => `
    <div class="prod ${selectedProductId===p.id?'on':''}" data-p="${p.id}">
      <div class="swatch"></div>
      <div style="flex:1">
        <div class="pname">${escapeHtml(p.name)}</div>
        <div class="ping">${p.ingredients.map(escapeHtml).join(' · ')}</div>
      </div>
      <div class="del" data-del="${p.id}">삭제</div>
    </div>`).join('') || `<div class="empty">등록된 제품이 없습니다. 위 '+ 제품 추가'로 시작하세요.</div>`;

  document.querySelectorAll('.prod').forEach(el => {
    el.onclick = e => {
      if(e.target.dataset.del) return;
      const id = +el.dataset.p;
      selectedProductId = (selectedProductId===id) ? null : id;
      renderProds(); renderFace(); setMode(mode);
    };
  });
  document.querySelectorAll('[data-del]').forEach(el => {
    el.onclick = async e => {
      e.stopPropagation();
      if(!confirm('이 제품을 삭제할까요? (기록된 사용 이력도 함께 지워집니다)')) return;
      await api(`/api/products/${el.dataset.del}`, { method: 'DELETE' });
      if(selectedProductId === +el.dataset.del) selectedProductId = null;
      await loadProducts(); await loadDay();
    };
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ── 얼굴 ──
async function loadDay(){
  dayData = await api(`/api/day/${fmt(currentDate)}`);
  renderFace();
}
function renderFace(){
  document.querySelectorAll('.zone').forEach(z => {
    const zone = z.dataset.z;
    const has = selectedProductId && (dayData.log[zone] || []).includes(selectedProductId);
    z.classList.toggle('applied', !!has);
  });
  $('#dots').innerHTML = dayData.dots
    .map(d => `<circle class="dot" cx="${d.x}" cy="${d.y}" r="6" data-id="${d.id}"/>`).join('');
  document.querySelectorAll('.dot').forEach(c => {
    c.onclick = async e => {
      e.stopPropagation();
      await api(`/api/dots/${c.dataset.id}`, { method: 'DELETE' });
      await loadDay();
    };
  });
}

document.querySelectorAll('.zone').forEach(z => {
  z.addEventListener('click', async e => {
    if(mode !== 'apply') return;
    e.stopPropagation();
    if(!selectedProductId){ flash('먼저 제품을 고르세요'); return; }
    await api('/api/log/toggle', {
      method: 'POST',
      body: JSON.stringify({ date: fmt(currentDate), zone: z.dataset.z, product_id: selectedProductId }),
    });
    await loadDay();
  });
});

svg.addEventListener('click', async e => {
  if(mode !== 'trouble') return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let zone = null;
  for(const el of document.querySelectorAll('.zone')){
    if(el.isPointInFill(new DOMPoint(p.x, p.y))){ zone = el.dataset.z; break; }
  }
  if(!zone){ flash('얼굴 영역 안을 탭해주세요'); return; }
  await api('/api/dots', {
    method: 'POST',
    body: JSON.stringify({ date: fmt(currentDate), zone, x: p.x, y: p.y }),
  });
  await loadDay();
});

let ft;
function flash(msg){
  const h = $('#hint');
  h.textContent = msg; h.style.color = '#E14B48';
  clearTimeout(ft);
  ft = setTimeout(()=>{ h.style.color=''; setMode(mode); }, 1400);
}

// ── 편의 버튼 ──
$('#same').onclick = async () => {
  await api(`/api/log/copy-previous?day=${fmt(currentDate)}`, { method: 'POST' });
  await loadDay();
};
$('#clear').onclick = async () => {
  await api(`/api/log/${fmt(currentDate)}`, { method: 'DELETE' });
  await loadDay();
};

// ── 제품 추가 모달 ──
$('#addProductBtn').onclick = () => openProductModal();
function openProductModal(prefill){
  const name = prefill?.name || '';
  const ing = prefill?.ingredients?.join(', ') || '';
  $('#productSheet').innerHTML = `
    <h2>제품 추가</h2>
    <div class="sub">성분표 사진을 찍으면 자동으로 인식해요</div>
    <label class="ocrbtn" id="ocrTrigger">📷 성분표 사진으로 인식하기
      <input type="file" accept="image/*" capture="environment" id="ocrFile" style="display:none">
    </label>
    <div class="spinner" id="ocrSpinner">인식 중…</div>
    <div class="field">
      <label>제품명</label>
      <input id="pfName" value="${escapeHtml(name)}" placeholder="예: 세라마이드 수분크림">
    </div>
    <div class="field">
      <label>성분 (쉼표로 구분)</label>
      <textarea id="pfIng" placeholder="정제수, 글리세린, ...">${escapeHtml(ing)}</textarea>
    </div>
    <div class="row">
      <button class="btn ghost" onclick="closeProductModal()">취소</button>
      <button class="btn primary" id="pfSave">저장</button>
    </div>`;
  $('#productModal').classList.add('show');

  $('#ocrTrigger').onclick = () => $('#ocrFile').click();
  $('#ocrFile').onchange = async () => {
    const file = $('#ocrFile').files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    $('#ocrSpinner').style.display = 'block';
    try {
      const result = await api('/api/products/ocr', { method: 'POST', body: fd });
      if(result.name) $('#pfName').value = result.name;
      $('#pfIng').value = result.ingredients.join(', ');
      if(!result.ingredients.length) flash('성분을 인식하지 못했어요. 다시 찍거나 직접 입력해주세요');
    } catch(err){
      alert(err.message);
    } finally {
      $('#ocrSpinner').style.display = 'none';
    }
  };

  $('#pfSave').onclick = async () => {
    const nameVal = $('#pfName').value.trim();
    const ingVal = $('#pfIng').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(!nameVal || !ingVal.length){ alert('제품명과 성분을 입력해주세요'); return; }
    await api('/api/products', { method: 'POST', body: JSON.stringify({ name: nameVal, ingredients: ingVal }) });
    closeProductModal();
    await loadProducts();
  };
}
function closeProductModal(){ $('#productModal').classList.remove('show'); }
$('#productModal').onclick = e => { if(e.target.id === 'productModal') closeProductModal(); };

// ── 분석 ──
$('#analyze').onclick = async () => {
  const r = await api('/api/analysis');
  const s = $('#sheet');
  const productName = id => products.find(p=>p.id===id)?.name || '(삭제된 제품)';

  if(!r.events){
    s.innerHTML = `<h2>아직 분석할 게 없습니다</h2>
      <div class="empty">'트러블 표시' 모드에서 뾰루지 난 자리를 먼저 찍어주세요.<br>
      비교할 부위가 있어야 원인을 좁힐 수 있습니다.</div>
      <div class="row"><button class="btn ghost" onclick="closeM()">닫기</button></div>`;
  } else if(!r.suspects.length){
    s.innerHTML = `<h2>겹치는 성분을 못 찾았습니다</h2>
      <div class="empty">트러블이 난 부위에만 발린 성분이 없습니다.<br>
      제품 외 원인(수면·마찰·호르몬)일 수 있어요.</div>
      <div class="row"><button class="btn ghost" onclick="closeM()">닫기</button></div>`;
  } else {
    const top = r.suspects.slice(0,3);
    s.innerHTML = `
      <h2>분석 대조 결과</h2>
      <div class="sub">트러블 ${r.events}건 · 발생 부위 ${r.bad_zones.map(z=>ZONE_LABELS[z]).join(', ')}
        · 비교군 ${r.good_zones.map(z=>ZONE_LABELS[z]).join(', ') || '없음'}</div>
      ${top.map((s0,i)=>`
        <div class="card ${i===0?'top':''}">
          <div class="ing">${escapeHtml(s0.ingredient)}</div>
          <div class="evi">
            <b>${s0.zones.map(z=>ZONE_LABELS[z]).join(', ')}</b>에서만 발랐고,
            그 부위에서 트러블이 났습니다.<br>
            ${r.good_zones.length ? `<b>${r.good_zones.map(z=>ZONE_LABELS[z]).join(', ')}</b>에는 바르지 않았고 괜찮았습니다.<br>` : ''}
            해당 성분이 든 제품 →
            ${s0.product_ids.map(productName).join(', ')}
          </div>
          <div class="meter">${[0,1,2,3,4].map(n=>
            `<i class="${n < Math.min(5, Math.ceil(s0.count/2)) ? 'f':''}"></i>`).join('')}</div>
        </div>`).join('')}
      <div class="ask">
        <p><b>${escapeHtml(top[0].ingredient)}</b>이(가) 반복해서 겹칩니다.<br>
        2주간 이 성분이 든 제품만 빼고 나머지는 그대로 써보시겠어요?
        결과가 다시 기록에 쌓이면 신뢰도가 올라갑니다.</p>
      </div>
      <div class="disc">의료적 진단이 아니며 참고용입니다.<br>
      증상이 지속되면 피부과 전문의와 상담하세요.</div>
      <div class="row"><button class="btn ghost" onclick="closeM()">닫기</button></div>`;
  }
  $('#modal').classList.add('show');
};
function closeM(){ $('#modal').classList.remove('show'); }
$('#modal').onclick = e => { if(e.target.id === 'modal') closeM(); };

// ── 로그아웃 ──
$('#logout').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/login';
};

(async function init(){
  dlabel();
  await loadProducts();
  await loadDay();
  setMode(mode);
})();
