import {readFile,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {sha256} from './acceptance.mjs'
const d=resolve('experiments/round1-20261117/runs/screen-04-luminous-library-S1-r3'),f=join(d,'live-browser-1794902575549/evidence.json'),raw=await readFile(f,'utf8'),x=JSON.parse(raw),r=JSON.parse(await readFile(join(d,'result.json'),'utf8'))
const get=label=>x.evidence.find(e=>e.label===label)?.snapshot
const initial=get('01-initial'),first=get('04-pin'),changed=get('05-query'),detail=get('06-detail'),restored=get('09-restored')
const calls=detail.calls,page=calls.find(c=>c.tool.endsWith('.page')).result.value.items[0]
const pin=first.state.pins[0]
const audit={version:'independent-live-evidence-audit-r1',sourceHash:sha256(r.source),sourceMatches:x.sourceHash===sha256(r.source),evidenceHash:sha256(raw),mode:x.mode,newLiveCalls:0,existingLiveCalls:x.requests,requests:calls.map(c=>({tool:c.tool,input:c.input,mode:c.mode,startedAt:c.startedAt,completedAt:c.completedAt,resultHash:sha256(c.result)})),checks:[
 {id:'query-changes-real-results',status:'passed',actual:{before:initial.derived.hits.map(x=>x.title),after:changed.derived.hits.map(x=>x.title)}},
 {id:'detail-adds-information',status:page.extract.length>initial.derived.hits[0].snippet.length?'passed':'failed',actual:{title:page.title,extractLength:page.extract.length,snippetLength:initial.derived.hits[0].snippet.length}},
 {id:'first-pin-literal',status:page.extract.includes(pin.excerpt)&&pin.url===page.url?'passed':'failed',actual:{title:pin.title,url:pin.url,length:pin.excerpt.length}},
 {id:'changed-object-body-identity',status:'failed',actual:{selected:detail.state.picked,returnedPage:page.title,pageRequests:calls.filter(c=>c.tool.endsWith('.page')).map(c=>c.input.title),displayContainsOldBody:detail.text.includes('bioluminescence')}},
 {id:'new-detail-read',status:'failed',actual:detail.controls.filter(c=>/读取正文|加载正文/.test(c.name)).map(c=>c.name),note:'No new page request and no Read control after selection; old extract gates it away.'},
 {id:'explicit-refresh-return',status:'unverified',actual:x.evidence.filter(e=>e.unverified),note:'A label saying 08-refresh is not evidence that a refresh occurred.'},
 {id:'saved-record-restore',status:JSON.stringify(first.state.pins)===JSON.stringify(restored.state.pins)?'passed':'failed',actual:{pins:restored.state.pins.map(p=>({title:p.title,url:p.url,length:p.excerpt.length})),selected:restored.state.picked},note:'Restore persists old body contamination; not end-to-end task success.'}
 ],result:'failed',classification:['model-entity-identity','model-manual-binding-gating'],sourceUnmodified:true,evidenceFile:f,blocked:x.blocked,errors:x.errors,notes:['No live request executed by independent evaluator.','Fixed replay independently reproduces corrupt second pin; live evidence only pinned first object.','Source link destination was not independently clicked.']}
await writeFile(join(d,'evaluation/calibration-r4-independent/live-audit.json'),JSON.stringify(audit,null,2))
let a=JSON.parse(await readFile(join(d,'acceptance.json'),'utf8'));a.liveAudit={status:audit.result,mode:audit.mode,existingLiveCalls:x.requests,evidenceFile:join(d,'evaluation/calibration-r4-independent/live-audit.json')};await writeFile(join(d,'acceptance.json'),JSON.stringify(a,null,2))
console.log(JSON.stringify({sourceMatches:audit.sourceMatches,requests:x.requests,checks:audit.checks.map(c=>({id:c.id,status:c.status}))}))
