import {createHash} from 'node:crypto'
export function validateCompletion(job,record,qa,tests,source){
 const digest=s=>createHash('sha256').update(s).digest('hex')
 if(record.status!=='compiled'||record.sourceHash!==digest(source)||qa.artifactHash!==record.artifactHash||Date.parse(qa.at)<job.startedAt||qa.testsHash!==digest(JSON.stringify(tests)))throw Error('需要本次任务的新源码检查及交互验证')
 if(!Array.isArray(qa.results)||qa.results.length!==6||new Set(qa.results.map(x=>`${x.width}:${x.size}`)).size!==6||![320,360,432].every(w=>['square','auto'].every(s=>qa.results.some(x=>x.width===w&&x.size===s&&x.passed))))throw Error('六种尺寸的交互检查尚未全部通过')
}
