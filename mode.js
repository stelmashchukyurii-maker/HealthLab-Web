const HL_MODE_KEY='healthlab.ui.mode.v1';

function hlSavedMode(){
  const q=new URLSearchParams(location.search).get('mode');
  if(q==='user'||q==='research')return q;
  const s=localStorage.getItem(HL_MODE_KEY);
  return s==='research'?'research':'user';
}
function hlSetMode(mode,{navigate=false}={}){
  mode=mode==='research'?'research':'user';
  localStorage.setItem(HL_MODE_KEY,mode);
  const isResearchPage=document.body.classList.contains('research-page');
  if(isResearchPage&&mode==='user'){
    location.href='./index.html?mode=user';
    return;
  }
  document.body.classList.toggle('mode-user',mode==='user');
  document.body.classList.toggle('mode-research',mode==='research');
  document.querySelectorAll('[data-hl-mode]').forEach(el=>el.classList.toggle('active',el.dataset.hlMode===mode));
  document.querySelectorAll('[data-hl-mode-caption]').forEach(el=>el.textContent=mode==='user'?'Простий щоденний огляд':'Повні сигнали, якість і дослідницькі інструменти');
  if(mode==='research'){
    requestAnimationFrame(()=>{
      try{window.renderPulse?.();window.renderStateLab?.();window.dispatchEvent(new Event('resize'));}catch{}
    });
  }
  if(navigate&&mode==='research'&&location.pathname.endsWith('index.html'))location.hash='research';
}

function hlInstallModeSwitch(){
  document.querySelectorAll('[data-hl-mode]').forEach(el=>{
    el.addEventListener('click',ev=>{
      if(el.tagName==='A')return;
      ev.preventDefault();
      hlSetMode(el.dataset.hlMode);
    });
  });
}
function hlMoodForState(state){
  const s=(state||'').toUpperCase();
  if(s.includes('СОН'))return ['😴','Сон','Організм зараз у стані сну.'];
  if(s.includes('ВІДПОЧИНОК'))return ['🙂','Спокійний стан','Навантаження зараз близьке до спокійного рівня.'];
  if(s.includes('РУХ'))return ['🚶','Фізичне навантаження','Зараз переважає фізична активність.'];
  if(s.includes('ВІДНОВЛЕНН'))return ['🙂','Відновлення','Організм відновлюється після недавнього руху.'];
  if(s.includes('АВТОНОМНЕ'))return ['😕','Навантаження на організм вище','Є ознаки підвищеного автономного навантаження. Це не обов’язково емоційний стрес.'];
  return ['😐','Даних недостатньо','HealthLab поки не має достатньо якісних даних для простого висновку.'];
}
function hlUpdateUserState(){
  const src=document.getElementById('stateNow');
  const mood=document.getElementById('userMood');
  const title=document.getElementById('userStateTitle');
  const text=document.getElementById('userStateText');
  if(!src||!mood||!title||!text)return;
  const [m,t,d]=hlMoodForState(src.textContent);
  mood.textContent=m;title.textContent=t;text.textContent=d;
  const hr=document.getElementById('pulseNow')?.textContent?.trim();
  const hrv=document.getElementById('hrvToday')?.textContent?.trim();
  const resp=document.getElementById('respToday')?.textContent?.trim();
  const set=(id,v,suffix)=>{const el=document.getElementById(id);if(el)el.textContent=v&&v!=='—'?`${v}${suffix}`:'—'};
  set('userHr',hr,' уд/хв');set('userHrv',hrv,' мс');set('userResp',resp,' /хв');
}
function hlTrendChip(label,arrow){
  const icon=arrow==='↑'?'↗':arrow==='↓'?'↘':'→';
  return `<span class="user-direction-chip">${label} ${icon}</span>`;
}
function hlUpdateUserTrend(){
  const src=document.getElementById('trendSummary');
  const box=document.getElementById('userTrendSummary');
  const chips=document.getElementById('userTrendChips');
  if(!src||!box||!chips)return;
  const txt=src.textContent.trim();
  if(!txt||txt.includes('Формую')||txt.includes('недоступний')){box.textContent='Напрямок ще формується.';chips.innerHTML='';return}
  const parts=txt.split('·').map(x=>x.trim()).filter(Boolean);
  const friendly=[];const out=[];
  parts.forEach(p=>{
    const m=p.match(/(.+?)\s*([↑↓→])$/);if(!m)return;
    const name=m[1].trim(),arrow=m[2];out.push(hlTrendChip(name,arrow));
    if(/HRV/i.test(name))friendly.push(arrow==='↑'?'HRV покращується':arrow==='↓'?'HRV знижується':'HRV стабільний');
    else if(/пульс/i.test(name))friendly.push(arrow==='↓'?'пульс спокою нижчий':arrow==='↑'?'пульс спокою вищий':'пульс спокою стабільний');
    else if(/сон/i.test(name))friendly.push(arrow==='↑'?'сну більше':arrow==='↓'?'сну менше':'сон стабільний');
  });
  box.textContent=friendly.length?friendly.join(' · '):txt;
  chips.innerHTML=out.join('');
}
function hlObserveSimple(){
  ['stateNow','pulseNow','hrvToday','respToday','trendSummary'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    new MutationObserver(()=>{hlUpdateUserState();hlUpdateUserTrend()}).observe(el,{childList:true,subtree:true,characterData:true});
  });
  hlUpdateUserState();hlUpdateUserTrend();
}

document.addEventListener('DOMContentLoaded',()=>{
  hlInstallModeSwitch();
  const isResearchPage=document.body.classList.contains('research-page');
  const initial=isResearchPage?'research':hlSavedMode();
  hlSetMode(initial);
  hlObserveSimple();
});