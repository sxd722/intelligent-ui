import { mkdir, writeFile } from 'node:fs/promises'
import { FIXTURES } from '../shared/cardspec/fixtures.mjs'
const base=process.argv[2] || 'http://127.0.0.1:8787', dir='artifacts/planning-qa'
await mkdir(dir,{recursive:true})
const history=[{role:'user',content:'做一张喝水打卡卡片'}, {role:'assistant',content:FIXTURES.water}]
const results=[]
for(const [name,messages,mode] of [
  ['history-cloud',[...history,{role:'user',content:'世界各个云服务厂商服务比较'}],'staged'],
  ['followup-water',[...history,{role:'user',content:'把目标改成每天6杯，并加一个归零按钮'}],'staged'],
]) {
  const response=await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format:'cardspec',mode,messages})})
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  const text=await response.text()
  const frames=text.split(/\r?\n/).filter(l=>l.startsWith('data: ')&&l!=='data: [DONE]').map(l=>JSON.parse(l.slice(6)))
  await writeFile(`${dir}/${name}.json`,JSON.stringify(frames,null,2))
  const phases=[];let current
  for(const f of frames) {
    if(f.type==='phase_begin') {current={phase:f.phase,calls:1,source:''};phases.push(current)}
    if(f.o==='patch') for(const op of f.v) {
      if(op.p==='/message/metadata'&&op.v.model_call_count) current.calls=op.v.model_call_count
      if(op.p==='/message/content/parts/0') current.source=op.o==='replace' ? op.v : current.source+op.v
    }
  }
  const metadata=frames.find(f=>f.type==='server_ste_metadata')?.metadata
  if (phases.some(p=>p.phase==='dsl')) phases.find(p=>p.phase==='dsl').calls=1+(metadata?.repair_count || 0)
  const result={name,status:frames.find(f=>f.type==='message_stream_complete')?.status,metadata,
    phases:phases.map(p=>({phase:p.phase,calls:p.calls,characters:p.source.length,startsWith:p.source.slice(0,40)})),
    notes:frames.filter(f=>f.type==='stream_note'||f.type==='stream_error')}
  results.push(result);console.log(JSON.stringify(result))
}
await writeFile(`${dir}/summary.json`,JSON.stringify(results,null,2))
if(results.some(r=>r.status!=='succeeded'||r.metadata.plan_repair_count!==0)) process.exitCode=1
