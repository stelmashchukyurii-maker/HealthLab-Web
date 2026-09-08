const TREND_API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
const TREND_DAY=86400000;
const TREND_METRICS=[
  {key:'avgHrv',label:'Нічний HRV',short:'HRV',unit:'мс',digits:0,better:'up',threshold:5,source:'WHOOP · похідний показник'},
  {key:'restingHr',label:'Пульс спокою',short:'пульс спокою',unit:'уд/хв',digits:0,better:'down',threshold:3,source:'WHOOP'},
  {key:'totalSleepMin',label:'Сон',short:'сон',unit:'',digits:0,better:'up',threshold:5,source:'WHOOP',format:'sleep'},
  {key:'recovery',label:'Recovery',short:'WHOOP Recovery',unit:'%',digits:0,better:'up',threshold:5,source:'WHOOP · vendor score'},
  {key:'strain',label:'Навантаження',short:'навантаження',unit:'',digits:1,better:'neutral',threshold:10,source:'WHOOP · vendor strain'}
];

const trendEl=id=>document.getElementById(id);

async function trendApi(params){
  const u=new URL(TREND_API);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(d&&d.error)throw Error(d.error);
  return d;
}

function trendDayMs(day){
  const t=Date.parse(day+'T12:00:00Z');
  return Number.isFinite(t)?t:null;
}
function trendMean(rows,key){
  const v=rows.map(r=>Number(r[key])).filter(Number.isFinite);
  return v.length?{value:v.reduce((a,b)=>a+b,0)/v.length,n:v.length}:null;
}
function trendFormatValue(metric,value){
  if(metric.format==='sleep'){
    const mins=Math.round(value),h=Math.floor(mins/60),m=mins%60;
    return `${h}г ${String(m).padStart(2,'0')}хв`;
  }
  return `${value.toFixed(metric.digits)}${metric.unit?' '+metric.unit:''}`;
}
function trendArrow(direction){return direction==='up'?'↑':direction==='down'?'↓':'→'}
function trendDirection(deltaPct,threshold){
  if(!Number.isFinite(deltaPct)||Math.abs(deltaPct)<threshold)return 'flat';
  return deltaPct>0?'up':'down';
}
function trendEvaluation(metric,direction){
  if(direction==='flat')return {cls:'neutral',label:'стабільно'};
  if(metric.better==='neutral')return {cls:'info',label:direction==='up'?'вище навантаження':'нижче навантаження'};
  const favorable=(metric.better==='up'&&direction==='up')||(metric.better==='down'&&direction==='down');
  return favorable?{cls:'favorable',label:'сприятливіше'}:{cls:'unfavorable',label:'менш сприятливо'};
}
function trendDateLabel(day){
  return new Date(day+'T12:00:00').toLocaleDateString('uk-UA',{day:'2-digit',month:'short'}).replace('.','');
}
function trendEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function trendBuildComparison(rows){
  if(!rows.length)return null;
  const latest=rows.at(-1)._dayMs;
  const currentStart=latest-6*TREND_DAY;
  const previousStart=latest-13*TREND_DAY;
  const current7=rows.filter(r=>r._dayMs>=currentStart&&r._dayMs<=latest);
  const previous7=rows.filter(r=>r._dayMs>=previousStart&&r._dayMs<currentStart);
  if(current7.length>=5&&previous7.length>=4){
    return {mode:'7v7',current:current7,previous:previous7,window:current7,caption:`7 днів проти попередніх 7 · ${current7.length}/7 поточних днів`};
  }
  if(current7.length>=6){
    const six=current7.slice(-6);
    return {mode:'3v3',current:six.slice(-3),previous:six.slice(0,3),window:current7,caption:`короткий тренд: останні 3 дні проти попередніх 3 · ${current7.length}/7 днів`};
  }
  return {mode:'insufficient',current:[],previous:[],window:current7,caption:`ще збираємо дані · ${current7.length}/7 днів`};
}

