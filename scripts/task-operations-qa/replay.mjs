import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {CASES,ROOT} from './cases.mjs'
import {inspectTask} from './browser.mjs'
const runs=JSON.parse(await readFile(ROOT+'/model-v3-results.json','utf8')),browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
const jobs=runs.filter(r=>r.complete).flatMap(r=>[320,360,432].flatMap(width=>['square','auto'].map(size=>({r,width,size}))))
try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length){const {r,width,size}=jobs.shift(),result=await inspectTask(browser,CASES.find(c=>c.id===r.case),r.id,width,size);results.push(result);console.log(JSON.stringify({id:r.id,width,size,passed:result.passed,fail:result.checks.filter(c=>!c.passed)}))}}))}finally{await browser.close()}
await writeFile(ROOT+'/model-v3-browser.json',JSON.stringify(results,null,2))
