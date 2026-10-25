import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
const base=process.argv[2] || 'http://127.0.0.1:8787', dir='artifacts/mobile-qa'
await mkdir(dir,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const evidence=[]
for(const name of ['carousel','slider','mindmap','flowchart','chart','media']) {
  await page.goto(`${base}/cardspec-lab.html`)
  await page.getByLabel('样例',{exact:true}).selectOption(name)
  await page.getByLabel('宽度',{exact:true}).selectOption('320')
  await page.getByLabel('主题',{exact:true}).selectOption('soft')
  if(name==='media') {
    await page.getByLabel('图片',{exact:true}).selectOption('pexels')
    await expect(page.locator('.cs-image[data-loaded=true]')).toHaveCount(3,{timeout:45000})
    const sources=await page.locator('.cs-image img').evaluateAll(els=>els.map(el=>({src:new URL(el.src).pathname,width:el.naturalWidth,height:el.naturalHeight})))
    evidence.push({name,sources,credits:await page.locator('.cs-photo-credit').allTextContents()})
  }
  await expect(page.locator('.cs-stage')).toHaveAttribute('data-cs-fit','fit')
  await page.locator('.cs-shell').screenshot({path:`${dir}/${name}.png`})
}
await browser.close()
await writeFile(`${dir}/media-evidence.json`,JSON.stringify(evidence,null,2))
const generation=JSON.parse(await readFile(`${dir}/real/summary.json`,'utf8'))
const replay=JSON.parse(await readFile(`${dir}/real/replay.json`,'utf8'))
const browserResults=JSON.parse(await readFile('artifacts/cardspec-qa/browser-results.json','utf8'))
await writeFile(`${dir}/browser-results.json`,JSON.stringify(browserResults,null,2))
const cases=['carousel','slider','mindmap','flowchart','chart','media'], labels=['步骤轮播','数值滑杆','思维导图','流程图','数据图表','真实 Pexels 配图']
await writeFile(`${dir}/report.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>移动组件验收</title><style>body{margin:0;background:#f0f3f5;color:#203141;font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:auto;padding:32px 24px}h1{font-size:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article,section{background:white;border:1px solid #d5dfe7;border-radius:16px;padding:20px;margin:20px 0}article{margin:0}img{display:block;max-width:100%;margin:auto}h2{font-size:20px}a{color:#1767a4}li{margin-bottom:5px}</style><main><h1>移动端组件 · 实施与验收</h1><p>保留 DIL 默认选项。新增高阶组件在 CardSpec v1 中使用，轮播是布局建议，不强制替代所有列表。</p><section><b>真实模型生成 ${generation.filter(r=>r.status==='succeeded').length}/${generation.length}，浏览器三尺寸回放 ${replay.filter(r=>r.passed).length}/${replay.length}。</b><p>浏览器回归 ${browserResults.stats.expected}/${browserResults.stats.expected+browserResults.stats.unexpected+browserResults.stats.skipped+browserResults.stats.flaky} 通过。15项单元测试覆盖组件校验、图关系、图片循环解析、下载/缓存和失败重试。浏览器另测真实触摸横滑、状态保留、slider键盘、节点选择/缩放、正负零数据与图片尺寸；完整套件包含原有回归。六个新场景只做了各一次direct抽样，不代表任意提示词都可靠。</p><a href="browser-results.json">浏览器测试记录</a> · <a href="real/summary.json">生成记录</a> · <a href="real/replay.json">浏览器回放</a> · <a href="media-evidence.json">真实图片与署名</a></section><div class="grid">${cases.map((name,i)=>`<article><h2>${labels[i]}</h2><img src="${name}.png" alt="${labels[i]}，320px截图"></article>`).join('')}</div><section><h2>交互与边界</h2><ul><li>Carousel：原生触摸/吸附，前后按钮44px，页码与方向键，所有页状态持续保留。</li><li>Mindmap/flowchart：最多40节点，触摸平移与缩放、节点选择；流程图允许循环。当前不提供节点/连线编辑器。</li><li>Chart：单序列柱状或折线，最多40点，原始数值与可点击标签；slider采用原生range输入。</li><li>Pexels：桌面密钥只由服务器读取，hero大图、64px缩略图、循环项独立查询。本地下载缓存24小时，最多12个query/role每轮、3路并发，失败可重试；磁盘文件暂不自动淘汰。</li><li>图片是示意素材；不保证语义完全准确。真实照片显示摄影师与Pexels来源。新组件仍受模型协议遵循与现有布局边界影响。</li></ul><p><a href="../../docs/CARDSPEC.md">实现契约</a> · <a href="http://127.0.0.1:8787/cardspec-lab.html">打开组件实验室</a> · <a href="https://www.pexels.com/api/documentation/">Pexels API 文档</a></p></section></main></html>`)
console.log(JSON.stringify({generation:generation.length,replay:replay.length,realMedia:evidence[0]?.sources.length,report:`${dir}/report.html`}))
