const $=id=>document.getElementById(id);
const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
let selectedDate=startOfDay(new Date()),periodDays=1,typeFilter='ALL';
let summaryMap=new Map(),dailyRows=[],sleepRows=[],stateRows=[];

$('refreshLab').onclick=refreshAll;
$('prevDay').onclick=()=>shiftDay(-1);
$('nextDay').onclick=()=>shiftDay(1);
$('todayBtn').onclick=()=>{selectedDate=startOfDay(new Date());refreshRange()};
$('closeDetail').onclick=()=>$('metricDetail').classList.add('hidden');
document.querySelectorAll('#labPeriods button').forEach(b=>b.onclick=()=>{periodDays=+b.dataset.days;document.querySelectorAll('#labPeriods button').forEach(x=>x.classList.toggle('active',x===b));refreshRange()});
document.querySelectorAll('#typeFilters button').forEach(b=>b.onclick=()=>{typeFilter=b.dataset.type;document.querySelectorAll('#typeFilters button').forEach(x=>x.classList.toggle('active',x===b));renderLab()});
refreshAll();

async function api(p){const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d&&d.error)throw Error(d.error);return d}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return startOfDay(x)}
function dateKey(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function fmtDate(d){return d.toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}
function epochMs(v){const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function avg(a){const x=a.map(finite).filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function median(a){const x=a.map(finite).filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const p=(x.length-1)/2,i=Math.floor(p),f=p-i;return x[i+1]!==undefined?x[i]+f*(x[i+1]-x[i]):x[i]}
function sum(a){return a.map(finite).filter(Number.isFinite).reduce((s,v)=>s+v,0)}
function minv(a){const x=a.map(finite).filter(Number.isFinite);return x.length?Math.min(...x):null}
function maxv(a){const x=a.map(finite).filter(Number.isFinite);return x.length?Math.max(...x):null}
function round(v,d=0){return Number.isFinite(v)?Number(v.toFixed(d)):null}
function duration(min){if(!Number.isFinite(min))return null;const h=Math.floor(min/60),m=Math.round(min%60);return `${h}г ${m}хв`}
function pct(v){if(!Number.isFinite(v))return null;return v<=1?`${Math.round(v*100)}%`:`${Math.round(v)}%`}
function val(v,unit='',digits=0){return Number.isFinite(v)?`${round(v,digits)}${unit?` ${unit}`:''}`:'—'}
function lastTs(table){const q=summaryMap.get(table);return q?.lastTs?epochMs(q.lastTs):0}
function rawAvailability(table,label='RAW'){const q=summaryMap.get(table);if(!q?.count)return {value:'—',quality:'NO DATA',maturity:'RAW'};return {value:label,quality:'RAW',maturity:'RAW',period:`${Number(q.count).toLocaleString('uk-UA')} rows · last ${lastTs(table)?new Date(lastTs(table)).toLocaleString('uk-UA'):'—'}`}}

async function refreshAll(){
  $('labStatus').textContent='Оновлення LAB…';
  try{
    const [s,d,sl]=await Promise.all([api({api:'summary'}),api({api:'table',name:'dailyMetric',limit:500}),api({api:'table',name:'sleepSession',limit:200})]);
    const sr=Array.isArray(s)?s:(s.tables||[]);summaryMap=new Map(sr.map(x=>[x.name||x.table,x]));
    dailyRows=(Array.isArray(d)?d:(d.rows||[])).filter(x=>x.day).sort((a,b)=>String(a.day).localeCompare(String(b.day)));
    sleepRows=(Array.isArray(sl)?sl:(sl.rows||[]));
    await refreshRange();
  }catch(e){$('labStatus').textContent='LAB error: '+e.message}
}
async function refreshRange(){
  const today=startOfDay(new Date());if(selectedDate>today)selectedDate=today;
  const rangeStart=addDays(selectedDate,-(periodDays-1)),rangeEnd=addDays(selectedDate,1);
  $('selectedDate').textContent=fmtDate(selectedDate);$('nextDay').disabled=selectedDate>=today;
  $('labStatus').textContent='Завантаження фізіологічного вікна…';
  try{
    const r=await api({api:'state',from:Math.floor(rangeStart.getTime()/1000),to:Math.floor((rangeEnd.getTime()-1)/1000),bucket:300});
    stateRows=(Array.isArray(r)?r:[]).map(x=>({ts:epochMs(x.bucket_ts),avgHr:finite(x.avg_hr),minHr:finite(x.min_hr),maxHr:finite(x.max_hr),motion:finite(x.motion_score),rrCount:Number(x.rr_count||0),meanNN:finite(x.mean_nn_ms),rmssd:finite(x.rmssd_ms),sdnn:finite(x.sdnn_ms),pnn50:finite(x.pnn50_pct),sleep:x.sleep_state==='SLEEP'})).filter(x=>x.ts).sort((a,b)=>a.ts-b.ts);
    renderLab();
  }catch(e){$('labStatus').textContent='State/LAB error: '+e.message}
}
function shiftDay(n){selectedDate=addDays(selectedDate,n);const today=startOfDay(new Date());if(selectedDate>today)selectedDate=today;refreshRange()}

function context(){
  const dayStart=selectedDate.getTime(),dayEnd=addDays(selectedDate,1).getTime();
  const rangeStart=addDays(selectedDate,-(periodDays-1));
  const rangeStartKey=dateKey(rangeStart),endKey=dateKey(selectedDate);
  const dayState=stateRows.filter(r=>r.ts>=dayStart&&r.ts<dayEnd),periodState=stateRows;
  const selectedDaily=dailyRows.find(r=>r.day===endKey)||null;
  const periodDaily=dailyRows.filter(r=>r.day>=rangeStartKey&&r.day<=endKey);
  const validDay=dayState.filter(validHrv),validPeriod=periodState.filter(validHrv);
  const sleepSession=sleepRows.find(s=>{const t=epochMs(s.endTs);return t&&dateKey(new Date(t))===endKey})||null;
  return {dayState,periodState,selectedDaily,periodDaily,validDay,validPeriod,sleepSession,rangeStart,endKey};
}
function validHrv(r){return r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250}
function avgField(rows,k){return avg(rows.map(r=>r[k]))}
function hrStats(rows){const x=rows.filter(r=>Number.isFinite(r.avgHr));return {last:x.at(-1)?.avgHr??null,mean:avg(x.map(r=>r.avgHr)),min:minv(x.map(r=>r.minHr)),max:maxv(x.map(r=>r.maxHr))}}
function hrvStats(valid){return {meanNN:median(valid.map(r=>r.meanNN)),rmssd:median(valid.map(r=>r.rmssd)),sdnn:median(valid.map(r=>r.sdnn)),pnn50:median(valid.map(r=>r.pnn50))}}
function sleepClock(v){const t=epochMs(v);return t?new Date(t).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):'—'}

function buildMetrics(){
  const c=context(),dayHr=hrStats(c.dayState),perHr=hrStats(c.periodState),dayHrv=hrvStats(c.validDay),perHrv=hrvStats(c.validPeriod),dm=c.selectedDaily||{};
  const periodLabel=periodDays===1?'вибраний день':`avg/median ${periodDays}д`;
  const dailyAvg=k=>avgField(c.periodDaily,k);
  const rrDay=sum(c.dayState.map(r=>r.rrCount)),rrPeriod=sum(c.periodState.map(r=>r.rrCount));
  const motionDay=median(c.dayState.map(r=>r.motion)),motionPeriod=median(c.periodState.map(r=>r.motion));
  const ppg=rawAvailability('ppgHrSample','RAW'),spoRaw=rawAvailability('spo2Sample','red/IR RAW'),respRaw=rawAvailability('respSample','RAW'),tempRaw=rawAvailability('skinTempSample','RAW'),grav=rawAvailability('gravitySample','RAW'),stepsRaw=rawAvailability('stepSample','PRIMARY'),sleepState=rawAvailability('sleepStateSample','PRIMARY');
  const groups=[
    {name:'CARDIO / HRV',metrics:[
      M('hr','HR / heart rate',1,'WHOOP → HealthLab','PRIMARY',val(dayHr.last,'bpm'),periodDays===1?`avg ${val(dayHr.mean,'bpm')}`:`${periodLabel}: ${val(perHr.mean,'bpm')}`,c.dayState.length?'GOOD':'NO DATA','Первинний пульс із mirror HR. Day min/max: '+val(dayHr.min,'bpm')+' / '+val(dayHr.max,'bpm')+'.'),
      M('rr','RR intervals',1,'WHOOP → HealthLab','PRIMARY',rrDay?`${rrDay.toLocaleString('uk-UA')} RR`:'—',periodDays===1?'selected day':`${rrPeriod.toLocaleString('uk-UA')} RR / ${periodDays}д`,rrDay>=100?'GOOD':rrDay?'LIMITED':'NO DATA','Beat-to-beat інтервали. Перед HRV проходять plausibility/coverage quality gate.'),
      M('ecg','ECG waveform',1,'Polar H10','REFERENCE','session files','—','REFERENCE','ECG є референсним каналом контрольованих H10-сесій; це не live web stream.'),
      M('rpeaks','R-peaks',1,'Polar H10 / HealthLab','PLANNED','—','—','PLANNED','R-peak extraction буде окремо валідований проти H10 ECG.'),
      M('ppg','PPG / raw optical',1,'WHOOP',ppg.maturity,ppg.value,ppg.period,ppg.quality,'Сирий/near-raw optical carrier. Не прирівнювати до calibrated SpO₂.'),
      M('rhr','Resting HR',2,'WHOOP summary','DEVICE-PROCESSED',val(finite(dm.restingHr),'bpm'),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('restingHr'),'bpm',1)}`,Number.isFinite(finite(dm.restingHr))?'AVAILABLE':'NO DATA','Стандартизований показник, але поточне значення походить із WHOOP summary; HealthLab-derived RHR буде окремим рядком після власної валідації.'),
      M('meanhr','Mean HR',2,'HealthLab','EXPERIMENTAL',val(dayHr.mean,'bpm',1),periodDays===1?'—':`${periodLabel}: ${val(perHr.mean,'bpm',1)}`,c.dayState.length?'GOOD':'NO DATA','HealthLab обчислює з 5-хв HR buckets.'),
      M('minhr','Min HR',2,'HealthLab','EXPERIMENTAL',val(dayHr.min,'bpm'),periodDays===1?'—':`period min ${val(perHr.min,'bpm')}`,c.dayState.length?'GOOD':'NO DATA','Мінімум у доступному HR coverage; не автоматично resting HR.'),
      M('maxhr','Max HR',2,'HealthLab','EXPERIMENTAL',val(dayHr.max,'bpm'),periodDays===1?'—':`period max ${val(perHr.max,'bpm')}`,c.dayState.length?'GOOD':'NO DATA','Максимум у доступному HR coverage.'),
      M('meannn','Mean NN',2,'HealthLab','EXPERIMENTAL',val(dayHrv.meanNN,'ms'),periodDays===1?'5m median':`5m median ${periodDays}д: ${val(perHrv.meanNN,'ms')}`,c.validDay.length?'GOOD':'LIMITED','Медіана mean NN серед 5-хв RR-вікон, які пройшли quality gate.'),
      M('rmssd','RMSSD',2,'HealthLab','EXPERIMENTAL',val(dayHrv.rmssd,'ms'),periodDays===1?'5m median':`5m median ${periodDays}д: ${val(perHrv.rmssd,'ms')}`,c.validDay.length?'GOOD':'LIMITED','Незалежно перераховується HealthLab з RR. Не зливати з WHOOP/Garmin nightly HRV.'),
      M('sdnn','SDNN',2,'HealthLab','EXPERIMENTAL',val(dayHrv.sdnn,'ms'),periodDays===1?'5m median':`5m median ${periodDays}д: ${val(perHrv.sdnn,'ms')}`,c.validDay.length?'GOOD':'LIMITED','SDNN у валідних 5-хв RR-вікнах; interpretation залежить від window.'),
      M('pnn50','pNN50',2,'HealthLab','EXPERIMENTAL',val(dayHrv.pnn50,'%'),periodDays===1?'5m median':`5m median ${periodDays}д: ${val(perHrv.pnn50,'%')}`,c.validDay.length?'GOOD':'LIMITED','Частка сусідніх NN, що відрізняються більш ніж на 50 ms, у quality-gated 5-хв вікнах.'),
      M('freqhrv','HRV frequency-domain',2,'HealthLab','PLANNED','—','—','PLANNED','LF/HF та інші spectral metrics додамо лише з чітким window, artifact handling і respiration context.'),
      M('ectopy','PVC / PAC-like burden',2,'HealthLab + H10','VALIDATING','—','—','VALIDATING','Потребує ECG/RR morphology validation; не ставимо клінічний label без reference.'),
      M('brady','Brady / tachy episodes',2,'HealthLab','PLANNED','—','—','PLANNED','Епізоди з threshold + duration + source quality.'),
      M('whoophrv','WHOOP nightly HRV',3,'WHOOP','VENDOR',val(finite(dm.avgHrv),'ms'),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('avgHrv'),'ms',1)}`,Number.isFinite(finite(dm.avgHrv))?'VENDOR':'NO DATA','Vendor-derived nightly HRV summary. Показується окремо від HealthLab RMSSD.')
    ]},
    {name:'RESPIRATION / OXYGEN',metrics:[
      M('respraw','Raw respiration signal',1,'WHOOP',respRaw.maturity,respRaw.value,respRaw.period,respRaw.quality,'Поточний raw integer ще не декодований у фізичні одиниці.'),
      M('resprate','Respiratory rate',2,'WHOOP summary','DEVICE-PROCESSED',val(finite(dm.respRateBpm),'rpm',1),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('respRateBpm'),'rpm',1)}`,Number.isFinite(finite(dm.respRateBpm))?'AVAILABLE':'NO DATA','Поточне значення — WHOOP-derived summary; окремий HL-derived respiration алгоритм ще не валідований.'),
      M('sporaw','PPG red / IR carriers',1,'WHOOP',spoRaw.maturity,spoRaw.value,spoRaw.period,spoRaw.quality,'Red/IR carriers не є автоматично SpO₂ %.'),
      M('spo2','SpO₂ calibrated %',1,'WHOOP / future reference','DEVICE-PROCESSED',val(finite(dm.spo2Pct),'%'),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('spo2Pct'),'%',1)}`,Number.isFinite(finite(dm.spo2Pct))?'AVAILABLE':'NOT AVAILABLE','Показуємо лише якщо source реально віддає calibrated value; raw red/IR сюди не підставляємо.'),
      M('spo2derived','SpO₂ mean / min / time below threshold',2,'HealthLab','PLANNED','—','—','PLANNED','Лише після validated SpO₂ source і quality gate.'),
      M('desat','Desaturation events',2,'HealthLab','PLANNED','—','—','PLANNED','Не визначати desaturation з невалідованого raw optical signal.')
    ]},
    {name:'SLEEP',metrics:[
      M('sleepmotion','Sleep / wake movement',1,'WHOOP',sleepState.maturity,sleepState.value,sleepState.period,sleepState.quality,'Source sleep-state/motion coverage; stage interpretation окремо.'),
      M('sleepstart','Sleep onset',2,'WHOOP sleepSession','DEVICE-PROCESSED',c.sleepSession?sleepClock(c.sleepSession.startTsAdjusted||c.sleepSession.startTs):'—','—',c.sleepSession?'AVAILABLE':'NO DATA','Час початку sleepSession; source/reference label завжди зберігається.'),
      M('wake','Final wake',2,'WHOOP sleepSession','DEVICE-PROCESSED',c.sleepSession?sleepClock(c.sleepSession.endTs):'—','—',c.sleepSession?'AVAILABLE':'NO DATA','Час завершення sleepSession.'),
      M('tst','Total sleep time',2,'WHOOP summary','DEVICE-PROCESSED',duration(finite(dm.totalSleepMin))||'—',periodDays===1?'—':`${periodLabel}: ${duration(dailyAvg('totalSleepMin'))||'—'}`,Number.isFinite(finite(dm.totalSleepMin))?'AVAILABLE':'NO DATA','Total sleep time із dailyMetric.'),
      M('eff','Sleep efficiency',2,'WHOOP summary','DEVICE-PROCESSED',pct(finite(dm.efficiency))||'—',periodDays===1?'—':`${periodLabel}: ${pct(dailyAvg('efficiency'))||'—'}`,Number.isFinite(finite(dm.efficiency))?'AVAILABLE':'NO DATA','Source-specific sleep efficiency.'),
      M('deep','Deep / N3',2,'WHOOP stages','DEVICE-PROCESSED',duration(finite(dm.deepMin))||'—',periodDays===1?'—':`${periodLabel}: ${duration(dailyAvg('deepMin'))||'—'}`,Number.isFinite(finite(dm.deepMin))?'SOURCE-LABEL':'NO DATA','Stage label походить від WHOOP; не прирівнювати до PSG N3 без validation.'),
      M('rem','REM',2,'WHOOP stages','DEVICE-PROCESSED',duration(finite(dm.remMin))||'—',periodDays===1?'—':`${periodLabel}: ${duration(dailyAvg('remMin'))||'—'}`,Number.isFinite(finite(dm.remMin))?'SOURCE-LABEL':'NO DATA','WHOOP-derived stage label.'),
      M('light','Light sleep',2,'WHOOP stages','DEVICE-PROCESSED',duration(finite(dm.lightMin))||'—',periodDays===1?'—':`${periodLabel}: ${duration(dailyAvg('lightMin'))||'—'}`,Number.isFinite(finite(dm.lightMin))?'SOURCE-LABEL':'NO DATA','WHOOP-derived stage label.'),
      M('dist','Awakenings / disturbances',2,'WHOOP summary','DEVICE-PROCESSED',Number.isFinite(finite(dm.disturbances))?String(dm.disturbances):'—',periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('disturbances'),'',1)}`,Number.isFinite(finite(dm.disturbances))?'AVAILABLE':'NO DATA','Vendor/source-defined disturbances; definition must stay attached to source.'),
      M('sleepscore','WHOOP Sleep Performance / Score',3,'WHOOP','VENDOR','—','—','NOT SYNCED','Vendor score зареєстрований у LAB, але поточна mirror-схема ще не дає надійного поля для нього.')
    ]},
    {name:'TEMPERATURE',metrics:[
      M('skinraw','Skin temperature raw',1,'WHOOP',tempRaw.maturity,tempRaw.value,tempRaw.period,tempRaw.quality,'Raw vendor integer; не показуємо як °C до декодування/валідації.'),
      M('skindev','Skin-temperature deviation',2,'WHOOP summary','DEVICE-PROCESSED',val(finite(dm.skinTempDevC),'°C',2),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('skinTempDevC'),'°C',2)}`,Number.isFinite(finite(dm.skinTempDevC))?'AVAILABLE':'NO DATA','Deviation from vendor baseline, якщо джерело її реально віддає.'),
      M('coretemp','Core / body temperature',1,'Future source','PLANNED','—','—','PLANNED','Потребує окремого validated sensor/reference source.')
    ]},
    {name:'ACTIVITY / MOVEMENT',metrics:[
      M('gravity','Gravity / posture-related motion',1,'WHOOP',grav.maturity,grav.value,grav.period,grav.quality,'Near-raw x/y/z gravity channel.'),
      M('stepsraw','Steps / activity samples',1,'WHOOP',stepsRaw.maturity,stepsRaw.value,stepsRaw.period,stepsRaw.quality,'stepSample coverage; vendor activityClass зберігаємо окремо від нашої state model.'),
      M('motionproxy','HealthLab motion proxy',2,'HealthLab','EXPERIMENTAL',Number.isFinite(motionDay)?motionDay.toFixed(4):'—',periodDays===1?'5m median':`5m median ${periodDays}д: ${Number.isFinite(motionPeriod)?motionPeriod.toFixed(4):'—'}`,Number.isFinite(motionDay)?'EXPERIMENTAL':'NO DATA','Розрахунок із зміни gravity x/y/z. Поріг руху персонально калібрується.'),
      M('strain','WHOOP Strain',3,'WHOOP','VENDOR',val(finite(dm.strain),'',2),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('strain'),'',2)}`,Number.isFinite(finite(dm.strain))?'VENDOR':'NO DATA','Proprietary composite score; не фізична величина.'),
      M('kcal','Active kcal estimate',3,'WHOOP / source model','VENDOR',val(finite(dm.activeKcalEst),'kcal'),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('activeKcalEst'),'kcal')}`,Number.isFinite(finite(dm.activeKcalEst))?'VENDOR':'NO DATA','Model-derived energy estimate, не direct measurement.')
    ]},
    {name:'AUTONOMIC / RECOVERY · VENDOR',metrics:[
      M('recovery','WHOOP Recovery',3,'WHOOP','VENDOR',val(finite(dm.recovery),'%',1),periodDays===1?'—':`${periodLabel}: ${val(dailyAvg('recovery'),'%',1)}`,Number.isFinite(finite(dm.recovery))?'VENDOR':'NO DATA','Vendor composite; показується окремо від TYPE 1/2 причин.'),
      M('whoopstress','WHOOP Stress Monitor',3,'WHOOP','VENDOR','—','—','NOT SYNCED','Має бути окремим vendor/reference teacher; поточний mirror ще не містить надійної intraday series.'),
      M('garminstress','Garmin Stress',3,'Garmin','VENDOR','—','—','NOT CONNECTED','Планований Garmin reference layer 0–100; не абсолютна фізіологічна величина.'),
      M('bodybattery','Garmin Body Battery',3,'Garmin','VENDOR','—','—','NOT CONNECTED','Планований vendor reference для accumulated charge/drain.'),
      M('readiness','Garmin Training Readiness',3,'Garmin','VENDOR','—','—','PLANNED','Якщо доступно на конкретному Garmin/source.'),
      M('recoverytime','Garmin Recovery Time',3,'Garmin','VENDOR','—','—','PLANNED','Vendor interpretation, окремо від HealthLab recovery model.'),
      M('hlstate','HealthLab State Engine',2,'HealthLab','EXPERIMENTAL',c.dayState.length?'ACTIVE':'—',`${c.dayState.length} × 5m windows`,c.dayState.length?'EXPERIMENTAL':'NO DATA','SLEEP / REST / MOVEMENT / RECOVERY / AUTONOMIC LOAD / UNKNOWN. Це станова модель, не vendor score.')
    ]},
    {name:'METABOLIC / FUTURE SOURCES',metrics:[
      M('glucose','Glucose',1,'CGM / glucometer','PLANNED','—','—','SOURCE NOT CONNECTED','Майбутній calibrated metabolic source; meal context буде прив’язаний по timestamp.'),
      M('bp','Blood pressure',1,'BP monitor','PLANNED','—','—','SOURCE NOT CONNECTED','Окремий validated cuff/source.'),
      M('labs','Laboratory biomarkers',1,'Lab / manual import','PLANNED','—','—','PLANNED','Cortisol, insulin, hormones та інші лабораторні anchor points з датою/часом і лабораторією.')
    ]}
  ];
  return groups;
}
function M(id,label,type,source,maturity,value,period,quality,note){return{id,label,type,source,maturity,value:value??'—',period:period??'—',quality:quality||'—',note:note||''}}

