import fs from 'node:fs/promises'
import {ROOT,DEST,cases} from './cases.mjs'
import {contentIntegrity} from '../../shared/cardspec/content-integrity.mjs'
const read=async p=>JSON.parse(await fs.readFile(ROOT+'/'+p,'utf8'))
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const redact=s=>s.replace(/([?&](?:xsec_token|access_token|api_key|token|signature)=)[^&\s"<>\\]+/gi,'$1[REDACTED]').replace(/("(?:apiKey|accessToken|authorization|resumeToken)"\s*:\s*")[^"]*"/gi,'$1[REDACTED]"')
const notes={
 trip:['部分','条件改变说明，仍无可验证的费用/路线约束；缺餐饮、详情和地图。'],
 movie:['部分','实际工具与主要交互通过；推荐对象却偏成科幻纪录片剧集。'],
 sentiment:['未完成','真实搜索/部分正文已取得；四类态度统计缺失，20条声明与16条展示不一致。'],
 fever:['未完成','低龄高热提示、记录与折线有效；下次时间未加间隔，不能作为用药计划。'],
 study:['未完成','换科目有效；答案args/event错用导致提交禁用。知识图是装饰性等分图。'],
 medicine:['未完成','Mock识别与确认有效；频率不影响时刻，无逐剂次记录和真实到点提醒。'],
 schedule:['未完成','月内日号误当星期；完整增删改未验证通过。'],
 gpa:['通过','增删改、加权结果、非法值、零分母、图形与恢复符合本次需求。'],
 editor:['部分','安全公式、错误隔离、富文本、撤销及恢复有效；导出未触发下载。'],
 game:['未完成','行动、敌方回合、胜利、重开、恢复有效；失败终局不可达。'],
 reading:['部分','原文/数值/测验/已读恢复有效；结构仍为按钮集合，未达关系图与长文验证目标。']
}
await fs.mkdir(DEST+'/evidence',{recursive:true});await fs.mkdir(DEST+'/screenshots',{recursive:true})
for(const f of await fs.readdir(ROOT+'/screenshots'))await fs.copyFile(ROOT+'/screenshots/'+f,DEST+'/screenshots/'+f)
const all=[]
for(const c of cases){
 const run=await read(c.id+'.json'),browser=await read(c.id+'-browser.json');let followup;try{followup=await read(c.id+'-followup.json')}catch{}
 const diagnostics=contentIntegrity(run.spec,{goal:c.prompt,records:run.spec?.prefetched||[]})
 const calls=run.events?.filter(e=>e.type==='research_model')||[]
 const result={id:c.id,title:c.title,status:notes[c.id][0],reason:notes[c.id][1],generation:run.status,elapsedMs:run.elapsedMs,tokenUsage:calls.reduce((s,x)=>s+(x.usage?.total_tokens||0),0),requirements:c.requirements,checks:browser.checks,followup:followup?.checks||[],diagnostics,humanApproved:false,trainingEligible:false}
 all.push({c,run,browser,followup,result})
 for(const ext of ['.json','.sse','-browser.json','-request.json'])try{await fs.writeFile(DEST+'/evidence/'+c.id+ext,redact(await fs.readFile(ROOT+'/'+c.id+ext,'utf8')))}catch{}
 if(followup)await fs.writeFile(DEST+'/evidence/'+c.id+'-followup.json',redact(JSON.stringify(followup,null,2)))
 await fs.writeFile(DEST+'/evidence/'+c.id+'.cardspec',redact(run.source||''))
}
const stitch=await read('stitch/manifest.json'),layouts=await read('layouts.json'),followup=await read('followup.json')
const conn=await fetch('http://127.0.0.1:8787/api/tools/connections').then(r=>r.json())
const connection={connected:conn.browser?.connected,bound:conn.browser?.binding?.bound,session:conn.browser?.binding?.session,daemonPid:conn.browser?.daemonPid}
const report={generatedAt:new Date().toISOString(),connection,scope:'Local only; actual read-only tools; explicit mock medicine image; recorded live results for host structure fixtures',cases:all.map(a=>a.result),layouts:layouts.length,compositeChecks:followup.filter(r=>r.id.startsWith('composite-'))}
await fs.writeFile(ROOT+'/acceptance.json',JSON.stringify(report,null,2));await fs.writeFile(DEST+'/evidence/acceptance.json',redact(JSON.stringify(report,null,2)))
await fs.writeFile(DEST+'/evidence/layouts.json',JSON.stringify(layouts));await fs.writeFile(DEST+'/evidence/followup.json',redact(JSON.stringify(followup,null,2)))
for(const f of ['final-tests.log','debug-regression.log','build-verified.log'])await fs.copyFile(ROOT+'/'+f,DEST+'/evidence/'+f)
await fs.copyFile('docs/complex-p0-20261103.md',DEST+'/review.md')
const img=(path,label)=>`<figure><a href="${esc(path)}" target="_blank"><img loading="lazy" src="${esc(path)}" alt="${esc(label)}"></a><figcaption>${esc(label)}</figcaption></figure>`
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P0修复与复杂业务验收</title><style>
*{box-sizing:border-box}body{margin:0;background:#101724;color:#e4edf5;font:15px/1.6 system-ui;padding:36px max(18px,calc((100vw - 1180px)/2))}h1{font-size:clamp(30px,4vw,50px);line-height:1.2}p{overflow-wrap:anywhere}h2{font-size:25px}a{color:#91e0d6}section{background:#1a2536;padding:26px;border-radius:20px;margin:24px 0}p{max-width:950px}.muted,figcaption{color:#b2c3d7;font-size:13px}.table{overflow:auto}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #354255;vertical-align:top}th{white-space:nowrap}.metrics,.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.metrics>div{background:#20364a;border-radius:15px;padding:20px}.metrics strong{display:block;font-size:30px}.gallery figure{margin:0}img{width:100%;border-radius:12px;background:#e8edf3}summary{cursor:pointer;color:#a4e2d7}.fail{color:#ffb6a6}.pass{color:#88dfb7}.warn{border-left:4px solid #e3b467;padding:12px;background:#30303a}code{color:#e7cc9a;overflow-wrap:anywhere}.badge{padding:4px 10px;border-radius:20px;background:#324759}details{margin:16px 0}@media(max-width:700px){body{padding:20px 12px}section{padding:16px}.metrics,.gallery{grid-template-columns:1fr 1fr}td,th{min-width:115px}}
</style><p class="muted">2026.11.03 · LOCAL / REAL TOOLS / STITCH</p><h1>绑定正确之后，继续验收任务是否完成</h1><p>修复完整链接、隐藏加载、内容矛盾和实体误合并；用旅游、电影、舆情与八类新业务检查功能边界。</p>
<div class="metrics"><div><strong>${all.filter(x=>x.run.spec).length}/11</strong>当前有生成产物</div><div><strong>1/11</strong>本轮完整要求通过</div><div><strong>6</strong>Stitch复合结构及宿主实现</div></div>
<p class="warn">“生成成功”和“探针通过”不等于完整业务成功。11例首次生成后，旅游/电影各追加一次门控修复后的重生成。只有GPA满足本轮完整要求；没有任何样板自动晋级人工金标。</p>
<p><a href="review.md">实现与分析文档</a> · <a href="evidence/acceptance.json">机器可读验收</a> · <a href="evidence/final-tests.log">58项回归</a> · <a href="../">生成入口</a></p>
<section><h2>P0修复结果</h2><table><tr><th>层</th><th>改动</th><th>证据与边界</th></tr><tr><td>契约</td><td>URL标识上限8192；同步生成同一规则</td><td>历史真实签名链接输入校验；本轮XHS note取得6条记录</td></tr><tr><td>生命周期</td><td>卡可见＋分支可见＋依赖/输入有效；详情展开后加载</td><td>隐藏/空输入零请求，隐藏后取消；电影打开详情才调用两工具</td></tr><tr><td>内容/行为</td><td>缺分类字段、假刷新、补写日期、无效设置、args/event错用门控</td><td>识别可证明矛盾；完整规划、分类和临床逻辑仍需业务验收</td></tr><tr><td>宿主合并</td><td>重复ID但实体不同，不再合并或当详情ID</td><td>携程三个id=0地点保留三项；坐标系未知不伪造地图点</td></tr></table></section>
<section><h2>真实生成总览</h2><div class="table"><table><tr><th>任务</th><th>完整需求</th><th>最新耗时 / token</th><th>结论</th></tr>${all.map(({c,result})=>`<tr><td><a href="#${c.id}">${esc(c.title)}</a></td><td>${result.status}</td><td>${(result.elapsedMs/1000).toFixed(1)}s / ${result.tokenUsage.toLocaleString()}</td><td>${esc(result.reason)}</td></tr>`).join('')}</table></div><p class="muted">模型 DeepSeek Flash，direct / quick / js-v1；编辑器与小游戏允许Web。token为实际research_model事件用量累计，含重复上下文与缓存。单次样本不构成统计显著比较。</p></section>
<section><h2>Stitch → 可复用宿主构图</h2><p>六个设计均保留原稿供人工检视。转译为同一 task-board 的布局、选择、对比和回调，继承既有风格令牌；没有把设计稿的虚构统计或距离带入真实数据。</p><div class="gallery">${stitch.map(s=>img('stitch/'+s.id+'.png',s.title)).join('')}</div><table><tr><th>结构</th><th>实现与验证</th><th>演示</th></tr>${report.compositeChecks.map(r=>`<tr><td>${esc(r.id)}</td><td>${r.checks.filter(c=>c.status==='pass').length}/${r.checks.length} 交互/恢复检查</td><td><a href="viewer.html?id=${r.id}">打开可互动样板</a></td></tr>`).join('')}</table><p class="muted">样板使用录制的真实工具响应，不是六次新的模型生成。确认仅验证事件交付，不能冒充业务计划已生成；地图仍要求来源确认坐标系。</p><div class="gallery">${report.compositeChecks.map(r=>img(`screenshots/${r.id}-followup-filter-select-compare-apply.png`,r.id+' 宿主实现')).join('')}</div></section>
${all.map(({c,result,browser,followup})=>`<section id="${c.id}"><span class="badge">${result.status}</span><h2>${esc(c.title)}</h2><p>${esc(result.reason)}</p><p><a href="viewer.html?id=${c.id}">打开当前卡片</a> · <a href="evidence/${c.id}.json">去敏trace</a> · <a href="evidence/${c.id}.sse">SSE</a> · <a href="evidence/${c.id}.cardspec">CardSpec源码</a> · <a href="evidence/${c.id}-browser.json">交互记录</a></p><details><summary>完整需求</summary><p>${esc(c.prompt)}</p><ul>${c.requirements.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details><div class="table"><table><tr><th>检查</th><th>结果</th><th>说明</th></tr>${[...browser.checks,...(followup?.checks||[])].map(x=>`<tr><td>${esc(x.name)}</td><td class="${x.status}">${x.status}</td><td>${esc(x.actual?.reason||x.error||'见状态与工具trace')}</td></tr>`).join('')}</table></div><details><summary>截图与当前静态门控</summary><p>${esc(JSON.stringify(result.diagnostics))}</p><div class="gallery">${[...(browser.screenshots||[]),...(followup?.checks||[]).map(c=>c.screenshot).filter(Boolean)].map(s=>img(s,s.split('/').at(-1))).join('')}</div></details></section>`).join('')}
<section><h2>尺寸、来源与验收边界</h2><p>${layouts.length}组初始布局，${layouts.filter(l=>l.stable).length}组高度稳定；${layouts.filter(l=>l.horizontalOverflow>2).length}组横向超限。布局记录包含内滚动与被裁切控件；这不是所有交互六尺寸全通过。</p><p>关键交互主要验证432px方形。阅读仅用提供的短论文；未证明长文泛化。药品图片明确mock；提醒未通过不能用于实际用药。发热提示测试依据 <a href="https://www.nhs.uk/symptoms/fever-in-children/">NHS</a> 与 <a href="https://www.nice.org.uk/guidance/NG143/chapter/recommendations">NICE</a>，不包含自主开药或剂量推荐。</p><details><summary>102组截图</summary><div class="gallery">${layouts.map(l=>img(l.screenshot,`${l.id} ${l.width}px ${l.size}`)).join('')}</div></details><a href="evidence/layouts.json">真实DOM记录</a><p>尚未全面验证：运行期断网/来源失败注入、海报失败、乱序/取消、后台提醒与人工审美。可证明矛盾的门控不等于任意任务语义证明。</p><p>OpenCLI/Owl保持连接：${esc(JSON.stringify(connection))}。仅重载应用服务，无重新绑定、无GPT Site发布。</p></section>
<section><h2>下一步</h2><ol><li>按业务不变量验收时间计划、选中结果、终局与字段溯源，避免通过删功能换生成成功。</li><li>统一宿主时间/提醒、安全导出和实体身份服务，减少模型重复实现基础语义。</li><li>Stitch继续设计时间记录/告警、知识练习反馈、阅读证据图、游戏状态与终局；先验证功能，再扩风格与尺寸。</li></ol></section></html>`
const finalHtml=html.replaceAll('<table>','<div class="table"><table>').replaceAll('</table>','</table></div>');await fs.writeFile(DEST+'/report.html',finalHtml);await fs.writeFile(ROOT+'/report.html',finalHtml);console.log(JSON.stringify({report:DEST+'/report.html',connection,total:all.length,fullPass:all.filter(x=>x.result.status==='通过').length}))
