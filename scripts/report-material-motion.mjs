import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises'
import path from 'node:path'
const root='artifacts/material-motion-qa',out='public/material-motion-review';await mkdir(out,{recursive:true})
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const native=await read(`${root}/native/results.json`),timing=await read(`${root}/frame-timing.json`),credits=await read(`${root}/photo-credits.json`),browserStats=(await read(`${root}/results.json`)).stats
const samples=[];for(const round of ['', '/model-round2'])for(const id of ['nature','living']){const r=await read(`${root}${round}/model-${id}.json`);samples.push({round:round?2:1,id,elapsedMs:r.elapsedMs,images:r.contentImages,modelCalls:r.modelCalls,error:r.error||null})}
const summary={browser:browserStats,native:{passed:native.filter(r=>r.passed).length,total:native.length,failed:native.filter(r=>!r.passed).map(({id,width,size,error})=>({id,width,size,error}))},timing,samples,limitations:['320px 方形舆情基线触发兜底滚动，关闭动效仍复现。','第二轮自然观察样本 save 错把 args 数据读作 event，未产生预期的保存反馈；保留失败，不针对样本修补。','桌面 Chrome 性能采样不等于真实手机验证；本轮未调用真实 OpenCLI。']}
await writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2))
for(const file of await readdir(root))if(file.endsWith('.png'))await copyFile(`${root}/${file}`,`${out}/${file}`)
const videos=await readdir(`${root}/browser`,{recursive:true})
let demo=videos.find(f=>/visual-exa/i.test(f)&&f.endsWith('.webm'))
try{const clip=await read(`${root}/preview-video/record.json`);await copyFile(clip.path,`${out}/motion-demo.webm`);demo=true}catch{if(demo)await copyFile(path.join(root,'browser',demo),`${out}/motion-demo.webm`)}
const escape=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>材质与动效升级 · 本地验证</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf3ef;color:#19392f;font:15px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:38px 20px}h1{font-size:clamp(26px,5vw,40px);letter-spacing:-1px}h2{font-size:22px;margin-top:38px}small{color:#526c62}a{color:#246b60}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.panel{padding:20px;background:#fff9;border-radius:22px}img,video{max-width:100%;border-radius:20px;display:block}figure{margin:0}figcaption{margin:8px 2px 16px;color:#526c62}table{width:100%;border-collapse:collapse;background:#ffffff99}td,th{padding:10px;text-align:left;border-bottom:1px solid #d3ded8}.note{padding:16px;background:#f5e8ca;border-radius:16px}.stat{font-size:28px;font-weight:700}nav{display:flex;gap:20px;flex-wrap:wrap}ul{padding-left:20px}</style><main>
<small>LOCAL / MATERIAL & MOTION / 2026-10-22</small><h1>让照片透出来，让交互连起来。</h1><p>更轻的全局遮罩、局部阅读保护、双层缓慢光照，以及保持状态的交互切换。模型继续选择现有风格，无新增必填 DSL。</p>
<nav><a href="/">打开生成器</a><a href="/cardspec-lab.html?fixture=materials">互动材质实验室</a><a href="summary.json">检查摘要 JSON</a></nav>
<h2>同一内容，升级前后</h2><div class="grid"><figure><img src="showcase-before.png" alt="升级前"><figcaption>升级前：较重的整卡遮罩。</figcaption></figure><figure><img src="showcase-after.png" alt="升级后"><figcaption>升级后：背景部分显露，正文与导航有局部阅读底。</figcaption></figure></div>
${demo?'<h2>操作录屏</h2><video src="motion-demo.webm" controls playsinline preload="metadata"></video><small>隔离浏览器中的实际测试录屏；包含前后对照、选择与轮播操作。</small>':''}
<h2>五种材质</h2><div class="grid">${['photo-glass','tinted-glass','liquid-glass','frosted-glass','smoked-glass'].map(s=>`<figure><img loading="lazy" src="${s}.png" alt="${s}"><figcaption>${s}</figcaption></figure>`).join('')}</div>
<h2>生成图片数量验证</h2><p>使用同一模型 glm-5.3-flash，direct、原生、方形，无 CLI。两轮独立样本用于调整指引，不作为统计性成功率。</p><table><thead><tr><th>轮次 / 任务</th><th>内容图（不含背景）</th><th>耗时</th><th>模型调用</th></tr></thead><tbody>${samples.map(s=>`<tr><td>${s.round} / ${s.id==='nature'?'自然观察':'客厅风格'}</td><td>${s.images}</td><td>${(s.elapsedMs/1000).toFixed(1)}s</td><td>${s.modelCalls}</td></tr>`).join('')}</tbody></table>
<p>第二轮分别生成 3 / 4 张内容图；未增加固定规划或审稿步骤。增加图片不等于交互自动正确：自然观察保存动作存在模型参数读取错误。</p>
<h2>验证边界</h2><div class="grid"><div class="panel"><div class="stat">529 / 529</div>单元回归通过</div><div class="panel"><div class="stat">${summary.native.passed} / ${summary.native.total}</div>五个原生基线 × 六尺寸完整交互与恢复</div><div class="panel"><div class="stat">${timing.p95.toFixed(1)}ms</div>持续动画桌面帧间隔 P95；${timing.frames} 帧采样</div></div>
<p>专项浏览器检查 ${browserStats.expected} 项通过、${browserStats.unexpected} 项失败（自然观察保存动作），涵盖五种材质、四种配方、320/360/432px、两种高度、状态恢复、动效开关、系统减少动态效果、离屏暂停与 sandbox 伪元素暂停。主按钮对比度检查 ≥4.5:1；所有照片下的每个文本像素未作自动化对比度认证。</p>
<div class="note"><strong>未通过与未覆盖项</strong><ul>${summary.limitations.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div>
<h2>摄影来源</h2><p>对照截图复用本地已缓存的 Pexels 图片，测试使用同源图片替身；不代表具体目的地。实际生成按 query 或 assetRef 获取图片。</p><ul>${Object.entries(credits).map(([k,v])=>`<li>${escape(k)}：<a href="${escape(v.photoUrl)}" target="_blank" rel="noopener noreferrer">${escape(v.photographer)} · Pexels</a></li>`).join('')}</ul>
</main></html>`
await writeFile(`${out}/index.html`,html)
await mkdir('dist/material-motion-review',{recursive:true});for(const file of await readdir(out))await copyFile(path.join(out,file),path.join('dist/material-motion-review',file))
console.log(JSON.stringify({report:out+'/index.html',native:summary.native,video:!!demo}))
