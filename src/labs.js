/* LearnProof lab engines. One deterministic simulator per lesson.
   Pure functions, no DOM, no network. Browser: LPLabs. Node: module.exports. */
(function(root){
'use strict';

/* ---------- 1. Deadlock waiting-state model (single-instance locks) ----------
   owners: {resource: thread|null}; waits: {thread: resource|null}.
   One instance per non-reentrant lock; requests block; a thread has at most
   one pending request; blocked threads keep their locks. A thread with no
   remaining blocker can finish and release its locks. */
function deadlockAnalyze(owners,waits){
  const ts=Object.keys(waits),resources=Object.keys(owners);
  if(ts.length>8||resources.length>8)throw Error('State too large');
  if(resources.some(r=>owners[r]!==null&&!ts.includes(owners[r])))throw Error('Unknown owner');
  if(ts.some(t=>waits[t]!==null&&!resources.includes(waits[t])))throw Error('Unknown resource');
  const edges={};
  for(const t of ts)edges[t]=waits[t]===null?null:owners[waits[t]];
  const done=new Set(),order=[];
  let changed=true;
  while(changed){
    changed=false;
    for(const t of ts){
      if(done.has(t))continue;
      if(edges[t]===null||done.has(edges[t])){done.add(t);order.push(t);changed=true;}
    }
  }
  const cycles=[],cycleKeys=new Set();
  for(const start of ts){
    let t=start;const chain=[];
    while(t!==null&&!chain.includes(t)){chain.push(t);t=edges[t];}
    if(t!==null){
      const c=chain.slice(chain.indexOf(t)),key=[...c].sort().join(',');
      if(!cycleKeys.has(key)){cycleKeys.add(key);cycles.push(c);}
    }
  }
  return {edges,order,blocked:ts.filter(t=>!done.has(t)),cycles,cycleNodes:[...new Set(cycles.flat())]};
}

/* ---------- 2. CPU scheduling (uniprocessor, no I/O) ----------
   jobs: [{id, arrival, burst}] integers, arrival>=0, burst>=1, at most 6 jobs.
   policy: 'fcfs' | 'sjf' (both non-preemptive) | 'rr' (quantum 1..5).
   Returns timeline slices plus per-job waiting/turnaround and averages. */
function schedule(jobs,policy,quantum){
  if(!Array.isArray(jobs)||!jobs.length||jobs.length>6)throw Error('Between 1 and 6 jobs');
  if(!['fcfs','sjf','rr'].includes(policy))throw Error('Unknown policy');
  if(policy==='rr'&&(!Number.isInteger(quantum)||quantum<1||quantum>5))throw Error('Quantum must be 1 to 5');
  const js=jobs.map(j=>{
    if(!j.id||!Number.isInteger(j.arrival)||j.arrival<0||j.arrival>99||!Number.isInteger(j.burst)||j.burst<1||j.burst>99)
      throw Error('Each job needs an id, an arrival of 0-99 and a burst of 1-99');
    return {id:String(j.id),arrival:j.arrival,burst:j.burst,remaining:j.burst};
  });
  if(new Set(js.map(j=>j.id)).size!==js.length)throw Error('Job ids must be unique');
  const byArrival=(a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id);
  const timeline=[];let t=0;const perJob={};
  for(const j of js)perJob[j.id]={completion:null};
  if(policy==='rr'){
    const ready=[],pending=[...js].sort(byArrival);let current=null,i=0;
    const arrivalsAt=time=>{while(i<pending.length&&pending[i].arrival<=time)ready.push(pending[i++]);};
    arrivalsAt(0);
    while(true){
      if(current===null){
        if(!ready.length){
          if(i>=pending.length)break;
          const next=pending[i].arrival;
          if(t<next){timeline.push({job:null,start:t,end:next});t=next;}
          arrivalsAt(t);continue;
        }
        current=ready.shift();
      }
      const slice=Math.min(quantum,current.remaining);
      timeline.push({job:current.id,start:t,end:t+slice});
      t+=slice;current.remaining-=slice;
      arrivalsAt(t);
      if(current.remaining===0){perJob[current.id].completion=t;current=null;}
      else ready.push(current),current=null;
    }
  }else{
    const done=new Set();
    while(done.size<js.length){
      const avail=js.filter(j=>!done.has(j.id)&&j.arrival<=t);
      if(!avail.length){
        const next=Math.min(...js.filter(j=>!done.has(j.id)).map(j=>j.arrival));
        timeline.push({job:null,start:t,end:next});t=next;continue;
      }
      let pick;
      if(policy==='fcfs')avail.sort(byArrival),pick=avail[0];
      else avail.sort((a,b)=>a.burst-b.burst||byArrival(a,b)),pick=avail[0];
      timeline.push({job:pick.id,start:t,end:t+pick.burst});
      t+=pick.burst;perJob[pick.id].completion=t;done.add(pick.id);
    }
  }
  for(const j of js){
    const p=perJob[j.id];
    p.turnaround=p.completion-j.arrival;
    p.waiting=p.turnaround-j.burst;
  }
  const n=js.length;
  return {policy,quantum:policy==='rr'?quantum:null,timeline,perJob,
    avgWaiting:js.reduce((s,j)=>s+perJob[j.id].waiting,0)/n,
    avgTurnaround:js.reduce((s,j)=>s+perJob[j.id].turnaround,0)/n};
}

/* ---------- 3. Demand paging: FIFO / LRU / OPT replacement ----------
   refs: array of page ids (integers 0..9, at most 20). frames: 1..5.
   Returns per-step frame contents, fault flags, evictions and totals. */
function pageFaults(refs,frames,policy){
  if(!Array.isArray(refs)||!refs.length||refs.length>20)throw Error('Between 1 and 20 references');
  if(refs.some(p=>!Number.isInteger(p)||p<0||p>9))throw Error('Pages are integers 0-9');
  if(!Number.isInteger(frames)||frames<1||frames>5)throw Error('Frames must be 1 to 5');
  if(!['fifo','lru','opt'].includes(policy))throw Error('Unknown policy');
  const mem=[],steps=[];let faults=0;
  const loaded=[];
  refs.forEach((page,i)=>{
    let evicted=null;
    const hit=mem.includes(page);
    if(!hit){
      faults++;
      if(mem.length<frames){mem.push(page);loaded.push(page);}
      else{
        let victim;
        if(policy==='fifo')victim=loaded[0];
        else if(policy==='lru'){
          victim=mem.reduce((old,p)=>{
            const lastUse=refs.lastIndexOf(p,i-1);
            return lastUse<refs.lastIndexOf(old,i-1)?p:old;
          });
        }else{
          victim=mem.reduce((best,p)=>{
            const nextUse=refs.indexOf(p,i+1)===-1?Infinity:refs.indexOf(p,i+1);
            return nextUse> (refs.indexOf(best,i+1)===-1?Infinity:refs.indexOf(best,i+1))?p:best;
          });
        }
        evicted=victim;
        mem[mem.indexOf(victim)]=page;
        loaded[loaded.indexOf(victim)]=page;
      }
    }
    steps.push({page,hit,fault:!hit,evicted,frames:[...mem]});
  });
  return {policy,frames,faults,hits:refs.length-faults,steps};
}

/* ---------- 4. Transaction schedules: conflict serializability ----------
   ops: ordered [{t, op:'R'|'W', item}] over transactions and data items.
   A conflict is two ops on the same item, different transactions, at least one
   write, in schedule order. Serializable iff the precedence graph is acyclic. */
function scheduleCheck(ops){
  if(!Array.isArray(ops)||ops.length<2||ops.length>14)throw Error('Between 2 and 14 operations');
  const ts=new Set(),items=new Set();
  for(const o of ops){
    if(!/^[A-Z]$/.test(o.t)||!['R','W'].includes(o.op)||!/^[A-Z]$/.test(o.item))throw Error('Operations need a transaction, R or W, and an item');
    ts.add(o.t);items.add(o.item);
  }
  if(ts.size<2)throw Error('Use at least two transactions');
  const conflicts=[],adj={};
  for(const t of ts)adj[t]=new Set();
  for(let i=0;i<ops.length;i++)for(let j=i+1;j<ops.length;j++){
    const a=ops[i],b=ops[j];
    if(a.t===b.t||a.item!==b.item)continue;
    if(a.op==='R'&&b.op==='R')continue;
    conflicts.push({first:{...a,pos:i},second:{...b,pos:j},item:a.item});
    adj[a.t].add(b.t);
  }
  /* cycle search over the precedence graph */
  const cycles=[],keys=new Set();
  for(const start of ts){
    const stack=[[start,[start]]];
    while(stack.length){
      const [node,path]=stack.pop();
      for(const next of adj[node]){
        if(next===start&&path.length>1){
          const key=[...path].sort().join(',');
          if(!keys.has(key)){keys.add(key);cycles.push([...path,start]);}
        }else if(!path.includes(next)&&path.length<ts.size+1){
          stack.push([next,[...path,next]]);
        }
      }
    }
  }
  /* topological order when acyclic */
  let serialOrder=null;
  if(!cycles.length){
    const indeg={};for(const t of ts)indeg[t]=0;
    for(const t of ts)for(const n of adj[t])indeg[n]++;
    const queue=[...ts].filter(t=>indeg[t]===0).sort(),order=[];
    const work={};for(const t of ts)work[t]=new Set(adj[t]);
    while(queue.length){
      const t=queue.shift();order.push(t);
      for(const n of work[t]){if(--indeg[n]===0){queue.push(n);queue.sort();}}
    }
    if(order.length===ts.size)serialOrder=order;
  }
  return {transactions:[...ts].sort(),items:[...items].sort(),conflicts,
    edges:[...ts].sort().flatMap(t=>[...adj[t]].sort().map(n=>t+'->'+n)),
    cycles,serializable:cycles.length===0,serialOrder};
}

const api={deadlockAnalyze,schedule,pageFaults,scheduleCheck};
if(typeof module!=='undefined')module.exports=api;
root.LPLabs=api;
})(typeof window==='undefined'?globalThis:window);
