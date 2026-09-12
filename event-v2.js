(function(){
  const SUPABASE='https://ttvlgfzvgjcbomdlddbn.supabase.co';
  const PUB='sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y';
  const EVENT_API=SUPABASE+'/functions/v1/healthlab-event-v2';
  const SESSION_KEY='healthlab_event_v2_session';
  const RETURN_KEY='healthlab_event_v2_return';
  const $v=id=>document.getElementById(id);
  const saveBtn=$v('saveEvent'), photoInput=$v('eventPhoto');
  if(!saveBtn||!photoInput)return;

  const legacySaveHandler=saveBtn.onclick;
  const legacyMarkerHandlers=new Map();
  document.querySelectorAll('[data-marker]').forEach(b=>legacyMarkerHandlers.set(b,b.onclick));

  function esc2(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmtLocalInput(d=new Date()){const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  function nowIsoFromInput(){const v=$v('eventWhen')?.value;const d=v?new Date(v):new Date();return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString()}
  function browserTz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Oslo'}catch{return 'Europe/Oslo'}}
  function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
  function clearSession(){localStorage.removeItem(SESSION_KEY)}
  function normalizeSession(x){if(!x?.access_token)return null;const exp=x.expires_at?Number(x.expires_at)*1000:Date.now()+Number(x.expires_in||3600)*1000;return{access_token:x.access_token,refresh_token:x.refresh_token||'',expires_at:exp}}

  async function refreshSession(){
    const s=loadSession();if(!s?.refresh_token)return null;
    const r=await fetch(SUPABASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
    if(!r.ok){clearSession();return null}const d=await r.json();const n=normalizeSession(d);if(n)saveSession(n);return n;
  }
  async function ensureSession(){const s=loadSession();if(!s)return null;if(Number(s.expires_at||0)>Date.now()+60000)return s;return await refreshSession()}
  function captureAuthHash(){
    if(!location.hash||!location.hash.includes('access_token='))return false;
    const p=new URLSearchParams(location.hash.slice(1));const n=normalizeSession({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_at:p.get('expires_at'),expires_in:p.get('expires_in')});
    if(n){saveSession(n);history.replaceState({},document.title,location.pathname+location.search);return true}return false;
  }

  async function authRequest(api,opt={}){
    let s=await ensureSession();if(!s)return{ok:false,status:401,data:{error:'login_required'}};
    const url=EVENT_API+'?api='+encodeURIComponent(api)+(opt.query?'&'+opt.query:'');
    const headers={apikey:PUB,Authorization:'Bearer '+s.access_token,...(opt.headers||{})};
    let r=await fetch(url,{...opt,headers});
    if(r.status===401){s=await refreshSession();if(!s)return{ok:false,status:401,data:{error:'login_required'}};headers.Authorization='Bearer '+s.access_token;r=await fetch(url,{...opt,headers})}
    let data;const ct=r.headers.get('content-type')||'';try{data=ct.includes('application/json')?await r.json():await r.text()}catch{data=null}
    return{ok:r.ok,status:r.status,data};
  }
  async function secureEvents(limit=100){const q='limit='+limit;const r=await authRequest('events',{method:'GET',query:q});return r.ok&&Array.isArray(r.data)?r.data:[]}

  function injectUi(){
    const box=document.querySelector('#journalView .journal-box');if(!box||$v('eventV2Security'))return;
    const sec=document.createElement('div');sec.id='eventV2Security';sec.className='event-v2-security legacy';sec.innerHTML='<div class="event-v2-status"><span id="eventV2Badge" class="event-v2-badge">🔓 Legacy режим</span><button id="eventV2Logout" class="event-v2-logout" style="display:none">Вийти</button></div><div id="eventV2Login" class="event-v2-login"><input id="eventV2Email" type="email" inputmode="email" autocomplete="email" placeholder="Email для приватного входу"><button id="eventV2LoginBtn">🔒 Увійти</button></div><div id="eventV2AuthMsg" class="event-v2-note">Текст можна записувати як раніше. Фото та приватний Event v2 увімкнуться після одноразового входу.</div>';
    box.insertBefore(sec,box.firstChild);
    const quick=box.querySelector('.quick-types');
    const tm=document.createElement('div');tm.className='event-v2-time';tm.innerHTML='<div class="event-v2-time-label">Час події</div><input id="eventWhen" type="datetime-local"><button id="eventWhenNow" type="button">Зараз</button>';
    quick?.after(tm);$v('eventWhen').value=fmtLocalInput();
    const msg=$v('journalMsg');const meta=document.createElement('div');meta.id='eventPhotoMeta';meta.className='event-v2-photo-meta';msg.before(meta);
    const prev=document.createElement('img');prev.id='eventPhotoPreview';prev.className='event-v2-preview';prev.alt='Вибране фото';meta.after(prev);
    const ai=document.createElement('div');ai.id='eventAiResult';ai.className='event-v2-ai';prev.after(ai);
    $v('eventWhenNow').onclick=()=>{$v('eventWhen').value=fmtLocalInput()};
    $v('eventV2LoginBtn').onclick=requestMagicLink;$v('eventV2Logout').onclick=logout;
  }

  async function requestMagicLink(){
    const email=String($v('eventV2Email')?.value||'').trim();if(!email)return setAuthMsg('Введи email.');
    setAuthMsg('Надсилаю приватне посилання…');
    const redirect=location.origin+location.pathname;
    const r=await fetch(SUPABASE+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:false})});
    if(r.ok){localStorage.setItem(RETURN_KEY,'1');setAuthMsg('✓ Посилання надіслано. Відкрий лист на цьому телефоні; після повернення HealthLab збереже сесію.')}
    else{let d={};try{d=await r.json()}catch{}setAuthMsg('Вхід не надіслано: '+(d.msg||d.error_description||d.error||r.status))}
  }
  async function logout(){const s=loadSession();if(s?.access_token){try{await fetch(SUPABASE+'/auth/v1/logout',{method:'POST',headers:{apikey:PUB,Authorization:'Bearer '+s.access_token}})}catch{}}clearSession();await renderAuth()}
  function setAuthMsg(t){if($v('eventV2AuthMsg'))$v('eventV2AuthMsg').textContent=t}
  async function renderAuth(){const s=await ensureSession(),sec=$v('eventV2Security');if(!sec)return;if(s){sec.classList.remove('legacy');sec.classList.add('secure');$v('eventV2Badge').textContent='🔒 Приватний Event v2';$v('eventV2Login').style.display='none';$v('eventV2Logout').style.display='inline-block';setAuthMsg('Фото зберігаються у приватному bucket; події прив’язані до твого HealthLab user/person.')}else{sec.classList.add('legacy');sec.classList.remove('secure');$v('eventV2Badge').textContent='🔓 Legacy режим';$v('eventV2Login').style.display='grid';$v('eventV2Logout').style.display='none';setAuthMsg('Текст можна записувати як раніше. Фото та приватний Event v2 увімкнуться після одноразового входу.')}}

  photoInput.onchange=()=>{
    const f=photoInput.files?.[0],meta=$v('eventPhotoMeta'),prev=$v('eventPhotoPreview'),ai=$v('eventAiResult');if(ai){ai.classList.remove('show');ai.textContent=''};
    if(!f){meta?.classList.remove('show');prev?.classList.remove('show');return}
    meta.textContent=`Фото вибрано: ${f.name||'camera'} · ${(f.size/1024/1024).toFixed(2)} МБ. У secure режимі воно буде приватно завантажене та прив’язане до події.`;meta.classList.add('show');
    if(prev){prev.src=URL.createObjectURL(f);prev.classList.add('show')}
  };

  async function secureSave(){
    const title=$v('eventText').value.trim();if(!title){$v('journalMsg').textContent='Спочатку скажи або напиши подію.';return}
    const s=await ensureSession();const f=photoInput.files?.[0]||null;
    if(!s){if(f){$v('journalMsg').textContent='Фото не відправляю через відкритий legacy endpoint. Спочатку натисни 🔒 Увійти.';return}return legacySaveHandler?.call(saveBtn)}
    saveBtn.disabled=true;$v('journalMsg').textContent='🔒 Записую Event v2…';
    try{
      const er=await authRequest('event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,event_type:typeof eventType!=='undefined'?eventType:'note',occurred_at:nowIsoFromInput(),timezone:browserTz(),input_mode:'web-v2',details:{client_timezone:browserTz(),photo_selected:!!f}})});
      if(!er.ok)throw new Error(er.data?.error||('event HTTP '+er.status));const event=Array.isArray(er.data)?er.data[0]:er.data;const id=event?.id;if(!id)throw new Error('event id missing');
      let attachment=null,analysis=null;
      if(f){$v('journalMsg').textContent='🔒 Подію записано. Завантажую фото…';const fd=new FormData();fd.append('file',f,f.name||'photo.jpg');const pr=await authRequest('photo',{method:'POST',query:'event_id='+encodeURIComponent(id),body:fd});if(!pr.ok)throw new Error(pr.data?.error||('photo HTTP '+pr.status));attachment=pr.data?.attachment;
        if(attachment?.id){$v('journalMsg').textContent='🔒 Фото збережено. Аналізую…';analysis=await authRequest('analyze',{method:'POST',query:'id='+encodeURIComponent(attachment.id)});renderAnalysis(analysis)}
      }
      $v('eventText').value='';photoInput.value='';$v('eventWhen').value=fmtLocalInput();$v('eventPhotoMeta')?.classList.remove('show');$v('eventPhotoPreview')?.classList.remove('show');
      if(!f)$v('journalMsg').textContent='✓ 🔒 Записано в приватний HealthLab Event v2';else if(analysis?.ok)$v('journalMsg').textContent='✓ 🔒 Подія + фото + AI-аналіз збережені';else if(analysis?.status===503)$v('journalMsg').textContent='✓ 🔒 Подія + фото збережені. AI-ключ ще не підключений; аналіз не втрачено — його можна запустити пізніше.';else $v('journalMsg').textContent='✓ 🔒 Подія + фото збережені; AI-аналіз потребує повтору.';
      await Promise.all([typeof loadTimeline==='function'?loadTimeline():Promise.resolve(),typeof loadStateEvents==='function'?loadStateEvents():Promise.resolve()]);if(typeof renderStateLab==='function')renderStateLab();
    }catch(e){$v('journalMsg').textContent='Event v2 помилка: '+e.message}finally{saveBtn.disabled=false}
  }
  function renderAnalysis(r){const box=$v('eventAiResult');if(!box)return;box.classList.add('show');if(r?.ok){const a=r.data?.analysis?.result||r.data?.analysis||r.data;box.innerHTML='<strong>🤖 AI-аналіз фото</strong>'+esc2(typeof a==='string'?a:JSON.stringify(a,null,2))}else if(r?.status===503){box.innerHTML='<strong>🤖 AI-аналіз</strong>Фото приватно збережене. Серверний vision API key ще не налаштований.'}else{box.innerHTML='<strong>🤖 AI-аналіз</strong>Не завершився; фото лишилося приватно збереженим.'}}

  async function secureMarker(btn){
    const s=await ensureSession();if(!s){const legacy=legacyMarkerHandlers.get(btn);return legacy?.call(btn)}
    const title=btn.dataset.marker||'MARKER',type=btn.dataset.markerType||'marker';$v('journalMsg').textContent='🔒 Записую '+title+'…';
    const r=await authRequest('event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,event_type:type,occurred_at:new Date().toISOString(),timezone:browserTz(),input_mode:'marker-v2',details:{protocol:'state-engine-calibration-v0'}})});
    $v('journalMsg').textContent=r.ok?'✓ 🔒 '+title:'Помилка Event v2: '+(r.data?.error||r.status);if(r.ok){await Promise.all([loadTimeline(),loadStateEvents()]);renderStateLab()}
  }

  async function mergedEvents(limit=100){
    let legacy=[];try{legacy=await api({api:'timeline',limit})}catch{}const secure=await secureEvents(limit);const all=[...(Array.isArray(legacy)?legacy:[]).map(x=>({...x,_secure:false})),...secure.map(x=>({...x,_secure:true}))];
    const seen=new Set();return all.filter(x=>{const k=(x._secure?'s:':'l:')+(x.id||x.occurred_at+'|'+x.title);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at)).slice(0,limit)
  }

  const secureLoadTimeline=async()=>{try{const rs=await mergedEvents(50);$v('timelineRows').innerHTML=rs.length?rs.map(r=>`<div class="row-card"><div class="timeline-event-time">${esc2(r.event_type||'подія')} · ${fmt(new Date(r.occurred_at).getTime())}${r._secure?'<span class="timeline-event-secure">🔒 v2</span>':''}</div><div class="timeline-event-title">${esc2(r.title)}</div></div>`).join(''):'<div class="status">Подій ще немає</div>'}catch(e){$v('timelineRows').innerHTML='<div class="status">'+esc2(e.message)+'</div>'}};
  const secureLoadStateEvents=async()=>{try{const rs=await mergedEvents(200),start=windowStart();stateEvents=rs.map(e=>({...e,ts:new Date(e.occurred_at).getTime()})).filter(e=>Number.isFinite(e.ts)&&e.ts>=start).sort((a,b)=>a.ts-b.ts)}catch{stateEvents=[]}};

  injectUi();captureAuthHash();
  saveBtn.onclick=secureSave;
  document.querySelectorAll('[data-marker]').forEach(b=>b.onclick=()=>secureMarker(b));
  try{loadTimeline=secureLoadTimeline;loadStateEvents=secureLoadStateEvents}catch{}
  renderAuth().then(async()=>{if(localStorage.getItem(RETURN_KEY)==='1'&&await ensureSession()){localStorage.removeItem(RETURN_KEY);try{openJournal()}catch{}await secureLoadTimeline();await secureLoadStateEvents();if(typeof renderStateLab==='function')renderStateLab()}});
})();