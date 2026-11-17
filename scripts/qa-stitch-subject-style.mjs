import {createStitchComparison} from '../server/stitch-comparison.mjs'
import {randomUUID} from 'node:crypto'
import {writeFile,mkdir} from 'node:fs/promises'
const dir='artifacts/compact-flow',service=createStitchComparison({catalog:async()=>[]})
await mkdir(dir,{recursive:true})
const report=[]
for(const prompt of [
 '乞力马扎罗登山路线选择。为阅读障碍用户用大字号、图片和紧凑的四路线候选帮助比较天数与住宿，选一条后展示高度剖面与当前日程。只做一张432px卡片的首屏，不需要完整旅行App。',
 '给孩子的森林观察卡：在树叶、鸟和蘑菇三个对象之间选择，放大观察特征，勾选今天的发现，显示已发现数量。只做一张432px卡片，有趣且易操作。'
]){
 const input={id:randomUUID(),prompt,cardSize:'square',width:432,toolsEnabled:false,designPreference:'academy'}
 await service.start(input)
 let job;do{await new Promise(r=>setTimeout(r,2000));job=await service.get(input.id)}while(!['ready','error','interrupted','cancelled'].includes(job.status))
 report.push(job);await writeFile(dir+'/stitch-subjects.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify({id:job.id,status:job.status,project:job.project,elapsedMs:job.elapsedMs,error:job.error}))
}
