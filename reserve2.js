// HealthLab Reserve/Battery v0.1.3 — progressive read-only client model.
// Fast path: dailyMetric + recent state first. Historical 7-day baseline refines in background.
(() => {
  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const HOUR=3600000, DAY=86400000, BUCKET=300000;
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const epochMs=v=>{const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0};
  const fmtSigned=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1)}`:'—';
  const clock=ms=>new Date(ms).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let stateRows=[], daily=null, reserveSeries=[], busy=false, historyBusy=false;

  async function api(p,timeoutMs=18000){
    const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try{
      const r=await fetch(u,{cache:'no-store',signal:ctrl.signal});
      let d=null;try{d=await r.json()}catch(_){}
      if(!r.ok)throw Error((d&&d.error)?String(d.error):('HTTP '+r.status));
      if(d&&d.error)throw Error(String(d.error));
      return d;
    }catch(e){
      if(e?.name==='AbortError')throw Error('таймаут запиту');
      throw e;
    }finally{clearTimeout(timer)}
  }

  function q(xs,p){const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const x=(a.length-1)*p,i=Math.floor(x),d=x-i;return a[i+1]===undefined?a[i]:a[i]+d*(a[i+1]-a[i])}
  function scale(v,lo,hi){if(![v,lo,hi].every(Number.isFinite)||hi<=lo)return .5;return clamp((v-lo)/(hi-lo))}
  function mapState(rs){return (Array.isArray(rs)?rs:[]).map(r=>({ts:epochMs(r.bucket_ts),avgHr:num(r.avg_hr),motion:num(r.motion_score),rrCount:Number(r.rr_count||0),rmssd:num(r.rmssd_ms),sleep:r.sleep_state==='SLEEP'})).filter(r=>r.ts&&Number.isFinite(r.avgHr)&&Number.isFinite(r.motion)).sort((a,b)=>a.ts-b.ts)}
  function mergeRows(part){const m=new Map(stateRows.map(r=>[r.ts,r]));part.forEach(r=>m.set(r.ts,r));stateRows=[...m.values()].sort((a,b)=>a.ts-b.ts);const min=Date.now()-8*DAY;stateRows=stateRows.filter(r=>r.ts>=min)}
  function validRr(r){return r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250}
  function baseline(rows,now){const b=rows.filter(r=>r.ts>=now-7*DAY&&r.ts<=now);return{hr20:q(b.map(r=>r.avgHr),.2),hr80:q(b.map(r=>r.avgHr),.8),hrv20:q(b.filter(validRr).map(r=>r.rmssd),.2),hrv80:q(b.filter(validRr).map(r=>r.rmssd),.8),mot20:q(b.map(r=>r.motion).filter(v=>v>0),.2),mot80:q(b.map(r=>r.motion).filter(v=>v>0),.8),n:b.length,days:b.length?Math.max(1,(b.at(-1).ts-b[0].ts)/DAY):0}}
  function score(r,b){const hr=scale(r.avgHr,b.hr20,b.hr80),mot=scale(r.motion,b.mot20,b.mot80),hrv=validRr(r)?scale(r.rmssd,b.hrv20,b.hrv80):.5;const mobilization=clamp(.60*hr+.40*mot),restoration=clamp(.45*hrv+.35*(1-hr)+.20*(1-mot)),delta=.25*restoration-.50*mobilization;return{...r,mobilization,restoration,delta}}
  function latestSleepBlock(rows){let end=-1;for(let i=rows.length-1;i>=0;i--){if(rows[i].sleep){end=i;break}}if(end<0)return null;let start=end;while(start>0&&rows[start-1].sleep&&rows[start].ts-rows[start-1].ts<=BUCKET*2)start--;return{rows:rows.slice(start,end+1),wakeTs:rows[end].ts+BUCKET,startTs:rows[start].ts}}
  function latestDaily(raw){const a=Array.isArray(raw)?raw:(raw?.rows||[]);return a.slice().sort((x,y)=>String(y.day||'').localeCompare(String(x.day||'')))[0]||null}

  async function fetchState(s,e){return mapState(await api({api:'state',from:Math.floor(s/1000),to:Math.floor(e/1000),bucket:300},16000))}
  async function fetchRangeResilient(s,e){
    try{return await fetchState(s,e)}catch(first){
      const span=e-s;if(span<=6*HOUR)throw first;
      const out=[];
      for(let x=s;x<e;x+=6*HOUR){const y=Math.min(e,x+6*HOUR-1000);try{out.push(...await fetchState(x,y))}catch(_){}await wait(40)}
      if(!out.length)throw first;
      return out;
    }
  }

  function gauge(v){const n=document.getElementById('reserveNow'),bar=document.getElementById('reserveFill');if(!n||!bar)return;v=clamp(v,0,100);n.textContent=Math.round(v);bar.style.width=`${v}%`}
  function draw(series){
    const c=document.getElementById('reserveChart');if(!c)return;
    const dpr=window.devicePixelRatio||1,w=Math.max(280,c.clientWidth||320),h=Math.max(130,c.clientHeight||150);
    c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);if(series.length<2)return;
    const p={l:28,r:8,t:10,b:20},minT=series[0].ts,maxT=series.at(-1).ts,X=t=>p.l+(t-minT)/Math.max(1,maxT-minT)*(w-p.l-p.r),Y=v=>p.t+(100-v)/100*(h-p.t-p.b);
    x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=1;[25,50,75].forEach(v=>{x.beginPath();x.moveTo(p.l,Y(v));x.lineTo(w-p.r,Y(v));x.stroke()});
    x.fillStyle='rgba(255,255,255,.46)';x.font='11px system-ui';x.textAlign='right';[25,50,75,100].forEach(v=>x.fillText(String(v),p.l-5,Y(v)+4));
    x.strokeStyle='#63e6be';x.lineWidth=2.4;x.beginPath();series.forEach((v,i)=>i?x.lineTo(X(v.ts),Y(v.reserve)):x.moveTo(X(v.ts),Y(v.reserve)));x.stroke();
    x.fillStyle='rgba(255,255,255,.55)';x.textAlign='left';x.fillText(clock(minT),p.l,h-4);x.textAlign='right';x.fillText(clock(maxT),w-p.r,h-4);
  }

  function renderDaily(){
    if(!daily)return;
    const active=Number(daily.activeKcalEst),rec=Number(daily.recovery);
    set('activeEnergy',Number.isFinite(active)?Math.round(active).toLocaleString('uk-UA'):'—');
    set('recoveryWeb',Number.isFinite(rec)?rec.toFixed(1):'—');
  }

  function renderModel(stage='швидка база'){
    if(!stateRows.length)return false;
    const now=Date.now(),b=baseline(stateRows,now),scored=stateRows.map(r=>score(r,b)),sleepBlock=latestSleepBlock(scored);
    const rawSeed=Number(daily?.recovery),seed=Number.isFinite(rawSeed)?clamp(rawSeed,0,100):70;
    const nightCharge=sleepBlock?sleepBlock.rows.reduce((s,r)=>s+Math.max(0,r.delta),0):0;
    const wake=sleepBlock?.wakeTs||new Date().setHours(7,0,0,0),awake=scored.filter(r=>r.ts>=wake);
    let reserve=seed;reserveSeries=[{ts:wake,reserve}];awake.forEach(r=>{reserve=clamp(reserve+r.delta,0,100);reserveSeries.push({ts:r.ts,reserve})});
    const latest=awake.at(-1)||scored.at(-1);gauge(reserve);draw(reserveSeries);
    set('reserveNight',sleepBlock?fmtSigned(nightCharge):'—');set('reserveDayDelta',fmtSigned(reserve-seed));set('reserveWake',sleepBlock?clock(wake):'—');
    set('mobilizationNow',latest?Math.round(latest.mobilization*100):'—');set('restorationNow',latest?Math.round(latest.restoration*100):'—');
    set('reserveSeed',Number.isFinite(rawSeed)?`ранковий seed ${seed.toFixed(1)} із Recovery; заряд/розряд — HR/RR/рух/сон`:'тимчасовий seed 70; заряд/розряд — HR/RR/рух/сон');
    const hours=b.n?Math.round((stateRows.at(-1).ts-stateRows[0].ts)/HOUR):0;
    set('reserveBaseline',`${stage}: ${b.n} × 5 хв · ~${hours} год даних`);
    renderDaily();return true;
  }

  async function loadDailyFast(){
    try{daily=latestDaily(await api({api:'table',name:'dailyMetric',limit:10},10000));renderDaily();return true}catch(_){return false}
  }

  async function initialFast(){
    if(busy)return;busy=true;const badge=document.getElementById('reserveBadge');
    try{
      if(badge){badge.textContent='1/3 метрики';badge.className='badge'};set('reserveSeed','Завантажую Recovery та energy…');
      await loadDailyFast();
      if(badge)badge.textContent='2/3 останні 12 год';set('reserveSeed','Формую поточний стан з останніх 12 год…');
      const now=Date.now();mergeRows(await fetchRangeResilient(now-12*HOUR,now));
      let hasSleep=!!latestSleepBlock(stateRows.map(r=>({...r,sleep:r.sleep})));
      if(!hasSleep){if(badge)badge.textContent='3/3 додаю ніч';set('reserveSeed','Додаю попередні 18 год, щоб знайти останній сон…');mergeRows(await fetchRangeResilient(now-30*HOUR,now-12*HOUR-1000))}
      if(!stateRows.length)throw Error('state data empty');
      renderModel(hasSleep?'швидка база':'база 30 год');
      if(badge){badge.textContent='ГОТОВО · уточнюю 7 днів';badge.className='badge warn'}
      enrichHistory(now).catch(()=>{});
    }catch(e){
      if(badge){badge.textContent='помилка';badge.className='badge bad'};set('reserveSeed',`Reserve: ${e.message}`)
    }finally{busy=false}
  }

  async function enrichHistory(now){
    if(historyBusy)return;historyBusy=true;const badge=document.getElementById('reserveBadge');
    try{
      const end=now-30*HOUR, start=now-8*DAY;let done=0,total=Math.ceil((end-start)/DAY);
      for(let e=end;e>start;e-=DAY){const s=Math.max(start,e-DAY+1000);try{mergeRows(await fetchRangeResilient(s,e));done++;renderModel(`уточнена база ${done}/${total}`);if(badge){badge.textContent=`ГОТОВО · база ${done}/${total}`;badge.className='badge warn'}}catch(_){}await wait(120)}
      renderModel('персональна база 7 днів');if(badge){badge.textContent='EXPERIMENT v0.1.3';badge.className='badge warn'}
    }finally{historyBusy=false}
  }

  async function refreshTail(){
    if(busy)return;busy=true;try{const now=Date.now();await loadDailyFast();mergeRows(await fetchRangeResilient(now-2*HOUR,now));renderModel(stateRows.length>1000?'персональна база 7 днів':'поточна база')}catch(_){}finally{busy=false}
  }

  window.addEventListener('resize',()=>draw(reserveSeries));
  initialFast();
  // Only refresh the fresh tail. Never reload the whole 8-day history on the timer.
  setInterval(refreshTail,300000);
})();