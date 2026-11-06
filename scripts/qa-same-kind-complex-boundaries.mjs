import {readFile,writeFile} from 'node:fs/promises'
for(const [id,prompt]of [['travel','保留原卡，同时新增一个按钮：调用glm.generate根据已选景点自动优化路线，生成下一页，并新增酒店比较功能。'],['care','把照护卡从四个事项变为六个事项，新增两个独立倒计时并自动发消息提醒下一位照护者。']]){
 const b=JSON.parse(await readFile(`artifacts/same-kind-complex/${id}-baseline.json`,'utf8')),at=Date.now(),r=await fetch('http://127.0.0.1:8787/api/cards/same-kind/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baselineId:b.id,prompt,modelProfile:'default'}),signal:AbortSignal.timeout(125000)}),body=await r.json();await writeFile(`artifacts/same-kind-complex/${id}-boundary.json`,JSON.stringify({http:r.status,elapsedMs:Date.now()-at,prompt,...body},null,2));console.log(id,r.status,body.error||'UNEXPECTED SUCCESS')
}
