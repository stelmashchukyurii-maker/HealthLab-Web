const $=id=>document.getElementById(id);
const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
const TABLES=['device','pairedDevice','dayOwnership','hrSample','ppgHrSample','rrInterval','event','battery','spo2Sample','skinTempSample','stepSample','sleepStateSample','respSample','gravitySample','dailyMetric','sleepSession','metricSeries','labMarker','journal','workout','dismissedWorkout','dismissedSleep','appleDaily','liveSession'];

$('refreshBtn').onclick=loadSummary;
$('dbNav').onclick=()=>document.querySelector('.section-head').scrollIntoView({behavior:'smooth'});
$('closeViewer').onclick=()=>{$('viewer').classList.add('hidden');document.body.style.overflow=''};

loadSummary();
setInterval(loadSummary,15000);

async function api(params){
  const url=new URL(API);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
}

async function loadSummary(){
  $('status').textContent='Оновлення…';
  try{
    const data=await api({api:'summary'});
    const summary=Array.isArray(data)?data:(data.tables||data.summary||[]);
    const byName=new Map(summary.map(x=>[x.name||x.table,x]));
    renderCards(byName);
    const device=byName.get('device');
    $('deviceName').textContent=device?.latest?.name||device?.latest?.id||'WHOOP';
    const hr=byName.get('hrSample');
    const rr=byName.get('rrInterval');
    $('liveHr').textContent=hr?.latest?.bpm??'—';
    $('rrCount').textContent=rr?.count??0;
    const last=findNewest(summary);
    $('lastSeen').textContent='Останні дані: '+(last?fmtTime(last):'—');
    const total=summary.reduce((s,x)=>s+(Number(x.count)||0),0);
    $('totalRows').textContent=total.toLocaleString('uk-UA')+' рядків';
    $('syncBadge').textContent=last?'онлайн':'очікування';
    $('syncBadge').classList.toggle('live',!!last);
    $('status').textContent='Автооновлення кожні 15 с';
  }catch(e){
    $('status').textContent='Не вдалося прочитати базу: '+e.message;
  }
}

function renderCards(byName){
  const grid=$('tableGrid');grid.innerHTML='';
  TABLES.forEach(name=>{
    const x=byName.get(name)||{count:0};
    const card=document.createElement('article');card.className='table-card';
    card.innerHTML=`<div class="table-name">${name}</div><div class="table-count">${Number(x.count||0).toLocaleString('uk-UA')}</div><div class="table-last">${x.last?fmtTime(x.last):'—'}</div>`;
    card.onclick=()=>openTable(name,x.count||0);grid.appendChild(card);
  });
}

async function openTable(name,count){
  $('viewerTitle').textContent=name;$('viewerMeta').textContent=`${Number(count).toLocaleString('uk-UA')} рядків · показую останні 100`;
  $('rows').innerHTML='<div class="status">Завантаження…</div>';$('viewer').classList.remove('hidden');document.body.style.overflow='hidden';
  try{
    const data=await api({api:'table',name,limit:'100'});const rows=Array.isArray(data)?data:(data.rows||[]);
    $('rows').innerHTML='';
    if(!rows.length){$('rows').innerHTML='<div class="status">Таблиця порожня</div>';return}
    rows.forEach(row=>{
      const el=document.createElement('div');el.className='row-card';
      el.innerHTML=Object.entries(row).filter(([k])=>!k.startsWith('_hl_')).map(([k,v])=>`<div class="kv"><b>${esc(k)}</b><span>${esc(value(v))}</span></div>`).join('');
      $('rows').appendChild(el);
    });
  }catch(e){$('rows').innerHTML=`<div class="status">Помилка: ${esc(e.message)}</div>`}
}

function findNewest(summary){let best=null;for(const x of summary){const v=x.last||x.latest?.ts||x.latest?.startTs||x.latest?.lastSeenAt||x.latest?.takenAt;if(v&&(!best||new Date(v)>new Date(best)))best=v}return best}
function fmtTime(v){try{return new Date(v).toLocaleString('uk-UA')}catch{return String(v)}}
function value(v){if(v===null)return'null';if(typeof v==='object')return JSON.stringify(v);return String(v)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
