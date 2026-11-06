import {chromium} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage(),checks=[]
const check=async(name,fn)=>{try{await fn();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}}
try{
 await p.route('**/api/tools/assets/**',r=>r.fulfill({status:404,body:'not found'}))
 await p.goto('http://127.0.0.1:8787/tooling-p0p1/viewer.html?id=movies-atlas-4x4&width=432&badImage=1');await p.waitForSelector('.tool-stage')
 await check('failed-images-retain-functional-poster',async()=>{await p.waitForSelector('.ts-image [aria-label="暂无来源图片"]');await p.getByRole('button',{name:'加入对比',exact:true}).click();await p.getByRole('button',{name:'下一项',exact:true}).click();await p.getByRole('button',{name:'加入对比',exact:true}).click();if(await p.locator('.ts-compare>span').count()!==2)throw Error('compare count')})
 await check('comparison-bounded-to-two',async()=>{await p.getByRole('button',{name:'下一项',exact:true}).click();await p.getByRole('button',{name:'加入对比',exact:true}).click();if(await p.locator('.ts-compare>span').count()!==2)throw Error('more than two')})
 await check('filter-preserves-selected-set',async()=>{await p.getByRole('button',{name:'筛选候选',exact:true}).click();await p.getByRole('textbox',{name:'筛选已获取候选',exact:true}).fill('千与');await p.getByRole('button',{name:'筛选候选',exact:true}).click();if(await p.locator('.ts-compare>span').count()!==2)throw Error('filtered away previous selection')})
 await check('failure-keeps-last-successful-content',async()=>{await p.evaluate(()=>window.qaFail=true);await p.getByRole('button',{name:'数据',exact:true}).click();await p.getByRole('button',{name:'刷新数据',exact:true}).click();await p.waitForFunction(()=>Object.values(window.qaSession.current().bindings).some(b=>b.status==='error'));await p.getByRole('button',{name:'数据',exact:true}).click();if(!await p.locator('.tool-stage').isVisible())throw Error('content lost')})
}finally{await b.close()}
await writeFile('artifacts/tooling-p0p1-20261103/stage-state.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks))
