import {chromium,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
const dir='artifacts/repair-navigation',live=JSON.parse(readFileSync(`${dir}/live-2.json`)),browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:432,height:920}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(message=>{sessionStorage.setItem('cardspec:conversation:v1',JSON.stringify({messages:[{id:'live',role:'assistant',format:'cardspec',status:'succeeded',phases:[{id:'p',kind:'cardspec',phase:'dsl',status:'succeeded',message}]}],toolsEnabled:false}))},live.message)
 await page.goto('http://127.0.0.1:8787/');await page.getByRole('button',{name:'全屏查看卡片',exact:true}).click()
 const stage=page.locator('.cs-stage'),slider=stage.getByRole('slider');await slider.fill('12');await expect(stage).toContainText(/2,?400/);await expect(stage).toContainText('旅行预算');await expect(stage).not.toContainText('饮水实验')
 await page.screenshot({path:`${dir}/live-budget-432.png`});await page.reload();await expect(page.locator('.cs-stage').getByRole('slider')).toHaveValue('12');expect(errors).toEqual([])
 writeFileSync(`${dir}/live-interaction.json`,JSON.stringify({days:12,total:2400,reloadRestored:true,errors},null,2));console.log('Live budget slider, calculation and reload restoration passed')
}finally{await browser.close()}
