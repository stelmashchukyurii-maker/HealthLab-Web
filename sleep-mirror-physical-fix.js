(()=>{
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='sleep.html')return;
  const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const NEED=480;
  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
  const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
  const fmt=m=>{if(!Number.isFinite(m))return'—';m=Math.max(0,Math.round(m));return m<60?`${m}m`:`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`};
  const el=id=>document.getElementById(id);
  async function api(p){const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d?.error)throw Error(d.error);return Array.isArray(d)?d:(d?.rows||[])}
  function draw(c,vals,bars=false){if(!c)return;const a=vals.filter(Number.isFinite),ctx=c.getContext('2d'),w=c.clientWidth||540,h=c.clientHeight||190,d=devicePixelRatio||1;c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';for(let i=1;i<4;i++){const y=i*h/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}if(!a.length)return;const lo=bars?0:Math.min(...a),hi=Math.max(...a),span=hi-lo||1;if(bars){const slot=w/a.length;a.forEach((v,i)=>{const bh=(v-lo)/span*(h-12),x=i*slot+slot*.18;ctx.fillStyle='rgba(197,111,139,.82)';ctx.fillRect(x,h-bh-4,slot*.64,bh)})}else{ctx.strokeStyle='#8b84ff';ctx.lineWidth=2;ctx.beginPath();a.forEach((v,i)=>{const x=a.length===1?w/2:i/(a.length-1)*w,y=h-7-(v-lo)/span*(h-20);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}}
  function mini(c,vals){if(!c)return;const a=vals.filter(Number.isFinite),ctx=c.getContext('2d'),w=c.clientWidth||120,h=c.clientHeight||28,d=devicePixelRatio||1;c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);if(a.length<2)return;const lo=Math.min(...a),hi=Math.max(...a),span=hi-lo||1;ctx.strokeStyle='#8b84ff';ctx.lineWidth=1.6;ctx.beginPath();a.forEach((v,i)=>{const x=i/(a.length-1)*w,y=h-2-(v-lo)/span*(h-4);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  function footer(id,items){const e=el(id);if(e)e.innerHTML=items.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}
  async function fix(){
    try{
      const [dm,ms]=await Promise.all([api({api:'table',name:'dailyMetric',limit:90}),api({api:'table',name:'metricSeries',limit:500})]);
      const metrics=dm.sort((a,b)=>String(b.day||'').localeCompare(String(a.day||'')));
      const valid=metrics.filter(x=>{const s=n(x.totalSleepMin);return Number.isFinite(s)&&s>0}).slice(0,14).reverse();
      if(!valid.length)return;
      const sleeps=valid.map(x=>n(x.totalSleepMin)),hours=sleeps.map(v=>v/60),debts=sleeps.map(v=>Math.max(0,NEED-v)/60);
      const deltas=sleeps.map(v=>v-NEED),bal=deltas.reduce((s,v)=>s+v,0),isDebt=bal<0;
      if(el('hoursAvg'))el('hoursAvg').textContent=mean(hours).toFixed(1)+' h avg';
      if(el('debtNow'))el('debtNow').textContent=debts.at(-1).toFixed(1)+' h';
      draw(el('hoursTrend'),hours,false);draw(el('debtTrend'),debts,true);
      footer('hoursFooter',[['AVG',mean(hours).toFixed(1)+' h'],['MIN',Math.min(...hours).toFixed(1)+' h'],['MAX',Math.max(...hours).toFixed(1)+' h'],['NIGHTS',String(hours.length)]]);
      footer('debtFooter',[['AVG',mean(debts).toFixed(1)+' h'],['MAX',Math.max(...debts).toFixed(1)+' h'],['DAYS',String(debts.length)]]);
      const box=el('debtLedger');if(box){const max=Math.max(...deltas.map(v=>Math.abs(v)),1);box.innerHTML=`<div class="sleep-ledger-head"><strong>${isDebt?'-':'+'}${fmt(Math.abs(bal))}</strong><b style="color:${isDebt?'#f07872':'#74d9a4'}">${isDebt?'sleep debt':bal>0?'surplus':'balanced'}</b></div><div class="sleep-ledger-copy">${isDebt?'Your recent usable nights add up to a sleep deficit.':'Your recent usable nights are at or above the current on-device need reference.'}</div><div class="sleep-delta-bars">${valid.map((x,i)=>{const v=deltas[i],h=Math.max(2,Math.abs(v)/max*28),top=v>=0?30-h:31;return `<span title="${x.day} ${Math.round(v)}m"><i class="${v<0?'deficit':''}" style="height:${h}px;top:${top}px"></i></span>`}).join('')}</div><div class="sleep-stat-footer"><div><span>BALANCE</span><b>${bal>=0?'+':''}${fmt(Math.abs(bal))}</b></div><div><span>PER-NIGHT NEED</span><b>${fmt(NEED)}</b></div><div><span>NIGHTS</span><b>${valid.length}</b></div></div>`}
      const perf=new Map(ms.filter(x=>x.key==='sleep_performance').map(x=>[x.day,n(x.value)]));
      const hist={performance:valid.map(x=>perf.get(x.day)).filter(Number.isFinite),efficiency:valid.map(x=>{const v=n(x.efficiency);return Number.isFinite(v)?v*100:null}).filter(Number.isFinite),hours_needed:sleeps.map(v=>v/NEED*100),restorative:valid.map(x=>{const s=n(x.totalSleepMin),d=n(x.deepMin),r=n(x.remMin);return s>0&&Number.isFinite(d)&&Number.isFinite(r)?(d+r)/s*100:null}).filter(Number.isFinite),resp:valid.map(x=>n(x.respRateBpm)).filter(Number.isFinite),debt:sleeps.map(v=>Math.max(0,NEED-v))};
      const current=valid.at(-1),cur={performance:perf.get(current.day),efficiency:n(current.efficiency)*100,hours_needed:n(current.totalSleepMin)/NEED*100,restorative:((n(current.deepMin)||0)+(n(current.remMin)||0))/n(current.totalSleepMin)*100,resp:n(current.respRateBpm),debt:Math.max(0,NEED-n(current.totalSleepMin))};
      for(const k of ['performance','efficiency','hours_needed','restorative','resp','debt']){const tile=document.querySelector(`[data-metric="${k}"]`);if(!tile)continue;const v=cur[k],h=hist[k]||[],typ=mean(h.slice(0,-1)),unit=k==='resp'?'rpm':k==='debt'?'m':'%',cap=Number.isFinite(v)&&Number.isFinite(typ)?`${v>=typ?'+':''}${Math.round(v-typ)}${unit} vs typical`:'—';const strong=tile.querySelector('strong'),small=tile.querySelector('small'),canvas=tile.querySelector('canvas');if(strong)strong.textContent=k==='debt'?fmt(v):k==='resp'?v.toFixed(1)+' rpm':Math.round(v)+'%';if(small)small.textContent=cap;mini(canvas,h)}
      if(el('sleepStatus'))el('sleepStatus').textContent=`Android Sleep mirror · ${valid.length} usable nights in 14-night calculations · read-only web actions`;
    }catch(e){console.warn('sleep physical fix',e)}
  }
  const kick=()=>setTimeout(fix,250);window.addEventListener('load',kick);document.addEventListener('DOMContentLoaded',kick);el('sleepRefresh')?.addEventListener('click',()=>setTimeout(fix,900));
})();