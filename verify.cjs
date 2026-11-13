// LearnProof verification. Run: node verify.cjs   (no dependencies)
// 1. Reproducible build: the shipped index.html must equal a fresh build.
// 2. Pack validation: every lesson pack passes structural checks.
// 3. Core engine: scoring, delta, path, report, restore on every pack.
// 4. Lab engines: known-answer and invariant tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
let count=0;
function test(name,fn){fn();count++;console.log('PASS',name)}

test('reproducible build',()=>{
  const shipped=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  cp.execFileSync(process.execPath,[path.join(__dirname,'build.mjs')],{stdio:'pipe'});
  const rebuilt=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert.equal(rebuilt,shipped,'index.html is stale; run node build.mjs');
});

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
function loadScript(id){
  const code=html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)</script>'))[1];
  const context={module:{exports:{}},exports:{}};
  new Function('module','exports','window','document',code)(context.module,context.exports,{},{getElementById:()=>({textContent:''})});
  return context.module.exports;
}
const C=loadScript('core-code');
const Labs=loadScript('labs-code');
const LESSONS=JSON.parse(html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('four lesson packs embedded',()=>assert.equal(LESSONS.length,4));
function answers(L,stage,correct=true){return Object.fromEntries(L[stage].map(q=>[q.id,correct?q.correct:-1]))}

for(const L of LESSONS){
  test(L.id+' validates',()=>C.validatePack(L));
  for(const st of ['pre','practice','post','recall']){
    test(L.id+' '+st+' perfect',()=>assert.equal(C.score(L,st,answers(L,st)).right,L[st].length));
    test(L.id+' '+st+' unknown scores zero',()=>assert.equal(C.score(L,st,answers(L,st,false)).right,0));
    test(L.id+' '+st+' missing rejected',()=>assert.throws(()=>C.score(L,st,{})));
  }
  test(L.id+' delta +100',()=>assert.equal(C.delta(C.score(L,'pre',answers(L,'pre',false)),C.score(L,'post',answers(L,'post'))),100));
  test(L.id+' delta -100',()=>assert.equal(C.delta(C.score(L,'pre',answers(L,'pre')),C.score(L,'post',answers(L,'post',false))),-100));
  test(L.id+' path orders weakest first',()=>{
    const order=C.path(L,{concepts:Object.fromEntries(L.concepts.map((c,i)=>[c.id,i]))}).map(x=>x.id);
    assert.equal(order[0],L.concepts[0].id);
  });
  test(L.id+' report/restore round-trip recalculates',()=>{
    const state={answers:{pre:answers(L,'pre',false),post:answers(L,'post'),recall:{}},confidence:{pre:{},post:{},recall:{}},completedAt:new Date().toISOString()};
    const r=C.report(L,state);
    assert.equal(r.deltaPercentagePoints,100);
    r.before.right=999;r.after.right=-100;
    const s=C.restore(L,r);
    assert.equal(C.score(L,'post',s.answers.post).right,L.post.length);
    assert.throws(()=>C.restore(L,{...r,schema:1}));
    assert.throws(()=>C.restore(L,{...r,completedAt:'tomorrow'}));
    const t=JSON.parse(JSON.stringify(r));t.before.evidence[0].choice=200;
    assert.throws(()=>C.restore(L,t));
  });
}
test('restore rejects a report for another lesson',()=>{
  const [a,b]=LESSONS;
  const state={answers:{pre:answers(a,'pre',false),post:answers(a,'post'),recall:{}},confidence:{pre:{},post:{},recall:{}},completedAt:new Date().toISOString()};
  assert.throws(()=>C.restore(b,C.report(a,state)));
});

/* ---- lab engines ---- */
test('deadlock two cycle',()=>assert.deepEqual(Labs.deadlockAnalyze({X:'A',Y:'B',Z:null},{A:'Y',B:'X',C:null}).cycleNodes.sort(),['A','B']));
test('deadlock chain completion',()=>assert.deepEqual(Labs.deadlockAnalyze({X:'A',Y:'B'},{A:'Y',B:null,C:'X'}).order,['B','A','C']));
test('deadlock dependent not cycle member',()=>{const r=Labs.deadlockAnalyze({X:'A',Y:'B',Z:'C'},{A:'Y',B:'X',C:'X'});assert.equal(r.blocked.length,3);assert.equal(r.cycleNodes.length,2)});
test('deadlock self wait nonreentrant',()=>assert.deepEqual(Labs.deadlockAnalyze({X:'A'},{A:'X'}).cycleNodes,['A']));
test('deadlock exhaustive invariants 4096 states',()=>{
  const vals=[null,'A','B','C'],rs=[null,'X','Y','Z'];
  for(let n=0;n<4096;n++){
    let v=n,o={},w={};
    for(const k of ['X','Y','Z']){o[k]=vals[v%4];v=Math.floor(v/4)}
    for(const k of ['A','B','C']){w[k]=rs[v%4];v=Math.floor(v/4)}
    const a=Labs.deadlockAnalyze(o,w);
    assert.equal(a.order.length+a.blocked.length,3);
    assert.equal(new Set(a.order).size,a.order.length);
    assert.equal(a.blocked.length===0,a.cycles.length===0);
    for(const t of a.cycleNodes)assert.ok(a.blocked.includes(t));
  }
});
const ref=[1,2,3,4,1,2,5,1,2,3,4,5];
test('paging FIFO classic = 9',()=>assert.equal(Labs.pageFaults(ref,3,'fifo').faults,9));
test('paging LRU classic = 10',()=>assert.equal(Labs.pageFaults(ref,3,'lru').faults,10));
test('paging OPT classic = 7',()=>assert.equal(Labs.pageFaults(ref,3,'opt').faults,7));
test('paging LRU 4 frames = 8',()=>assert.equal(Labs.pageFaults(ref,4,'lru').faults,8));
test('paging all hits after warm',()=>assert.equal(Labs.pageFaults([1,2,1,2,1,2],2,'lru').faults,2));
test('paging steps account for every reference',()=>{const r=Labs.pageFaults(ref,3,'fifo');assert.equal(r.steps.length,ref.length);assert.equal(r.faults+r.hits,ref.length)});
test('paging OPT never worse than FIFO/LRU across samples',()=>{
  let seed=42;const rand=()=>((seed=seed*1103515245+12345>>>0)%1000)/1000;
  for(let i=0;i<200;i++){
    const s=Array.from({length:12},()=>Math.floor(rand()*5));
    const o=Labs.pageFaults(s,3,'opt').faults;
    assert.ok(o<=Labs.pageFaults(s,3,'fifo').faults);
    assert.ok(o<=Labs.pageFaults(s,3,'lru').faults);
  }
});
const jobs=[{id:'P1',arrival:0,burst:24},{id:'P2',arrival:0,burst:3},{id:'P3',arrival:0,burst:3}];
test('scheduling FCFS convoy avg waiting 17',()=>assert.equal(Labs.schedule(jobs,'fcfs').avgWaiting,17));
test('scheduling SJF optimal avg waiting 3',()=>assert.equal(Labs.schedule(jobs,'sjf').avgWaiting,3));
test('scheduling RR quantum 4 timeline',()=>{
  const r=Labs.schedule(jobs,'rr',4);
  assert.deepEqual(r.timeline.map(s=>[s.job,s.start,s.end]),[['P1',0,4],['P2',4,7],['P3',7,10],['P1',10,14],['P1',14,18],['P1',18,22],['P1',22,26],['P1',26,30]]);
});
test('scheduling waiting identity holds',()=>{
  let seed=7;const rand=()=>((seed=seed*1103515245+12345>>>0)%1000)/1000;
  for(const p of ['fcfs','sjf','rr'])for(let i=0;i<100;i++){
    const js=Array.from({length:4},(_,k)=>({id:'J'+k,arrival:Math.floor(rand()*10),burst:1+Math.floor(rand()*10)}));
    const r=Labs.schedule(js,p,2);
    for(const j of js){
      assert.equal(r.perJob[j.id].turnaround,r.perJob[j.id].completion-j.arrival);
      assert.equal(r.perJob[j.id].waiting,r.perJob[j.id].turnaround-j.burst);
    }
    const busy=r.timeline.filter(s=>s.job).reduce((n,s)=>n+s.end-s.start,0);
    assert.equal(busy,js.reduce((n,j)=>n+j.burst,0));
  }
});
test('scheduling SJF never worse than FCFS on simultaneous arrival',()=>{
  let seed=99;const rand=()=>((seed=seed*1103515245+12345>>>0)%1000)/1000;
  for(let i=0;i<100;i++){
    const js=Array.from({length:4},(_,k)=>({id:'J'+k,arrival:0,burst:1+Math.floor(rand()*20)}));
    assert.ok(Labs.schedule(js,'sjf').avgWaiting<=Labs.schedule(js,'fcfs').avgWaiting);
  }
});
test('transactions cyclic schedule rejected',()=>{
  const r=Labs.scheduleCheck([{t:'A',op:'R',item:'X'},{t:'B',op:'W',item:'X'},{t:'B',op:'W',item:'Y'},{t:'A',op:'R',item:'Y'}]);
  assert.equal(r.serializable,false);assert.equal(r.cycles.length,1);
});
test('transactions acyclic schedule gives serial order',()=>{
  const r=Labs.scheduleCheck([{t:'A',op:'R',item:'X'},{t:'A',op:'W',item:'X'},{t:'B',op:'R',item:'X'},{t:'B',op:'W',item:'Y'}]);
  assert.equal(r.serializable,true);assert.deepEqual(r.serialOrder,['A','B']);
});
test('transactions read-read is not a conflict',()=>{
  const r=Labs.scheduleCheck([{t:'A',op:'R',item:'X'},{t:'B',op:'R',item:'X'}]);
  assert.equal(r.conflicts.length,0);assert.equal(r.serializable,true);
});
test('transactions serial order respects every edge',()=>{
  let seed=1234;const rand=()=>((seed=seed*1103515245+12345>>>0)%1000)/1000;
  const ts=['A','B','C'],items=['X','Y','Z'];
  for(let i=0;i<200;i++){
    const ops=Array.from({length:8},()=>({t:ts[Math.floor(rand()*3)],op:rand()<0.5?'R':'W',item:items[Math.floor(rand()*3)]}));
    let r;try{r=Labs.scheduleCheck(ops)}catch(e){continue}
    if(r.serializable&&r.serialOrder){
      const pos=Object.fromEntries(r.serialOrder.map((t,k)=>[t,k]));
      for(const e of r.edges){const [a,b]=e.split('->');assert.ok(pos[a]<pos[b],e)}
    }
  }
});
console.log(count+' checks passed');
