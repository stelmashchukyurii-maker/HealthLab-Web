(()=>{
const host=document.getElementById('referenceRegistry');
if(!host)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fetch('./lab-references.json',{cache:'no-store'}).then(r=>r.json()).then(items=>{
  if(!Array.isArray(items)||!items.length){host.innerHTML='<div class="ref-empty">Контрольних вимірювань поки немає.</div>';return}
  host.innerHTML=items.slice().reverse().map(ep=>`<article class="ref-card">
    <div class="ref-head"><div><div class="ref-kicker">КОНТРОЛЬНЕ ВИМІРЮВАННЯ · ${esc(ep.date)}</div><h3>${esc(ep.title)}</h3></div><span class="ref-status">${esc(ep.status)}</span></div>
    <p class="ref-conditions">${esc(ep.conditions)}</p>
    <div class="ref-phases">${(ep.phases||[]).map(p=>`<section class="ref-phase">
      <div class="ref-phase-head"><b>${esc(p.name)}</b><span>${esc(p.time)}</span></div>
      <div class="ref-phase-status">${esc(p.status)}</div>
      <ul>${(p.metrics||[]).map(m=>`<li>${esc(m)}</li>`).join('')}</ul>
      <p>${esc(p.note)}</p>
    </section>`).join('')}</div>
    <div class="ref-quality"><b>Якість / обмеження:</b> ${esc(ep.qualityNote)}</div>
  </article>`).join('');
}).catch(e=>{host.innerHTML='<div class="ref-empty">Не вдалося завантажити контрольні вимірювання.</div>'});
})();
