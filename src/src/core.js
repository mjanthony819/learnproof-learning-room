/* LearnProof core: scoring, delta, path, evidence report and restore.
   Pure functions over a lesson pack. No DOM, no network.
   Loaded in the browser as LPCore and in node via module.exports. */
(function(root){
'use strict';
const STAGES=['pre','practice','post','recall'];

function score(lesson,stage,answers,confidence={}){
  const qs=lesson[stage];
  if(!Array.isArray(qs))throw Error('Unknown assessment');
  const evidence=qs.map(q=>{
    const a=answers[q.id];
    if(!Number.isInteger(a)||a<-1||a>=q.options.length)throw Error('Every question needs a valid answer');
    return {id:q.id,concept:q.concept,page:q.page,prompt:q.prompt,choice:a,
      chosen:a===-1?'I do not know':q.options[a],correct:q.correct,expected:q.options[q.correct],
      right:a===q.correct,why:q.why,confidence:confidence[q.id]||'unspecified'};
  });
  return {right:evidence.filter(x=>x.right).length,total:evidence.length,evidence,
    concepts:Object.fromEntries(lesson.concepts.map(c=>[c.id,evidence.filter(q=>q.concept===c.id&&q.right).length]))};
}

function delta(a,b){
  if(!a.total||!b.total)throw Error('Empty assessment');
  return 100*(b.right/b.total-a.right/a.total);
}

function path(lesson,result){
  return [...lesson.concepts].sort((a,b)=>(result.concepts[a.id]||0)-(result.concepts[b.id]||0));
}

function report(lesson,state){
  const before=score(lesson,'pre',state.answers.pre,state.confidence.pre);
  const after=score(lesson,'post',state.answers.post,state.confidence.post);
  return {format:'LearnProof evidence',schema:2,lessonId:lesson.id,lessonVersion:lesson.version,
    exportedAt:new Date().toISOString(),completedAt:state.completedAt,before,after,
    deltaPercentagePoints:delta(before,after),
    recall:state.recallCompletedAt?score(lesson,'recall',state.answers.recall,state.confidence.recall):null,
    recallCompletedAt:state.recallCompletedAt||null,
    limits:lesson.limitations,
    notice:'Self-reported local session. Editable, unproctored and not identity-verified. These scores do not prove retention, mastery or a causal learning benefit.'};
}

function restore(lesson,file){
  if(!file||file.format!=='LearnProof evidence'||file.schema!==2||file.lessonId!==lesson.id||file.lessonVersion!==lesson.version)
    throw Error('This is not a compatible LearnProof evidence report for this lesson.');
  const answers={pre:{},post:{},practice:{},recall:{}},confidence={pre:{},post:{},practice:{},recall:{}};
  for(const stage of ['pre','post']){
    const r=file[stage==='pre'?'before':'after'];
    if(!r||!Array.isArray(r.evidence)||r.evidence.length!==lesson[stage].length)throw Error('Missing answer evidence');
    for(const q of lesson[stage]){
      const e=r.evidence.find(x=>x.id===q.id);
      if(!e)throw Error('Missing answer');
      answers[stage][q.id]=e.choice;
      confidence[stage][q.id]=['sure','unsure'].includes(e.confidence)?e.confidence:'unspecified';
    }
    score(lesson,stage,answers[stage],confidence[stage]);
  }
  const stamp=Date.parse(file.completedAt);
  if(!Number.isFinite(stamp)||stamp>Date.now()+60000)throw Error('Invalid completion date');
  return {answers,confidence,completedAt:new Date(stamp).toISOString(),imported:true};
}

/* Structural validation of a lesson pack. Throws on any inconsistency so a
   broken pack can never ship. Returns a small summary. */
function validatePack(L){
  if(!L.id||!L.title||!L.version)throw Error('Pack needs id, title, version');
  if(!Array.isArray(L.pages)||!L.pages.length)throw Error('Pack needs source pages');
  if(!Array.isArray(L.concepts)||L.concepts.length!==3)throw Error('Pack needs exactly 3 concepts');
  const sizes={pre:6,practice:3,post:6,recall:6};
  for(const st of STAGES){
    if(!Array.isArray(L[st])||L[st].length!==sizes[st])throw Error(st+' must have '+sizes[st]+' items');
  }
  const ids=new Set(),prompts=new Set();
  for(const st of STAGES){
    const perConcept={};
    for(const q of L[st]){
      if(ids.has(q.id))throw Error('Duplicate item id '+q.id);
      ids.add(q.id);
      const key=st+':'+q.prompt;
      if(prompts.has(key))throw Error('Duplicate prompt in '+st);
      prompts.add(key);
      if(!L.concepts.some(c=>c.id===q.concept))throw Error('Unknown concept '+q.concept);
      if(!Array.isArray(q.options)||q.options.length<2)throw Error('Item '+q.id+' needs options');
      if(!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length)throw Error('Item '+q.id+' bad correct index');
      if(!q.why)throw Error('Item '+q.id+' needs an explanation');
      if(!L.pages.some(p=>p.page===q.page))throw Error('Item '+q.id+' cites missing page');
      perConcept[q.concept]=(perConcept[q.concept]||0)+1;
    }
    if(st!=='practice')for(const c of L.concepts){
      if(perConcept[c.id]!==2)throw Error(st+' needs exactly 2 items per concept ('+c.id+')');
    }
  }
  for(const c of L.concepts){
    const page=L.pages.find(p=>p.page===c.page);
    if(!page)throw Error('Concept '+c.id+' cites missing page');
    if(!c.quote||!page.text.includes(c.quote))throw Error('Concept '+c.id+' quote is not an exact passage of page '+c.page);
    if(!c.plain||!c.example)throw Error('Concept '+c.id+' needs plain language and a worked example');
  }
  if(!Array.isArray(L.references)||!L.references.every(r=>r.url&&r.title))throw Error('Pack needs references');
  if(!Array.isArray(L.limitations)||!L.limitations.length)throw Error('Pack needs limitations');
  if(!L.lab||!L.lab.type)throw Error('Pack needs a lab type');
  return {id:L.id,items:STAGES.reduce((n,st)=>n+L[st].length,0)};
}

const api={score,delta,path,report,restore,validatePack,STAGES};
if(typeof module!=='undefined')module.exports=api;
root.LPCore=api;
})(typeof window==='undefined'?globalThis:window);
