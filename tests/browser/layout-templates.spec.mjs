import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
const out='artifacts/design-templates';mkdirSync(out,{recursive:true})
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{}'}))})
// Six-size native core loops now live in composition-v2.spec.mjs.
test('scoped long content and unmatched headings remain usable',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=templateNested');const stage=page.locator('.cs-stage')
 await page.getByLabel('宽度',{exact:true}).selectOption('320')
 await stage.getByRole('button',{name:'最后一个操作'}).click();await expect(stage).toContainText('结果 99')
 await stage.getByRole('button',{name:'下一组'}).click();await stage.getByRole('button',{name:'选择 4',exact:true}).click();await expect(stage).toContainText('结果 4')
 await page.getByLabel('卡片尺寸',{exact:true}).selectOption('auto');await stage.getByRole('button',{name:'最后一个操作'}).click();await expect(stage).toContainText('结果 99')
 await page.goto('/cardspec-lab.html?fixture=templateFallback');await expect(stage).toHaveAttribute('data-layout-template','default');await expect(stage).toHaveAttribute('data-template-reason','no-leading-heading')
 await stage.getByRole('button',{name:'增加'}).click();await expect(stage).toContainText('结果 1')
})
test('native matrix motion respects reduced motion and exact selection',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=templateAtlas');await page.emulateMedia({reducedMotion:'reduce'})
 const grid=page.locator('.cs-heatmap-grid');await expect.poll(()=>grid.evaluate(el=>getComputedStyle(el).transform)).toBe('none')
 const target=page.getByRole('button',{name:'喜欢 / d₃：-0.3',exact:true})
 for(let i=0;i<4&&!(await target.count());i++)await page.getByRole('button',{name:'后组',exact:true}).click()
 await target.click();await expect(page.locator('.cs-stage')).toContainText('喜欢 / d3 · -0.3')
})
test('local component errors do not replace the template or its healthy controls',async({page})=>{
 await page.goto('/cardspec-lab.html?fixture=templatePearl')
 // Inject a malformed already-compiled AST, as a restored old session might
 // contain. This isolates renderer recovery from compiler rejection.
 await page.evaluate(async()=>{
  const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js'),{CardRenderer}=await import('/src/cardspec/Renderer.jsx'),{compileCard}=await import('/shared/cardspec/compiler.mjs'),{TEMPLATE_FIXTURES}=await import('/shared/cardspec/template-fixtures.mjs')
  const spec=compileCard(TEMPLATE_FIXTURES.templatePearl,{final:true}).spec
  spec.children.find(n=>n.type==='chart').props.data={type:'literal',value:'broken'}
  const el=document.createElement('div');el.id='error-template';document.body.append(el);ReactDOM.createRoot(el).render(React.createElement(CardRenderer,{spec}))
 })
 const stage=page.locator('#error-template .cs-stage');await expect(stage.locator('.cs-node-recovery')).toHaveCount(1)
 await stage.getByRole('slider').fill('44');await stage.getByRole('button',{name:'保存当前方案'}).click();await expect(stage).toContainText('已保存 44%')
 await expect(stage).toHaveAttribute('data-composition-family','pearl')
})
// Refresh/state preservation and no-scroll acceptance are covered by composition-v2.
