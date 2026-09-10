(()=>{
  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const COLORS={hr:'#ecf3ff',motion:'#6ed6d0',hrv:'#c895ff',light:'#4da3ff',deep:'#6857d9',rem:'#c895ff',wake:'#ff9b4a',unknown:'#68748a'};
  let section=null,canvas=null,rows=[],stages=[],session=null,sessions=[],sessionIndex=0,selectedIndex=null,loading=false;
  const rowCache=new Map();
  const layers={hr:true,motion:true,hrv:true,stages:true};
  const el=id=>document.getElementById(id),num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const epochMs=v=>{const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const quantile=(a,q)=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const p=(x.length-1)*q,b=Math.floor(p),d=p-b;return x[b+1]!==undefined?x[b]+d*(x[b+1]-x[b]):x[b]};
  const median=a=>quantile(a,.5);
  const fmtTime=ts=>new Date(ts).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
  const fmtDate=ts=>new Date(ts).toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'short'});
  const fmtDur=ms=>{const m=Math.max(0,Math.round(ms/60000));return m<60?`${m} хв`:`${Math.floor(m/60)}г ${String(m%60).padStart(2,'0')}хв`};
  const validHrv=r=>r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250;

  async function api(p,timeout=18000){
    const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
    try{const r=await fetch(u,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d?.error)throw Error(d.error);return d}
    catch(e){if(e?.name==='AbortError')throw Error('таймаут запиту');throw e}finally{clearTimeout(t)}
  }

  function mergeStateRows(...sets){
    const map=new Map();
    sets.flat().forEach(r=>{const t=epochMs(r?.bucket_ts);if(t)map.set(t,r)});
    return [...map.values()].sort((a,b)=>epochMs(a.bucket_ts)-epochMs(b.bucket_ts));
  }
  function coverageInfo(a,from,to){
    const ts=(Array.isArray(a)?a:[]).map(r=>Math.floor(epochMs(r?.bucket_ts)/1000)).filter(Number.isFinite).sort((x,y)=>x-y);
    if(!ts.length)return{complete:false,count:0,first:null,last:null,gaps:[]};
    const gaps=[];for(let i=1;i<ts.length;i++)if(ts[i]-ts[i-1]>600)gaps.push([ts[i-1]+300,ts[i]-1]);
    const first=ts[0],last=ts[ts.length-1];
    return{complete:first<=from+300&&last>=to-300&&!gaps.length,count:ts.length,first,last,gaps};
  }
  async function stateRange(from,to){
    const status=el('sleepTimelineStatus');
    status.textContent='HR / HRV / рух: один запит на всю sleepSession…';
    let merged=[],directError='';
    try{
      const direct=await api({api:'state',from,to,bucket:300},45000);
      if(Array.isArray(direct))merged=mergeStateRows(direct);
      let info=coverageInfo(merged,from,to);
      if(info.complete)return merged;
      directError=info.count?`неповне покриття: ${info.count} вікон, до ${info.last?fmtTime(info.last*1000):'—'}`:'порожня відповідь';
      for(let pass=0;pass<3&&!info.complete;pass++){
        const missing=[];
        if(info.first===null||info.first>from+300)missing.push([from,info.first?Math.max(from,info.first-1):to]);
        if(info.last!==null&&info.last<to-300)missing.push([Math.max(from,info.last+300),to]);
        info.gaps.forEach(g=>missing.push(g));
        if(!missing.length)break;
        status.textContent=`Доповнюю лише відсутню частину sleepSession · ${pass+1}/3…`;
        for(const [a,b] of missing){
          if(b<a)continue;
          try{const x=await api({api:'state',from:a,to:b,bucket:300},35000);if(Array.isArray(x))merged=mergeStateRows(merged,x)}catch(e){directError=e?.message||String(e)}
        }
        info=coverageInfo(merged,from,to);
      }
      if(info.complete)return merged;
    }catch(e){directError=e?.message||String(e)}

    status.textContent=`Основний sleepSession-запит неповний (${directError}). Резервне завантаження…`;
    const step=2*3600,out=[...merged],parts=Math.ceil((to-from+1)/step);let done=0,failed=0;
    for(let s=from;s<=to;s+=step){
      const e=Math.min(to,s+step-1);status.textContent=`Резервне завантаження: ${done}/${parts} частин…`;
      try{const a=await api({api:'state',from:s,to:e,bucket:300},30000);if(Array.isArray(a))out.push(...a)}catch{
        failed++;const mid=Math.floor((s+e)/2);
        for(const [a,b] of [[s,mid],[mid+1,e]]){if(b<a)continue;try{const x=await api({api:'state',from:a,to:b,bucket:300},22000);if(Array.isArray(x))out.push(...x)}catch{}}
      }
      done++;
    }
    merged=mergeStateRows(out);const info=coverageInfo(merged,from,to);
    if(!merged.length)throw Error(`HR/HRV/рух не отримані; основний запит: ${directError}; резервних помилок: ${failed}`);
    if(!info.complete)throw Error(`отримано лише ${info.count} вікон; останнє ${info.last?fmtTime(info.last*1000):'—'}, sleepSession до ${fmtTime(to*1000)}`);
    return merged;
  }

  function normalizeStage(s){const x=String(s||'unknown').toLowerCase();return x==='awake'?'wake':x}
  function parseStages(v){try{const a=typeof v==='string'?JSON.parse(v):v;return Array.isArray(a)?a.map(s=>({start:epochMs(s.start),end:epochMs(s.end),stage:normalizeStage(s.stage)})).filter(s=>s.start&&s.end>s.start):[]}catch{return []}}
  function stageAt(ts){return stages.find(x=>ts>=x.start&&ts<x.end)?.stage||'—'}
  function stageLabel(s){return ({light:'Light',deep:'Deep',rem:'REM',wake:'Awake'})[s]||'—'}
  function whenLabel(center,start,end){if(!Number.isFinite(center)||end<=start)return'—';const p=(center-start)/(end-start);return `${p<.34?'переважно на початку':p<.67?'переважно в середині':'переважно під кінець'} · ~${fmtTime(center)}`}

  function metricsForStages(ss){
    const sg=parseStages(ss?.stagesJSON);if(!sg.length)return null;
    const keys=['light','deep','rem','wake'],out={};let totalSleep=0,totalSession=0;
    keys.forEach(k=>out[k]={ms:0,episodes:0,longest:0,weightedCenter:0});
    sg.forEach(x=>{const d=Math.max(0,x.end-x.start);if(!out[x.stage])return;out[x.stage].ms+=d;out[x.stage].episodes++;out[x.stage].longest=Math.max(out[x.stage].longest,d);out[x.stage].weightedCenter+=((x.start+x.end)/2)*d;totalSession+=d;if(x.stage!=='wake')totalSleep+=d});
    keys.forEach(k=>{const den=totalSleep;out[k].share=den>0?out[k].ms/den:0;out[k].continuity=out[k].ms>0?out[k].longest/out[k].ms:0;out[k].density=totalSession>0?out[k].episodes/(totalSession/3600000):0;out[k].center=out[k].ms>0?out[k].weightedCenter/out[k].ms:null});
    out.totalSleep=totalSleep;out.totalSession=totalSession;out.start=Math.min(...sg.map(x=>x.start));out.end=Math.max(...sg.map(x=>x.end));return out;
  }
  function similarity(v,ref,floor=.05){if(!Number.isFinite(v)||!Number.isFinite(ref))return null;const den=Math.max(Math.abs(ref),floor);return clamp(100-Math.abs(v-ref)/den*65,0,100)}
  function phaseQuality(k,current,base){
    if(k==='wake'||!current||!base?.length)return null;
    const bShare=median(base.map(x=>x[k]?.share).filter(Number.isFinite));
    const bCont=median(base.map(x=>x[k]?.continuity).filter(Number.isFinite));
    const bDens=median(base.map(x=>x[k]?.density).filter(Number.isFinite));
    const s1=similarity(current[k]?.share,bShare,.08),s2=similarity(current[k]?.continuity,bCont,.08),s3=similarity(current[k]?.density,bDens,.15);
    if(![s1,s2,s3].every(Number.isFinite))return null;
    return Math.round(.55*s1+.25*s2+.20*s3);
  }
  function phasePhysiology(k){
    const a=rows.filter(r=>stageAt(r.ts)===k),hr=median(a.map(r=>r.avgHr).filter(Number.isFinite)),mv=median(a.map(r=>r.motion).filter(Number.isFinite)),hv=median(a.filter(r=>r.hrvValid).map(r=>r.rmssd));
    return{n:a.length,hr,mv,hrv:hv};
  }
  function renderArchitecture(cur,base){
    const box=el('sleepArchitecture');if(!box||!cur)return;
    const sleepHours=cur.totalSleep/3600000,totalEpisodes=['light','deep','rem'].reduce((s,k)=>s+cur[k].episodes,0),wakePct=cur.totalSleep?cur.wake.ms/cur.totalSleep*100:0;
    const phys=rows.length?{hr:median(rows.map(r=>r.avgHr).filter(Number.isFinite)),hrv:median(rows.filter(r=>r.hrvValid).map(r=>r.rmssd)),motion:median(rows.map(r=>r.motion).filter(Number.isFinite))}:{};
    const baseFrag=median(base.map(x=>['light','deep','rem'].reduce((s,k)=>s+x[k].episodes,0)/Math.max(x.totalSleep/3600000,.1)).filter(Number.isFinite));
    const frag=totalEpisodes/Math.max(sleepHours,.1),fragText=Number.isFinite(baseFrag)?`${frag.toFixed(1)}/год · персональна медіана ${baseFrag.toFixed(1)}`:`${frag.toFixed(1)}/год`;
    box.innerHTML=`<div class="hl-arch-head"><div><span>Sleep Architecture Quality</span><b>v0 · експериментально</b></div><strong>структура + фізіологія</strong></div><div class="hl-arch-grid"><div><span>Фрагментація</span><b>${fragText}</b></div><div><span>Пробудження</span><b>${cur.wake.episodes} · ${fmtDur(cur.wake.ms)} · ${Math.round(wakePct)}% від сну</b></div><div><span>Циклічність</span><b>Deep ×${cur.deep.episodes} · REM ×${cur.rem.episodes}</b></div><div><span>Restorative physiology</span><b>${Number.isFinite(phys.hr)?`HR ${Math.round(phys.hr)}`:'HR —'} · ${Number.isFinite(phys.hrv)?`RMSSD ${Math.round(phys.hrv)} мс`:'RMSSD —'} · ${Number.isFinite(phys.motion)?`рух ${phys.motion.toFixed(3)}`:'рух —'}</b></div></div><small>Єдина числова оцінка /100 навмисно ще не видається: її калібруємо окремо, щоб не змішати фізіологічну якість сну з упевненістю wearable у визначенні фаз.</small>`;
  }
  function renderPhaseQuality(){
    const box=el('sleepPhaseCards');if(!box||!session)return;
    const cur=metricsForStages(session);if(!cur){box.innerHTML='<div class="hl-phase-empty">Немає достатньої розмітки фаз.</div>';return}
    const base=sessions.slice(sessionIndex+1,sessionIndex+8).map(metricsForStages).filter(Boolean),order=['light','deep','rem','wake'];
    box.innerHTML=order.map(k=>{
      const x=cur[k],q=phaseQuality(k,cur,base),qText=k==='wake'?'—':(Number.isFinite(q)?q+'/100':'ще мало бази'),percent=Math.round((x.share||0)*100),p=phasePhysiology(k);
      const physiology=[Number.isFinite(p.hr)?`HR ${Math.round(p.hr)}`:null,Number.isFinite(p.hrv)?`RMSSD ${Math.round(p.hrv)}`:null,Number.isFinite(p.mv)?`рух ${p.mv.toFixed(3)}`:null].filter(Boolean).join(' · ')||'—';
      return `<article class="hl-phase-card ${k}"><div class="hl-phase-card-head"><span><i></i>${stageLabel(k)}</span><b>${fmtDur(x.ms)}</b></div><div class="hl-phase-grid"><div><span>% фактичного сну</span><b>${percent}%</b></div><div><span>Епізоди</span><b>${x.episodes}</b></div><div><span>Найдовший</span><b>${fmtDur(x.longest)}</b></div><div><span>Коли переважно</span><b>${whenLabel(x.center,cur.start,cur.end)}</b></div><div><span>Stage Quality v0</span><b>${qText}</b></div><div><span>Data Confidence</span><b>wearable не надав</b></div><div class="hl-phase-phys"><span>Фізіологія фази</span><b>${physiology}</b></div></div></article>`;
    }).join('');
    const note=el('sleepPhaseQualityNote');if(note)note.textContent=base.length?`Stage Quality v0 зараз оцінює структурну схожість із ${base.length} попередніми ночами (частка, безперервність, фрагментація). Це НЕ Data Confidence. Наступна версія Stage Quality окремо додасть HR, HRV/RMSSD, respiration, рух, тривалість і безперервність; пізніше SpO₂ та skin temperature.`:'Stage Quality v0 з’явиться після кількох попередніх ночей. Data Confidence не вигадується: у поточному sleepSession немає ймовірності/довіри wearable до кожної фази.';
    renderArchitecture(cur,base);
  }

  function install(){
    const dash=el('sleepDashboard');if(!dash||el('sleepTimelineCard'))return;const grid=dash.querySelector('.sleep-grid');if(!grid)return;
    const wrap=document.createElement('article');wrap.id='sleepTimelineCard';wrap.className='hl-sleep-timeline';
    wrap.innerHTML=`
      <div class="hl-sleep-timeline-head"><div><div class="eyebrow">ГРАФІКИ</div><h3>Організм під час сну</h3><small>Тільки фактичний sleepSession</small></div><div class="hl-sleep-head-actions"><button id="sleepTimelineRefresh" title="Оновити">↻</button><button id="sleepTimelineFullscreen" title="На весь екран">⛶</button></div></div>
      <div class="hl-sleep-daynav"><button id="sleepPrev" aria-label="Попередній сон">‹</button><div class="hl-sleep-daylabel"><b id="sleepSessionDate">—</b><small id="sleepTimelineRange">Остання завершена сесія</small></div><button id="sleepNext" aria-label="Наступний сон">›</button><div class="hl-sleep-full-actions"><button id="sleepTimelineRefreshFull" title="Оновити">↻</button><button id="sleepTimelineFullscreenFull" title="Вийти з повного екрана">⛶</button></div></div>
      <div class="hl-sleep-selected"><div><span>Час</span><b id="sleepPointTime">—</b></div><div><span>Фаза</span><b id="sleepPointStage">—</b></div><div><span>Пульс</span><b id="sleepPointHr">—</b></div><div><span>HRV / RMSSD</span><b id="sleepPointHrv">—</b></div><div><span>Рух</span><b id="sleepPointMotion">—</b></div></div>
      <div class="hl-sleep-canvas-wrap"><canvas id="sleepTimelineCanvas"></canvas><div id="sleepTimelineEmpty" class="hl-sleep-empty hidden">Немає даних для цієї сесії сну.</div></div>
      <div class="hl-sleep-stage-legend"><span><i class="light"></i>Light</span><span><i class="deep"></i>Deep</span><span><i class="rem"></i>REM</span><span><i class="wake"></i>Awake</span></div>
      <div class="hl-sleep-layer-buttons"><button class="on" data-sleep-layer="hr">Пульс</button><button class="on" data-sleep-layer="motion">Рух</button><button class="on" data-sleep-layer="hrv">HRV</button><button class="on" data-sleep-layer="stages">Фази сну</button></div>
      <section class="hl-phase-summary"><div class="hl-phase-summary-head"><div><div class="eyebrow">ФАЗИ СНУ</div><h4>Тривалість, частка, епізоди та якість</h4></div></div><div id="sleepPhaseCards" class="hl-phase-cards"></div><div id="sleepPhaseQualityNote" class="hl-phase-note"></div><div id="sleepArchitecture" class="hl-sleep-architecture"></div></section>
      <div class="hl-sleep-timeline-links"><a href="./timeline.html">≋ Усі графіки / Хронологія стану →</a></div>
      <div id="sleepTimelineStatus" class="hl-sleep-timeline-status">Завантаження…</div>`;
    grid.insertAdjacentElement('afterend',wrap);section=wrap;canvas=el('sleepTimelineCanvas');
    const refresh=()=>load(true);el('sleepTimelineRefresh').onclick=refresh;el('sleepTimelineRefreshFull').onclick=refresh;el('sleepPrev').onclick=()=>moveSession(1);el('sleepNext').onclick=()=>moveSession(-1);el('sleepTimelineFullscreen').onclick=toggleFullscreen;el('sleepTimelineFullscreenFull').onclick=toggleFullscreen;
    section.querySelectorAll('[data-sleep-layer]').forEach(b=>b.onclick=()=>{const k=b.dataset.sleepLayer;layers[k]=!layers[k];b.classList.toggle('on',layers[k]);render()});
    canvas.addEventListener('pointerdown',pickPoint);canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pickPoint(e)});window.addEventListener('resize',()=>setTimeout(render,80));document.addEventListener('fullscreenchange',()=>{syncAnalysisMode();setTimeout(render,120)});
    const mainRefresh=el('refreshBtn');if(mainRefresh)mainRefresh.addEventListener('click',()=>setTimeout(()=>load(true),100));load(true);
  }

  async function load(force=false){
    if(!section||loading)return;loading=true;const status=el('sleepTimelineStatus');status.textContent='Оновлюю список сну…';el('sleepTimelineRefresh').classList.add('busy');el('sleepTimelineRefreshFull')?.classList.add('busy');
    try{
      if(force||!sessions.length){const oldStart=session?.startTs;const d=await api({api:'sleepSessions',limit:30},18000);sessions=(Array.isArray(d)?d:[]).filter(x=>Number(x.startTs)>0&&Number(x.endTs)>Number(x.startTs));if(oldStart){const i=sessions.findIndex(x=>String(x.startTs)===String(oldStart));sessionIndex=i>=0?i:Math.min(sessionIndex,Math.max(0,sessions.length-1))}else sessionIndex=Math.min(sessionIndex,Math.max(0,sessions.length-1))}
      if(!sessions.length)throw Error('завершених sleepSession немає');await loadCurrentSession(force);
    }catch(e){if(!rows.length){session=null;selectedIndex=null;render()}status.textContent='Помилка: '+(e?.message||e)}finally{loading=false;el('sleepTimelineRefresh').classList.remove('busy');el('sleepTimelineRefreshFull')?.classList.remove('busy')}
  }
  async function loadCurrentSession(force=false){
    session=sessions[sessionIndex];if(!session)throw Error('сесію не знайдено');const start=Number(session.startTs),end=Number(session.endTs),key=String(start);stages=parseStages(session.stagesJSON);selectedIndex=null;
    el('sleepSessionDate').textContent=fmtDate(start*1000);el('sleepTimelineRange').textContent=`${fmtTime(start*1000)}–${fmtTime(end*1000)} · ${fmtDur((end-start)*1000)}`;updateNav();renderPhaseQuality();
    const cached=rowCache.get(key);if(cached?.length){rows=cached;selectedIndex=rows.length-1;updateSelected();render();renderPhaseQuality();el('sleepTimelineStatus').textContent=`Показую кеш · ${rows.length} вікон; перевіряю оновлення…`}else{rows=[];updateSelected();render()}
    try{
      const raw=await stateRange(start,end);const fresh=raw.map(r=>({ts:epochMs(r.bucket_ts),avgHr:num(r.avg_hr),motion:num(r.motion_score),rrCount:Number(r.rr_count||0),rmssd:num(r.rmssd_ms)})).filter(r=>r.ts>=start*1000-300000&&r.ts<=end*1000).sort((a,b)=>a.ts-b.ts);fresh.forEach(r=>r.hrvValid=validHrv(r));
      if(fresh.length){rows=fresh;rowCache.set(key,fresh);selectedIndex=rows.length-1;updateSelected();render();renderPhaseQuality();const last=rows.at(-1)?.ts;el('sleepTimelineStatus').textContent=`Готово · ${rows.length} п’ятихвилинних вікон · дані до ${last?fmtTime(last):'—'} · sleepSession до ${fmtTime(end*1000)}`;return}
      if(!cached?.length)throw Error('сервер повернув 0 п’ятихвилинних вікон');
    }catch(e){
      if(cached?.length){rows=cached;selectedIndex=rows.length-1;updateSelected();render();renderPhaseQuality();el('sleepTimelineStatus').textContent=`Оновлення не вдалося (${e?.message||e}); залишив попередні ${rows.length} вікон`}
      else{rows=[];updateSelected();render();renderPhaseQuality();el('sleepTimelineStatus').textContent=`Фази є (${stages.length}), але HR/HRV/рух не отримані: ${e?.message||e}`}
    }
  }
  function moveSession(delta){if(loading||!sessions.length)return;const next=sessionIndex+delta;if(next<0||next>=sessions.length)return;sessionIndex=next;loadCurrentSession(false).catch(e=>el('sleepTimelineStatus').textContent='Помилка: '+(e?.message||e));updateNav()}
  function updateNav(){const p=el('sleepPrev'),n=el('sleepNext');if(p)p.disabled=!sessions.length||sessionIndex>=sessions.length-1;if(n)n.disabled=!sessions.length||sessionIndex<=0}
  function syncAnalysisMode(){const on=document.fullscreenElement===section||section?.classList.contains('hl-sleep-faux-fullscreen');document.body.classList.toggle('hl-sleep-analysis-mode',!!on)}
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement===section){await document.exitFullscreen();try{await screen.orientation?.unlock?.()}catch{};return}
      if(section.classList.contains('hl-sleep-faux-fullscreen')){section.classList.remove('hl-sleep-faux-fullscreen');syncAnalysisMode();try{await screen.orientation?.unlock?.()}catch{};setTimeout(render,120);return}
      if(!section.requestFullscreen)throw Error('fullscreen unsupported');
      await section.requestFullscreen();syncAnalysisMode();try{await screen.orientation?.lock?.('landscape')}catch{};setTimeout(render,180)
    }catch{section.classList.toggle('hl-sleep-faux-fullscreen');syncAnalysisMode();setTimeout(render,120)}
  }

  function updateSelected(){const r=selectedIndex!==null?rows[selectedIndex]:null;if(!r){['sleepPointTime','sleepPointStage','sleepPointHr','sleepPointHrv','sleepPointMotion'].forEach(id=>{if(el(id))el(id).textContent='—'});return}el('sleepPointTime').textContent=fmtTime(r.ts);el('sleepPointStage').textContent=stageLabel(stageAt(r.ts));el('sleepPointHr').textContent=Number.isFinite(r.avgHr)?`${Math.round(r.avgHr)} уд/хв`:'—';el('sleepPointHrv').textContent=r.hrvValid?`${Math.round(r.rmssd)} мс`:'—';el('sleepPointMotion').textContent=Number.isFinite(r.motion)?r.motion.toFixed(3):'—'}

  function render(){
    if(!canvas)return;const box=canvas.parentElement,cssW=Math.max(300,box.clientWidth),cssH=parseInt(getComputedStyle(canvas).height)||430,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
    const empty=el('sleepTimelineEmpty');if(!session){empty.classList.remove('hidden');return}empty.classList.add('hidden');const L=46,R=12,T=14,B=30,W=cssW-L-R,H=cssH-T-B,x0=Number(session.startTs)*1000,x1=Number(session.endTs)*1000,x=ts=>L+(ts-x0)/(x1-x0)*W;
    ctx.strokeStyle='rgba(112,132,166,.13)';ctx.lineWidth=1;for(let i=0;i<=4;i++){const xx=L+W*i/4;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke();const ts=x0+(x1-x0)*i/4;ctx.fillStyle='#7f8da7';ctx.font='10px system-ui';ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(fmtTime(ts),xx,T+H+22)}ctx.textAlign='left';
    if(layers.stages&&stages.length){stages.forEach(s=>{const a=clamp(x(Math.max(s.start,x0)),L,L+W),b=clamp(x(Math.min(s.end,x1)),L,L+W);if(b<=a)return;ctx.globalAlpha=.10;ctx.fillStyle=COLORS[s.stage]||COLORS.unknown;ctx.fillRect(a,T,b-a,H);ctx.globalAlpha=.96;ctx.fillRect(a,T,b-a,24)});ctx.globalAlpha=1;ctx.fillStyle='#dce7fb';ctx.font='700 9px system-ui';ctx.fillText('ФАЗИ',4,T+16)}
    if(!rows.length){ctx.fillStyle='#9eabc3';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('Очікую HR / HRV / рух для цієї сесії…',L+W/2,T+H/2);ctx.textAlign='left';canvas._geom={L,W,x0,x1};return}
    const active=[];if(layers.hr)active.push('hr');if(layers.motion)active.push('motion');if(layers.hrv)active.push('hrv');const top=T+32,avail=H-32,weights={hr:1.05,motion:.8,hrv:.9},gap=8,total=active.reduce((s,k)=>s+weights[k],0)||1;let y=top;const lanes={};active.forEach(k=>{const h=(avail-gap*Math.max(0,active.length-1))*weights[k]/total;lanes[k]={top:y,h};y+=h+gap});if(lanes.hr)drawSeries(ctx,lanes.hr,L,W,x,'hr');if(lanes.motion)drawSeries(ctx,lanes.motion,L,W,x,'motion');if(lanes.hrv)drawSeries(ctx,lanes.hrv,L,W,x,'hrv');if(selectedIndex!==null&&rows[selectedIndex]){const xx=x(rows[selectedIndex].ts);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke()}canvas._geom={L,W,x0,x1};
  }
  function laneTitle(ctx,lane,text,right=''){ctx.fillStyle='#8fa0bd';ctx.font='700 10px system-ui';ctx.fillText(text,4,lane.top+11);if(right){ctx.textAlign='right';ctx.fillText(right,canvas.clientWidth-10,lane.top+11);ctx.textAlign='left'}}
  function drawSeries(ctx,lane,L,W,x,kind){const top=lane.top+16,h=Math.max(10,lane.h-19);let vals,label,color,access;if(kind==='hr'){vals=rows.map(r=>r.avgHr).filter(Number.isFinite);label='ПУЛЬС';color=COLORS.hr;access=r=>r.avgHr}else if(kind==='motion'){vals=rows.map(r=>r.motion).filter(Number.isFinite);label='РУХ';color=COLORS.motion;access=r=>r.motion}else{vals=rows.filter(r=>r.hrvValid).map(r=>r.rmssd);label='HRV / RMSSD';color=COLORS.hrv;access=r=>r.hrvValid?r.rmssd:null}if(!vals.length){laneTitle(ctx,lane,label,'немає валідних даних');return}let lo,hi;if(kind==='motion'){lo=0;hi=Math.max(.001,quantile(vals,.95)||Math.max(...vals))}else{lo=quantile(vals,.05);hi=quantile(vals,.95);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo){lo=Math.min(...vals);hi=Math.max(...vals)+1}}laneTitle(ctx,lane,label,kind==='hr'?`${Math.round(lo)}–${Math.round(hi)} уд/хв`:kind==='hrv'?`${Math.round(lo)}–${Math.round(hi)} мс`:'відносний рух');ctx.strokeStyle='rgba(130,151,185,.14)';ctx.beginPath();ctx.moveTo(L,top+h);ctx.lineTo(L+W,top+h);ctx.stroke();if(kind==='motion'){rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),x2=x(Math.min(Number(session.endTs)*1000,r.ts+300000)),bh=h*clamp(v/hi,0,1);ctx.fillStyle=color;ctx.globalAlpha=.55;ctx.fillRect(xx,top+h-bh,Math.max(1,x2-xx-1),bh)});ctx.globalAlpha=1;return}ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();let started=false;rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),yy=top+h-clamp((v-lo)/(hi-lo),0,1)*h;if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke()}
  function pickPoint(e){if(!rows.length||!canvas?._geom)return;const rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left,g=canvas._geom;if(px<g.L||px>g.L+g.W)return;const ts=g.x0+(px-g.L)/g.W*(g.x1-g.x0);let best=0,dist=Infinity;rows.forEach((r,i)=>{const d=Math.abs(r.ts-ts);if(d<dist){dist=d;best=i}});selectedIndex=best;updateSelected();render()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,30));
})();