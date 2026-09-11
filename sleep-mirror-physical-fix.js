// SUPERSEDED / NO-OP — 2026-09-11
// This file is intentionally kept in the repository for traceability.
// Physical phone pass #1 showed display issues, but the user explicitly chose
// Android-mirror fidelity over web-side algorithm corrections.
// Therefore this script MUST NOT alter sleep debt, averages, usable-night
// filtering, metric tiles, or any other Android Sleep calculation.
(()=>{
  if((location.pathname.split('/').pop()||'').toLowerCase()!=='sleep.html')return;
  console.info('HealthLab Sleep: physical-fix algorithm override disabled; mirror fidelity mode active.');
})();
