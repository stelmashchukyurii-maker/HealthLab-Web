(()=>{
  async function stateChunks(fromSec,toSec,bucket=300){
    const step=2*3600,ranges=[];
    for(let s=fromSec;s<=toSec;s+=step)ranges.push([s,Math.min(toSec,s+step-1)]);
    const call=(a,b)=>api({api:'state',from:a,to:b,bucket});
    const parts=await Promise.all(ranges.map(async([a,b])=>{
      try{return await call(a,b)}catch(e){
        const mid=Math.floor((a+b)/2);
        if(mid<=a)return [];
        const r=await Promise.allSettled([call(a,mid),call(mid+1,b)]);
        return r.flatMap(x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[]);
      }
    }));
    const map=new Map();
    parts.flat().forEach(r=>{const ts=epochMs(r?.bucket_ts);if(ts)map.set(ts,r)});
    return [...map.values()].sort((a,b)=>epochMs(a.bucket_ts)-epochMs(b.bucket_ts));
  }

  load=async function(){
    $('status').textContent='Оновлюю хронологію…';
    $('selectedDate').textContent=fmtDate(selectedDay);
    $('nextDay').disabled=selectedDay.getTime()>=startOfDay(new Date()).getTime();
    try{
      const from=Math.floor(selectedDay.getTime()/1000),to=Math.floor(dayEnd()/1000);
      const [state,timeline]=await Promise.all([stateChunks(from,to,300),api({api:'timeline',limit:300})]);
      allRows=(Array.isArray(state)?state:[]).map(r=>({ts:epochMs(r.bucket_ts),avgHr:num(r.avg_hr),minHr:num(r.min_hr),maxHr:num(r.max_hr),motion:num(r.motion_score),rrCount:Number(r.rr_count||0),rmssd:num(r.rmssd_ms),sleep:r.sleep_state==='SLEEP'})).filter(r=>r.ts).sort((a,b)=>a.ts-b.ts);
      events=(Array.isArray(timeline)?timeline:[]).map(e=>({...e,ts:new Date(e.occurred_at).getTime()})).filter(e=>Number.isFinite(e.ts)&&e.ts>=selectedDay.getTime()&&e.ts<=selectedDay.getTime()+86400000).sort((a,b)=>a.ts-b.ts);
      if(!allRows.length)throw Error('State Engine не повернув часових вікон');
      classifyAll();sliceVisible();renderAll();
      $('status').textContent=`${allRows.length} п’ятихвилинних вікон · ${events.length} подій`;
    }catch(e){$('status').textContent='Помилка: '+e.message;allRows=[];rows=[];renderAll();throw e}
  };

  $('refreshBtn').onclick=load;
  setTimeout(()=>load().catch(()=>{}),1400);
  setTimeout(()=>{if(!allRows.length)load().catch(()=>{})},4200);
})();
