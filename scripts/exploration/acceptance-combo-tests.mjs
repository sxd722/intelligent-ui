import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {checkComboCheckpoint,expectedQuestionRecords,observedPath} from './acceptance-combo.mjs'
const {tasks}=JSON.parse(await readFile(new URL('../../experiments/round1-20261117/tasks/combo.json',import.meta.url),'utf8'))
const oracles=JSON.parse(await readFile(new URL('../../experiments/round1-20261117/tasks/oracles-combo.json',import.meta.url),'utf8')).tasks
test('workflow exact completed set and independent count/effort reject residual downstream state',()=>{
 const task=tasks[0],expected=oracles[task.id].paths[1].expected,mapping={completed:{path:'state.done',kind:'array'},count:'derived.count',effortMinutes:'derived.minutes',delivered:'derived.delivered'},snapshot={state:{done:['permission','collect']},derived:{count:2,minutes:6,delivered:false}}
 assert.ok(checkComboCheckpoint(task,snapshot,expected,mapping,'fixture').every(c=>c.status==='passed'))
 const bad=structuredClone(snapshot);bad.state.done.push('review');const checks=checkComboCheckpoint(task,bad,expected,mapping,'fixture');assert.equal(checks.find(c=>c.id==='dependency-invariant').status,'failed');assert.equal(checks.find(c=>c.id==='completed-set').status,'failed')
})
test('oracle transcript paths determine exact composite note anchors independently of generated code',()=>{
 for(const p of oracles[tasks[1].id].paths){const rows=expectedQuestionRecords(tasks[1],p);assert.equal(rows.length,2);assert.equal(new Set(rows.map(q=>JSON.stringify([q.recordingId,q.sourceId,q.segmentId]))).size,2)}
})
test('transcript rejects identical segment ID with wrong recording/source even if displayed passage matches',()=>{
 const task=tasks[1],expected=oracles[task.id].paths[0].expected,record=task.data.segments.find(s=>Object.entries(expected.selection).every(([k,v])=>s[k]===v))
 const mapping={selection:{recordingId:'state.r',sourceId:'state.v',segmentId:'state.s'},startSeconds:'derived.start',endSeconds:'derived.end',questions:{kind:'array',path:'state.notes',fields:{recordingId:'recordingId',sourceId:'sourceId',segmentId:'segmentId',text:'text'}}}
 const snapshot={state:{r:'workshop',v:'auto',s:'s2',notes:expectedQuestionRecords(task,oracles[task.id].paths[0])},derived:{start:24,end:50},text:record.text}
 assert.ok(checkComboCheckpoint(task,snapshot,expected,mapping,'fixture').every(c=>c.status==='passed'))
 snapshot.state.notes.find(n=>n.recordingId==='workshop').recordingId='rainwalk';assert.equal(checkComboCheckpoint(task,snapshot,expected,mapping,'fixture').find(c=>c.id==='anchored-question').status,'failed')
 snapshot.state.r='rainwalk';assert.equal(checkComboCheckpoint(task,snapshot,expected,mapping,'fixture').find(c=>c.id==='composite-selection').status,'failed')
})
test('unobservable mapping is unverified, not silently passed or made into a product failure',()=>{
 const checks=checkComboCheckpoint(tasks[0],{},oracles[tasks[0].id].paths[0].expected,{},'fixture');assert.ok(checks.every(c=>c.status==='unverified'))
 assert.deepEqual(observedPath({},'__proto__.value'),{found:false})
})
