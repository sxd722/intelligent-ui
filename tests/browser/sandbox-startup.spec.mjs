import {test,expect} from '@playwright/test'
test('slow WASM initialization keeps latest parent input without premature input timeout',async({page})=>{
 await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{"cardSandbox":true}'}))
 let started;const loading=new Promise(resolve=>started=resolve)
 await page.route('**/*.wasm',async route=>{started();await new Promise(resolve=>setTimeout(resolve,2200));await route.continue()})
 await page.goto('/pearl-review.html');await loading
 const stage=page.locator('.pearl-reference .cs-stage')
 await stage.getByRole('slider').fill('55')
 const frame=page.frameLocator('iframe[title="Pearl 整卡样板"]')
 await expect(frame.getByLabel('已储能 55%',{exact:true})).toBeVisible({timeout:15000})
 await expect(stage.getByRole('alert')).toHaveCount(0)
 await frame.getByRole('button',{name:'保存当前方案 ↗'}).click();await expect(frame.getByRole('status')).toHaveText('已保存 55%')
})
