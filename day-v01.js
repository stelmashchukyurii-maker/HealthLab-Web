/* DAY V0.1 · read-only visual projection over existing timeline data */
(()=>{"use strict";
const PX=62,GAP_MIN=20;
let last=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hm=t=>new Date(t).toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
function mins(ts,d0){return (ts-d0)/60000}
function y(min){return 10+min/60*PX}
function stateRuns(rows,state){
 const out=[];let cur=null;
 for(const r of rows){if(r.state===state){if(!cur||r.ts-cur.end>360000){cur={start:r.ts,end:r.ts+300000};out.push(cur)}else cur.end=r.ts+300000}else cur=null}
 return out;
}
function gaps(rows,d0,end){
 const good=rows.map(r=>r.ts).sort((a,b)=>a-b),out=[];let p=d0;
 for(const t of good){if(t-p>30*60000)out.push({start:p,end:t});p=Math.max(p,t+300000)}
 if(end-p>30*60000)out.push({start:p,end});return out;
}
function render(data){
 last=data;document.body.classList.add("day-v01");
 const host=document.getElementById("dayV01");if(!host)return;
 const d0=data.dayStart,end=data.dayEnd,rows=data.rows||[],events=data.events||[];
 const total=Math.max(24*PX,Math.ceil((end-d0)/3600000)*PX);
 if(!rows.length&&!events.length){host.innerHTML='<div class="day-v01-empty">На цей день немає доступних даних.</div>';return}
 let h='<div class="day-v01-timeline" style="height:'+total+'px"><div class="day-v01-axis"></div>';
 for(let hr=0;hr<=24;hr++){const yy=y(hr*60);h+='<div class="day-v01-hour" style="top:'+yy+'px">'+String(hr).padStart(2,"0")+':00</div><div class="day-v01-hour-line" style="top:'+yy+'px"></div>'}
 const sleeps=stateRuns(rows,"SLEEP");
 for(const s of sleeps){const top=y(Math.max(0,mins(s.start,d0))),height=Math.max(26,y(mins(s.end,d0))-top);h+='<div class="day-v01-sleep-block" style="top:'+top+'px;height:'+height+'px"><b>☾ Сон</b><br><small>'+hm(s.start)+' – '+hm(s.end)+'</small></div>'}
 const responses=[...stateRuns(rows,"AUTONOMIC_LOAD"),...stateRuns(rows,"RECOVERY")].sort((a,b)=>a.start-b.start);
 for(const r of responses){const top=y(mins(r.start,d0)),height=Math.max(22,y(mins(r.end,d0))-top);h+='<div class="day-v01-response" style="top:'+top+'px;height:'+height+'px">▌ Фізіологічна зміна · '+hm(r.start)+'–'+hm(r.end)+'</div>'}
 for(const g of gaps(rows,d0,end)){const top=y(mins(g.start,d0)),height=Math.max(24,y(mins(g.end,d0))-top);h+='<div class="day-v01-gap" style="top:'+top+'px;height:'+height+'px">Немає даних · '+hm(g.start)+'–'+hm(g.end)+'</div>'}
 let lastTop=-999;
 for(const e of events){if(e.ts<d0||e.ts>end)continue;let top=y(mins(e.ts,d0));if(top-lastTop<GAP_MIN)top=lastTop+GAP_MIN;lastTop=top;const meal=["food","meal_start","meal_end"].includes(e.event_type);const title=esc(e.title||e.event_type||"Подія");h+='<div class="day-v01-item event" style="top:'+top+'px"><i class="day-v01-dot"></i><div class="day-v01-label"><b>'+(meal?"🍽 ":"● ")+title+'</b><small>'+hm(e.ts)+'</small></div></div>'}
 const today=new Date();today.setHours(0,0,0,0);if(d0===today.getTime()){const now=Date.now();if(now>=d0&&now<=end)h+='<div class="day-v01-now" style="top:'+y(mins(now,d0))+'px"><span>'+hm(now)+' ЗАРАЗ</span></div>'}
 h+='</div><div class="day-v01-note">DAY V0.1 · read-only · наявні дані HealthLab</div>';host.innerHTML=h;
 if(d0===today.getTime()&&!host.dataset.autoScrolled){host.dataset.autoScrolled="1";requestAnimationFrame(()=>{const nowY=y(mins(Date.now(),d0));window.scrollTo({top:Math.max(0,nowY-window.innerHeight*.52),behavior:"auto"})})}
}
window.addEventListener("healthlab:daydata",e=>render(e.detail));
window.addEventListener("pageshow",()=>{if(last)render(last)});
})();