import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const base='https://device.tailnet.ts.net',out='artifacts/tailnet-qa';await mkdir(out,{recursive:true})
const checks=[]
for(const url of ['/','/workbench.html','/agent-workbench.html','/cardspec-lab.html','/demos/','/api/workbench/feedback','/api/tools']){const r=await fetch(base+url);if(!r.ok)throw Error(url+': '+r.status);checks.push({url,status:r.status})}
for(const [url,origin] of [['/api/tools/bind',base],['/api/tools/invoke','https://example.com'],['/api/tools/invoke','null']]){const r=await fetch(base+url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});if(r.status!==403)throw Error('Boundary failed '+url);checks.push({url,origin,status:r.status})}
const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({viewport:{width:1100,height:950}});await page.goto(base+'/agent-workbench.html?case=reg-01-counter&track=trae-cardspec&qa=1');await page.getByTestId('artifact-ready').waitFor();await page.getByRole('button',{name:'增加',exact:true}).click();await expect(page.getByText('计数为 1',{exact:true})).toBeVisible();await page.screenshot({path:out+'/remote.png',fullPage:true});checks.push({browser:'remote HTTPS interaction',passed:true})}finally{await browser.close()}
await writeFile(out+'/result.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks))