function trendRenderMetric(metric,currentRows,previousRows){
  const a=trendMean(currentRows,metric.key),b=trendMean(previousRows,metric.key);
  if(!a||!b||a.n<2||b.n<2){
    return {html:`<div class="trend-row"><div><b>${trendEscape(metric.label)}</b><small>${trendEscape(metric.source)}</small></div><div class="trend-value">—</div><div class="trend-pill neutral">даних мало</div></div>`,summary:null};
  }
  const deltaPct=b.value!==0?(a.value-b.value)/Math.abs(b.value)*100:0;
  const direction=trendDirection(deltaPct,metric.threshold);
  const evaluation=trendEvaluation(metric,direction);
  const pctText=direction==='flat'?`${Math.abs(deltaPct).toFixed(0)}%`:`${trendArrow(direction)} ${Math.abs(deltaPct).toFixed(0)}%`;
  const html=`<div class="trend-row">
    <div class="trend-name"><b>${trendEscape(metric.label)}</b><small>${trendEscape(metric.source)}</small></div>
    <div class="trend-value"><strong>${trendEscape(trendFormatValue(metric,a.value))}</strong><small>середнє</small></div>
    <div class="trend-change"><span class="trend-pill ${evaluation.cls}">${pctText}</span><small>${trendEscape(evaluation.label)}</small></div>
  </div>`;
  return {html,summary:{metric,direction,evaluation,deltaPct}};
}

async function loadTrend(){
  const coverage=trendEl('trendCoverage'),summaryEl=trendEl('trendSummary'),periodEl=trendEl('trendPeriod'),rowsEl=trendEl('trendRows'),noteEl=trendEl('trendNote');
  if(!coverage||!summaryEl||!periodEl||!rowsEl)return;
  coverage.textContent='оновлення…';
  try{
    const d=await trendApi({api:'table',name:'dailyMetric',limit:30});
    const raw=Array.isArray(d)?d:(d.rows||[]);
    const byDay=new Map();
    raw.forEach(r=>{
      const ms=trendDayMs(r.day);
      if(ms!==null)byDay.set(r.day,{...r,_dayMs:ms});
    });
    const rows=[...byDay.values()].sort((a,b)=>a._dayMs-b._dayMs);
    const cmp=trendBuildComparison(rows);
    if(!cmp){throw Error('Немає dailyMetric')}
    coverage.textContent=cmp.window.length+'/7 днів';
    coverage.className='badge '+(cmp.window.length>=6?'live':'warn');
    const first=cmp.window[0],last=cmp.window.at(-1);
    periodEl.textContent=(first&&last?`${trendDateLabel(first.day)} – ${trendDateLabel(last.day)} · `:'')+cmp.caption;
    if(cmp.mode==='insufficient'){
      summaryEl.textContent='Поки рано визначати напрямок. HealthLab збирає достатнє 7-денне вікно.';
      rowsEl.innerHTML='';
      if(noteEl)noteEl.textContent='Коли буде щонайменше 6 валідних днів, з’явиться короткий тренд; після достатньої історії — 7 днів проти попередніх 7.';
      return;
    }
    const rendered=TREND_METRICS.map(m=>trendRenderMetric(m,cmp.current,cmp.previous));
    rowsEl.innerHTML=rendered.map(x=>x.html).join('');
    const parts=rendered.slice(0,4).map(x=>x.summary).filter(Boolean).map(x=>`${x.metric.short} ${trendArrow(x.direction)}`);
    summaryEl.textContent=parts.length?parts.join(' · '):'Тренд ще формується.';
    if(noteEl)noteEl.textContent='↑/↓ показує факт зміни. «Сприятливіше / менш сприятливо» — окрема обережна інтерпретація. Для навантаження стрілка не означає «добре / погано». 28-денний персональний baseline додамо після достатньої історії.';
  }catch(e){
    coverage.textContent='—';coverage.className='badge warn';
    summaryEl.textContent='Тренд тимчасово недоступний.';
    periodEl.textContent=e.message;
    rowsEl.innerHTML='';
  }
}

trendEl('refreshBtn')?.addEventListener('click',loadTrend);
loadTrend();
setInterval(loadTrend,60000);