function renderLab(){
  const groups=buildMetrics(),c=context();
  $('coverage').textContent=`${dateKey(c.rangeStart)} → ${c.endKey} · dailyMetric ${c.periodDaily.length}/${periodDays} дн · State Engine ${c.periodState.length} × 5m · valid HRV ${c.validPeriod.length} вікон`;
  const box=$('labGroups');box.innerHTML='';let shown=0;
  groups.forEach(g=>{const metrics=g.metrics.filter(m=>typeFilter==='ALL'||String(m.type)===typeFilter);if(!metrics.length)return;shown+=metrics.length;const sec=document.createElement('section');sec.className='lab-group';sec.innerHTML=`<div class="group-head"><div><div class="eyebrow">PHYSIOLOGY</div><h2>${esc(g.name)}</h2></div><small>${metrics.length} metrics</small></div><div class="metric-table"></div>`;const table=sec.querySelector('.metric-table');metrics.forEach(m=>table.appendChild(metricRow(m)));box.appendChild(sec)});
  $('labStatus').textContent=`LAB · ${shown} показників · selected ${dateKey(selectedDate)} · ${periodDays} day view`;
}
function metricRow(m){const b=document.createElement('button');b.className='metric-row';const statusClass=statusClassFor(m);b.innerHTML=`<div><div class="metric-name">${esc(m.label)}</div><div class="metric-sub"><span class="tag t${m.type}">T${m.type}</span><span class="mini-tag">${esc(m.source)}</span><span class="mini-tag ${statusClass}">${esc(m.maturity)}</span><span class="mini-tag ${qualityClass(m.quality)}">${esc(m.quality)}</span></div></div><div class="metric-values"><div class="metric-current">${esc(m.value)}</div><div class="metric-period">${esc(m.period)}</div></div>`;b.onclick=()=>openDetail(m);return b}
function statusClassFor(m){const s=(m.maturity||'').toUpperCase();if(s.includes('VENDOR'))return'vendor';if(s.includes('RAW'))return'raw';if(s.includes('EXPERIMENTAL')||s.includes('VALIDATING'))return'experimental';if(s.includes('PLANNED')||s.includes('NOT'))return'planned';return'good'}
function qualityClass(s){s=String(s||'').toUpperCase();if(s.includes('GOOD')||s.includes('AVAILABLE')||s.includes('PRIMARY'))return'good';if(s.includes('RAW'))return'raw';if(s.includes('VENDOR')||s.includes('SOURCE-LABEL'))return'vendor';if(s.includes('LIMITED')||s.includes('EXPERIMENTAL'))return'experimental';return'planned'}
function openDetail(m){$('detailType').textContent=`TYPE ${m.type} · ${m.maturity}`;$('detailTitle').textContent=m.label;$('detailValue').textContent=m.value;const rows=[['Source',m.source],['Type',`T${m.type}`],['Maturity',m.maturity],['Quality / status',m.quality],['Selected day',dateKey(selectedDate)],['Period',periodDays===1?'1 day':`${periodDays} days ending ${dateKey(selectedDate)}`],['Period value',m.period]];$('detailMeta').innerHTML=rows.map(([k,v])=>`<div class="detail-key">${esc(k)}</div><div>${esc(v)}</div>`).join('');$('detailNote').textContent=m.note;$('metricDetail').classList.remove('hidden')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
