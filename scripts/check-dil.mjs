// Replay saved DIL envelopes through the real app; never changes the user's chat.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parse, splitCardText } from '../server/compiler/parse.mjs'
import { compile } from '../server/compiler/codegen.mjs'
import { validateDil } from '../server/compiler/validate.mjs'

const folder='artifacts/dil-qa', base=process.argv[2] || 'http://127.0.0.1:8787'
await mkdir(folder,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const results=[]
try {
  for(const name of ['original','regenerated']) {
    const envelope=JSON.parse(await readFile(`${folder}/${name}-envelope.json`,'utf8'))
    const message=envelope.message, source=message.content.parts[0], parts=splitCardText(source)
    const imageId=Object.keys(message.metadata.model_dil_v2.appData.opGenui.componentResults)[0]
    const compiled=compile(parse(parts.markup),{resolveImage:()=>imageId})
    Object.assign(message.metadata,{card_intro:parts.intro,card_outro:parts.outro})
    Object.assign(message.metadata.model_dil_v2,{...compiled,recoveryDiagnostics:[]})
    const frames=[{type:'phase_begin',id:message.id,phase:'dsl',title:'阶段 3 · 卡片成型',kind:'dil'},
      {type:'theme',theme:'playful',palette:'a'}, {p:'',o:'add',v:envelope},
      {type:'phase_end',id:message.id,phase:'dsl',status:'succeeded'},
      {type:'message_stream_complete',status:'succeeded'}]
    const page=await browser.newPage({viewport:{width:390,height:900}})
    await page.route('**/api/chat',route=>route.fulfill({contentType:'text/event-stream',body:frames.map(f=>`data: ${JSON.stringify(f)}\n\n`).join('')+'data: [DONE]\n\n'}))
    await page.goto(base)
    await page.getByLabel('渲染协议').selectOption('dil')
    await page.getByPlaceholder('描述你想要的交互卡片…').fill('回放已保存的卡片')
    await page.getByRole('button',{name:'发送',exact:true}).click()
    const card=page.locator('.dil-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(name==='original'?'全球 8 个节日':'死亡相关节日')
    const result={name,diagnostics:validateDil(source),filters:[],widths:[]}
    for(const width of [320,375,432]) {
      await page.setViewportSize({width,height:900})
      await page.waitForTimeout(180)
      result.widths.push(await page.locator('.dil-stage').evaluate(el=>({width:el.clientWidth,horizontalOverflow:el.scrollWidth>el.clientWidth+1,scroll:el.classList.contains('al-scroll'),density:el.dataset.alDensity})))
    }
    const tabs=card.getByRole('tab'), labels=await tabs.allTextContents()
    for(const label of labels) {
      await card.getByRole('tab',{name:label,exact:true}).click()
      const content=await card.innerText()
      result.filters.push({label,hasItems:/亡灵节|清明节|万灵节|万圣节/.test(content)})
    }
    if(name==='original') {
      await card.getByRole('tab',{name:'全部',exact:true}).click()
      await page.screenshot({path:`${folder}/original-restored.png`,fullPage:true})
    } else {
      for(const [label,expected,absent] of [['美洲','亡灵节','清明节'],['亚洲','清明节','万灵节'],['欧洲','万灵节','清明节']]) {
        await card.getByRole('tab',{name:label,exact:true}).click()
        await expect(card).toContainText(expected)
        await expect(card).not.toContainText(absent)
      }
      await card.getByRole('tab',{name:'美洲',exact:true}).click()
      await card.getByRole('switch').first().click()
      await expect(card).toContainText('1/8')
      await card.getByRole('tab',{name:'亚洲',exact:true}).click()
      await card.getByRole('tab',{name:'美洲',exact:true}).click()
      await expect(card.getByRole('switch').first()).toHaveAttribute('aria-checked','true')
      result.favouritePersists=true
      await page.setViewportSize({width:375,height:900})
      await page.screenshot({path:`${folder}/regenerated-filter.png`,fullPage:true})
    }
    results.push(result)
    await page.close()
  }
} finally { await browser.close() }
await writeFile(`${folder}/replay.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results,null,2))
