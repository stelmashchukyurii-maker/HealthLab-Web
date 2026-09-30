(()=>{
  if(window.__florivoFutureCalendarLoaded)return;
  window.__florivoFutureCalendarLoaded=true;
  const $=id=>document.getElementById(id);
  const today0=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate())};
  const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  let futureDate=null, seq=0, sb=null;
  const isFuture=()=>futureDate&&futureDate>today0();
  async function client(){if(sb)return sb;const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');sb=createClient('https://ttvlgfzvgjcbomdlddbn.supabase.co','sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return sb}
  function setDateLabel(){if(!futureDate)return;const b=$('date');if(b)b.textContent=futureDate.toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});const next=$('next');if(next)next.disabled=false;const dbg=$('navDebug');if(dbg)dbg.textContent='CALENDAR · FUTURE · '+isoDay(futureDate)}
  function futureShell(){
    const health=document.querySelector('.healthCard');if(health)health.hidden=true;
    const legend=document.querySelector('.legend');if(legend)legend.hidden=false;
    const st=$('stage');if(st){st.hidden=false;st.style.height='auto';st.style.minHeight='0';st.innerHTML='<div id="futureCalendarList" style="padding:10px 2px 30px"></div>'}
    const status=$('status');if(status){status.hidden=false;status.className='status ok';status.textContent='Майбутній день · календарні події та PLAN'}
    const form=$('addForm');if(form)form.hidden=true;
    setDateLabel();
  }
  async function renderFuture(){
    const my=++seq;futureShell();const list=$('futureCalendarList');if(!list)return;
    list.innerHTML='<div class="status">Читаю календар…</div>';
    const c=await client(),{data:{session}}=await c.auth.getSession();if(my!==seq)return;
    if(!session){list.innerHTML='<div class="status bad">Потрібно увійти у Florivo Chat.</div>';return}
    const d=futureDate,e=addDays(d,1),{data,error}=await c.from('hl_timeline_item').select('id,truth_kind,category,title,start_at,end_at,status').gte('start_at',d.toISOString()).lt('start_at',e.toISOString()).is('deleted_at',null).order('start_at');
    if(my!==seq)return;if(error){list.innerHTML='<div class="status bad">Calendar: '+esc(error.message)+'</div>';return}
    const rows=data||[];
    list.innerHTML='<button id="futureAdd" type="button" style="width:100%;height:42px;border:1px solid #355070;border-radius:12px;background:#173c2a;color:#dff7e7;font-weight:850;margin-bottom:10px">＋ Додати майбутню подію</button>'+(rows.length?rows.map(x=>`<div data-future-id="${esc(x.id)}" style="padding:11px;margin:7px 0;border:1px solid #294461;border-left:4px solid #52a8ff;border-radius:10px;background:#0c1828"><b>${esc(x.truth_kind)}</b> · ${esc(x.category||'OTHER')}<br>${esc(x.title)} · ${new Date(x.start_at).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</div>`).join(''):'<div class="status ok">На цей день подій ще немає.</div>');
    $('futureAdd')?.addEventListener('click',()=>openFutureForm());
  }
  function openFutureForm(){
    const list=$('futureCalendarList');if(!list)return;
    const categories=['OTHER','WORK','DOCTOR','TRAVEL','COURSE','APPOINTMENT','MEAL','SLEEP','NOTE'];
    list.insertAdjacentHTML('afterbegin',`<div id="futureForm" class="addForm" style="display:block;margin-bottom:10px"><div class="addRow"><input id="futureTime" type="time" value="12:00"><select id="futureCategory">${categories.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div><input id="futureTitle" type="text" maxlength="200" placeholder="Подія / обмеження"><div class="addActions"><button id="futureCancel" type="button">Скасувати</button><button id="futureSave" class="save" type="button">Зберегти PLAN</button></div></div>`);
    $('futureAdd')?.setAttribute('disabled','');$('futureCancel').onclick=()=>renderFuture();$('futureSave').onclick=saveFuture;
  }
  async function saveFuture(){
    const title=$('futureTitle')?.value.trim(),time=$('futureTime')?.value,category=$('futureCategory')?.value||'OTHER';if(!title||!time)return;
    const c=await client(),{data:{session}}=await c.auth.getSession();if(!session)return;
    const [h,m]=time.split(':').map(Number),d=futureDate,start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,m);$('futureSave').disabled=true;
    const {error}=await c.from('hl_timeline_item').insert({owner_id:session.user.id,truth_kind:'PLAN',category,title,start_at:start.toISOString(),timezone:'Europe/Oslo',source_type:'USER'});
    if(error){$('futureSave').disabled=false;alert('Не вдалося зберегти: '+error.message);return}await renderFuture();
  }
  function leaveFuture(){futureDate=null;location.reload()}
  function goto(d){if(d<=today0()){leaveFuture();return}futureDate=d;renderFuture()}
  function capture(id,fn){$(id)?.addEventListener('click',e=>{if(!isFuture()&&id!=='next'&&id!=='date')return;e.preventDefault();e.stopImmediatePropagation();fn()},{capture:true})}
  capture('next',()=>goto(isFuture()?addDays(futureDate,1):addDays(today0(),1)));
  capture('prev',()=>goto(addDays(futureDate,-1)));
  capture('today',leaveFuture);
  $('date')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();let p=$('futureDatePicker');if(!p){p=document.createElement('input');p.id='futureDatePicker';p.type='date';p.style.position='fixed';p.style.left='-9999px';document.body.appendChild(p);p.onchange=()=>{if(!p.value)return;const [y,m,d]=p.value.split('-').map(Number),x=new Date(y,m-1,d);if(x>today0())goto(x);else{futureDate=null;const old=$('datePicker');if(old){old.removeAttribute('max');old.value=p.value;old.dispatchEvent(new Event('change',{bubbles:true}))}}}}p.value=isoDay(futureDate||today0());p.showPicker?.();p.click?.()},{capture:true});
  const foot=document.querySelector('.foot');if(foot)foot.textContent='DAY V0.8.14 · full future calendar layer · PLAN ≠ FACT';
})();