import {test,expect} from '@playwright/test'
const initial='initial={{items:[],source:"",fetchedAt:"",truncated:false}}'
const source=`<card schemaVersion="1"><binding id="trains" tool="opencli.12306.trains" input={{from:"杭州东",to:"上海南",date:"2026-10-14",departureAfter:"12:00",departureBefore:"18:00"}} ${initial} load="visible"/><state id="selected" type="string" initial=""/><action id="pick"><set target="selected" value={args.key}/></action><title>行身份回归</title><caption>选择：{state.selected}</caption><region overflow="scroll"><each items={bindings.trains.value.items} itemKey={item.rowKey}><pressable onPress="pick" args={{key:item.rowKey}} selected={state.selected==item.rowKey}><text>{item.code} {item.to_station} 二等座 {item.second_seat}</text></pressable></each></region></card>`
async function apply(page,source){await page.goto('/cardspec-lab.html?fixture=counter');await page.getByText('输入 DSL 验证',{exact:true}).click();await page.getByLabel('DSL源码').fill(source);await page.getByRole('button',{name:'应用源码',exact:true}).click();await expect(page.getByTestId('diagnostics')).toHaveText('[]')}
for(const width of [320,360,432])test(`tool list identity and partial coverage at ${width}`,async({page})=>{
 await page.route('**/api/tools/invoke',async route=>{
  const p=route.request().postDataJSON();expect(p.input.departureAfter).toBe('12:00')
  const value={items:[{rowKey:'segment-a',code:'G1',to_station:'上海南',second_seat:'无'},{rowKey:'segment-b',code:'G1',to_station:'上海虹桥',second_seat:'有'}],source:'test',fetchedAt:new Date().toISOString(),truncated:true,coverage:{complete:true,total:8,matched:3,returned:2}}
  await route.fulfill({contentType:'text/event-stream',body:[{type:'result',result:{kind:'json',value}},{type:'done'}].map(f=>'data: '+JSON.stringify({...f,requestId:p.requestId,pageId:p.pageId})+'\n\n').join('')})
 })
 await apply(page,source);await page.getByLabel('宽度',{exact:true}).selectOption(String(width))
 await page.locator('.cs-card').getByRole('button',{name:/G1\s*上海虹桥 二等座 有/}).click()
 await expect(page.locator('.cs-card')).toContainText('选择：segment-b')
 await expect(page.locator('.cs-tool-status')).toContainText('展示 2 / 3 条匹配结果')
 await expect(page.locator('[data-cs-error]')).toHaveCount(0)
 expect(await page.locator('.cs-stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
})
test('a malformed dynamic list keeps surrounding content usable',async({page})=>{
 await apply(page,'<card schemaVersion="1"><state id="rows" type="array" initial={[]}/><action id="load"><set target="rows" value={[{id:"x"},{id:"x"}]}/></action><title>保留天气和操作</title><each items={state.rows} itemKey={item.id}><text>A</text></each><button onPress="load">载入重复数据</button><caption>其余内容仍可读</caption></card>')
 await page.getByRole('button',{name:'载入重复数据',exact:true}).click()
 await expect(page.locator('[data-cs-error]')).toHaveCount(1)
 await expect(page.locator('.cs-card')).toContainText('保留天气和操作')
 await expect(page.locator('.cs-card')).toContainText('其余内容仍可读')
})
