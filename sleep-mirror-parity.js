// Android Sleep parity layer for HealthLab-Web.
// Mirrors HealthLab v8.2.6 / NOOP base 8045aee SleepScreen.kt derivations.
// Presentation/data parity only: no write actions and no new health algorithm.
(()=>{
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='sleep.html')return;

  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const CANONICAL_METRIC_DEVICE='my-whoop'; // Android SleepScreen loads imported metricSeries from this exact id.
  const el=id=>document.getElementById(id);
  const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
  const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmtMin=m=>{if(!Number.isFinite(m))return'—';m=Math.max(0,Math.round(m));return m<60?`${m}m`:`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`};
  const round1=v=>{const x=v*10;return (x<0?Math.ceil(x-.5):Math.floor(x+.5))/10};
  let cache=null, applying=false, refreshTimer=null;

  async function api(p){
    const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();if(d?.error)throw Error(d.error);
    return Array.isArray(d)?d:(Array.isArray(d?.rows)?d.rows:[]);
  }

  function importedMap(rows,key){
    return new Map(rows
      .filter(r=>r.key===key && String(r.deviceId||'')===CANONICAL_METRIC_DEVICE && Number.isFinite(num(r.value)))
      .map(r=>[String(r.day||''),num(r.value)]));
  }

  function consistencySeries(days){
    // Exact Android fallback: rolling duration-SD proxy; 90 min SD -> 0, >=3 nights.
    const mins=days.map(d=>num(d.totalSleepMin)).filter(v=>Number.isFinite(v)&&v>0);
    const scores=[];
    for(let i=0;i<mins.length;i++){
      const lo=Math.max(0,i-13),w=mins.slice(lo,i+1);if(w.length<3)continue;
      const m=mean(w),variance=w.reduce((s,v)=>s+(v-m)*(v-m),0)/w.length,sd=Math.sqrt(variance);
      scores.push(clamp(100*(1-sd/90),0,100));
    }
    return scores;
  }

  function build(daysRaw,seriesRaw){
    const days=daysRaw.slice().sort((a,b)=>String(a.day||'').localeCompare(String(b.day||'')));
    const validTotals=days.map(d=>num(d.totalSleepMin)).filter(v=>Number.isFinite(v)&&v>0);
    const typicalTotal=mean(validTotals);
    const needMin=Math.max(450,Number.isFinite(typicalTotal)?typicalTotal:450);

    const perfImp=importedMap(seriesRaw,'sleep_performance');
    const consImp=importedMap(seriesRaw,'sleep_consistency');
    const needImp=importedMap(seriesRaw,'sleep_need_min');
    const debtImp=importedMap(seriesRaw,'sleep_debt_min');

    const performance=[],efficiency=[],hoursNeeded=[],restorative=[],respiratory=[],debt=[];
    for(const d of days){
      const slept=num(d.totalSleepMin),day=String(d.day||'');
      const p=perfImp.has(day)?perfImp.get(day):(Number.isFinite(slept)&&slept>0?Math.min(100,slept/needMin*100):null);
      if(Number.isFinite(p))performance.push(p);
      const e=num(d.efficiency);if(Number.isFinite(e))efficiency.push(e<=1?e*100:e);
      const need=needImp.has(day)?needImp.get(day):needMin;
      if(Number.isFinite(slept)&&slept>0&&need>0)hoursNeeded.push(slept/need*100);
      const dp=num(d.deepMin),rm=num(d.remMin);
      if(Number.isFinite(dp)&&Number.isFinite(rm)&&Number.isFinite(slept)&&slept>0)restorative.push((dp+rm)/slept*100);
      const rr=num(d.respRateBpm);if(Number.isFinite(rr))respiratory.push(rr);
      const db=debtImp.has(day)?debtImp.get(day):(Number.isFinite(slept)&&slept>0?Math.max(0,needMin-slept):null);
      if(Number.isFinite(db))debt.push(db);
    }

    const latestDay=days.at(-1)?.day||null;
    const importedConsistencyLatest=latestDay&&consImp.has(latestDay);
    const consistency=importedConsistencyLatest
      ? days.map(d=>consImp.get(String(d.day||''))).filter(Number.isFinite)
      : consistencySeries(days);

    const latest=days.slice().reverse().find(d=>num(d.totalSleepMin)>0)||null;
    const counted=days.filter(d=>num(d.totalSleepMin)>0).slice(-14);
    const ledgerNights=counted.map(d=>({day:d.day,slept:num(d.totalSleepMin),delta:num(d.totalSleepMin)-needMin}));
    const balance=round1(ledgerNights.reduce((s,x)=>s+x.delta,0));

    const trend=counted;
    const trendHours=trend.map(d=>num(d.totalSleepMin)/60);
    const trendDebt=trend.map(d=>{
      const day=String(d.day||''),slept=num(d.totalSleepMin),need=needImp.has(day)?needImp.get(day):needMin;
      return (debtImp.has(day)?debtImp.get(day):Math.max(0,need-slept))/60;
    });

    return {days,seriesRaw,needMin,perfImp,consImp,needImp,debtImp,performance,efficiency,consistency,hoursNeeded,restorative,respiratory,debt,latest,latestDay,ledgerNights,balance,trendHours,trendDebt};
  }

  function metricSpec(k,m){
    return ({
      performance:{series:m.performance,unit:'%',dec:0},
      efficiency:{series:m.efficiency,unit:'%',dec:0},
      consistency:{series:m.consistency,unit:'%',dec:0},
      hours_needed:{series:m.hoursNeeded,unit:'%',dec:0},
      restorative:{series:m.restorative,unit:'%',dec:0},
      resp:{series:m.respiratory,unit:' rpm',dec:1},
      debt:{series:m.debt,unit:'m',dec:0},
    })[k];
  }

  function latest(s){return s?.length?s[s.length-1]:null}
  function caption(k,s){
    const v=latest(s),typ=mean(s||[]);if(k==='debt')return !Number.isFinite(v)?'vs need':v<15?'On target':'Below need';
    if(!Number.isFinite(v)||!Number.isFinite(typ)||typ===0)return'vs typical -';
    const diff=v-typ,sign=diff>=0?'+':'−',mag=Math.abs(diff);
    if(k==='resp')return `${sign}${mag.toFixed(1)} rpm vs typical`;
    return `${sign}${Math.round(mag)}% vs typical`;
  }

  function valueText(k,v){
    if(!Number.isFinite(v))return'—';
    if(k==='debt')return fmtMin(v);
    if(k==='resp')return v.toFixed(1)+' rpm';
    return Math.round(v)+'%';
  }

  function drawMini(c,vals){
    if(!c)return;const a=(vals||[]).filter(Number.isFinite),ctx=c.getContext('2d'),w=c.clientWidth||120,h=c.clientHeight||28,d=devicePixelRatio||1;
    c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);if(a.length<2)return;
    const lo=Math.min(...a),hi=Math.max(...a),span=hi-lo||1;ctx.strokeStyle='#8b84ff';ctx.lineWidth=1.6;ctx.beginPath();
    a.forEach((v,i)=>{const x=i/(a.length-1)*w,y=h-2-(v-lo)/span*(h-4);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  }

  function drawChart(c,vals,bars=false){
    if(!c)return;const a=(vals||[]).filter(Number.isFinite),ctx=c.getContext('2d'),w=c.clientWidth||540,h=c.clientHeight||190,d=devicePixelRatio||1;
    c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(255,255,255,.08)';for(let i=1;i<4;i++){const y=i*h/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}if(!a.length)return;
    const lo=bars?0:Math.min(...a),hi=Math.max(...a),span=hi-lo||1;
    if(bars){const slot=w/a.length;a.forEach((v,i)=>{const bh=(v-lo)/span*(h-12),x=i*slot+slot*.18;ctx.fillStyle='rgba(197,111,139,.82)';ctx.fillRect(x,h-bh-4,slot*.64,bh)})}
    else{ctx.strokeStyle='#8b84ff';ctx.lineWidth=2;ctx.beginPath();a.forEach((v,i)=>{const x=a.length===1?w/2:i/(a.length-1)*w,y=h-7-(v-lo)/span*(h-20);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  }

  function restWord(score){return !Number.isFinite(score)?'Sleep':score<50?'Poor':score<70?'Fair':score<85?'Good':'Optimal'}
  function foot(items){return items.map(([a,b])=>`<div><span>${a}</span><b>${b??'—'}</b></div>`).join('')}

  function patchHero(m){
    const v=latest(m.performance),d=m.latest;if(el('restScore'))el('restScore').textContent=Number.isFinite(v)?Math.round(v):'—';
    if(el('restUnit'))el('restUnit').textContent=Number.isFinite(v)?'%':'';
    if(el('restFill'))el('restFill').style.height=`${Math.max(8,Math.min(100,v||0))}%`;
    if(el('restWord'))el('restWord').textContent=restWord(v);
    if(el('restSource'))el('restSource').textContent=m.latestDay&&m.perfImp.has(m.latestDay)?'Whoop':'On-device';
    if(el('restAsleep'))el('restAsleep').textContent=`${fmtMin(num(d?.totalSleepMin))} asleep`;
  }

  function patchTiles(m){
    for(const k of ['performance','efficiency','consistency','hours_needed','restorative','resp','debt']){
      const tile=document.querySelector(`[data-metric="${k}"]`),spec=metricSpec(k,m);if(!tile||!spec)continue;
      const v=latest(spec.series),strong=tile.querySelector('strong'),small=tile.querySelector('small'),canvas=tile.querySelector('canvas');
      if(strong)strong.textContent=valueText(k,v);if(small)small.textContent=caption(k,spec.series);drawMini(canvas,spec.series);
    }
  }

  function patchLedger(m){
    const box=el('debtLedger');if(!box)return;const b=m.balance,mag=Math.abs(b),on=mag<30,def=b<0,max=Math.max(...m.ledgerNights.map(x=>Math.abs(x.delta)),1);
    const headline=on?'On target':`≈${fmtMin(mag)}`,tag=on?'balanced':def?'sleep debt':'surplus';
    box.innerHTML=`<div class="sleep-ledger-head"><strong>${headline}</strong><b style="color:${on?'#74d9a4':def?'#f07872':'#74d9a4'}">${tag}</b></div><div class="sleep-ledger-copy">${on?'Your recent nights are on target for your current personal sleep need.':def?'Your recent nights add up to a sleep deficit.':'Your recent nights add up to a sleep surplus.'}</div><div class="sleep-delta-bars">${m.ledgerNights.map(x=>{const h=Math.max(2,Math.abs(x.delta)/max*28),top=x.delta>=0?30-h:31;return `<span title="${x.day} ${Math.round(x.delta)}m"><i class="${x.delta<0?'deficit':''}" style="height:${h}px;top:${top}px"></i></span>`}).join('')}</div><div class="sleep-stat-footer"><div><span>BALANCE</span><b>${on?'On target':`${b>=0?'+':'−'}${fmtMin(mag)}`}</b></div><div><span>PER-NIGHT NEED</span><b>${fmtMin(m.needMin)}</b></div><div><span>NIGHTS</span><b>${m.ledgerNights.length}</b></div></div>`;
  }

  function patchTrends(m){
    const hrs=m.trendHours,deb=m.trendDebt;if(el('hoursAvg'))el('hoursAvg').textContent=hrs.length?mean(hrs).toFixed(1)+' h avg':'—';
    if(el('debtNow'))el('debtNow').textContent=deb.length?deb.at(-1).toFixed(1)+' h':'—';
    drawChart(el('hoursTrend'),hrs,false);drawChart(el('debtTrend'),deb,true);
    if(el('hoursFooter'))el('hoursFooter').innerHTML=foot([['AVG',hrs.length?mean(hrs).toFixed(1)+' h':'—'],['MIN',hrs.length?Math.min(...hrs).toFixed(1)+' h':'—'],['MAX',hrs.length?Math.max(...hrs).toFixed(1)+' h':'—'],['NIGHTS',hrs.length]]);
    if(el('debtFooter'))el('debtFooter').innerHTML=foot([['AVG',deb.length?mean(deb).toFixed(1)+' h':'—'],['MAX',deb.length?Math.max(...deb).toFixed(1)+' h':'—'],['DAYS',deb.length]]);
  }

  function patchNeeded(m){
    const card=el('hoursNeededCard'),pctEl=el('hoursNeededPct'),d=m.latest;if(!card||!d)return;
    const slept=num(d.totalSleepMin),day=String(d.day||''),need=m.needImp.has(day)?m.needImp.get(day):m.needMin,debt=m.debtImp.has(day)?m.debtImp.get(day):Math.max(0,need-slept),p=slept/need*100;
    if(pctEl)pctEl.textContent=Math.round(p)+'%';
    card.innerHTML=`<div class="sleep-needed-main"><strong>${fmtMin(slept)}</strong><span>of ${fmtMin(need)} needed</span></div><div class="sleep-need-track"><i style="width:${Math.min(100,p)}%"></i></div><div class="sleep-need-components"><i style="width:75%"></i><i style="width:12.5%"></i><i style="width:12.5%"></i></div><div class="sleep-need-labels"><span>Healthy Minimum</span><span>Strain buffer</span><span>Debt repayment</span></div><div class="sleep-stat-footer"><div><span>SLEPT</span><b>${fmtMin(slept)}</b></div><div><span>NEEDED</span><b>${fmtMin(need)}</b></div><div><span>DEBT</span><b>${fmtMin(debt)}</b></div></div>`;
  }

  function patchConsistency(m){
    const score=latest(m.consistency),sec=el('consistencySection');if(!sec)return;
    if(!Number.isFinite(score)){sec.classList.add('hidden');return}sec.classList.remove('hidden');if(el('consistencyScore'))el('consistencyScore').textContent=Math.round(score)+'%';
    drawChart(el('consistencyChart'),m.consistency,false);
    if(el('consistencyFooter'))el('consistencyFooter').innerHTML=foot([['SCORE',Math.round(score)+'%'],['METHOD','duration SD'],['WINDOW','14 nights'],['NIGHTS',m.days.filter(d=>num(d.totalSleepMin)>0).length]]);
  }

  function openDetail(k,m){
    const names={performance:['Rest','%'],efficiency:['Sleep Efficiency','%'],consistency:['Consistency','%'],hours_needed:['Hours vs Needed','%'],restorative:['Restorative','%'],resp:['Respiratory',' rpm'],debt:['Sleep Debt','m']};
    const [title]=names[k]||[k],spec=metricSpec(k,m);if(!spec)return;
    el('sleepModalTitle').textContent=title;el('sleepModalBody').innerHTML=`<div id="metricDetailValue" class="sleep-detail-value">—</div><div class="sleep-range">${['W','M','3M','6M','1Y','ALL'].map(r=>`<button data-parity-range="${r}" class="${r==='M'?'active':''}">${r}</button>`).join('')}</div><canvas id="metricDetailCanvas" class="sleep-detail-canvas" height="220"></canvas><div id="metricDetailNote" class="sleep-muted"></div>`;el('sleepModal').classList.remove('hidden');
    const paint=r=>{const count={W:7,M:30,'3M':90,'6M':180,'1Y':365,ALL:9999}[r],a=spec.series.slice(-count),v=latest(a);el('metricDetailValue').textContent=valueText(k,v);drawChart(el('metricDetailCanvas'),a,false);el('metricDetailNote').textContent=a.length<2?'Not enough history in this range. Try 3M, 6M, or ALL.':`${a.length} data points in ${r}.`;document.querySelectorAll('[data-parity-range]').forEach(b=>b.classList.toggle('active',b.dataset.parityRange===r))};
    paint('M');document.querySelectorAll('[data-parity-range]').forEach(b=>b.onclick=()=>paint(b.dataset.parityRange));
  }

  function apply(){if(!cache||applying)return;applying=true;try{patchHero(cache);patchTiles(cache);patchLedger(cache);patchTrends(cache);patchNeeded(cache);patchConsistency(cache);if(el('sleepStatus'))el('sleepStatus').textContent=`Android Sleep mirror · parity formulas from v8.2.6 · ${cache.ledgerNights.length} usable nights`;}finally{applying=false}}

  async function refresh(){
    try{const [d,s]=await Promise.all([api({api:'table',name:'dailyMetric',limit:90}),api({api:'table',name:'metricSeries',limit:500})]);cache=build(d,s);setTimeout(apply,80)}catch(e){console.warn('sleep parity',e)}
  }

  function install(){
    const grid=el('metricGrid');if(grid&&!grid.dataset.parityBound){grid.dataset.parityBound='1';grid.addEventListener('click',ev=>{const tile=ev.target.closest?.('[data-metric]');if(!tile||!cache)return;ev.preventDefault();ev.stopImmediatePropagation();openDetail(tile.dataset.metric,cache)},true);new MutationObserver(()=>{if(cache&&!applying)setTimeout(apply,0)}).observe(grid,{childList:true});}
    el('sleepRefresh')?.addEventListener('click',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,1000)});
    refresh();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();