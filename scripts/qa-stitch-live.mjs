import {createStitchComparison} from '../server/stitch-comparison.mjs'
import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
const id=randomUUID(),catalog=async()=>(await(await fetch('http://127.0.0.1:8787/api/tools')).json()).tools
const service=createStitchComparison({catalog})
const request={id,prompt:'今晚看什么：从豆瓣热门电影选择。用海报舞台展示候选，可以按类型和片长筛选，选择两部比较，展开故事简介与演员详情，再返回保留选择。画面紧凑，有电影杂志的设计感。',cardSize:'square',width:432,height:432,toolsEnabled:true,designPreference:'pearl'}
await fs.mkdir('artifacts/stitch-comparison-qa',{recursive:true});await fs.writeFile('artifacts/stitch-comparison-qa/live-request.json',JSON.stringify(request,null,2))
console.log(await service.start(request))
let previous
while(true){const j=await service.get(id);if(previous!==j.status){console.log(JSON.stringify({id,status:j.status,error:j.error,elapsedMs:j.elapsedMs,plannedTools:j.plannedTools}));previous=j.status}if(['ready','error','cancelled','interrupted'].includes(j.status)){await fs.writeFile('artifacts/stitch-comparison-qa/live-result.json',JSON.stringify(j,null,2));break}await new Promise(r=>setTimeout(r,2000))}
