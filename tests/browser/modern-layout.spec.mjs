import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
mkdirSync('artifacts/modern-cards-qa',{recursive:true})
async function lab(page,name,width='320'){
 await page.goto('/cardspec-lab.html');await page.getByLabel('样例',{exact:true}).selectOption(name)
 await page.getByLabel('宽度',{exact:true}).selectOption(width)
 await page.getByLabel('风格',{exact:true}).selectOption('frosted-glass')
 await page.getByRole('button',{name:'模拟结束'}).click()
 await expect(page.getByTestId('diagnostics')).toHaveText('[]')
}
for(const width of ['320','432'])test(`overview, photo carousel and magazine at ${width}`,async({page})=>{
 for(const name of ['mindmap','flowchart']){
  await lab(page,name,width)
  await expect(page.locator('.cs-diagram')).toHaveAttribute('data-overview','true')
  await expect.poll(()=>page.locator('.cs-diagram-pan').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1)).toBe(true)
  const sizes=await page.locator('.cs-diagram-node').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})))
  expect(sizes.every(n=>n.w>=68&&n.h>=40)).toBe(true)
  await page.locator('.cs-stage').screenshot({path:`artifacts/modern-cards-qa/${name}-${width}.png`})
 }
 await lab(page,'carouselEditorial',width)
 await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit','fit')
 const geometry=await page.locator('.cs-slide').first().evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight,image:el.querySelector('.cs-image').getBoundingClientRect().bottom,title:el.querySelector('.cs-title').getBoundingClientRect().top}))
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.h+1);expect(geometry.image).toBeLessThanOrEqual(geometry.title)
 await page.getByRole('button',{name:'下一项',exact:true}).click()
 await expect(page.locator('.cs-carousel')).toHaveAttribute('data-active-index','1')
 await expect.poll(()=>page.locator('.cs-carousel-track').evaluate(el=>Math.abs(el.children[1].getBoundingClientRect().left-el.getBoundingClientRect().left))).toBeLessThan(2)
 expect(await page.locator('.cs-slide').nth(1).evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1)).toBe(true)
 await page.locator('.cs-stage').screenshot({path:`artifacts/modern-cards-qa/carousel-${width}.png`})
 await lab(page,'longtext',width)
 await expect(page.locator('.cs-magazine')).toHaveCount(1)
 expect(await page.locator('.cs-prose p').count()).toBeGreaterThan(3)
 const drop=await page.locator('.cs-prose p').first().evaluate(el=>({letter:parseFloat(getComputedStyle(el,'::first-letter').fontSize),font:parseFloat(getComputedStyle(el).fontSize)}))
 expect(drop.letter).toBeGreaterThan(drop.font*2)
 await page.locator('.cs-stage').screenshot({path:`artifacts/modern-cards-qa/magazine-${width}.png`})
 await page.locator('.cs-prose p').last().scrollIntoViewIfNeeded()
 await expect(page.locator('.cs-prose p').last()).toBeInViewport()
})
test('battle reaches zero exactly; heal, mana reset, defeat and restart',async({page})=>{
 await lab(page,'battle')
 const stat=label=>page.locator('.cs-stat').filter({hasText:label}).locator('strong')
 for(let hit=1;hit<=4;hit++){
  await page.getByRole('button',{name:'火球',exact:true}).click()
  await expect(stat('敌人生命')).toHaveText(String(Math.max(0,10-hit*3)))
  if(hit<4){await expect(page.locator('.cs-card')).not.toContainText('胜利');await expect(page.getByRole('button',{name:'火球',exact:true})).toBeDisabled();await page.getByRole('button',{name:'结束回合'}).click();await expect(stat('法力')).toHaveText('3')}
 }
 await expect(page.locator('.cs-card')).toContainText('胜利')
 await expect(page.getByRole('button',{name:'结束回合'})).toBeDisabled()
 await page.getByRole('button',{name:'重新开始'}).click()
 await page.getByRole('button',{name:'结束回合'}).click();await page.getByRole('button',{name:'治疗',exact:true}).click()
 await expect(stat('你的生命')).toHaveText('10');await expect(stat('法力')).toHaveText('2')
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'结束回合'}).click()
 await expect(page.locator('.cs-card')).toContainText('失败')
 await page.locator('.cs-stage').screenshot({path:'artifacts/modern-cards-qa/battle-terminal.png'})
})
test('checkout, dependent resources and three rounds share the transaction contract',async({page})=>{
 await lab(page,'checkout')
 await page.getByRole('button',{name:'结算',exact:true}).click()
 await expect(page.locator('.cs-card')).toContainText('购物车：0元');await expect(page.locator('.cs-card')).toContainText('上次实付：17元')
 await page.getByRole('button',{name:'添加3元'}).click();await expect(page.locator('.cs-card')).toContainText('上次实付：17元')
 await lab(page,'allocation')
 await page.getByRole('button',{name:'补充资源'}).click();await expect(page.locator('.cs-card')).toContainText('容量 6 · 可用 6');await expect(page.locator('.cs-card')).toContainText('操作前容量 5')
 await lab(page,'quizRounds')
 for(let i=1;i<=3;i++){await page.getByRole('button',{name:'答对',exact:true}).click();await expect(page.getByRole('button',{name:'答对',exact:true})).toBeDisabled();await expect(page.locator('.cs-card')).not.toContainText('练习结束');await page.getByRole('button',{name:'继续',exact:true}).click()}
 await expect(page.locator('.cs-card')).toContainText('练习结束');await expect(page.locator('.cs-card')).toContainText('得分3')
 await page.getByRole('button',{name:'重新开始'}).click();await expect(page.locator('.cs-card')).toContainText('第1题 · 得分0')
})

