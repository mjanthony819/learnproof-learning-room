/* LearnProof v3 application layer. Depends on LPCore, LPLabs and LESSONS
   (the embedded lesson packs). No network, no analytics, no build step. */
'use strict';
const C=LPCore,Labs=LPLabs,$=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN=n=>Number.isInteger(n)?String(n):n.toFixed(1);

/* ---------- state ---------- */
const defaultLab=type=>{
  if(type==='deadlock')return {owners:{X:'A',Y:'B',Z:null},waits:{A:'Y',B:'X',C:null}};
  if(type==='scheduling')return {jobs:[{id:'P1',arrival:0,burst:24},{id:'P2',arrival:0,burst:3},{id:'P3',arrival:0,burst:3}],policy:'fcfs',quantum:4,prediction:''};
  if(type==='paging')return {refs:'1,2,3,4,1,2,5,1,2,3,4,5',frames:3,policy:'fifo',prediction:''};
  if(type==='transactions')return {ops:[{t:'A',op:'R',item:'X'},{t:'B',op:'W',item:'X'},{t:'B',op:'W',item:'Y'},{t:'A',op:'R',item:'Y'}],prediction:null};
  return {};
};
const defaultSession=()=>({view:'home',stage:'pre',index:0,
  answers:{pre:{},practice:{},post:{},recall:{}},confidence:{pre:{},practice:{},post:{},recall:{}},
  completedAt:null,recallCompletedAt:null,done:[],read:[],imported:false,labRevealed:false});
const defaultRoot=()=>({v:3,view:'library',roomId:null,
  settings:{remember:false,textSize:'standard',typeface:'default',voiceName:'',voiceLang:''},lessons:{}});
