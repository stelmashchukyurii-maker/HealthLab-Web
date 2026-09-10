(()=>{
  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const COLORS={hr:'#ecf3ff',motion:'#6ed6d0',hrv:'#c895ff',light:'#4da3ff',deep:'#6857d9',rem:'#c895ff',wake:'#ff9b4a',unknown:'#68748a'};
  let section=null,canvas=null,rows=[],stages=[],session=null,sessions=[],sessionIndex=0,selectedIndex=null,loading=false;
  const layers={hr:true,motion:true,hrv:true,stages:true};
  const el=id=>document.getElementById(id),num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const epochMs=v=>{const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const quantile=(a,q)=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const p=(x.length-1)*q,b=Math.floor(p),d=p-b;return x[b+1]!==undefined?x[b]+d*(x[b+1]-x[b]):x[b]};
  const fmtTime=ts=>new Date(ts).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
  const fmtDate=ts=>new Date(ts).toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'short'});
  const fmtDur=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)}г ${String(m%60).padStart(2,'0')}хв`};
  const validHrv=r=>r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250;

  async function api(p,timeout=18000){
    const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
    try{const r=await fetch(u,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d?.error)throw Error(d.error);return d}
    catch(e){if(e?.name==='AbortError')throw Error('таймаут запиту');throw e}finally{clearTimeout(t)}
  }
  async function stateChunks(from,to){
    const step=2*3600,out=[],parts=Math.ceil((to-from+1)/step);let done=0;
    for(let s=from;s<=to;s+=step){
      const e=Math.min(to,s+step-1);el('sleepTimelineStatus').textContent=`Дані сну: ${done}/${parts} частин…`;
      try{const a=await api({api:'state',from:s,to:e,bucket:300});if(Array.isArray(a))out.push(...a)}
      catch{
        const mid=Math.floor((s+e)/2);
        for(const [a,b] of [[s,mid],[mid+1,e]]){if(b<a)continue;try{const x=await api({api:'state',from:a,to:b,bucket:300},12000);if(Array.isArray(x))out.push(...x)}catch{}}
      }
      done++;
    }
    const map=new Map();out.forEach(r=>{const t=epochMs(r?.bucket_ts);if(t)map.set(t,r)});
    return [...map.values()].sort((a,b)=>epochMs(a.bucket_ts)-epochMs(b.bucket_ts));
  }
  function parseStages(v){try{const a=typeof v==='string'?JSON.parse(v):v;return Array.isArray(a)?a.map(s=>({start:epochMs(s.start),end:epochMs(s.end),stage:String(s.stage||'unknown').toLowerCase()})).filter(s=>s.start&&s.end>s.start):[]}catch{return []}}
  function stageAt(ts){return stages.find(x=>ts>=x.start&&ts<x.end)?.stage||'—'}
  function stageLabel(s){return ({light:'Light',deep:'Deep',rem:'REM',wake:'Awake'})[s]||'—'}

  function install(){
    const dash=el('sleepDashboard');if(!dash||el('sleepTimelineCard'))return;const grid=dash.querySelector('.sleep-grid');if(!grid)return;
    const wrap=document.createElement('article');wrap.id='sleepTimelineCard';wrap.className='hl-sleep-timeline';
    wrap.innerHTML=`
      <div class="hl-sleep-timeline-head"><div><div class="eyebrow">ГРАФІКИ</div><h3>Організм під час сну</h3><small>Тільки відрізок, який зафіксовано як сон</small></div><div class="hl-sleep-head-actions"><button id="sleepTimelineRefresh" title="Оновити">↻</button><button id="sleepTimelineFullscreen" title="На весь екран">⛶</button></div></div>
      <div class="hl-sleep-daynav"><button id="sleepPrev" aria-label="Попередній сон">‹</button><div><b id="sleepSessionDate">—</b><small id="sleepTimelineRange">Остання завершена сесія</small></div><button id="sleepNext" aria-label="Наступний сон">›</button></div>
      <div class="hl-sleep-selected"><div><span>Час</span><b id="sleepPointTime">—</b></div><div><span>Фаза</span><b id="sleepPointStage">—</b></div><div><span>Пульс</span><b id="sleepPointHr">—</b></div><div><span>HRV / RMSSD</span><b id="sleepPointHrv">—</b></div><div><span>Рух</span><b id="sleepPointMotion">—</b></div><div><span>Тривалість сесії</span><b id="sleepPointDuration">—</b></div></div>
      <div class="hl-sleep-layer-buttons"><button class="on" data-sleep-layer="hr">Пульс</button><button class="on" data-sleep-layer="motion">Рух</button><button class="on" data-sleep-layer="hrv">HRV</button><button class="on" data-sleep-layer="stages">Фази сну</button></div>
      <div class="hl-sleep-canvas-wrap"><canvas id="sleepTimelineCanvas"></canvas><div id="sleepTimelineEmpty" class="hl-sleep-empty hidden">Немає даних для цієї сесії сну.</div></div>
      <div class="hl-sleep-stage-legend"><span><i class="light"></i>Light</span><span><i class="deep"></i>Deep</span><span><i class="rem"></i>REM</span><span><i class="wake"></i>Awake</span></div>
      <div class="hl-sleep-timeline-links"><a href="./timeline.html">≋ Усі графіки / Хронологія стану →</a></div>
      <div id="sleepTimelineStatus" class="hl-sleep-timeline-status">Завантаження…</div>`;
    grid.insertAdjacentElement('afterend',wrap);section=wrap;canvas=el('sleepTimelineCanvas');
    el('sleepTimelineRefresh').onclick=()=>load(true);el('sleepPrev').onclick=()=>moveSession(1);el('sleepNext').onclick=()=>moveSession(-1);el('sleepTimelineFullscreen').onclick=toggleFullscreen;
    section.querySelectorAll('[data-sleep-layer]').forEach(b=>b.onclick=()=>{const k=b.dataset.sleepLayer;layers[k]=!layers[k];b.classList.toggle('on',layers[k]);render()});
    canvas.addEventListener('pointerdown',pickPoint);canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pickPoint(e)});window.addEventListener('resize',()=>setTimeout(render,80));document.addEventListener('fullscreenchange',()=>setTimeout(render,120));
    const mainRefresh=el('refreshBtn');if(mainRefresh)mainRefresh.addEventListener('click',()=>setTimeout(()=>load(true),100));load(true);
  }

  async function load(force=false){
    if(!section||loading)return;loading=true;const status=el('sleepTimelineStatus');status.textContent='Оновлюю список сну…';el('sleepTimelineRefresh').classList.add('busy');
    try{
      if(force||!sessions.length){const d=await api({api:'sleepSessions',limit:30},12000);sessions=(Array.isArray(d)?d:[]).filter(x=>Number(x.startTs)>0&&Number(x.endTs)>Number(x.startTs));sessionIndex=Math.min(sessionIndex,Math.max(0,sessions.length-1))}
      if(!sessions.length)throw Error('завершених sleepSession немає');await loadCurrentSession();
    }catch(e){rows=[];session=null;selectedIndex=null;render();status.textContent='Помилка: '+(e?.message||e)}finally{loading=false;el('sleepTimelineRefresh').classList.remove('busy')}
  }
  async function loadCurrentSession(){
    session=sessions[sessionIndex];if(!session)throw Error('сесію не знайдено');const start=Number(session.startTs),end=Number(session.endTs);stages=parseStages(session.stagesJSON);rows=[];selectedIndex=null;
    el('sleepSessionDate').textContent=fmtDate(start*1000);el('sleepTimelineRange').textContent=`${fmtTime(start*1000)}–${fmtTime(end*1000)} · ${fmtDur((end-start)*1000)}`;el('sleepPointDuration').textContent=fmtDur((end-start)*1000);updateNav();render();
    const raw=await stateChunks(start,end);rows=raw.map(r=>({ts:epochMs(r.bucket_ts),avgHr:num(r.avg_hr),motion:num(r.motion_score),rrCount:Number(r.rr_count||0),rmssd:num(r.rmssd_ms)})).filter(r=>r.ts>=start*1000&&r.ts<=end*1000).sort((a,b)=>a.ts-b.ts);rows.forEach(r=>r.hrvValid=validHrv(r));
    if(!rows.length){updateSelected();render();el('sleepTimelineStatus').textContent=`Фази є (${stages.length}), але 5-хвилинні HR/HRV/рух не отримані`;return}
    selectedIndex=rows.length-1;updateSelected();render();el('sleepTimelineStatus').textContent=`Готово · ${rows.length} п’ятихвилинних вікон · ${stages.length} сегментів фаз`;
  }
  function moveSession(delta){if(loading||!sessions.length)return;const next=sessionIndex+delta;if(next<0||next>=sessions.length)return;sessionIndex=next;loadCurrentSession().catch(e=>el('sleepTimelineStatus').textContent='Помилка: '+(e?.message||e));updateNav()}
  function updateNav(){const p=el('sleepPrev'),n=el('sleepNext');if(p)p.disabled=!sessions.length||sessionIndex>=sessions.length-1;if(n)n.disabled=!sessions.length||sessionIndex<=0}
  async function toggleFullscreen(){try{if(document.fullscreenElement){await document.exitFullscreen();try{await screen.orientation?.unlock?.()}catch{};return}await section.requestFullscreen?.();try{await screen.orientation?.lock?.('landscape')}catch{};setTimeout(render,180)}catch{section.classList.toggle('hl-sleep-faux-fullscreen');setTimeout(render,120)}}

  function updateSelected(){const r=selectedIndex!==null?rows[selectedIndex]:null;if(!r){['sleepPointTime','sleepPointStage','sleepPointHr','sleepPointHrv','sleepPointMotion'].forEach(id=>{if(el(id))el(id).textContent='—'});return}el('sleepPointTime').textContent=fmtTime(r.ts);el('sleepPointStage').textContent=stageLabel(stageAt(r.ts));el('sleepPointHr').textContent=Number.isFinite(r.avgHr)?`${Math.round(r.avgHr)} уд/хв`:'—';el('sleepPointHrv').textContent=r.hrvValid?`${Math.round(r.rmssd)} мс`:'—';el('sleepPointMotion').textContent=Number.isFinite(r.motion)?r.motion.toFixed(3):'—'}

  function render(){
    if(!canvas)return;const box=canvas.parentElement,cssW=Math.max(300,box.clientWidth),cssH=parseInt(getComputedStyle(canvas).height)||430,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
    const empty=el('sleepTimelineEmpty');if(!session){empty.classList.remove('hidden');return}empty.classList.add('hidden');const L=46,R=12,T=14,B=30,W=cssW-L-R,H=cssH-T-B,x0=Number(session.startTs)*1000,x1=Number(session.endTs)*1000,x=ts=>L+(ts-x0)/(x1-x0)*W;
    ctx.strokeStyle='rgba(112,132,166,.13)';ctx.lineWidth=1;for(let i=0;i<=4;i++){const xx=L+W*i/4;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke();const ts=x0+(x1-x0)*i/4;ctx.fillStyle='#7f8da7';ctx.font='10px system-ui';ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(fmtTime(ts),xx,T+H+22)}ctx.textAlign='left';
    if(layers.stages&&stages.length){stages.forEach(s=>{const a=clamp(x(Math.max(s.start,x0)),L,L+W),b=clamp(x(Math.min(s.end,x1)),L,L+W);if(b<=a)return;ctx.globalAlpha=.08;ctx.fillStyle=COLORS[s.stage]||COLORS.unknown;ctx.fillRect(a,T,b-a,H);ctx.globalAlpha=.9;ctx.fillRect(a,T,b-a,19)});ctx.globalAlpha=1;ctx.fillStyle='#dce7fb';ctx.font='700 9px system-ui';ctx.fillText('ФАЗИ',4,T+13)}
    if(!rows.length){ctx.fillStyle='#9eabc3';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('Очікую HR / HRV / рух для цієї сесії…',L+W/2,T+H/2);ctx.textAlign='left';canvas._geom={L,W,x0,x1};return}
    const active=[];if(layers.hr)active.push('hr');if(layers.motion)active.push('motion');if(layers.hrv)active.push('hrv');const top=T+27,avail=H-27,weights={hr:1.05,motion:.8,hrv:.9},gap=8,total=active.reduce((s,k)=>s+weights[k],0)||1;let y=top;const lanes={};active.forEach(k=>{const h=(avail-gap*Math.max(0,active.length-1))*weights[k]/total;lanes[k]={top:y,h};y+=h+gap});if(lanes.hr)drawSeries(ctx,lanes.hr,L,W,x,'hr');if(lanes.motion)drawSeries(ctx,lanes.motion,L,W,x,'motion');if(lanes.hrv)drawSeries(ctx,lanes.hrv,L,W,x,'hrv');if(selectedIndex!==null&&rows[selectedIndex]){const xx=x(rows[selectedIndex].ts);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke()}canvas._geom={L,W,x0,x1};
  }
  function laneTitle(ctx,lane,text,right=''){ctx.fillStyle='#8fa0bd';ctx.font='700 10px system-ui';ctx.fillText(text,4,lane.top+11);if(right){ctx.textAlign='right';ctx.fillText(right,canvas.clientWidth-10,lane.top+11);ctx.textAlign='left'}}
  function drawSeries(ctx,lane,L,W,x,kind){const top=lane.top+16,h=Math.max(10,lane.h-19);let vals,label,color,access;if(kind==='hr'){vals=rows.map(r=>r.avgHr).filter(Number.isFinite);label='ПУЛЬС';color=COLORS.hr;access=r=>r.avgHr}else if(kind==='motion'){vals=rows.map(r=>r.motion).filter(Number.isFinite);label='РУХ';color=COLORS.motion;access=r=>r.motion}else{vals=rows.filter(r=>r.hrvValid).map(r=>r.rmssd);label='HRV / RMSSD';color=COLORS.hrv;access=r=>r.hrvValid?r.rmssd:null}if(!vals.length){laneTitle(ctx,lane,label,'немає валідних даних');return}let lo,hi;if(kind==='motion'){lo=0;hi=Math.max(.001,quantile(vals,.95)||Math.max(...vals))}else{lo=quantile(vals,.05);hi=quantile(vals,.95);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo){lo=Math.min(...vals);hi=Math.max(...vals)+1}}laneTitle(ctx,lane,label,kind==='hr'?`${Math.round(lo)}–${Math.round(hi)} уд/хв`:kind==='hrv'?`${Math.round(lo)}–${Math.round(hi)} мс`:'відносний рух');ctx.strokeStyle='rgba(130,151,185,.14)';ctx.beginPath();ctx.moveTo(L,top+h);ctx.lineTo(L+W,top+h);ctx.stroke();if(kind==='motion'){rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),x2=x(Math.min(Number(session.endTs)*1000,r.ts+300000)),bh=h*clamp(v/hi,0,1);ctx.fillStyle=color;ctx.globalAlpha=.55;ctx.fillRect(xx,top+h-bh,Math.max(1,x2-xx-1),bh)});ctx.globalAlpha=1;return}ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();let started=false;rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),yy=top+h-clamp((v-lo)/(hi-lo),0,1)*h;if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke()}
  function pickPoint(e){if(!rows.length||!canvas?._geom)return;const rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left,g=canvas._geom;if(px<g.L||px>g.L+g.W)return;const ts=g.x0+(px-g.L)/g.W*(g.x1-g.x0);let best=0,dist=Infinity;rows.forEach((r,i)=>{const d=Math.abs(r.ts-ts);if(d<dist){dist=d;best=i}});selectedIndex=best;updateSelected();render()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,30));
})();