import fs from 'node:fs/promises'
import {renderStitchMock} from '../server/stitch-static-mock.mjs'
const file='artifacts/stitch-comparison-qa/live-result.json',job=JSON.parse(await fs.readFile(file,'utf8')),directory='artifacts/stitch-comparison/'+job.id
const html=await fs.readFile(directory+'/screen.html','utf8')
job.preview=await renderStitchMock(html,{output:directory+'/mock.png',width:job.width,tools:job.candidates.map(t=>t.id),signal:AbortSignal.timeout(45000)})
await fs.writeFile(file,JSON.stringify(job,null,2));const record=JSON.parse(await fs.readFile(directory+'/job.json','utf8'));record.preview=job.preview;await fs.writeFile(directory+'/job.json',JSON.stringify(record,null,2));console.log(JSON.stringify(job.preview))