let S=defaultRoot();
function lessonById(id){return LESSONS.find(l=>l.id===id)}
function session(id){
  if(!S.lessons[id])S.lessons[id]=defaultSession();
  const ss=S.lessons[id];
  if(!ss.lab||ss.labType!==lessonById(id).lab.type){ss.lab=defaultLab(lessonById(id).lab.type);ss.labType=lessonById(id).lab.type;}
  return ss;
}
function load(){
  try{
    const saved=JSON.parse(sessionStorage.getItem('lp3')||localStorage.getItem('lp3')||'null');
    if(saved&&saved.v===3&&saved.lessons)S={...defaultRoot(),...saved,settings:{...defaultRoot().settings,...(saved.settings||{})}};
  }catch(e){S=defaultRoot()}
  /* migrate the v2 single-lesson session */
  try{
    const old=JSON.parse(sessionStorage.getItem('lp2')||localStorage.getItem('lp2')||'null');
    if(old&&old.v===2&&old.answers&&!S.lessons['deadlock-v2']){
      const ss=defaultSession();
      for(const st of ['pre','post','practice','recall'])for(const q of lessonById('deadlock-v2')[st]){
        const a=old.answers[st]?.[q.id];
        if(a!==undefined&&Number.isInteger(a)&&a>=-1&&a<q.options.length){ss.answers[st][q.id]=a;ss.confidence[st][q.id]=old.confidence?.[st]?.[q.id]||'unspecified';}
      }
      ss.done=(old.done||[]).filter(x=>['pre','post','practice','recall'].includes(x));
      ss.completedAt=old.completedAt||null;ss.recallCompletedAt=old.recallCompletedAt||null;
      ss.read=old.read||[];ss.imported=!!old.imported;
      S.lessons['deadlock-v2']=ss;
      sessionStorage.removeItem('lp2');localStorage.removeItem('lp2');
    }
  }catch(e){}
}
function persist(){
  try{
    sessionStorage.setItem('lp3',JSON.stringify(S));
    if(S.settings.remember)localStorage.setItem('lp3',JSON.stringify(S));
    else localStorage.removeItem('lp3');
  }catch(e){toast('Storage is unavailable. Export your evidence reports before leaving.')}
}
function toast(t){$('#toast').textContent=t;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').textContent='',6000)}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

/* ---------- room helpers ---------- */
const L=()=>lessonById(S.roomId);
const SS=()=>session(S.roomId);
function complete(st){return SS().done.includes(st)&&L()[st].every(q=>Number.isInteger(SS().answers[st][q.id]))}
function result(st){return C.score(L(),st,SS().answers[st],SS().confidence[st])}
function need(view){
  if(view==='home'||view==='about'||view==='lab')return true;
  if(view==='baseline')return complete('pre');
  if(view==='quiz')return SS().stage==='pre'||complete('pre');
  if(view==='learn')return complete('pre');
  if(view==='feedback')return complete('practice');
  if(view==='report')return complete('post');
  return false;
}
const stages=['Start','Diagnose','Learn','Practice','Fresh check','Evidence'];

/* ---------- routing ---------- */
function parseHash(){
  const h=location.hash.replace(/^#\/?/,'');
  if(h.startsWith('room/')){const id=h.slice(5);if(lessonById(id)){S.view='room';S.roomId=id;return}}
  if(h==='my'){S.view='my';return}
  if(h==='about'){S.view='about';return}
  if(h==='access'){S.view='access';return}
  S.view='library';
}
function go(hash){stopSpeech();if(location.hash===hash)render();else location.hash=hash}
window.addEventListener('hashchange',()=>{stopSpeech();parseHash();render();$('#main').focus();window.scrollTo(0,0)});

/* ---------- speech (read-aloud) ---------- */
const speech={supported:'speechSynthesis' in window,voices:[],active:false};
function loadVoices(){if(speech.supported)speech.voices=speechSynthesis.getVoices()}
if(speech.supported){loadVoices();speechSynthesis.onvoiceschanged=loadVoices}
function stopSpeech(){if(speech.supported&&speechSynthesis.speaking)speechSynthesis.cancel();speech.active=false}
function speakMain(){
  if(!speech.supported){toast('Read-aloud is not available in this browser.');return}
  if(speech.active){stopSpeech();render();return}
  const text=$('#main').innerText.replace(/\s+\n/g,'\n').trim();
  if(!text)return;
  stopSpeech();
  const u=new SpeechSynthesisUtterance(text.slice(0,4000));
  const v=speech.voices.find(v=>v.name===S.settings.voiceName&&v.lang===S.settings.voiceLang)||speech.voices.find(v=>v.default);
  if(v)u.voice=v;
  u.onend=()=>{speech.active=false;render()};
  u.onerror=()=>{speech.active=false;render()};
  speech.active=true;speechSynthesis.speak(u);render();
}

/* ---------- shared fragments ---------- */
function evidence(L,r,showAll=true){
  return r.evidence.filter(q=>showAll||!q.right).map(q=>`<details class="evidence"><summary><span class="badge ${q.right?'':'revisit'}">${q.right?'CORRECT':'REVISIT'}</span> · ${esc(q.prompt)}</summary><div><p class="chosen">Your answer: ${esc(q.chosen)}${q.confidence!=='unspecified'?' · '+esc(q.confidence):''}</p><p><b>Supported answer:</b> ${esc(q.expected)}</p><p>${esc(q.why)}</p><p class="small muted">Source page ${q.page} · ${esc(L.concepts.find(c=>c.id===q.concept).title)}</p><blockquote>${esc(L.pages.find(p=>p.page===q.page).text)}</blockquote></div></details>`).join('');
}
function lessonStatus(id){
  const ss=S.lessons[id];
  if(!ss)return 'not';
  if(ss.done.includes('post'))return 'done';
  if(ss.done.length||Object.keys(ss.answers.pre).length)return 'started';
  return 'not';
}
function statusPill(id){
  const st=lessonStatus(id);
  return st==='done'?'<span class="status-pill done">Evidence complete</span>':st==='started'?'<span class="status-pill started">In progress</span>':'<span class="status-pill not">Not started</span>';
}
function keepCopy(){
  return `<details><summary>Keep a copy &amp; choose what is saved</summary><div><label class="setting"><input type="checkbox" id="remember" ${S.settings.remember?'checked':''}>Remember my progress on this device. Otherwise progress lasts only in this tab.</label><p class="small muted">A shared device? Leave this off and clear your session when finished. No answers are sent to a server by this learning room.</p><div class="actions"><button data-action="download-app">Save an offline copy ↓</button><button data-action="clear">Clear local session</button></div></div></details>`;
}

/* ---------- top-level views ---------- */
function library(){
  const started=LESSONS.filter(l=>lessonStatus(l.id)!=='not').length;
  const done=LESSONS.filter(l=>lessonStatus(l.id)==='done').length;
  return `<div class="hero"><div><p class="eyebrow">A STUDY SESSION WITH RECEIPTS</p><h1>Less guessing.<br>More understanding.</h1><p class="intro">Dense notes should not be the end of the story. Pick a room, find the gap, work through the idea, and check it with different questions.</p><div class="actions"><button class="primary" data-action="first-room">${started?'Continue learning':'Find my starting point'} →</button><button data-action="my">My learning</button></div><p class="small muted">No account. No upload. Works offline once saved.<br>Your scores come from your answers, not from AI.</p></div><div><div class="illustration"><p class="eyebrow">THE SYSTEMS SHELF / ${LESSONS.length} ROOMS</p>${shelfDiagram()}<p class="small muted" style="text-align:center;margin:10px 0 0">Four rooms. One honest loop in each.</p></div><button class="text small" data-action="about">How the scoring works ↗</button></div></div><div class="numbers"><div><b>${String(LESSONS.length).padStart(2,'0')}</b><span>reviewed learning rooms</span></div><div><b>06 + 06</b><span>different before / after items in each</span></div><div><b>${done} / ${started}</b><span>rooms finished / started by you</span></div></div><h2>The library</h2><div class="lesson-grid">${LESSONS.map(l=>`<div class="lesson-card ${lessonStatus(l.id)}"><div class="meta"><span>OPERATING SYSTEMS &amp; DATA</span><span>~${l.minutes} MIN</span></div><h3>${esc(l.title)}</h3><p class="small muted grow">${esc(l.summary)}</p><div class="meta">${statusPill(l.id)}${cardScore(l.id)}</div><div class="actions"><button class="primary" data-room="${l.id}">${lessonStatus(l.id)==='not'?'Enter the room':'Continue'} →</button></div></div>`).join('')}</div><div class="help-grid"><div><h3>A path, not another summary</h3><p class="small muted">Your diagnostic decides what to revise first. Practice gives explanations. A fresh check shows which concepts still need work.</p></div><div><h3>Evidence, not a promise</h3><p class="small muted">Separate questions, transparent scoring and source passages. No fabricated progress, mastery badge, or claim that this tool caused improvement.</p></div></div>${keepCopy()}`;
}
function cardScore(id){
  const ss=S.lessons[id];
  if(!ss||!ss.done.includes('post'))return '';
  try{const a=C.score(lessonById(id),'pre',ss.answers.pre,ss.confidence.pre),b=C.score(lessonById(id),'post',ss.answers.post,ss.confidence.post);const d=C.delta(a,b);return `<span class="small muted">${a.right}/${a.total} → ${b.right}/${b.total} (${d>=0?'+':''}${fmtN(d)} pts)</span>`}catch(e){return ''}
}
function shelfDiagram(){
  return `<svg viewBox="0 0 340 155" class="diagram" role="img" aria-label="Four learning rooms: deadlocks, CPU scheduling, paging and transactions."><rect x="20" y="45" width="60" height="90" rx="2"/><rect x="100" y="25" width="60" height="110" rx="2"/><rect x="180" y="55" width="60" height="80" rx="2"/><rect x="260" y="35" width="60" height="100" rx="2"/><text x="50" y="95" text-anchor="middle" class="tiny">LOCKS</text><text x="130" y="85" text-anchor="middle" class="tiny">CPU</text><text x="210" y="100" text-anchor="middle" class="tiny">PAGES</text><text x="290" y="90" text-anchor="middle" class="tiny">DATA</text><line x1="10" y1="140" x2="330" y2="140" style="stroke:var(--blue);stroke-width:2"/></svg>`;
}
function myLearning(){
  const rows=LESSONS.map(l=>{
    const ss=S.lessons[l.id],st=lessonStatus(l.id);
    let scores='<span class="small muted">No finished evidence yet.</span>';
    if(st!=='not'){
      try{
        const parts=[];
        if(ss.done.includes('pre'))parts.push('start '+C.score(l,'pre',ss.answers.pre,ss.confidence.pre).right+'/'+l.pre.length);
        if(ss.done.includes('post')){const a=C.score(l,'pre',ss.answers.pre,ss.confidence.pre),b=C.score(l,'post',ss.answers.post,ss.confidence.post);parts.push('fresh '+b.right+'/'+b.total+' ('+(C.delta(a,b)>=0?'+':'')+fmtN(C.delta(a,b))+' pts)');}
        if(ss.recallCompletedAt)parts.push('recall '+C.score(l,'recall',ss.answers.recall,ss.confidence.recall).right+'/'+l.recall.length);
        scores='<span class="small">'+parts.join(' · ')+'</span>';
      }catch(e){}
    }
    const next=st==='done'?(ss.recallCompletedAt?'Come back for another recall round later.':'Try the recall check after a break.'):st==='started'?'Pick up where you left off.':'Run the six-question diagnostic.';
    return `<div class="path-row"><span class="num">${esc(l.title.split(':')[0].slice(0,2))}</span><div><h3>${esc(l.title)}</h3><p class="small muted">${next}</p>${scores}</div><div class="actions" style="margin:0"><button data-room="${l.id}">${st==='not'?'Start':'Open'} →</button>${st==='done'?`<button data-export="${l.id}">Evidence JSON ↓</button>`:''}</div></div>`;
  }).join('');
  const done=LESSONS.filter(l=>lessonStatus(l.id)==='done').length;
  return `<p class="eyebrow">MY LEARNING / THIS DEVICE ONLY</p><h1>Your trail across the rooms.</h1><p class="intro">Every number below is recalculated from your recorded answers on this device. Nothing is uploaded; clearing the session removes it.</p>${done?`<div class="note success">${done} of ${LESSONS.length} rooms have a finished before / after comparison.</div>`:`<div class="note">No finished evidence yet. Each room takes about 25 minutes: diagnostic, targeted reading, lab, practice, fresh check.</div>`}${rows}<div class="rule"></div><p class="small muted">Scores are small self-check snapshots, not grades, mastery estimates or proof of learning. The interpretation limits are listed in each room and in How it works.</p><div class="actions"><button class="primary" data-action="home">Back to the library</button></div>`;
}
function access(){
  const sizes=[['standard','Standard'],['large','Large'],['larger','Larger']];
  const fonts=[['default','Default (system)'],['alt','OpenDyslexic (bundled)']];
  const voices=speech.voices;
  return `<div class="reading"><p class="eyebrow">DISPLAY &amp; ACCESS</p><h1>Make it fit you.</h1><p class="intro">These settings live on this device only. They change how the room looks and sounds, never what it scores.</p>
  <h2>Text size</h2><div class="actions" role="group" aria-label="Text size">${sizes.map(([v,t])=>`<button data-size="${v}" aria-pressed="${S.settings.textSize===v}" class="${S.settings.textSize===v?'primary':''}">${t}</button>`).join('')}</div>
  <h2>Typeface</h2><div class="actions" role="group" aria-label="Typeface">${fonts.map(([v,t])=>`<button data-font="${v}" aria-pressed="${S.settings.typeface===v}" class="${S.settings.typeface===v?'primary':''}">${t}</button>`).join('')}</div><p class="small muted">OpenDyslexic is bundled with this page (SIL Open Font License 1.1). Research on specialised typefaces is mixed; treat it as a preference, not a proven aid.</p>
  <h2>Read-aloud</h2>${speech.supported?`<p class="small muted">Uses your browser's speech voices. Voices marked "local" run on this device; other voices may send text to a network service, so pick a local one if that matters to you.</p><div class="voice-row"><div><label for="voice" class="small"><b>Voice</b></label><select id="voice"><option value="">Browser default</option>${voices.map(v=>`<option value="${esc(v.name)}|${esc(v.lang)}" ${v.name===S.settings.voiceName&&v.lang===S.settings.voiceLang?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.localService?' · local':' · network'}</option>`).join('')}</select></div><button data-action="listen-test">Test this voice</button></div><p class="small muted">The ▶ Listen button in the header reads the current page. The browser decides which voices are local; if nothing is marked, it did not say.</p>`:'<p class="small muted">This browser does not offer speech synthesis, so read-aloud is unavailable here.</p>'}
  <h2>Keyboard &amp; motion</h2><p class="small muted">Every control is a real button, link, field or summary: tab through, Enter or Space to activate. A skip link jumps to the content. The room honours your system's reduced-motion setting.</p>
  <div class="actions"><button class="primary" data-action="home">Back to the library</button></div></div>`;
}
function about(){
  return `<div class="reading"><p class="eyebrow">METHODS / PRIVACY / CREDITS</p><h1>A small claim.<br>A clear trail.</h1><h2>The barrier</h2><p>A university learner can have access to the notes and still get stuck on dense wording. Each LearnProof room pairs original technical passages with plain language, worked examples, a hands-on model and a path based on missed questions.</p><h2>How the score works</h2><p>Each reviewed room has three concepts. Six diagnostic items and six different fresh-check items give two questions per concept. Three practice questions are separate. Correct answers count one point; incorrect and "I do not know" count zero. No AI grades an answer.</p><p>Percentage-point change = 100 × (fresh correct / fresh total − starting correct / starting total). Forms follow a topic blueprint but are not statistically equated. We have not run a student efficacy study. Outside help and answer-key inspection are possible.</p><h2>What runs where</h2><p>This learning room is static HTML, CSS and JavaScript. Its lessons, scoring, simulators, report import/export and offline download run in your browser. No analytics, tracking scripts, AI API or uploaded PDF processor are in this build. The host may log ordinary page requests. Read-aloud uses your browser's own voices; voices not marked "local" may send the read text to a network service. The bundled OpenDyslexic typeface is served as part of the page, not from a font service.</p><p>Answers stay in session storage by default. Optional local storage keeps them on this device; shared devices should leave it off. Reports are editable local files, not certificates. Import recalculates scores from choices, rather than trusting a report's totals.</p><h2>What's not built</h2><ul class="checklist"><li>No arbitrary PDF-to-lesson generation in this public room, OCR, screen-reader certification or broad course library. Four rooms, not forty.</li><li>No proctoring, identity verification, teacher database, synced accounts, automated reminders or verified retention tracking. The recall reminder is a calendar file you choose to save.</li><li>No claim that a six-item score is a stable mastery estimate or that this app causes better learning.</li></ul><h2>The rooms and their sources</h2>${LESSONS.map(l=>`<details><summary>${esc(l.title)}</summary><div>${l.pages.map(p=>`<section class="source"><p class="eyebrow">ORIGINAL NOTES / PAGE ${p.page}</p><p>${esc(p.text)}</p></section>`).join('')}<p class="small">Reference reading: ${l.references.map(r=>`<a target="_blank" rel="noopener noreferrer" href="${esc(r.url)}">${esc(r.title)}</a>`).join(', ')}. Source-page labels refer to the bundled notes above, not page numbers in the references.</p></div></details>`).join('')}<h2>Build &amp; authorship</h2><p class="small">M J Anthony directed the project. Implementation, original teaching drafts, tests, interface, documentation and narration were made with AI assistance. A private LearnProof prototype began on 28 October 2026, within AccessED's event window. The 13 November v2 rebuild added the targeted path, waiting lab, confidence-linked corrections, browser-local evidence restoration and a third recall set. The 13 November v3 rebuild added the four-room library (CPU scheduling, paging and transactions are new), the per-room simulators, My learning, display &amp; access settings, read-aloud and calendar recall reminders. Material is reviewed by the builder, not a subject-matter expert panel.</p><p class="small">OpenDyslexic typeface © Abbie Gonzalez and contributors, SIL Open Font License 1.1 (license text is in the repository under fonts/OFL.txt).</p><div class="note warn">Use only synthetic or permission-cleared examples. This prototype does not collect learner names or educational records. If you add your own implementation, do not turn a free provider key into an unrestricted public endpoint.</div><div class="actions"><button data-action="home">Back to the library</button><button data-action="download-app">Save an offline copy ↓</button></div></div>`;
}

/* ---------- room views ---------- */
function rail(){
  const ss=SS();
  const active=ss.view==='quiz'?({pre:1,practice:3,post:4,recall:5}[ss.stage]):({home:0,baseline:1,learn:2,feedback:3,report:5}[ss.view]);
  $('#rail').innerHTML='<p class="eyebrow small">'+esc(L().short||L().title.toUpperCase())+'</p>'+stages.map((n,i)=>{
    const ok=i<2||i===2&&complete('pre')||i===3&&complete('pre')||i===4&&complete('practice')||i===5&&complete('post');
    return `<button data-nav="${i}" ${ok?'':'disabled'} class="${active===i?'active':''}" ${active===i?'aria-current="step"':''}><b>${String(i).padStart(2,'0')}</b>${n}</button>`;
  }).join('')+'<hr><button class="labnav '+(ss.view==='lab'?'active':'')+'" data-action="lab"><b>↗</b>Lab</button><button data-action="library"><b>⌂</b>Library</button><p class="small muted">From dense notes to<br>answers you can explain.</p>';
}
function roomHome(){
  const l=L();
  return `<div class="hero"><div><p class="eyebrow">${esc(l.mode.toUpperCase())}</p><h1>${esc(l.title)}</h1><p class="intro">${esc(l.summary)}</p><div class="actions"><button class="primary" data-action="start">${complete('pre')?'Start a new self-check':'Find my starting point'} →</button>${complete('pre')?'<button data-action="resume">Resume my session</button>':''}</div><p class="small muted">Three concepts. Six questions in, six different questions out.<br>About ${l.minutes} minutes, at your pace.</p></div><div><div class="illustration"><p class="eyebrow">THIS ROOM</p><div class="numbers" style="margin:8px 0"><div><b>03</b><span>source-linked concepts</span></div><div><b>06+06</b><span>before / after items</span></div><div><b>01</b><span>honest evidence trail</span></div></div><p class="small muted" style="margin:0">${esc(l.lab.intro)}</p></div><button class="text small" data-action="lab">Open the lab first ↗</button></div></div><div class="lessonline"><div><span class="tag">Reviewed, original teaching material</span><h3>Inspect before you trust</h3><p class="small muted">Every correction in this room quotes the exact source passage it rests on. Read the notes and the reference before believing any score.</p></div><button data-action="sources">Read the source notes</button></div>${keepCopy()}<details><summary>Restore a previous evidence report for this room</summary><div><label class="small" for="import">Restore a compatible evidence report (JSON, under 100 KB)</label><br><input id="import" class="file-input" type="file" accept="application/json,.json"></div></details>`;
}
function quiz(){
  const ss=SS(),qs=L()[ss.stage],q=qs[ss.index],a=ss.answers[ss.stage][q.id];
  const labels={pre:['01 / FIND YOUR START','What do you know already?'],practice:['03 / TRY IT OUT','Think it through.'],post:['04 / DIFFERENT QUESTIONS','What makes sense now?'],recall:['06 / RETURN & RETRIEVE','What can you recall later?']};
  const [label,title]=labels[ss.stage];
  return `<div class="question"><p class="eyebrow">${label}</p><h1>${title}</h1><p class="small muted">${ss.stage==='pre'?'There is no pass mark. "I do not know" helps make the path honest.':ss.stage==='practice'?'Use your reasoning. Feedback follows after this short set.':ss.stage==='recall'?'A third question set. The elapsed interval is self-reported from this device, not verified.':'No hints or answer feedback during this check. Source code contains keys; this is not proctored.'}</p><div class="progress" role="progressbar" aria-label="Questions reached" aria-valuemin="0" aria-valuemax="${qs.length}" aria-valuenow="${ss.index+1}"><div style="width:${100*(ss.index+1)/qs.length}%"></div></div><p class="eyebrow" style="color:var(--pink)">QUESTION ${String(ss.index+1).padStart(2,'0')} / ${String(qs.length).padStart(2,'0')}</p><h2 id="qprompt">${esc(q.prompt)}</h2><fieldset class="options" aria-labelledby="qprompt">${q.options.map((x,i)=>option(i,x,a)).join('')}${option(-1,'I do not know',a)}</fieldset><fieldset class="confidence"><legend>How confident are you? (optional)</legend><label><input type="radio" name="confidence" value="sure" ${ss.confidence[ss.stage][q.id]==='sure'?'checked':''}> Sure of my reasoning</label><label><input type="radio" name="confidence" value="unsure" ${ss.confidence[ss.stage][q.id]==='unsure'?'checked':''}> Still unsure</label></fieldset><p id="error" class="error" role="alert"></p><div class="actions"><button data-action="previous" ${ss.index===0?'disabled':''}>← Previous</button><button class="primary" data-action="next">${ss.index<qs.length-1?'Continue →':ss.stage==='pre'?'Build my learning path →':ss.stage==='practice'?'Review my reasoning →':ss.stage==='recall'?'See recall evidence →':'See my evidence →'}</button></div></div>`;
}
function option(i,text,a){return `<label class="option"><input type="radio" name="answer" value="${i}" ${a===i?'checked':''}><span>${esc(text)}</span></label>`}
function learn(){
  const l=L(),r=result('pre'),path=C.path(l,r);
  return `<div class="reading"><p class="eyebrow">02 / YOUR TARGETED LEARNING PATH</p><h1>Follow the gap.<br>Then the idea.</h1><p class="intro">You answered ${r.right} of ${r.total} starting questions correctly. We put lower-scoring concepts first, not the longest chapter.</p>${path.map((c,i)=>`<div class="path-row"><span class="num">${i+1}</span><div><h3>${esc(c.title)}</h3><p class="small muted">${r.concepts[c.id]===2?'Both starting items correct. Keep this concept warm.':'Revisit this before the fresh check.'}</p></div><span class="score small">${r.concepts[c.id]} / 2 at start</span></div>`).join('')}<div class="note">This is item-based prioritisation, not a clinical or psychometric diagnosis. Two items per concept give only a small snapshot.</div>${path.map(c=>`<section class="concept" id="concept-${c.id}"><div class="rule"></div><p class="eyebrow">SOURCE PAGE ${c.page} / ${r.concepts[c.id]<2?'PRIORITY REVISION':'KEEP IN VIEW'}</p><h2>${esc(c.title)}</h2><p>${esc(c.plain)}</p><div class="source"><p class="eyebrow">IN PRACTICE</p><p>${esc(c.example)}</p></div><details><summary>Read the exact source passage</summary><div><blockquote>${esc(c.quote)}</blockquote><p class="small muted">Page ${c.page} of our original, bundled teaching notes. Reference reading: ${l.references.map(r=>esc(r.title)).join(', ')}.</p></div></details>${r.evidence.filter(q=>q.concept===c.id&&!q.right).map(q=>`<p class="small"><b>Your starting gap:</b> ${esc(q.prompt)}<br><span class="muted">${esc(q.why)}</span></p>`).join('')}<label class="setting"><input type="checkbox" data-read="${c.id}" ${SS().read.includes(c.id)?'checked':''}>I can explain this idea in my own words. (Self-check, not a scored answer.)</label></section>`).join('')}<div class="rule"></div><div class="actions"><button data-action="lab">Try it in the lab ↗</button><button class="primary" data-action="practice">Use the idea in practice →</button></div></div>`;
}
function baseline(){return '<p class="eyebrow">01 / YOUR STARTING EVIDENCE</p><h1>The original snapshot.</h1><p class="intro">These submitted diagnostic choices stay fixed for this session. Start a new self-check from the room to replace them.</p>'+evidence(L(),result('pre'))+'<div class="actions"><button data-action="learn" class="primary">My learning path →</button></div>';}
function feedback(){const r=result('practice');return `<p class="eyebrow">03 / REFLECT &amp; CORRECT</p><h1>A second look.</h1><p class="intro">${r.right} / ${r.total} practice answers correct. Open the reasoning below. Practice does not count toward the before / after comparison.</p>${evidence(L(),r)}<div class="note">Ready for different questions? The fresh check gives no hints and does not show correct answers until all six responses are submitted.</div><div class="actions"><button data-action="learn">Revisit my learning path</button><button class="primary" data-action="post">Start the fresh check →</button></div>`;}
function reportView(){
  const l=L(),ss=SS(),a=result('pre'),b=result('post'),d=C.delta(a,b),sure=b.evidence.filter(q=>!q.right&&q.confidence==='sure'),elapsed=Math.max(0,Date.now()-Date.parse(ss.completedAt)),day=86400000;
  return `<p class="eyebrow">05 / YOUR ANSWERS, NOT AN AI VERDICT</p><h1>See what changed.</h1><p class="intro">One small snapshot of your understanding. Every number below links back to an actual choice and its supporting source passage.</p>${ss.imported?'<div class="note warn">Restored from an editable local report. Scores were recalculated from the choices, but identity, timestamps and independent work are not verified.</div>':''}<div class="scores"><div><p class="eyebrow">STARTING CHECK</p><strong>${a.right}<small> / ${a.total}</small></strong></div><div class="arrow" aria-hidden="true">→</div><div><p class="eyebrow">FRESH CHECK</p><strong>${b.right}<small> / ${b.total}</small></strong></div></div><p class="delta">${d>=0?'+':''}${fmtN(d)} percentage points</p><p class="small muted">Observed score change on these items. The two forms are not statistically equated. This does not prove lasting mastery or that LearnProof caused a change.</p><div class="rule"></div><h2>What still needs a look?</h2>${l.concepts.map(c=>`<div class="concept-result"><div><h3>${esc(c.title)}</h3><p class="small muted">${b.concepts[c.id]<2?'Next: re-read page '+c.page+' and explain the worked example without looking.':'Both fresh items correct. Try explaining the idea in a different setting.'}</p></div><div class="small"><b>${a.concepts[c.id]} / 2 → ${b.concepts[c.id]} / 2</b><div class="bar" role="img" aria-label="${b.concepts[c.id]} of 2 fresh items correct"><span class="${b.concepts[c.id]>0?'on':''}"></span><span class="${b.concepts[c.id]>1?'on':''}"></span></div><span class="muted">Source page ${c.page}</span></div></div>`).join('')}${sure.length?`<div class="note warn"><b>Confidence worth revisiting</b><br>${sure.length} incorrect fresh-check answer${sure.length===1?' was':'s were'} marked "sure". Open ${sure.map(q=>'question '+(l.post.findIndex(x=>x.id===q.id)+1)).join(', ')} below and compare your reasoning with the source.</div>`:''}<div class="rule"></div><h2>The reasoning behind the result</h2>${evidence(l,b)}<details><summary>Starting-check answers</summary><div>${evidence(l,a)}</div></details><div class="actions"><button class="primary" data-action="export">Save evidence report (JSON) ↓</button><button data-action="print">Print / save as PDF</button><button data-action="learn">Return to the learning path</button></div><div class="rule"></div><h2>Come back to it.</h2><p class="small muted">A later check asks six different questions about the same concepts. Save your report now, restore it on this device later, then try without revising first. This is a self-check, not verified retention measurement.</p><p class="retention">${elapsed>=day?'At least 24 hours have elapsed by this device clock.':'Less than 24 hours have elapsed by this device clock. A check now is immediate practice, not delayed recall.'} ${ss.recallCompletedAt?'A recall attempt is already recorded in this session.':''}</p><div class="actions">${ss.recallCompletedAt?'':`<button data-action="recall">${elapsed>=day?'Try the later recall check':'Try the third question set now'} →</button>`}<button data-action="ics">Save a recall reminder (.ics) ↓</button></div><p class="ics-note">The reminder is a standard calendar file for 3 days from now. Nothing is scheduled on any server; your calendar app is what reminds you.</p>${ss.recallCompletedAt?`<div class="note">Recall self-check: ${result('recall').right} / ${l.recall.length}. Finished ${esc(new Date(ss.recallCompletedAt).toLocaleString())}. The report export includes this evidence.</div>${evidence(l,result('recall'))}`:''}<p class="small muted" style="margin-top:20px">Reports contain your answer choices and timestamps. Store them privately. No names or educational records are needed.</p>`;
}

/* ---------- labs ---------- */
const dlPresets={cycle:{owners:{X:'A',Y:'B',Z:null},waits:{A:'Y',B:'X',C:null}},chain:{owners:{X:'A',Y:'B',Z:null},waits:{A:'Y',B:null,C:'X'}},three:{owners:{X:'A',Y:'B',Z:'C'},waits:{A:'Y',B:'Z',C:'X'}},blocked:{owners:{X:'A',Y:'B',Z:'C'},waits:{A:'Y',B:'X',C:'X'}},free:{owners:{X:'A',Y:null,Z:'C'},waits:{A:'Y',B:null,C:'X'}}};
function sel(id,values,value){return `<select id="${id}">${values.map(([v,t])=>`<option value="${v}" ${v===(value||'none')?'selected':''}>${t}</option>`).join('')}</select>`}
function labShell(inner){
  return `<p class="eyebrow">LAB / REASON ABOUT A SYSTEM</p><h1>Change one thing.<br>Follow the consequence.</h1><p class="intro">${esc(L().lab.intro)}</p><div class="note"><b>Model assumptions:</b> ${esc(L().lab.assumptions)}</div>${inner}<div class="actions">${complete('pre')?'<button data-action="learn">← My learning path</button>':'<button data-action="room-home">← Room</button>'}${complete('pre')?'<button data-action="practice">Continue to practice →</button>':''}</div>`;
}
function labDeadlock(){
  const ss=SS(),r=Labs.deadlockAnalyze(ss.lab.owners,ss.lab.waits);
  return labShell(`<label for="preset" class="small"><b>Start with a scenario</b></label>${sel('preset',[['custom','Custom state'],['cycle','Two-thread cycle'],['chain','Waiting chain with an exit'],['three','Three-thread cycle'],['blocked','Cycle plus a blocked dependent'],['free','A free lock lets work continue']],'custom')}<div class="lab-grid" style="margin-top:24px"><div class="lab-controls"><h3>Who holds each lock?</h3><div class="state-row">${['X','Y','Z'].map(x=>`<div><label for="owner-${x}">Lock ${x}</label>${sel('owner-'+x,[['none','Free'],['A','Thread A'],['B','Thread B'],['C','Thread C']],ss.lab.owners[x])}</div>`).join('')}</div><h3 style="margin-top:25px">What is each thread waiting for?</h3>${['A','B','C'].map(x=>`<label for="wait-${x}">Thread ${x}</label>${sel('wait-'+x,[['none','Nothing else: can finish'],['X','Lock X'],['Y','Lock Y'],['Z','Lock Z']],ss.lab.waits[x])}`).join('')}</div><div class="lab-output"><p class="eyebrow">YOUR PREDICTION</p><p>Does this state contain a closed waiting cycle?</p><div class="actions"><button data-predict="yes" aria-pressed="${ss.labPrediction==='yes'}">Yes</button><button data-predict="no" aria-pressed="${ss.labPrediction==='no'}">No</button></div><button class="primary" data-action="reveal-lab" ${ss.labPrediction===null||ss.labPrediction===undefined?'disabled':''}>Trace the state →</button>${ss.labRevealed?`<p class="status">${r.cycles.length?'A closed waiting cycle.':'A way through.'}</p><p class="small">${(r.cycles.length>0)===(ss.labPrediction==='yes')?'Your prediction matches this model.':'Your prediction needs another look. Follow the actual blockers below.'}</p>${Object.entries(r.edges).map(([t,o])=>`<div class="edge"><code>${t}</code><span class="small">${o?'waits for '+o:'can finish without waiting for another thread'}</span></div>`).join('')}${r.cycles.map(c=>`<p class="small"><b>Closed cycle:</b> ${c.join(' → ')} → ${c[0]}</p>`).join('')}<p class="small">${r.order.length?'Possible completions: '+r.order.join(' → ')+'.':'No thread can complete under these assumptions.'}</p>${r.blocked.length?`<p class="small">Blocked after every possible completion: ${r.blocked.join(', ')}. ${r.blocked.filter(x=>!r.cycleNodes.includes(x)).length?'A dependent may be blocked by a cycle without belonging to it.':''}</p>`:''}<p class="small muted">Try freeing a lock or removing a pending request. The state is re-evaluated, not played back from a canned answer.</p>`:'<p class="small muted" style="margin-top:24px">Make a prediction before seeing the result. This exercise is separate from your self-check scores.</p>'}</div></div>`);
}
function labScheduling(){
  const ss=SS(),lab=ss.lab;
  let out='',err='';
  try{
    const r=Labs.schedule(lab.jobs,lab.policy,lab.quantum);
    if(ss.labRevealed){
      const pred=parseFloat(lab.prediction);
      const verdict=Number.isFinite(pred)?(Math.abs(pred-r.avgWaiting)<0.51?'<p class="small">Your prediction matches the simulation (within rounding).</p>':`<p class="small">The simulation says ${fmtN(r.avgWaiting)}. Trace the slices below to see where the waiting comes from.</p>`):'';
      out=`<p class="status">Average waiting time: ${fmtN(r.avgWaiting)}</p>${verdict}<div class="gantt" aria-label="Timeline of scheduled slices">${r.timeline.map(s=>s.job?`<div>${esc(s.job)}<span class="glabel">${s.start}–${s.end}</span></div>`:`<div class="idle">idle<span class="glabel">${s.start}–${s.end}</span></div>`).join('')}</div><table class="jobs-table"><tr><th>Job</th><th>Arrival</th><th>Burst</th><th>Completion</th><th>Turnaround</th><th>Waiting</th></tr>${lab.jobs.map(j=>`<tr><td>${esc(j.id)}</td><td>${j.arrival}</td><td>${j.burst}</td><td>${r.perJob[j.id].completion}</td><td>${r.perJob[j.id].turnaround}</td><td>${r.perJob[j.id].waiting}</td></tr>`).join('')}</table><p class="small muted">Waiting = turnaround − burst; turnaround = completion − arrival. Change a burst, the policy or the quantum and run again.</p>`;
    }
  }catch(e){err=e.message}
  return labShell(`<div class="lab-grid"><div class="lab-controls"><h3>The workload</h3><table class="jobs-table"><tr><th>Job</th><th>Arrival</th><th>CPU need</th><th></th></tr>${lab.jobs.map((j,i)=>`<tr><td>${esc(j.id)}</td><td><input type="number" min="0" max="99" data-job="${i}" data-field="arrival" value="${j.arrival}" aria-label="${esc(j.id)} arrival time"></td><td><input type="number" min="1" max="99" data-job="${i}" data-field="burst" value="${j.burst}" aria-label="${esc(j.id)} CPU need"></td><td><button class="text small" data-remove-job="${i}" ${lab.jobs.length<2?'disabled':''}>Remove</button></td></tr>`).join('')}</table><div class="actions">${lab.jobs.length<6?'<button data-action="add-job">Add a job</button>':''}</div><h3>The policy</h3><label for="policy">Policy</label>${sel('policy',[['fcfs','First-come, first-served'],['sjf','Shortest job first'],['rr','Round robin']],lab.policy)}${lab.policy==='rr'?`<label for="quantum">Quantum (1–5)</label><input type="number" id="quantum" min="1" max="5" value="${lab.quantum}">`:''}</div><div class="lab-output"><p class="eyebrow">YOUR PREDICTION</p><p>Average waiting time across all jobs?</p><div class="voice-row"><div><label for="predict-wait" class="small"><b>Your number</b></label><input type="text" id="predict-wait" inputmode="decimal" value="${esc(lab.prediction)}" placeholder="e.g. 17"></div><button class="primary" data-action="reveal-lab" ${String(lab.prediction).trim()===''?'disabled':''}>Run the policy →</button></div>${err?`<p class="error">${esc(err)}</p>`:''}${out||'<p class="small muted" style="margin-top:24px">Estimate the average waiting time first, then run it. This exercise is separate from your self-check scores.</p>'}</div></div>`);
}
function labPaging(){
  const ss=SS(),lab=ss.lab;
  let out='',err='';
  const refs=lab.refs.split(/[\s,]+/).filter(Boolean).map(Number);
  try{
    const r=Labs.pageFaults(refs,lab.frames,lab.policy);
    if(ss.labRevealed){
      const pred=parseInt(lab.prediction,10);
      const verdict=Number.isFinite(pred)?(pred===r.faults?'<p class="small">Your prediction matches the replay exactly.</p>':`<p class="small">The replay shows ${r.faults} faults. Walk the table to find the references that surprised you.</p>`):'';
      out=`<p class="status">${r.faults} faults · ${r.hits} hits</p>${verdict}<div style="overflow-x:auto"><table class="frames-table"><tr><th>Ref</th>${r.steps.map(s=>`<th>${s.page}</th>`).join('')}</tr>${Array.from({length:lab.frames},(_,f)=>`<tr><th>Frame ${f+1}</th>${r.steps.map(s=>`<td class="${s.fault?'fault':'hit'}">${s.frames[f]??''}</td>`).join('')}</tr>`).join('')}<tr><th>Fault?</th>${r.steps.map(s=>`<td class="${s.fault?'fault':'hit'}">${s.fault?'F'+(s.evicted!==null?' (−'+s.evicted+')':''):'·'}</td>`).join('')}</tr></table></div><p class="small muted">F marks a fault; (−n) names the evicted page. Try the same string under another policy, or add a frame and watch FIFO misbehave.</p>`;
    }
  }catch(e){err=e.message}
  return labShell(`<div class="lab-grid"><div class="lab-controls"><h3>The reference string</h3><label for="refs">Pages, in order (0–9, comma separated, at most 20)</label><input type="text" id="refs" value="${esc(lab.refs)}"><div class="state-row" style="margin-top:14px"><div><label for="frames">Frames (1–5)</label><input type="number" id="frames" min="1" max="5" value="${lab.frames}"></div><div><label for="policy">Policy</label>${sel('policy',[['fifo','First-in, first-out'],['lru','Least recently used'],['opt','Optimal (benchmark)']],lab.policy)}</div></div></div><div class="lab-output"><p class="eyebrow">YOUR PREDICTION</p><p>How many page faults?</p><div class="voice-row"><div><label for="predict-faults" class="small"><b>Your count</b></label><input type="text" id="predict-faults" inputmode="numeric" value="${esc(lab.prediction)}" placeholder="e.g. 9"></div><button class="primary" data-action="reveal-lab" ${String(lab.prediction).trim()===''?'disabled':''}>Replay the string →</button></div>${err?`<p class="error">${esc(err)}</p>`:''}${out||'<p class="small muted" style="margin-top:24px">Count the faults on paper first, then replay. This exercise is separate from your self-check scores.</p>'}</div></div>`);
}
function labTransactions(){
  const ss=SS(),lab=ss.lab;
  let out='',err='';
  try{
    const r=Labs.scheduleCheck(lab.ops);
    if(ss.labRevealed){
      const verdict=lab.prediction===null||lab.prediction===undefined?'':((r.serializable)===(lab.prediction==='yes')?'<p class="small">Your prediction matches the graph.</p>':'<p class="small">The graph disagrees. Follow the conflict edges below.</p>');
      out=`<p class="status">${r.serializable?'Conflict-serializable.':'A cycle: no serial equivalent.'}</p>${verdict}${r.conflicts.length?`<p class="eyebrow">CONFLICTS</p>${r.conflicts.map(c=>`<div class="edge"><code>${c.first.t}:${c.first.op}${c.first.item} → ${c.second.t}:${c.second.op}${c.second.item}</code><span class="small">edge ${c.first.t} → ${c.second.t} on ${c.item}</span></div>`).join('')}`:'<p class="small">No conflicts at all: every pair either shares a transaction, touches different items, or only reads.</p>'}${r.cycles.map(c=>`<p class="small"><b>Cycle:</b> ${c.join(' → ')}</p>`).join('')}${r.serializable&&r.serialOrder?`<p class="small"><b>One equivalent serial order:</b> ${r.serialOrder.join(' → ')}</p>`:''}<p class="small muted">Add, remove or reorder operations and test again. The graph is rebuilt from your schedule each time.</p>`;
    }
  }catch(e){err=e.message}
  return labShell(`<div class="lab-grid"><div class="lab-controls"><h3>The schedule</h3><p class="small muted">Operations run top to bottom. Transactions A–C, items X–Z.</p><ol class="ops-list">${lab.ops.map((o,i)=>`<li><code>${o.t} ${o.op ==='R'?'reads':'writes'} ${o.item}</code> <button class="text small" data-remove-op="${i}" ${lab.ops.length<=2?'disabled':''}>Remove</button></li>`).join('')}</ol><div class="ops-row"><div><label for="op-t">Transaction</label>${sel('op-t',[['A','A'],['B','B'],['C','C']],'A')}</div><div><label for="op-op">Operation</label>${sel('op-op',[['R','Read'],['W','Write']],'R')}</div><div><label for="op-item">Item</label>${sel('op-item',[['X','X'],['Y','Y'],['Z','Z']],'X')}</div><button data-action="add-op" ${lab.ops.length>=14?'disabled':''}>Add</button></div></div><div class="lab-output"><p class="eyebrow">YOUR PREDICTION</p><p>Can this schedule be reordered into a serial execution?</p><div class="actions"><button data-predict="yes" aria-pressed="${lab.prediction==='yes'}">Yes</button><button data-predict="no" aria-pressed="${lab.prediction==='no'}">No</button></div><button class="primary" data-action="reveal-lab" ${lab.prediction===null||lab.prediction===undefined?'disabled':''}>Test the schedule →</button>${err?`<p class="error">${esc(err)}</p>`:''}${out||'<p class="small muted" style="margin-top:24px">Predict before you test. This exercise is separate from your self-check scores.</p>'}</div></div>`);
}
function lab(){
  const t=L().lab.type;
  if(t==='deadlock')return labDeadlock();
  if(t==='scheduling')return labScheduling();
  if(t==='paging')return labPaging();
  return labTransactions();
}

/* ---------- render ---------- */
function applySettings(){
  document.body.classList.toggle('font-alt',S.settings.typeface==='alt');
  document.body.classList.toggle('fs-large',S.settings.textSize==='large');
  document.body.classList.toggle('fs-larger',S.settings.textSize==='larger');
}
function render(){
  applySettings();
  const layout=$('.layout');
  if(S.view==='room'){
    if(!need(SS().view))SS().view='home';
    layout.classList.remove('no-rail');
    rail();
    const views={home:roomHome,quiz,learn,feedback,report:reportView,lab,baseline};
    $('#main').innerHTML=(views[SS().view]||roomHome)();
  }else{
    layout.classList.add('no-rail');
    $('#rail').innerHTML='';
    const views={library,my:myLearning,about,access};
    $('#main').innerHTML=(views[S.view]||library)();
  }
  $('#listen-btn').textContent=speech.active?'■ Stop':'▶ Listen';
  $('#listen-btn').setAttribute('aria-pressed',speech.active?'true':'false');
  persist();
}
function navigateRoom(view,stage){
  const ss=SS();
  if(ss.view==='quiz'&&ss.stage==='post'&&view!=='quiz'&&!confirm('Leaving the fresh check opens learning material. Continue? This is an unproctored self-check.'))return;
  if(stage)ss.stage=stage;
  ss.view=view;if(view==='quiz')ss.index=0;
  render();$('#main').focus();window.scrollTo(0,0);
}
function next(){
  const ss=SS(),q=L()[ss.stage][ss.index];
  if(!Number.isInteger(ss.answers[ss.stage][q.id])){$('#error').textContent='Choose an answer or "I do not know" before continuing.';return}
  if(ss.index<L()[ss.stage].length-1){ss.index++;render();$('#main').focus();window.scrollTo(0,0);return}
  ss.done=[...new Set([...ss.done,ss.stage])];
  if(ss.stage==='pre')ss.view='learn';
  else if(ss.stage==='practice')ss.view='feedback';
  else{if(ss.stage==='post')ss.completedAt=new Date().toISOString();else ss.recallCompletedAt=new Date().toISOString();ss.view='report'}
  render();$('#main').focus();window.scrollTo(0,0);
}
function icsFor(l){
  const start=new Date(Date.now()+3*86400000),end=new Date(start.getTime()+30*60000);
  const p=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LearnProof//Recall//EN','BEGIN:VEVENT','UID:'+l.id+'-'+Date.now()+'@learnproof.local','DTSTAMP:'+p(new Date()),'DTSTART:'+p(start),'DTEND:'+p(end),'SUMMARY:LearnProof recall check: '+l.title.replace(/[:\\,;]/g,' '),'DESCRIPTION:Retake the six-question recall set without revising first. This is a self-check\\, not verified retention measurement.','END:VEVENT','END:VCALENDAR'].join('\r\n');
}

/* ---------- events ---------- */
document.addEventListener('change',async e=>{
  const t=e.target;
  if(S.view==='room'){
    const ss=SS();
    if(t.name==='answer'){const q=L()[ss.stage][ss.index];ss.answers[ss.stage][q.id]=Number(t.value);persist()}
    else if(t.name==='confidence'){ss.confidence[ss.stage][L()[ss.stage][ss.index].id]=t.value;persist()}
    else if(t.dataset.read){ss.read=t.checked?[...new Set([...ss.read,t.dataset.read])]:ss.read.filter(x=>x!==t.dataset.read);persist()}
    else if(t.id==='preset'&&dlPresets[t.value]){ss.lab={...dlPresets[t.value]};ss.labType='deadlock';ss.labRevealed=false;ss.labPrediction=null;render()}
    else if(t.id.startsWith('owner-')||t.id.startsWith('wait-')){const owner=t.id.startsWith('owner-');ss.lab[owner?'owners':'waits'][t.id.split('-')[1]]=t.value==='none'?null:t.value;ss.labRevealed=false;ss.labPrediction=null;render()}
    else if(t.id==='policy'&&ss.lab){ss.lab.policy=t.value;ss.labRevealed=false;render()}
    else if(t.id==='import'&&t.files.length){
      try{
        const f=t.files[0];if(f.size>100000)throw Error('Report exceeds 100 KB.');
        const restored=C.restore(L(),JSON.parse(await f.text()));
        S.lessons[S.roomId]={...defaultSession(),...restored,done:['pre','post'],view:'report'};
        render();toast('Report restored. Scores recalculated from the recorded choices.');
      }catch(err){toast(err.message)}
    }
  }
  if(t.id==='remember'){S.settings.remember=t.checked;persist();toast(t.checked?'Progress will be remembered on this device.':'Progress now lasts only in this tab.')}
  else if(t.id==='voice'){const [name,lang]=t.value?t.value.split('|'):['',''];S.settings.voiceName=name;S.settings.voiceLang=lang;persist()}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(S.view!=='room')return;
  const ss=SS(),lab=ss.lab;
  if(!lab)return;
  if(t.dataset.job!==undefined){const j=lab.jobs[Number(t.dataset.job)];if(j)j[t.dataset.field]=t.value===''?'':Number(t.value);ss.labRevealed=false;persist()}
  else if(t.id==='quantum'){lab.quantum=Number(t.value);ss.labRevealed=false;persist()}
  else if(t.id==='refs'){lab.refs=t.value;ss.labRevealed=false;persist()}
  else if(t.id==='frames'){lab.frames=Number(t.value);ss.labRevealed=false;persist()}
  else if(t.id==='predict-wait'||t.id==='predict-faults'){lab.prediction=t.value;persist();const btn=$('[data-action="reveal-lab"]');if(btn)btn.disabled=t.value.trim()===''}
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action],[data-nav],[data-predict],[data-room],[data-size],[data-font],[data-export],[data-remove-job],[data-remove-op]');
  if(!b)return;
  if(b.disabled)return;
  e.preventDefault();
  if(b.dataset.room){go('#/room/'+b.dataset.room);return}
  if(b.dataset.size){S.settings.textSize=b.dataset.size;render();return}
  if(b.dataset.font){S.settings.typeface=b.dataset.font;render();return}
  if(b.dataset.export){const l=lessonById(b.dataset.export),ss=S.lessons[b.dataset.export];try{download('LearnProof-evidence-'+l.id+'.json',JSON.stringify(C.report(l,ss),null,2),'application/json')}catch(err){toast(err.message)}return}
  if(b.dataset.predict!==undefined){const ss=SS();if(L().lab.type==='transactions')ss.lab.prediction=b.dataset.predict;else ss.labPrediction=b.dataset.predict;render();return}
  if(b.dataset.removeJob!==undefined){const ss=SS();ss.lab.jobs.splice(Number(b.dataset.removeJob),1);ss.labRevealed=false;render();return}
  if(b.dataset.removeOp!==undefined){const ss=SS();ss.lab.ops.splice(Number(b.dataset.removeOp),1);ss.labRevealed=false;render();return}
  if(b.dataset.nav){
    const n=Number(b.dataset.nav);
    if(n===0)navigateRoom('home');
    if(n===1){if(complete('pre'))navigateRoom('baseline');else navigateRoom('quiz','pre')}
    if(n===2)navigateRoom('learn');
    if(n===3)navigateRoom(complete('practice')?'feedback':'quiz','practice');
    if(n===4)navigateRoom('quiz','post');
    if(n===5)navigateRoom('report');
    return;
  }
  const ss=S.view==='room'?SS():null;
  switch(b.dataset.action){
    case 'home':case 'library':go('#/');break;
    case 'my':go('#/my');break;
    case 'about':case 'sources':go('#/about');break;
    case 'access':go('#/access');break;
    case 'listen':speakMain();break;
    case 'listen-test':{stopSpeech();speakMain();break}
    case 'first-room':{const next=LESSONS.find(l=>lessonStatus(l.id)==='started')||LESSONS.find(l=>lessonStatus(l.id)==='not')||LESSONS[0];go('#/room/'+next.id);break}
    case 'room-home':navigateRoom('home');break;
    case 'lab':navigateRoom('lab');break;
    case 'learn':navigateRoom('learn');break;
    case 'resume':navigateRoom(complete('post')?'report':complete('practice')?'feedback':'learn');break;
    case 'start':if(complete('pre')&&!confirm('Start over? Export the existing report first if you want to keep it.'))break;S.lessons[S.roomId]={...defaultSession(),lab:ss.lab,labType:ss.labType};navigateRoom('quiz','pre');break;
    case 'next':next();break;
    case 'previous':ss.index=Math.max(0,ss.index-1);render();break;
    case 'practice':ss.done=ss.done.filter(x=>x!=='practice');ss.answers.practice={};ss.confidence.practice={};navigateRoom('quiz','practice');break;
    case 'post':if(complete('post')&&!confirm('Retake the fresh check? Seeing earlier answers affects interpretation. Existing fresh and recall evidence will be replaced.'))break;ss.done=ss.done.filter(x=>!['post','recall'].includes(x));ss.answers.post={};ss.confidence.post={};ss.answers.recall={};ss.confidence.recall={};ss.recallCompletedAt=null;ss.completedAt=null;navigateRoom('quiz','post');break;
    case 'recall':ss.done=ss.done.filter(x=>x!=='recall');ss.answers.recall={};ss.confidence.recall={};navigateRoom('quiz','recall');break;
    case 'reveal-lab':ss.labRevealed=true;render();break;
    case 'add-job':{const l=ss.lab;if(l.jobs.length<6){let n=1;while(l.jobs.some(j=>j.id==='P'+n))n++;l.jobs.push({id:'P'+n,arrival:0,burst:5});ss.labRevealed=false;render()}break}
    case 'add-op':{const l=ss.lab;if(l.ops.length<14){const t=$('#op-t').value,o=$('#op-op').value,i=$('#op-item').value;l.ops.push({t,op:o,item:i});ss.labRevealed=false;render()}break}
    case 'export':try{download('LearnProof-evidence-'+L().id+'.json',JSON.stringify(C.report(L(),ss),null,2),'application/json')}catch(err){toast(err.message)}break;
    case 'print':window.print();break;
    case 'ics':download('LearnProof-recall-'+L().id+'.ics',icsFor(L()),'text/calendar');toast('Calendar file saved. Open it to add the reminder; your calendar app does the reminding.');break;
    case 'download-app':{
      fetch(location.href).then(r=>r.text()).then(html=>{download('LearnProof-offline.html',html,'text/html');toast('Offline room saved. Open the HTML file directly in your browser. Session data is not included.')}).catch(()=>toast('Use your browser\'s Save Page As to keep an offline copy.'));
      break}
    case 'clear':if(confirm('Remove this device’s LearnProof session and any saved answers?')){try{localStorage.removeItem('lp3');sessionStorage.removeItem('lp3')}catch(e){}S=defaultRoot();parseHash();render();toast('Local session cleared. Downloaded reports are separate files.')}break;
  }
});
load();
parseHash();
render();
