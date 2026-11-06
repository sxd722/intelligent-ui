import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createStreamNarrative,readableOutput,usageLabel} from '../src/stream-narrative.mjs'

test('reconstructs batched and shorthand deltas, including tool interruptions',()=>{
 const n=createStreamNarrative()
 n.push({type:'phase_begin',id:'a',title:'生成',phase:'dsl'},100)
 n.push({p:'',o:'add',v:{message:{reasoning:'',content:{parts:['']}}}},110)
 n.push({o:'patch',v:[{p:'/message/reasoning',o:'append',v:'## 分析\n'}, {p:'/message/content/parts/0',o:'append',v:'<card>'}]},120)
 n.push({v:'hello'},130)
 n.push({type:'research',tool:'cli_read',status:'running',input:{id:'opencli.douban.search',input:{keyword:'电影'}}},200)
 n.push({type:'research',tool:'cli_read',status:'succeeded'},700)
 n.push({p:'/message/reasoning',o:'append',v:'已获取资料'},710)
 const s=n.snapshot(),output=s.entries.find(e=>e.kind==='output'),tool=s.entries.find(e=>e.kind==='tool')
 assert.equal(output.text,'<card>hello');assert.equal(tool.elapsedMs,500);assert.equal(tool.estimated,true)
 assert.match(tool.title,/opencli.douban.search/);assert.match(tool.text,/关键词：电影/)
 assert.deepEqual(s.entries.filter(e=>e.kind==='reasoning').map(e=>e.text),['## 分析\n','已获取资料'])
 n.push({p:'/message/reasoning',o:'replace',v:'更正后的说明'},750)
 assert.deepEqual(s.entries.filter(e=>e.kind==='reasoning').map(e=>e.text),['更正后的说明'])
})

test('phase reset isolates text and preserves history beyond the raw frame limit',()=>{
 const n=createStreamNarrative();n.push({type:'phase_begin',id:'a',phase:'plan'},0)
 for(let i=0;i<510;i++)n.push(i?{v:'字'}:{p:'/message/reasoning',o:'append',v:'字'},i)
 n.push({type:'phase_begin',id:'b',phase:'dsl'},600)
 n.push({p:'/message/reasoning',o:'append',v:'新阶段'},610)
 assert.deepEqual(n.snapshot().entries.filter(e=>e.kind==='reasoning').map(e=>e.text.length),[510,3])
 assert.equal(createStreamNarrative().snapshot().entries.length,0)
})

test('reports only provided usage and server timing, never adds duplicate snapshot totals',()=>{
 const n=createStreamNarrative();n.push({type:'phase_begin',id:'a',title:'卡片成型',phase:'dsl'},0)
 n.push({type:'research_model',model:'glm',usage:{prompt_tokens:0,completion_tokens:20,total_tokens:20}},100)
 n.push({type:'phase_end',status:'succeeded'},200)
 n.push({type:'server_ste_metadata',metadata:{phases:{dsl:180},total_ms:210,usage:{total_tokens:20}}},230)
 assert.equal(n.snapshot().entries[0].elapsedMs,180);assert.equal(n.snapshot().entries[0].estimated,false)
 assert.equal(usageLabel(undefined),'');assert.match(usageLabel({prompt_tokens:0}),/输入 0 tokens/)
 assert.equal(n.snapshot().entries.filter(e=>e.kind==='model').length,1)
 assert.match(readableOutput('{"goal":"探索","followups":["比较"]}'),/目标：探索/)
 assert.equal(readableOutput('<script>alert(1)</script>'),'<script>alert(1)</script>') // React renders this as text.
})

test('real recorded research stream preserves tools and reasoning without compiled payloads',()=>{
 const path='artifacts/compact-planner-live-20261029/initial-trace.json'
 if(!fs.existsSync(path))return
 const n=createStreamNarrative(),frames=JSON.parse(fs.readFileSync(path,'utf8'))
 for(const [i,row] of frames.entries())n.push(row.frame||row,row.at??i)
 const s=n.snapshot();assert.ok(s.entries.some(e=>e.kind==='tool'&&e.title.includes('ctrip')))
 assert.ok(s.entries.some(e=>e.kind==='reasoning'&&e.text.length>10))
 assert.equal(s.status,'完成');assert.equal(s.totalMs,148503)
 assert.ok(!s.entries.some(e=>e.text.includes('card_spec')))
})
