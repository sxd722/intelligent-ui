import {build} from 'esbuild'
import {readFile,writeFile} from 'node:fs/promises'
import {CASES,ROOT,DEST} from './engine-v3.mjs'
import {launchBrowser,inspect} from './browser-v3.mjs'
await build({entryPoints:['scripts/binding-experiment/viewer-v3.jsx'],bundle:true,format:'esm',platform:'browser',outfile:DEST+'/viewer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.ttf':'file','.woff':'file','.png':'file'},logLevel:'error'})
const runs=JSON.parse(await readFile(ROOT+'/results.json','utf8')),browser=await launchBrowser(),results=[]
const jobs=runs.filter(r=>r.complete).flatMap(r=>(process.argv.includes('--six')?[320,360,432]:[432]).flatMap(width=>(process.argv.includes('--six')?['square','auto']:['square']).map(size=>({r,width,size}))))
let writing=Promise.resolve()
try{await Promise.all(Array.from({length:3},async()=>{while(jobs.length){const {r,width,size}=jobs.shift();const result=await inspect(browser,CASES.find(c=>c.id===r.case),r,{width,size,dir:ROOT});results.push(result);writing=writing.then(()=>writeFile(ROOT+'/replay.json',JSON.stringify(results,null,2)));await writing;console.log(JSON.stringify({id:r.id,width,size,passed:result.passed,errors:result.checks.filter(c=>!c.passed)}))}}))}finally{await browser.close()}
