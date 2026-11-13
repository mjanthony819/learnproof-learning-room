// LearnProof build: inlines lessons, styles, fonts and scripts into a single
// self-contained index.html. Run: node build.mjs   (no dependencies)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const styles=read('src/styles.css')
  .replace('url(__OD_REGULAR__)',"url('data:font/woff2;base64,"+fs.readFileSync(path.join(root,'fonts/OpenDyslexic-Regular.woff2.b64'),'utf8').replace(/\s+/g,'')+"')")
  .replace('url(__OD_BOLD__)',"url('data:font/woff2;base64,"+fs.readFileSync(path.join(root,'fonts/OpenDyslexic-Bold.woff2.b64'),'utf8').replace(/\s+/g,'')+"')")
  .replace('url(__OD_ITALIC__)',"url('data:font/woff2;base64,"+fs.readFileSync(path.join(root,'fonts/OpenDyslexic-Italic.woff2.b64'),'utf8').replace(/\s+/g,'')+"')");
if(styles.includes('url(__OD_'))throw Error('Font placeholder left unreplaced');

const packs=fs.readdirSync(path.join(root,'lessons')).filter(f=>f.endsWith('.json')).sort()
  .map(f=>JSON.parse(read('lessons/'+f)));

const core=read('src/core.js');
const labs=read('src/labs.js');
const app=read('src/app.js');

const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="LearnProof turns dense notes into source-linked learning paths, with actual answers behind every score."><title>LearnProof | The learning room</title><style>
${styles}</style></head><body><a class="skip" href="#main">Skip to learning content</a><div class="wrap"><header><button class="brand" data-action="home" aria-label="LearnProof library home">learnproof<span>◒</span></button><div class="head-right"><span class="head-note">A little clearer, one concept at a time.</span><button id="listen-btn" data-action="listen" aria-pressed="false">▶ Listen</button><button data-action="my">My learning</button><button data-action="access">Display &amp; access</button><button data-action="about">How it works</button></div></header><div class="layout no-rail"><nav class="rail" aria-label="Learning stages" id="rail"></nav><main class="content" id="main" tabindex="-1"></main></div><footer><div>LEARNPROOF / ACCESS TO UNDERSTANDING<br>A small library of reviewed learning rooms. No learner account. No provider calls.</div><div>Built by M J Anthony with AI assistance.<br><a href="#/about">Methods, privacy &amp; credits</a></div></footer></div><div id="toast" role="status" aria-live="polite"></div>
<script id="core-code">
${core}</script>
<script id="labs-code">
${labs}</script>
<script id="lesson-data" type="application/json">${JSON.stringify(packs).replace(/</g,'\\u003c')}</script>
<script id="app-code">
const LESSONS=JSON.parse(document.getElementById('lesson-data').textContent);
${app}</script></body></html>
`;
fs.writeFileSync(path.join(root,'index.html'),html);
fs.writeFileSync(path.join(root,'learnproof-offline.html'),html);
console.log('built index.html + learnproof-offline.html:',html.length,'bytes,',packs.length,'lesson packs');
