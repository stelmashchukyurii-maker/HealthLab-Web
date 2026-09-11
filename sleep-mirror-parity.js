// Android Sleep parity layer for HealthLab-Web.
// SOURCE OF TRUTH: installed HealthLab v8.2.6, NOOP base 8045aee405ac180357529c3b096030a4069b3e76.
// This file copies Android Sleep derivations; it does not "improve" them.
(()=>{
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='sleep.html')return;

  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const CANON='my-whoop';
  const $=id=>document.getElementById(id);
  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
  const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=m=>{if(!Number.isFinite(m))return'—';m=Math.max(0,Math.round(m));return m<60?`${m}m`:`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`};
  const effStart=s=>n(s?.startTsAdjusted)??n(s?.startTs);
  const localDay=ts=>new Date(Number(ts)*1000).toLocaleDateString('en-CA');
  const localHour=ts=>{const d=new Date(Number(ts)*1000);return d.getHours()+d.getMinutes()/60};
  let model=null, applying=false, refreshTimer=null;

  async function api(p){
    const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));
    const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();if(d?.error)throw Error(d.error);
    return Array.isArray(d)?d:(Array.isArray(d?.rows)?d.rows:[]);
  }

  function imported(rows,key){
    return new Map(rows.filter(r=>String(r.deviceId||'')===CANON&&r.key===key&&Number.isFinite(n(r.value)))
      .map(r=>[String(r.day||''),n(r.value)]));
  }
  function localSeries(rows,key){
    const pref=rows.filter(r=>String(r.deviceId||'')==='my-whoop-noop'&&r.key===key&&Number.isFinite(n(r.value)));
    const src=pref.length?pref:rows.filter(r=>r.key===key&&String(r.deviceId||'')!==CANON&&Number.isFinite(n(r.value)));
    return new Map(src.map(r=>[String(r.day||''),n(r.value)]));
  }

  // Exact Android tile fallback (SleepScreen.kt @ 8045aee):
  // rolling trailing-14 sleep-duration SD; 90 min SD => score 0; needs >=3 nights.
  function consistencyDuration(days){
    const mins=days.map(d=>n(d.totalSleepMin)).filter(v=>Number.isFinite(v)&&v>0),out=[];
    for(let i=0;i<mins.length;i++){
      const w=mins.slice(Math.max(0,i-13),i+1); if(w.length<3)continue;
      const m=mean(w),sd=Math.sqrt(w.reduce((s,v)=>s+(v-m)*(v-m),0)/w.length);
      out.push(clamp(100*(1-sd/90),0,100));
    }
    return out;
  }

  function build(daysRaw,seriesRaw,sessionsRaw){
    // vm.recentDays is chronological; reproduce that ordering.
    const days=daysRaw.slice().sort((a,b)=>String(a.day||'').localeCompare(String(b.day||'')));
    const positive=days.map(d=>n(d.totalSleepMin)).filter(v=>Number.isFinite(v)&&v>0);
    const typicalTotal=mean(positive);
    const needMin=Math.max(450,Number.isFinite(typicalTotal)?typicalTotal:450); // exact Android 7.5h floor

    const perfImp=imported(seriesRaw,'sleep_performance');
    const consImp=imported(seriesRaw,'sleep_consistency');
    const needImp=imported(seriesRaw,'sleep_need_min');
    const debtImp=imported(seriesRaw,'sleep_debt_min');
    // Android's metric detail "Rest" recomputes the local Rest composite. HealthLab already persists
    // that exact on-device result as my-whoop-noop sleep_performance, so use it for the detail graph.
    const localPerf=localSeries(seriesRaw,'sleep_performance');

    const durationConsistency=consistencyDuration(days);
    const latestDay=days.at(-1)?.day||null;
    const useImportedConsistency=!!(latestDay&&consImp.has(String(latestDay)));

    const perf=[],eff=[],cons=[],hoursNeed=[],restorative=[],resp=[],debt=[];
    for(const d of days){
      const day=String(d.day||''),sleep=n(d.totalSleepMin);
      if(Number.isFinite(sleep)&&sleep>0){
        // TILE performance: imported WHOOP wins; else Android 8045 fallback = slept/personal need.
        perf.push(perfImp.has(day)?perfImp.get(day):Math.min(100,sleep/needMin*100));
        const e=n(d.efficiency); if(Number.isFinite(e))eff.push(e<=1?e*100:e);
        const need=needImp.has(day)?needImp.get(day):needMin;
        if(Number.isFinite(need)&&need>0)hoursNeed.push(sleep/need*100); // can exceed 100, as Android tile does
        const dp=n(d.deepMin),rm=n(d.remMin);
        if(Number.isFinite(dp)&&Number.isFinite(rm))restorative.push((dp+rm)/sleep*100);
        const rr=n(d.respRateBpm); if(Number.isFinite(rr))resp.push(rr);
        // TILE debt fallback uses global personal need (not per-day imported need) unless imported debt exists.
        debt.push(debtImp.has(day)?debtImp.get(day):Math.max(0,needMin-sleep));
      }
    }
    if(useImportedConsistency){
      days.forEach(d=>{const v=consImp.get(String(d.day||''));if(Number.isFinite(v))cons.push(v)});
    }else{
      cons.push(...durationConsistency);
    }

    const latest=days.slice().reverse().find(d=>n(d.totalSleepMin)>0)||null;
    const counted=days.filter(d=>n(d.totalSleepMin)>0).slice(-14);
    const ledgerNights=counted.map(d=>({day:String(d.day||''),slept:n(d.totalSleepMin),delta:n(d.totalSleepMin)-needMin}));
    const balance=ledgerNights.reduce((s,x)=>s+x.delta,0);

    const trendHours=counted.map(d=>n(d.totalSleepMin)/60);
    // Android trend debt: imported debt wins; else per-day imported need, else personal mean need.
    const trendDebt=counted.map(d=>{
      const day=String(d.day||''),sleep=n(d.totalSleepMin),need=needImp.has(day)?needImp.get(day):needMin;
      return (debtImp.has(day)?debtImp.get(day):Math.max(0,need-sleep))/60;
    });
    const trendNeed=counted.map(d=>{const day=String(d.day||'');return (needImp.has(day)?needImp.get(day):needMin)/60});

    const sessions=sessionsRaw.filter(s=>Number.isFinite(n(s.startTs))&&Number.isFinite(n(s.endTs))&&n(s.endTs)>n(s.startTs))
      .sort((a,b)=>(effStart(a)||0)-(effStart(b)||0));

    // Detail-sheet series mirrors Android buildSleepMetricPoints(), not the tile's imported-series preference.
    const detail={performance:[],efficiency:[],consistency:[],hours_needed:[],restorative:[],resp:[],debt:[]};
    let detailConsIdx=0;
    const detailCons=consistencyDuration(days);
    for(let i=0;i<days.length;i++){
      const d=days[i],day=String(d.day||''),sleep=n(d.totalSleepMin);
      if(Number.isFinite(sleep)&&sleep>0){
        // RestScorer.restFromDaily is persisted in the local sleep_performance series by IntelligenceEngine.
        const rp=localPerf.get(day);
        if(Number.isFinite(rp))detail.performance.push([day,rp]);
        else {
          // Best exact available fallback if persisted point is absent in web mirror.
          const p=perfImp.has(day)?perfImp.get(day):Math.min(100,sleep/needMin*100);
          if(Number.isFinite(p))detail.performance.push([day,p]);
        }
        const e=n(d.efficiency);if(Number.isFinite(e))detail.efficiency.push([day,e<=1?e*100:e]);
        if(i>=2 && detailConsIdx<detailCons.length)detail.consistency.push([day,detailCons[detailConsIdx++]);
        detail.hours_needed.push([day,Math.min(100,sleep/needMin*100)]); // detail sheet clamps to 100 in Android
        const dp=n(d.deepMin),rm=n(d.remMin);if(Number.isFinite(dp)&&Number.isFinite(rm))detail.restorative.push([day,(dp+rm)/sleep*100]);
        const rr=n(d.respRateBpm);if(Number.isFinite(rr))detail.resp.push([day,rr]);
        detail.debt.push([day,Math.max(0,needMin-sleep)/60]); // detail spec unit is hours
      }
    }

    return {days,seriesRaw,sessions,needMin,perfImp,consImp,needImp,debtImp,
      series:{performance:perf,efficiency:eff,consistency:cons,hours_needed:hoursNeed,restorative,resp,debt},
      detail,latest,latestDay,ledgerNights,balance,trendHours,trendDebt,trendNeed};
  }

  const last=a=>a?.length?a[a.length-1]:null;
  function value(k,v){
    if(!Number.isFinite(v))return'—';
    if(k==='debt')return fmt(v);
    if(k==='resp')return v.toFixed(1)+' rpm';
    return Math.round(v)+'%';
  }
  function typicalCaption(k,a){
    const v=last(a),hist=(a||[]).slice(0,-1),t=mean(hist);
    if(!Number.isFinite(v)||!Number.isFinite(t))return'—';
    const d=v-t,sg=d>=0?'+':'−',mag=Math.abs(d);
    if(k==='resp')return`${sg}${mag.toFixed(1)} rpm vs typical`;
    if(k==='debt')return`${sg}${Math.round(mag)}m vs typical`;
    return`${sg}${Math.round(mag)}% vs typical`;
  }
  function restWord(v){return !Number.isFinite(v)?'Sleep':v<50?'Poor':v<70?'Fair':v<85?'Good':'Optimal'}
  function foot(a){return a.map(([x,y])=>`<div><span>${x}</span><b>${y??'—'}</b></div>`).join('')}

  function drawLine(c,vals,bars=false){
    if(!c)return;const a=(vals||[]).filter(Number.isFinite),ctx=c.getContext('2d'),w=c.clientWidth||540,h=c.clientHeight||190,d=devicePixelRatio||1;
    c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(255,255,255,.08)';for(let i=1;i<4;i++){const y=i*h/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    if(!a.length)return;const lo=bars?0:Math.min(...a),hi=Math.max(...a),span=hi-lo||1;
    if(bars){const slot=w/a.length;a.forEach((v,i)=>{const bh=(v-lo)/span*(h-12),x=i*slot+slot*.18;ctx.fillStyle='rgba(197,111,139,.82)';ctx.fillRect(x,h-bh-4,slot*.64,bh)})}
    else{ctx.strokeStyle='#8b84ff';ctx.lineWidth=2;ctx.beginPath();a.forEach((v,i)=>{const x=a.length===1?w/2:i/(a.length-1)*w,y=h-7-(v-lo)/span*(h-20);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  }
  function drawMini(c,a){drawLine(c,a,false)}

  function patchHero(m){
    const v=last(m.series.performance),d=m.latest;
    if($('restScore'))$('restScore').textContent=Number.isFinite(v)?Math.round(v):'—';
    if($('restUnit'))$('restUnit').textContent=Number.isFinite(v)?'%':'';
    if($('restFill'))$('restFill').style.height=`${Math.max(8,Math.min(100,v||0))}%`;
    if($('restWord'))$('restWord').textContent=restWord(v);
    if($('restSource'))$('restSource').textContent=m.latestDay&&m.perfImp.has(String(m.latestDay))?'Whoop':'On-device';
    if($('restAsleep'))$('restAsleep').textContent=`${fmt(n(d?.totalSleepMin))} asleep`;
  }

  function patchTiles(m){
    for(const k of ['performance','efficiency','consistency','hours_needed','restorative','resp','debt']){
      const tile=document.querySelector(`[data-metric="${k}"]`),a=m.series[k];if(!tile||!a)continue;
      const strong=tile.querySelector('strong'),small=tile.querySelector('small'),canvas=tile.querySelector('canvas');
      if(strong)strong.textContent=value(k,last(a));if(small)small.textContent=typicalCaption(k,a);drawMini(canvas,a);
    }
  }

  function patchLedger(m){
    const box=$('debtLedger');if(!box)return;
    const bal=m.balance,def=bal<0,max=Math.max(...m.ledgerNights.map(x=>Math.abs(x.delta)),1);
    box.innerHTML=`<div class="sleep-ledger-head"><strong>${bal<0?'−':bal>0?'+':''}${fmt(Math.abs(bal))}</strong><b style="color:${def?'#f07872':'#74d9a4'}">${def?'sleep debt':bal>0?'surplus':'balanced'}</b></div>
      <div class="sleep-ledger-copy">${def?'Your recent nights add up to a sleep deficit.':'Your recent nights are at or above the current personal sleep need.'}</div>
      <div class="sleep-delta-bars">${m.ledgerNights.map(x=>{const h=Math.max(2,Math.abs(x.delta)/max*28),top=x.delta>=0?30-h:31;return`<span title="${x.day} ${Math.round(x.delta)}m"><i class="${x.delta<0?'deficit':''}" style="height:${h}px;top:${top}px"></i></span>`}).join('')}</div>
      <div class="sleep-stat-footer"><div><span>BALANCE</span><b>${bal>=0?'+':''}${fmt(Math.abs(bal))}</b></div><div><span>PER-NIGHT NEED</span><b>${fmt(m.needMin)}</b></div><div><span>NIGHTS</span><b>${m.ledgerNights.length}</b></div></div>`;
  }

  function patchTrends(m){
    const h=m.trendHours,d=m.trendDebt;
    if($('hoursAvg'))$('hoursAvg').textContent=h.length?mean(h).toFixed(1)+' h avg':'—';
    if($('debtNow'))$('debtNow').textContent=d.length?d.at(-1).toFixed(1)+' h':'—';
    drawLine($('hoursTrend'),h,false);drawLine($('debtTrend'),d,true);
    if($('hoursFooter'))$('hoursFooter').innerHTML=foot([['AVG',h.length?mean(h).toFixed(1)+' h':'—'],['MIN',h.length?Math.min(...h).toFixed(1)+' h':'—'],['MAX',h.length?Math.max(...h).toFixed(1)+' h':'—'],['NIGHTS',h.length]]);
    if($('debtFooter'))$('debtFooter').innerHTML=foot([['AVG',d.length?mean(d).toFixed(1)+' h':'—'],['MAX',d.length?Math.max(...d).toFixed(1)+' h':'—'],['DAYS',d.length]]);
  }

  function patchNeeded(m){
    const card=$('hoursNeededCard'),d=m.latest;if(!card||!d)return;
    const day=String(d.day||''),slept=n(d.totalSleepMin),need=m.needImp.has(day)?m.needImp.get(day):m.needMin;
    const debt=m.debtImp.has(day)?m.debtImp.get(day):Math.max(0,m.needMin-slept); // tile's debt definition
    const p=slept/need*100,healthy=420,strain=Math.max(0,need-healthy),repay=Math.max(0,debt),tot=Math.max(1,healthy+strain+repay);
    if($('hoursNeededPct'))$('hoursNeededPct').textContent=Math.round(p)+'%';
    card.innerHTML=`<div class="sleep-needed-main"><strong>${fmt(slept)}</strong><span>of ${fmt(need)} needed</span></div>
      <div class="sleep-need-track"><i style="width:${Math.min(100,p)}%"></i></div>
      <div class="sleep-need-components"><i style="width:${healthy/tot*100}%"></i><i style="width:${strain/tot*100}%"></i><i style="width:${repay/tot*100}%"></i></div>
      <div class="sleep-need-labels"><span>Healthy Min</span><span>Strain</span><span>Debt</span></div>
      <div class="sleep-stat-footer"><div><span>SLEPT</span><b>${(slept/60).toFixed(1)} h</b></div><div><span>NEEDED</span><b>${(need/60).toFixed(1)} h</b></div><div><span>DEBT</span><b>${debt>3?(debt/60).toFixed(1)+' h':'None'}</b></div></div>`;
  }

  function selectedIndexFromUi(){
    const t=($('nightLabel')?.textContent||'').trim();
    if(/^(Last night|Минула ніч)$/i.test(t))return 0;
    if(/^1 (night ago|ніч тому)$/i.test(t))return 1;
    const m=t.match(/^(\d+)\s+(nights ago|ночей тому)$/i);return m?Number(m[1]):0;
  }
  function selectedDay(m){
    const desc=m.sessions.slice().sort((a,b)=>n(b.endTs)-n(a.endTs)),s=desc[selectedIndexFromUi()]||desc[0];
    return s?localDay(n(s.endTs)):m.latestDay;
  }

  function patchStagesTypical(m){
    const box=$('stagesTypical');if(!box)return;const day=selectedDay(m),row=m.days.find(d=>String(d.day||'')===String(day));if(!row)return;
    const stage=[['Deep','deepMin','#5d52ca'],['REM','remMin','#bb82ec'],['Light','lightMin','#4d9ff0']];
    box.innerHTML=stage.map(([label,key,color])=>{
      const v=n(row[key]),typ=mean(m.days.map(d=>n(d[key])).filter(x=>Number.isFinite(x)&&x>0)),mx=Math.max(v||0,typ||0,1)*1.18,p=Number.isFinite(v)?Math.min(100,v/mx*100):0,mp=Number.isFinite(typ)?Math.min(100,typ/mx*100):0;
      const delta=Number.isFinite(v)&&Number.isFinite(typ)?`${v>=typ?'+':'−'}${fmt(Math.abs(v-typ))} vs typ`:'';
      return`<div class="sleep-typical-row"><div class="sleep-typical-head"><span>${label}</span><span><b>${fmt(v)}</b> <small>${delta}</small></span></div><div class="sleep-typical-track"><div class="sleep-typical-fill" style="width:${p}%;background:${color}"></div>${Number.isFinite(typ)?`<i class="sleep-typical-marker" style="left:${mp}%"></i>`:''}</div></div>`;
    }).join('');
  }

  // Exact Android bottom SleepConsistencyCard: last 14 sessions, mean bed/wake, ±45 min, schedule chart.
  function patchScheduleConsistency(m){
    const sec=$('consistencySection');if(!sec)return;const recent=m.sessions.slice(-14);if(recent.length<3){sec.classList.add('hidden');return}sec.classList.remove('hidden');
    const timings=recent.map(s=>{let bed=localHour(effStart(s));if(bed>12)bed-=24;return{bed,wake:localHour(n(s.endTs))}});
    const tb=mean(timings.map(x=>x.bed)),tw=mean(timings.map(x=>x.wake));
    const score=timings.filter(x=>Math.abs(x.bed-tb)<=.75&&Math.abs(x.wake-tw)<=.75).length/timings.length*100;
    const sd=a=>{const av=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-av)*(v-av),0)/a.length)};
    const typicalSd=((sd(timings.map(x=>x.bed))+sd(timings.map(x=>x.wake)))/2*60);
    if($('consistencyScore'))$('consistencyScore').textContent=Math.round(score)+'%';

    const c=$('consistencyChart');if(c){
      const ctx=c.getContext('2d'),w=c.clientWidth||540,h=c.clientHeight||220,d=devicePixelRatio||1;c.width=w*d;c.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
      const yMin=-4,yMax=18,range=yMax-yMin,y=v=>clamp((v-yMin)/range*h,0,h);
      ctx.strokeStyle='rgba(255,255,255,.08)';[-4,0,4,8,12,16].forEach(v=>{ctx.beginPath();ctx.moveTo(0,y(v));ctx.lineTo(w,y(v));ctx.stroke()});
      const slot=w/timings.length;timings.forEach((t,i)=>{const x=i*slot+slot/2;ctx.strokeStyle='#8b84ff';ctx.lineWidth=Math.max(3,slot*.6);ctx.beginPath();ctx.moveTo(x,y(t.bed));ctx.lineTo(x,y(t.wake));ctx.stroke()});
      ctx.setLineDash([8,6]);[[tb,'#8b84ff'],[tw,'#8b84ff']].forEach(([v,col])=>{ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,y(v));ctx.lineTo(w,y(v));ctx.stroke()});ctx.setLineDash([]);
    }
    if($('consistencyFooter'))$('consistencyFooter').innerHTML=foot([['SCORE',Math.round(score)+'%'],['TYPICAL',Math.round(typicalSd)+' min SD'],['NIGHTS',recent.length]]);
  }

  function filterRange(points,r){
    if(r==='ALL')return points;const days={W:7,M:30,'3M':90,'6M':180,'1Y':365}[r]||30;
    if(!points.length)return[];const lastDate=new Date(points.at(-1)[0]+'T00:00:00'),cut=new Date(lastDate);cut.setDate(cut.getDate()-(days-1));
    const out=points.filter(([d])=>new Date(d+'T00:00:00')>=cut);return out.length?out:points.slice(-days);
  }
  function openDetail(k,m){
    const names={performance:['Rest','%'],efficiency:['Sleep Efficiency','%'],consistency:['Consistency','%'],hours_needed:['Hours vs Needed','%'],restorative:['Restorative','%'],resp:['Respiratory Rate','rpm'],debt:['Sleep Debt','h']};
    const [title,unit]=names[k]||[k,''],pts=m.detail[k]||[];$('sleepModalTitle').textContent=title;
    $('sleepModalBody').innerHTML=`<div id="metricDetailValue" class="sleep-detail-value">—</div><div class="sleep-range">${['W','M','3M','6M','1Y','ALL'].map(r=>`<button data-parity-range="${r}" class="${r==='M'?'active':''}">${r}</button>`).join('')}</div><canvas id="metricDetailCanvas" class="sleep-detail-canvas" height="220"></canvas><div id="metricDetailNote" class="sleep-muted"></div><div id="metricDetailStats" class="sleep-stat-footer"></div>`;
    $('sleepModal').classList.remove('hidden');
    const format=v=>k==='resp'?v.toFixed(1):k==='debt'?v.toFixed(1):Math.round(v);
    const paint=r=>{const p=filterRange(pts,r),vals=p.map(x=>x[1]),v=last(vals);
      $('metricDetailValue').textContent=Number.isFinite(v)?`${format(v)} ${unit}`.trim():'—';drawLine($('metricDetailCanvas'),vals,false);
      $('metricDetailNote').textContent=p.length<2?'Not enough history in this range. Try 3M, 6M, or ALL.':`${p.length} data points in ${r}.`;
      $('metricDetailStats').innerHTML=foot([['MIN',vals.length?`${format(Math.min(...vals))} ${unit}`.trim():'—'],['AVG',vals.length?`${format(mean(vals))} ${unit}`.trim():'—'],['MAX',vals.length?`${format(Math.max(...vals))} ${unit}`.trim():'—']]);
      document.querySelectorAll('[data-parity-range]').forEach(b=>b.classList.toggle('active',b.dataset.parityRange===r));
    };
    paint('M');document.querySelectorAll('[data-parity-range]').forEach(b=>b.onclick=()=>paint(b.dataset.parityRange));
  }

  function apply(){
    if(!model||applying)return;applying=true;
    try{
      patchHero(model);patchTiles(model);patchLedger(model);patchTrends(model);patchNeeded(model);patchStagesTypical(model);patchScheduleConsistency(model);
      if($('sleepStatus'))$('sleepStatus').textContent=`Android Sleep mirror · v8.2.6 exact derivation parity · ${model.ledgerNights.length} usable nights`;
    }finally{applying=false}
  }
  async function refresh(){
    try{
      const [d,s,ss]=await Promise.all([api({api:'table',name:'dailyMetric',limit:90}),api({api:'table',name:'metricSeries',limit:500}),api({api:'sleepSessions',limit:90})]);
      model=build(d,s,ss);setTimeout(apply,120);
    }catch(e){console.warn('sleep parity',e)}
  }
  function install(){
    const grid=$('metricGrid');
    if(grid&&!grid.dataset.parityBound){
      grid.dataset.parityBound='1';
      grid.addEventListener('click',ev=>{const tile=ev.target.closest?.('[data-metric]');if(!tile||!model)return;ev.preventDefault();ev.stopImmediatePropagation();openDetail(tile.dataset.metric,model)},true);
      new MutationObserver(()=>{if(model&&!applying)setTimeout(apply,0)}).observe(grid,{childList:true});
    }
    ['prevNight','nextNight'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(apply,150)));
    $('sleepRefresh')?.addEventListener('click',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,900)});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();