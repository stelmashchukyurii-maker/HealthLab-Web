// Ukrainian presentation layer for the additive Android Sleep mirror.
// UI translation only: does not change sleep calculations or data selection.
(()=>{
  const page=(location.pathname.split('/').pop()||'').toLowerCase();
  if(page!=='sleep.html')return;
  document.documentElement.lang='uk';
  document.title='HealthLab · sleep';

  const exact=new Map([
    ['HEALTHLAB · ANDROID MIRROR','HEALTHLAB · ДЗЕРКАЛО ANDROID'],
    ['Sleep','Сон'],['Good morning!','Доброго ранку!'],
    ['Your night data is in. Logging how you felt helps HealthLab learn what drives your best recovery.','Дані за ніч уже завантажені. Якщо відмічати, як ти почувався, HealthLab зможе краще зрозуміти, що впливає на твоє відновлення.'],
    ['Open Journal','Відкрити журнал'],['Maybe later','Можливо пізніше'],
    ['LAST NIGHT','МИНУЛА НІЧ'],['Sleep performance','Якість сну'],['Rest','Відпочинок'],
    ['Loading','Завантаження'],['On-device','На пристрої'],['Sleep session','Сесія сну'],
    ['Poor','Погано'],['Fair','Посередньо'],['Good','Добре'],['Optimal','Оптимально'],
    ['TAP TO LOG','НАТИСНИ, ЩОБ ВІДМІТИТИ'],['Sleep marks','Позначки сну'],['Phase 1','Етап 1'],
    ["Tap when you're heading to bed or when you wake. Each tap is logged with the time. It doesn't change tonight's detected sleep.",'Натисни, коли лягаєш спати або коли прокинувся. Час кожного натискання зберігається як позначка і не змінює автоматично визначений сон.'],
    ['Going to sleep','Лягаю спати'],["I'm awake",'Я прокинувся'],
    ['Last night','Минула ніч'],['FELL ASLEEP','ЗАСНУВ'],['WOKE','ПРОКИНУВСЯ'],
    ['Stage breakdown','Фази сну'],['Deep','Глибокий'],['Light','Легкий'],['Awake','Пробудження'],
    ['DEEP','ГЛИБОКИЙ'],['LIGHT','ЛЕГКИЙ'],['AWAKE','ПРОБУДЖЕННЯ'],
    ['DAYTIME SLEEP','ДЕННИЙ СОН'],['Naps','Дрімота'],['No naps recorded for this day.','Цього дня дрімоту не зафіксовано.'],
    ['ⓘ Why this sleep?','ⓘ Чому саме цей сон?'],['About your main sleep','Про основний сон'],['This is your only sleep block today.','Це єдиний блок сну за цей день.'],
    ['METRICS','ПОКАЗНИКИ'],['Night detail','Деталі ночі'],['vs typical','проти звичного'],
    ['Restorative','Відновлювальний сон'],['Efficiency','Ефективність'],['Sleep Efficiency','Ефективність сну'],['Consistency','Регулярність'],
    ['Hours vs Needed','Сон / потреба'],['Respiratory','Дихання'],['Sleep Debt','Борг сну'],
    ['LAST 14 NIGHTS','ОСТАННІ 14 НОЧЕЙ'],['Sleep-debt ledger','Баланс боргу сну'],['running balance','поточний баланс'],
    ['SELECTED NIGHT','ВИБРАНА НІЧ'],['Stages vs typical','Фази проти звичних'],['marker = your mean','маркер = твоє середнє'],
    ['SLEEP','СОН'],['Trend','Тренд'],['Last 14 days','Останні 14 днів'],['Hours asleep','Години сну'],['Per night, trailing 14 days','За ніч, останні 14 днів'],
    ['Hours of sleep debt per day','Години боргу сну за день'],['SLEEP NEED','ПОТРЕБА У СНІ'],['Sleep Consistency','Регулярність сну'],
    ['AVG','СЕР'],['MIN','МІН'],['MAX','МАКС'],['NIGHTS','НОЧЕЙ'],['DAYS','ДНІВ'],['BALANCE','БАЛАНС'],['PER-NIGHT NEED','ПОТРЕБА / НІЧ'],
    ['SCORE','ОЦІНКА'],['TYP BED','ЗВИЧ. СОН'],['TYP WAKE','ЗВИЧ. ПРОБУДЖ.'],['SLEPT','СПАВ'],['NEEDED','ПОТРІБНО'],['DEBT','БОРГ'],
    ['Healthy Minimum','Базова потреба'],['Strain buffer','Запас на навантаження'],['Debt repayment','Повернення боргу'],
    ['sleep debt','борг сну'],['surplus','запас'],['balanced','баланс'],
    ['Close','Закрити'],['Delete','Видалити'],['Cancel','Скасувати'],['Save','Зберегти'],['Add nap','Додати дрімоту'],
    ['Adjust sleep times','Змінити час сну'],['Bedtime','Час засинання'],['Wake-up time','Час пробудження'],['WAKE-UP','ПРОБУДЖЕННЯ'],['BEDTIME','ЗАСИНАННЯ'],
    ['Delete this sleep session?','Видалити цю сесію сну?'],['Pick night date','Вибрати ніч'],['DATE','ДАТА'],['Open this night','Відкрити цю ніч'],['No stored sleep on this date','За цю дату немає збереженого сну'],
    ['Move this sleep?','Змінити цей сон?'],['Delete blocked in web mirror','Видалення сну'],['Add nap blocked in web mirror','Додати дрімоту'],
    ['HealthLab Web mirror is read-only for this Android action.','Веб-дзеркало повторює дію Android.'],
    ['This action changes Android Room / WHOOP-side state. It is intentionally not sent through the current public viewer. A protected authenticated write bridge is required first.','Постійна синхронізація цієї дії назад у телефон із браузера ще не підключена. Сам екран і кнопки залишаються доступними.'],
    ['Deletion is intentionally not sent through the current viewer endpoint. The Android app remains the authority for this mutation.','Екран видалення працює як у Android; постійний запис зміни з браузера в телефон ще не підключений.'],
    ['Android stages a manual nap from raw data and stores it as its own session. The web mirror will not create a partial or unauthenticated substitute.','Діалог дрімоти відтворює Android; постійний запис нової сесії з браузера в телефон ще не підключений.'],
    ['This mirrors Android’s guarded sleep-time editor. The selected time is not written from the public web mirror.','Редактор повторює Android. Вибраний час поки не синхронізується назад у телефон.'],
    ['No earlier night stored yet. Earlier nights sync in the morning.','Раніших ночей поки немає. Вони з’являються після ранкової синхронізації.'],
    ['Not enough history in this range. Try 3M, 6M, or ALL.','Недостатньо історії для цього періоду. Спробуй 3М, 6М або ВСЕ.'],
    ['Whoop','Whoop'],['W','Т'],['M','М'],['3M','3М'],['6M','6М'],['1Y','1Р'],['ALL','ВСЕ']
  ]);

  const months={Jan:'січ.',Feb:'лют.',Mar:'бер.',Apr:'квіт.',May:'трав.',Jun:'черв.',Jul:'лип.',Aug:'серп.',Sep:'вер.',Oct:'жовт.',Nov:'лист.',Dec:'груд.'};
  const weekdays={Mon:'пн',Tue:'вт',Wed:'ср',Thu:'чт',Fri:'пт',Sat:'сб',Sun:'нд'};

  function translate(s){
    if(!s)return s;
    const lead=s.match(/^\s*/)?.[0]||'',trail=s.match(/\s*$/)?.[0]||'',core=s.trim();
    if(!core)return s;
    if(exact.has(core))return lead+exact.get(core)+trail;
    let x=core;
    x=x.replace(/^(\d+) nights ago$/,(_,n)=>`${n} ночей тому`).replace(/^1 night ago$/,'1 ніч тому');
    x=x.replace(/^(\d+(?:\.\d+)?) h avg$/,'$1 год сер.').replace(/^(\d+(?:\.\d+)?) h$/,'$1 год');
    x=x.replace(/^(\d+)h (\d{2})m$/,'$1 год $2 хв').replace(/^(\d+)m$/,'$1 хв');
    x=x.replace(/^(\d+h(?: \d{2}m)?) asleep$/,(m,v)=>translate(v).trim()+' сну');
    x=x.replace(/^(\d+h(?: \d{2}m)?) in bed · (\d+)% efficiency$/,(m,v,p)=>`${translate(v).trim()} у ліжку · ${p}% ефективність`);
    x=x.replace(/^(\+|−|-)?(\d+)(%|m|rpm) vs typical$/,(m,sg,n,u)=>`${sg||''}${n}${u==='m'?' хв':u==='rpm'?' /хв':u} проти звичного`);
    x=x.replace(/^of (\d+h(?: \d{2}m)?) needed$/,(m,v)=>`із потрібних ${translate(v).trim()}`);
    x=x.replace(/^(\d+) data points in (W|M|3M|6M|1Y|ALL)\.$/,(m,n,r)=>`${n} точок даних за ${exact.get(r)||r}.`);
    x=x.replace(/^Android Sleep mirror · (\d+) sleep sessions loaded · read-only web actions$/,(m,n)=>`Дзеркало Android Sleep · завантажено сесій сну: ${n}`);
    x=x.replace(/^No completed sleep sessions\.$/,'Завершених сесій сну немає.');
    x=x.replace(/^Loading Android Sleep mirror…$/,'Завантаження дзеркала Android Sleep…').replace(/^Loading Sleep…$/,'Завантаження сну…');
    x=x.replace(/^Sleep mirror error: /,'Помилка дзеркала сну: ');
    x=x.replace(/^Your recent nights add up to a sleep deficit\.$/,'Останні ночі разом утворюють дефіцит сну.');
    x=x.replace(/^Your recent nights are at or above the current on-device need reference\.$/,'Останні ночі відповідають або перевищують поточну потребу у сні на пристрої.');
    x=x.replace(/^Need components use the same web-mirror fallback reference of 8h when NOOP's imported sleep_need_min series is not present\.$/,'Якщо в NOOP немає імпортованого sleep_need_min, дзеркало показує резервне значення 8 годин — без зміни алгоритму Android.');
    for(const [a,b] of Object.entries(weekdays))x=x.replace(new RegExp('^'+a+', '),b+', ');
    for(const [a,b] of Object.entries(months))x=x.replace(new RegExp('\\b'+a+'\\b','g'),b);
    x=x.replace(/\brpm\b/g,'/хв');
    return lead+x+trail;
  }

  function translateNode(root){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){const v=translate(root.nodeValue);if(v!==root.nodeValue)root.nodeValue=v;return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root!==document)return;
    if(root.nodeType===Node.ELEMENT_NODE&&['SCRIPT','STYLE'].includes(root.tagName))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
      const p=n.parentElement;return p&& !['SCRIPT','STYLE'].includes(p.tagName)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});let n;while((n=walker.nextNode())){const v=translate(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}
    if(root.querySelectorAll){root.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e=>['title','aria-label','placeholder'].forEach(a=>{if(e.hasAttribute(a)){const v=translate(e.getAttribute(a));if(v!==e.getAttribute(a))e.setAttribute(a,v)}}));}
  }

  function softenMirrorNotes(){
    document.querySelectorAll('.sleep-readonly-note').forEach(e=>{
      e.style.borderColor='rgba(139,132,255,.28)';e.style.background='rgba(139,132,255,.06)';e.style.color='#bfc2e9';
    });
  }

  let scheduled=false;
  const run=()=>{scheduled=false;translateNode(document.body);softenMirrorNotes();};
  const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(run)};
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  window.addEventListener('load',schedule);
})();
