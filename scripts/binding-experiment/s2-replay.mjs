import {readFile,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {S2_CASES,ROOT} from './s2-engine.mjs'
import {inspectS2} from './s2-browser.mjs'
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
try{results.push(...JSON.parse(await readFile(ROOT+'/replay.json','utf8')))}catch{}
let writing=Promise.resolve()
try{for(;;){
 const runs=JSON.parse(await readFile(ROOT+'/results.json','utf8'))
 const jobs=runs.filter(r=>r.complete).flatMap(r=>[320,360,432].flatMap(width=>['square','auto'].map(size=>({r,width,size})))).filter(j=>!results.some(x=>x.id===j.r.id&&x.width===j.width&&x.size===j.size))
 await Promise.all(Array.from({length:3},async()=>{while(jobs.length){const {r,width,size}=jobs.shift();const result=await inspectS2(browser,S2_CASES.find(c=>c.id===r.case),r,{width,size,dir:ROOT});results.push(result);writing=writing.then(()=>writeFile(ROOT+'/replay.json',JSON.stringify(results,null,2)));await writing;console.log(JSON.stringify({id:r.id,width,size,passed:result.passed}))}}))
 if(runs.length>=112||!process.argv.includes('--follow'))break
 await new Promise(r=>setTimeout(r,2000))
}}finally{await browser.close()}
