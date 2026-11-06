import {chromium} from '@playwright/test'
import {readFile,writeFile,copyFile,access} from 'node:fs/promises'
const root='artifacts/stitch-samples-20261103',dest='dist/stitch-samples',records=JSON.parse(await readFile(root+'/export.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true}),out=[]
try{for(const r of records){const existing=`${root}/screens/${r.id}-preview.png`;try{await access(existing);continue}catch{}
 const page=await browser.newPage({viewport:{width:432,height:600},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 try{await page.goto(`http://127.0.0.1:8787/stitch-samples/screens/${r.id}.html`,{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await page.evaluate(()=>document.fonts.ready)
 const dimensions=await page.evaluate(()=>{const all=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE','SVG','PATH'].includes(e.tagName)).map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>300&&r.height>300&&r.width<800&&r.height<800).sort((a,b)=>(Math.abs(a.r.width-368)+Math.abs(a.r.height-368))-(Math.abs(b.r.width-368)+Math.abs(b.r.height-368)));const x=all[0];if(!x)return null;x.e.setAttribute('data-stitch-preview','true');return {width:x.r.width,height:x.r.height,scrollHeight:x.e.scrollHeight,clientHeight:x.e.clientHeight}})
 if(dimensions)await page.locator('[data-stitch-preview]').screenshot({path:existing});else await page.screenshot({path:existing})
 const brokenImages=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.alt||'未命名图片'))
 await copyFile(existing,`${dest}/screens/${r.id}-preview.png`);out.push({id:r.id,dimensions,errors,brokenImages});console.log(JSON.stringify(out.at(-1)))}finally{await page.close()}
}}finally{await browser.close()}
let old=[];try{old=JSON.parse(await readFile(root+'/preview-checks.json','utf8'))}catch{}
await writeFile(root+'/preview-checks.json',JSON.stringify([...old.filter(o=>!out.some(n=>n.id===o.id)),...out],null,2))
