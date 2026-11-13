// Run: node verify.cjs. No npm packages required. Tests the shipped HTML directly.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const L=JSON.parse(html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const core=html.match(/<script id="core-code">([\s\S]*?)<\/script>/);
const context={module:{exports:{}},exports:{}};
new Function('module','exports',core?core[1]:html.match(/<script>\s*(\(function[\s\S]*?)<\/script>/)[1])(context.module,context.exports);
const C=context.module.exports;

let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
function answers(stage,correct=true){return Object.fromEntries(L[stage].map(q=>[q.id,correct?q.correct:-1]))}
for(const st of ['pre','practice','post','recall']){test(st+' perfect',()=>assert.equal(C.score(L,st,answers(st)).right,L[st].length));test(st+' unknown',()=>assert.equal(C.score(L,st,answers(st,false)).right,0));test(st+' missing rejected',()=>assert.throws(()=>C.score(L,st,{})));test(st+' out of range rejected',()=>assert.throws(()=>C.score(L,st,Object.fromEntries(L[st].map(q=>[q.id,9])))));}
test('100 percentage points',()=>assert.equal(C.delta(C.score(L,'pre',answers('pre',false)),C.score(L,'post',answers('post'))),100));
test('negative delta',()=>assert.equal(C.delta(C.score(L,'pre',answers('pre')),C.score(L,'post',answers('post',false))),-100));
test('lower concepts first',()=>assert.deepEqual(C.path(L,{concepts:{conditions:2,cycle:0,strategy:1}}).map(x=>x.id),['cycle','strategy','conditions']));
test('two cycle',()=>assert.deepEqual(C.analyze({X:'A',Y:'B',Z:null},{A:'Y',B:'X',C:null}).cycleNodes.sort(),['A','B']));
test('waiting chain completion',()=>assert.deepEqual(C.analyze({X:'A',Y:'B'},{A:'Y',B:null,C:'X'}).order,['B','A','C']));
test('three cycle',()=>assert.equal(C.analyze({X:'A',Y:'B',Z:'C'},{A:'Y',B:'Z',C:'X'}).blocked.length,3));
test('dependent not cycle member',()=>{let r=C.analyze({X:'A',Y:'B',Z:'C'},{A:'Y',B:'X',C:'X'});assert.equal(r.blocked.length,3);assert.equal(r.cycleNodes.length,2)});
test('free lock',()=>assert.equal(C.analyze({X:'A',Y:null,Z:'C'},{A:'Y',B:null,C:'X'}).blocked.length,0));
test('self wait nonreentrant',()=>assert.deepEqual(C.analyze({X:'A'},{A:'X'}).cycleNodes,['A']));
test('unknown owner rejected',()=>assert.throws(()=>C.analyze({X:'evil'},{A:'X'})));
test('unknown resource rejected',()=>assert.throws(()=>C.analyze({X:'A'},{A:'Q'})));
let state={answers:{pre:answers('pre',false),post:answers('post'),recall:{}},confidence:{pre:{},post:{},recall:{}},completedAt:new Date().toISOString()};let r=C.report(L,state);
test('export consistent',()=>assert.equal(r.deltaPercentagePoints,100));
test('import recalculates not trusts totals',()=>{r.before.right=999;r.after.right=-100;const s=C.restore(L,r);assert.equal(C.score(L,'post',s.answers.post).right,6)});
test('old schema rejected',()=>assert.throws(()=>C.restore(L,{...r,schema:1})));
test('bad completion rejected',()=>assert.throws(()=>C.restore(L,{...r,completedAt:'tomorrow'})));
test('invalid imported choice rejected',()=>{const t=JSON.parse(JSON.stringify(r));t.before.evidence[0].choice=200;assert.throws(()=>C.restore(L,t))});
test('distinct stems and ids',()=>{const qs=['pre','practice','post','recall'].flatMap(x=>L[x]);assert.equal(new Set(qs.map(q=>q.id)).size,qs.length);assert.equal(new Set(qs.map(q=>q.prompt)).size,qs.length)});
test('source quotes are exact',()=>{for(const c of L.concepts)assert.ok(L.pages.find(p=>p.page===c.page).text.includes(c.quote))});
// Exhaust all 4^3 lock-ownership x 4^3 waiting states: 4096 small finite states.
test('exhaustive model invariants 4096 states',()=>{const vals=[null,'A','B','C'],rs=[null,'X','Y','Z'];for(let n=0;n<4096;n++){let v=n,o={},w={};for(const k of ['X','Y','Z']){o[k]=vals[v%4];v=Math.floor(v/4)}for(const k of ['A','B','C']){w[k]=rs[v%4];v=Math.floor(v/4)}const a=C.analyze(o,w);assert.equal(a.order.length+a.blocked.length,3);assert.equal(new Set(a.order).size,a.order.length);assert.equal(a.blocked.length===0,a.cycles.length===0);for(const t of a.cycleNodes)assert.ok(a.blocked.includes(t));}});
console.log(count+' core tests passed');