test('conditional append retains rows; grow children never collapse clickable list items',async({page})=>{
 await page.goto('/cardspec-lab.html');await page.getByLabel('宽度',{exact:true}).selectOption('320')
 await page.getByText('输入 DSL 验证',{exact:true}).click()
 await page.getByLabel('DSL源码',{exact:true}).fill(`<card actionMode="snapshot"><state id="rows" type="array" initial={[]}/><state id="seq" type="number" initial={0}/><state id="amount" type="number" initial={0}/><action id="edit"><set target="amount" value={event.value}/></action><action id="add"><increment target="seq" when={state.amount>0}/><append target="rows" when={state.amount>0} value={{id:next.seq,amount:state.amount}}/><set target="amount" value={0}/></action><action id="remove"><remove target="rows" key={args.id}/></action><region role="summary"><title>记录</title><input label="金额" inputType="number" value={state.amount} onChange="edit"/><button onPress="add">添加</button></region><region role="content" overflow="scroll"><each items={state.rows} itemKey={item.id}><list-item><row grow justify="between"><text>条目{item.id} · {item.amount}</text><button label={"删除"+item.id} onPress="remove" args={{id:item.id}}/></row></list-item></each></region><text>合计 {sum(state.rows,item.amount)}</text></card>`)
 await page.getByRole('button',{name:'应用源码',exact:true}).click();await page.getByRole('button',{name:'模拟结束'}).click()
 for(const amount of ['20','10']){await page.getByLabel('金额',{exact:true}).fill(amount);await page.getByRole('button',{name:'添加',exact:true}).click()}
 await expect(page.locator('.cs-card')).toContainText('合计 30')
 const rows=await page.locator('[data-cs-component=list-item]').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:el.getBoundingClientRect().height})))
 expect(rows[0].height).toBeGreaterThanOrEqual(36);expect(rows[1].top).toBeGreaterThanOrEqual(rows[0].bottom)
 await page.getByRole('button',{name:'删除1',exact:true}).click();await expect(page.locator('.cs-card')).toContainText('合计 10')
 await page.getByRole('button',{name:'添加',exact:true}).click();await expect(page.locator('[data-cs-component=list-item]')).toHaveCount(1)
 await expect(page.locator('.cs-action-error')).toHaveCount(0)
})
