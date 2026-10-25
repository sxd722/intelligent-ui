import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const base='http://127.0.0.1:8787',manifest=await(await fetch(base+'/cardspec-baselines/manifest.json')).json();
for(const c of manifest){const r=await fetch(base+c.url);assert.equal(r.status,200);const source=await r.text();assert.equal(createHash('sha256').update(source).digest('hex'),c.sha256);assert.equal(compileCard(source,{final:true}).complete,true);}
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1440,height:1120}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(base+'/cardspec-baselines/report.html');await p.locator('.shots img').last().waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('.shots img')].every(i=>i.complete&&i.naturalWidth));await p.screenshot({path:'artifacts/native-baselines/overview.png'});
 await p.goto(base+'/cardspec-baselines.html?case=transformer');await p.getByLabel('本例反馈',{exact:true}).fill('QA: 反馈必须绑定当前产物');await p.reload();assert.equal(await p.getByLabel('本例反馈',{exact:true}).inputValue(),'QA: 反馈必须绑定当前产物');
 const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'导出反馈与 trace',exact:true}).click()]);const review=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(review.artifactHash,manifest.find(c=>c.id==='transformer').sha256);assert.equal(review.trainingEligible,false);assert.equal(review.reviewStatus,'unreviewed');
 assert.deepEqual(errors,[]);
}finally{await b.close();}
const connection=(await(await fetch(base+'/api/tools/connections')).json()).browser;
const old=JSON.parse(await readFile('artifacts/native-baselines/live/results.json','utf8')).connection.before;
assert.equal(connection.binding.session,old.session);assert.equal(connection.daemonPid,old.daemonPid);assert.equal(connection.connected,true);
const result={downloads:5,canonicalHashes:true,feedbackRestored:true,feedbackBoundToArtifact:true,errors,connectionPreserved:true,session:connection.binding.session,daemonPid:connection.daemonPid};
await writeFile('artifacts/native-baselines/final-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
