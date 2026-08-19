const ZONES = window.__ZONES;
const ZONE_LABELS = window.__ZONE_LABELS;
const TROUBLE_TYPES = window.__TROUBLE_TYPES;
const TROUBLE_TYPE_LABELS = window.__TROUBLE_TYPE_LABELS;
const EXPERIMENT_DAYS = window.__EXPERIMENT_DAYS;

const $ = s => document.querySelector(s);
const svg = $('#face');

let today = new Date(); today.setHours(0,0,0,0);
let currentDate = new Date(today);
let mode = 'apply';
let currentSlot = 'am';
let currentType = TROUBLE_TYPES[0];
let products = [];
let suspects = [];
let activeExperiment = null;
let selectedProductId = null;
let dayData = { log: {}, dots: [] };
let analysisTypeFilter = null;

function fmt(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function api(path, opts = {}){
  const res = await fetch(path, {
    headers: opts.body && !(opts.body instanceof FormData) ? {'Content-Type': 'application/json'} : undefined,
    ...opts,
  });
  if(!res.ok){
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `요청 실패 (${res.status})`);
  }
  if(res.status === 204) return null;
  return res.json();
}

// ── 토스트 ──
function toast(msg, kind='warn'){
  const wrap = $('#toastwrap');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3400);
}
function showInteractionWarnings(warnings){
  (warnings || []).forEach(w => toast(`⚠ ${w.a} + ${w.b} — ${w.description}`, 'warn'));
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

// ── 모드 / 시간대 / 트러블 유형 ──
function setMode(m){
  mode = m;
  $('#mApply').classList.toggle('on', m==='apply');
  $('#mTrouble').classList.toggle('on', m==='trouble');
  $('#mTrouble').classList.toggle('trouble', m==='trouble');
  $('#applyUI').style.display = m==='apply' ? '' : 'none';
  $('#slotToggle').style.display = m==='apply' ? 'flex' : 'none';
  $('#typeToggle').style.display = m==='trouble' ? 'flex' : 'none';
  $('#hint').textContent = m==='apply'
    ? (selectedProductId
        ? `"${products.find(p=>p.id===selectedProductId)?.name}" → 바른 부위를 탭하세요 (${currentSlot==='am'?'아침':'저녁'})`
        : '아래에서 제품을 고른 뒤 부위를 탭하세요')
    : `뾰루지가 난 자리를 얼굴 위에서 자유롭게 탭하세요 (${TROUBLE_TYPE_LABELS[currentType]} · 다시 탭하면 삭제)`;
}
$('#mApply').onclick = () => setMode('apply');
$('#mTrouble').onclick = () => setMode('trouble');

document.querySelectorAll('#slotToggle button').forEach(b => {
  b.onclick = () => {
    currentSlot = b.dataset.slot;
    document.querySelectorAll('#slotToggle button').forEach(x => x.classList.toggle('on', x===b));
    renderFace();
    setMode(mode);
  };
});
document.querySelectorAll('#typeToggle button').forEach(b => {
  b.onclick = () => {
    currentType = b.dataset.type;
    document.querySelectorAll('#typeToggle button').forEach(x => x.classList.toggle('on', x===b));
    setMode(mode);
  };
});

// ── 제품 목록 ──
async function loadProducts(){
  products = await api('/api/products');
  renderProds();
}
function renderProds(){
  $('#prods').innerHTML = products.map(p => `
    <div class="prod ${selectedProductId===p.id?'on':''} ${p.locked?'locked':''}" data-p="${p.id}">
      <div class="swatch"></div>
      <div style="flex:1">
        <div class="pname">${escapeHtml(p.name)}${p.locked ? ' 🔒' : ''}</div>
        <div class="ping">${p.ingredients.map(escapeHtml).join(' · ')}</div>
      </div>
      <div class="del" data-del="${p.id}">삭제</div>
    </div>`).join('') || `<div class="empty">등록된 제품이 없습니다. 위 '+ 제품 추가'로 시작하세요.</div>`;

  document.querySelectorAll('.prod').forEach(el => {
    el.onclick = e => {
      if(e.target.dataset.del) return;
      if(el.classList.contains('locked')){ flash('실험 진행 중이라 잠긴 제품입니다'); return; }
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

// ── 얼굴 ──
async function loadDay(){
  dayData = await api(`/api/day/${fmt(currentDate)}`);
  renderFace();
}
function renderFace(){
  document.querySelectorAll('.zone').forEach(z => {
    const zone = z.dataset.z;
    const slotIds = (dayData.log[zone] && dayData.log[zone][currentSlot]) || [];
    const has = selectedProductId && slotIds.includes(selectedProductId);
    z.classList.toggle('applied', !!has);
  });
  $('#dots').innerHTML = dayData.dots
    .map(d => `<circle class="dot ${d.type}" cx="${d.x}" cy="${d.y}" r="6" data-id="${d.id}"/>`).join('');
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
    try {
      const r = await api('/api/log/toggle', {
        method: 'POST',
        body: JSON.stringify({
          date: fmt(currentDate), zone: z.dataset.z, time_slot: currentSlot, product_id: selectedProductId,
        }),
      });
      showInteractionWarnings(r.warnings);
    } catch(err){
      alert(err.message);
    }
    await loadDay();
  });
});

svg.addEventListener('click', async e => {
  if(mode !== 'trouble') return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const testPt = svg.createSVGPoint(); // isPointInFill requires an SVGPoint, not the DOMPoint matrixTransform() returns
  testPt.x = p.x; testPt.y = p.y;
  let zone = null;
  for(const el of document.querySelectorAll('.zone')){
    if(el.isPointInFill(testPt)){ zone = el.dataset.z; break; }
  }
  if(!zone){ flash('얼굴 영역 안을 탭해주세요'); return; }
  await api('/api/dots', {
    method: 'POST',
    body: JSON.stringify({ date: fmt(currentDate), zone, type: currentType, x: p.x, y: p.y }),
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
  const r = await api(`/api/log/copy-previous?day=${fmt(currentDate)}`, { method: 'POST' });
  if(r.skipped && r.skipped.length) toast(`실험 진행 중이라 제외됨: ${r.skipped.join(', ')}`, 'warn');
  showInteractionWarnings(r.warnings);
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
    const r = await api('/api/products', { method: 'POST', body: JSON.stringify({ name: nameVal, ingredients: ingVal }) });
    if(r.warnings && r.warnings.length) toast(`⚠ 의심 성분 포함: ${r.warnings.join(', ')}`, 'warn');
    closeProductModal();
    await loadProducts();
  };
}
function closeProductModal(){ $('#productModal').classList.remove('show'); }
$('#productModal').onclick = e => { if(e.target.id === 'productModal') closeProductModal(); };

// ── 분석 ──
$('#analyze').onclick = () => openAnalysisModal();

async function openAnalysisModal(){
  const r = await api(`/api/analysis${analysisTypeFilter ? '?type='+analysisTypeFilter : ''}`);
  renderAnalysisModal(r);
  $('#modal').classList.add('show');
}

function renderAnalysisModal(r){
  const s = $('#sheet');
  const productName = id => products.find(p=>p.id===id)?.name || '(삭제된 제품)';
  const typeChips = `
    <div class="chiprow">
      <button class="chip ${!analysisTypeFilter?'on':''}" data-tf="">전체</button>
      ${TROUBLE_TYPES.map(t=>`<button class="chip ${analysisTypeFilter===t?'on':''}" data-tf="${t}">${TROUBLE_TYPE_LABELS[t]}</button>`).join('')}
    </div>`;

  if(!r.events || !r.suspects.length){
    s.innerHTML = `<h2>${!r.events ? '아직 분석할 게 없습니다' : '겹치는 성분을 못 찾았습니다'}</h2>
      ${typeChips}
      <div class="empty">${escapeHtml(r.message)}</div>
      <div class="row"><button class="btn ghost" onclick="closeM()">닫기</button></div>`;
  } else {
    const top = r.suspects.slice(0,3);
    const top0 = top[0];
    s.innerHTML = `
      <h2>분석 대조 결과</h2>
      ${typeChips}
      <div class="sub">${escapeHtml(r.message)}</div>
      <div class="sub">트러블 ${r.events}건 · 발생 부위 ${r.bad_zones.map(z=>ZONE_LABELS[z]).join(', ')}
        · 비교군 ${r.good_zones.map(z=>ZONE_LABELS[z]).join(', ') || '없음'}</div>
      ${top.map((s0,i)=>`
        <div class="card ${i===0?'top':''}">
          <div class="ing">${escapeHtml(s0.ingredient)}</div>
          <div class="evi">
            <b>${s0.zones.map(z=>ZONE_LABELS[z]).join(', ')}</b>에서만 발랐고,
            그 부위에서 트러블이 났습니다.<br>
            ${r.good_zones.length ? `<b>${r.good_zones.map(z=>ZONE_LABELS[z]).join(', ')}</b>에는 바르지 않았고 괜찮았습니다.<br>` : ''}
            도포 시간대 → ${s0.time_slots.map(t=>t==='am'?'아침':'저녁').join(', ')}<br>
            해당 성분이 든 제품 →
            ${s0.product_ids.map(productName).join(', ')}
          </div>
          <div class="meter">${[0,1,2,3,4].map(n=>
            `<i class="${n < Math.min(5, Math.ceil(s0.count/2)) ? 'f':''}"></i>`).join('')}</div>
        </div>`).join('')}
      <div class="ask">
        <p><b>${escapeHtml(top0.ingredient)}</b>이(가) 반복해서 겹칩니다. 다음 단계로 넘어가볼까요?</p>
        <div class="row">
          <button class="btn ghost" id="saveSuspectBtn">의심 성분 저장</button>
          <button class="btn primary" id="startExpBtn" ${activeExperiment ? 'disabled' : ''}>3일 실험 시작</button>
        </div>
        ${activeExperiment ? `<div class="expnote">이미 "${escapeHtml(activeExperiment.ingredient)}" 실험이 진행 중이에요.</div>` : ''}
      </div>
      <div class="disc">의료적 진단이 아니며 참고용입니다.<br>
      증상이 지속되면 피부과 전문의와 상담하세요.</div>
      <div class="row"><button class="btn ghost" onclick="closeM()">닫기</button></div>`;

    $('#saveSuspectBtn').onclick = async () => {
      await api('/api/suspects', { method: 'POST', body: JSON.stringify({ ingredient: top0.ingredient }) });
      toast(`"${top0.ingredient}" 의심 성분으로 저장했어요`, 'ok');
    };
    $('#startExpBtn').onclick = () => startExperiment(top0.ingredient);
  }

  document.querySelectorAll('#sheet [data-tf]').forEach(el => {
    el.onclick = () => {
      analysisTypeFilter = el.dataset.tf || null;
      openAnalysisModal();
    };
  });
}
function closeM(){ $('#modal').classList.remove('show'); }
$('#modal').onclick = e => { if(e.target.id === 'modal') closeM(); };

// ── 3일 실험 ──
async function loadActiveExperiment(){
  activeExperiment = await api('/api/experiments/active');
  renderExpBar();
}
function renderExpBar(){
  const el = $('#expbar');
  if(!activeExperiment){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="expinfo">🧪 <b>${escapeHtml(activeExperiment.ingredient)}</b> 제외 실험 · ${activeExperiment.day}/${EXPERIMENT_DAYS}일차</div>
    <div class="exbtns">
      <button class="expbtn" id="expResultBtn">${activeExperiment.is_complete ? '결과 보기' : '중간 확인'}</button>
      <button class="expbtn stop" id="expStopBtn">중단</button>
    </div>`;
  $('#expResultBtn').onclick = openExpResultModal;
  $('#expStopBtn').onclick = async () => {
    if(!confirm('실험을 중단할까요?')) return;
    await api(`/api/experiments/${activeExperiment.id}`, { method: 'PATCH' });
    await loadActiveExperiment();
    await loadProducts();
  };
}
async function startExperiment(ingredient){
  try {
    await api('/api/experiments', { method: 'POST', body: JSON.stringify({ ingredient }) });
    await loadActiveExperiment();
    await loadProducts();
    closeM();
    toast(`"${ingredient}" 3일 실험을 시작했어요`, 'ok');
  } catch(err){
    alert(err.message);
  }
}
async function openExpResultModal(){
  if(!activeExperiment) return;
  const r = await api(`/api/experiments/${activeExperiment.id}/result`);
  const s = $('#miscSheet');
  s.innerHTML = `
    <h2>${escapeHtml(r.ingredient)} 실험 결과</h2>
    <div class="sub">${r.is_complete ? '실험 종료' : `진행 중 · ${r.day}/${EXPERIMENT_DAYS}일차 (중간 결과)`}</div>
    <div class="card">
      <div class="explabel">실험 전 ${EXPERIMENT_DAYS}일</div>
      <div class="expnum">${r.before_count}건</div>
    </div>
    <div class="card ${r.improved ? 'top' : ''}">
      <div class="explabel">실험 중 ${EXPERIMENT_DAYS}일</div>
      <div class="expnum">${r.during_count}건</div>
    </div>
    <div class="ask">
      <p>${r.improved ? '트러블이 줄었어요. 이 성분이 원인일 가능성이 있습니다.' : '큰 변화가 없어요. 다른 요인도 함께 살펴보는 게 좋겠어요.'}</p>
    </div>
    <div class="row"><button class="btn ghost" onclick="closeMisc()">닫기</button></div>`;
  $('#miscModal').classList.add('show');
  await loadActiveExperiment();
}

// ── 의심 성분 목록 ──
async function loadSuspects(){ suspects = await api('/api/suspects'); }
async function openSuspectsModal(){
  await loadSuspects();
  renderSuspectsModal();
  $('#miscModal').classList.add('show');
}
function renderSuspectsModal(){
  const s = $('#miscSheet');
  s.innerHTML = `
    <h2>의심 성분</h2>
    <div class="sub">저장해두면 새 제품 등록할 때 자동으로 겹치는지 확인해줘요</div>
    <div class="field"><input id="newSuspectInput" placeholder="성분명 입력"></div>
    <div class="row"><button class="btn primary" id="addSuspectBtn">추가</button></div>
    <div class="suslist">
      ${suspects.length ? suspects.map(s0 => `
        <div class="susitem">
          <span>${escapeHtml(s0.ingredient)}</span>
          <span class="del" data-sid="${s0.id}">삭제</span>
        </div>`).join('') : '<div class="empty">저장된 의심 성분이 없습니다.</div>'}
    </div>
    <div class="row"><button class="btn ghost" onclick="closeMisc()">닫기</button></div>`;

  $('#addSuspectBtn').onclick = async () => {
    const val = $('#newSuspectInput').value.trim();
    if(!val) return;
    await api('/api/suspects', { method: 'POST', body: JSON.stringify({ ingredient: val }) });
    await loadSuspects();
    renderSuspectsModal();
  };
  document.querySelectorAll('#miscSheet [data-sid]').forEach(el => {
    el.onclick = async () => {
      await api(`/api/suspects/${el.dataset.sid}`, { method: 'DELETE' });
      await loadSuspects();
      renderSuspectsModal();
    };
  });
}

// ── 외부 요인 ──
async function openFactorsModal(){
  const d = fmt(currentDate);
  let data = null;
  try { data = await api(`/api/external-factors/${d}`); } catch(e) { data = null; }
  renderFactorsModal(d, data || {});
  $('#miscModal').classList.add('show');
}
function renderFactorsModal(d, data){
  const s = $('#miscSheet');
  s.innerHTML = `
    <h2>오늘의 외부 요인</h2>
    <div class="sub">${d}</div>
    <div class="field">
      <label>수면 시간 (시간)</label>
      <input id="fSleep" type="number" step="0.5" min="0" max="24" value="${data.sleep_hours ?? ''}">
    </div>
    <div class="field">
      <label>생리 주기</label>
      <select id="fPhase">
        <option value="">선택 안 함</option>
        <option value="menstrual">생리기</option>
        <option value="follicular">난포기</option>
        <option value="ovulation">배란기</option>
        <option value="luteal">황체기</option>
      </select>
    </div>
    <div class="field">
      <label>메모</label>
      <textarea id="fMemo" placeholder="특이사항">${data.memo || ''}</textarea>
    </div>
    <div class="field">
      <label>미세먼지 (PM2.5)</label>
      <div class="pm25row">
        <span id="fPm25">${data.pm25 != null ? data.pm25 + ' ㎍/㎥' : '아직 조회 안 함'}</span>
        <button class="btn ghost small" id="fSyncBtn" type="button">동기화</button>
      </div>
    </div>
    <div class="row">
      <button class="btn ghost" onclick="closeMisc()">닫기</button>
      <button class="btn primary" id="fSaveBtn">저장</button>
    </div>`;
  if(data.menstrual_phase) $('#fPhase').value = data.menstrual_phase;

  $('#fSyncBtn').onclick = async () => {
    $('#fPm25').textContent = '조회 중…';
    try {
      const r = await api(`/api/external-factors/${d}/sync-pm25`, { method: 'POST' });
      $('#fPm25').textContent = r.pm25 != null ? r.pm25 + ' ㎍/㎥' : '데이터 없음';
    } catch(err){
      $('#fPm25').textContent = '조회 실패';
      alert(err.message);
    }
  };

  $('#fSaveBtn').onclick = async () => {
    const sleepVal = $('#fSleep').value;
    await api('/api/external-factors', {
      method: 'POST',
      body: JSON.stringify({
        date: d,
        sleep_hours: sleepVal === '' ? null : parseFloat(sleepVal),
        menstrual_phase: $('#fPhase').value || null,
        memo: $('#fMemo').value.trim() || null,
      }),
    });
    closeMisc();
    toast('저장했어요', 'ok');
  };
}

// ── PDF 리포트 ──
function openReportModal(){
  const s = $('#miscSheet');
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  s.innerHTML = `
    <h2>PDF 리포트</h2>
    <div class="sub">기간을 골라서 트러블/도포 히스토리/의심 성분 요약을 PDF로 받아요</div>
    <div class="field"><label>시작일</label><input id="rStart" type="date" value="${fmt(weekAgo)}"></div>
    <div class="field"><label>종료일</label><input id="rEnd" type="date" value="${fmt(today)}"></div>
    <div class="row">
      <button class="btn ghost" onclick="closeMisc()">닫기</button>
      <button class="btn primary" id="rDownloadBtn">다운로드</button>
    </div>`;
  $('#rDownloadBtn').onclick = () => {
    const start = $('#rStart').value, end = $('#rEnd').value;
    if(!start || !end){ alert('기간을 선택해주세요'); return; }
    window.open(`/api/reports/pdf?start=${start}&end=${end}`, '_blank');
  };
  $('#miscModal').classList.add('show');
}

function closeMisc(){ $('#miscModal').classList.remove('show'); }
$('#miscModal').onclick = e => { if(e.target.id === 'miscModal') closeMisc(); };

$('#suspectsBtn').onclick = openSuspectsModal;
$('#factorsBtn').onclick = openFactorsModal;
$('#reportBtn').onclick = openReportModal;

(async function init(){
  dlabel();
  await loadProducts();
  await loadDay();
  await loadActiveExperiment();
  setMode(mode);
})();
