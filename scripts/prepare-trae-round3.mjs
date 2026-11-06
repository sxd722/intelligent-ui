// Prepare an independent, live-tool batch. Never starts a service or touches Owl.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
const project=fileURLToPath(new URL('../',import.meta.url))
const source=path.join(project,'artifacts/trae-skill-round2/workspace')
const work=path.join(project,'artifacts/trae-skill-round3/workspace')
try{await fs.access(work);throw Error('Round3 already exists; refusing overwrite')}catch(e){if(e.code!=='ENOENT')throw e}
const connection=await(await fetch('http://127.0.0.1:8787/api/tools/connections')).json()
const catalog=await(await fetch('http://127.0.0.1:8787/api/tools')).json()
await fs.mkdir(work,{recursive:true})
await fs.mkdir(path.join(work,'src/cases'),{recursive:true})
await fs.mkdir(path.join(work,'traces'),{recursive:true})
await fs.cp(path.join(project,'.trae/skills/interactive-card-baseline'),path.join(work,'.trae/skills/interactive-card-baseline'),{recursive:true})
const provenance=[]
for(const file of ['src/core.mjs','src/host.mjs','src/index.html','src/transport.mjs','src/insights.mjs','src/insight-fixtures.mjs','src/fixtures.mjs','src/douban-mock.mjs','src/runtime.jsx','build.mjs','build-isolated.mjs','AUTHOR-API.md','cases.json','tool-probe.mjs']){
 let text=await fs.readFile(path.join(source,file),'utf8')
 const originalHash=createHash('sha256').update(text).digest('hex')
 text=text.replaceAll('trae-skill-round2','trae-skill-round3')
 if(file==='src/host.mjs')text=text.replace('// User requested mock only for Douban in this evaluation workspace. Other tools remain live.','// Round3: live tools by default, including Douban. Fixtures are explicit QA only.').replace("const mockDouban=q.get('douban')!=='live';","const mockDouban=false;")
 if(file==='AUTHOR-API.md')text=text.split('\n').filter(line=>!line.startsWith('- User steering 2026-10-21:')).join('\n').replace('Round2:','Round3:')+'\nRound3 live policy: Douban and all other enabled tools are REAL by default. Never silently mock failures. fixtures=1 is a separate development/negative-test mode; label it and score it separately. Read QUALITY-GATES.md and functional-v3. Do not copy prior case UI.\n'
 await fs.writeFile(path.join(work,file),text)
 provenance.push({file,source:'round2 supplied infrastructure only',originalHash,hash:createHash('sha256').update(text).digest('hex')})
}
const prompts=JSON.parse(await fs.readFile(path.join(project,'.trae/skills/interactive-card-baseline/assets/eight-baseline-prompts.json'),'utf8'))
const cases=JSON.parse(await fs.readFile(path.join(work,'cases.json'),'utf8')).map(c=>({...c,prompt:prompts.find(p=>p.id===c.id).prompt}))
await fs.writeFile(path.join(work,'cases.json'),JSON.stringify(cases,null,2))
await fs.writeFile(path.join(work,'catalog.json'),JSON.stringify(catalog,null,2))
const b=connection.browser||{}
await fs.writeFile(path.join(work,'traces/connection-before.json'),JSON.stringify({at:new Date().toISOString(),connected:b.connected,ready:b.ready,binding:{mode:b.binding?.mode,bound:b.binding?.bound},daemonPid:b.daemonPid},null,2))
for(const c of cases){await fs.mkdir(path.join(work,'cases',c.id),{recursive:true});await fs.writeFile(path.join(work,'cases',c.id,'TASK.md'),`# ${c.title}\n\n${c.prompt}\n\n从零编写宿主联网H5/React（非CardSpec DSL）；复用所供runtime，按新版skill设计与functional-v3验收。默认真实工具；无法获取的事实明确标未知/阻塞，不自动mock。\n`)}
await fs.writeFile(path.join(work,'AGENTS.md'),`# Fresh round3 — functional-v3 / live tools
Read TASK.md, QUALITY-GATES.md, AUTHOR-API.md and .trae/skills/interactive-card-baseline/SKILL.md. Use the current default Trae model; do not switch models. Start a new conversation with no prior chat context. Author eight case UIs independently; only supplied infrastructure is reused.
Write only this workspace and ${path.join(project,'public/trae-skill-round3')} and ${path.join(project,'dist/trae-skill-round3')}. Do not modify production, prior rounds, their tasks, queues, or bridge. No service restarts, deployments, polling automations, Owl/OpenCLI binding/tab/connection/profile changes. Real read-only tools via existing host; no account writes or purchases. Never close/release the existing Owl bridge.
Do not alter supplied host/runtime/transport/core/build/CSP permissions. Report missing capability as a blocker; do not widen allowlists or bypass controls. Use an isolated browser for UI QA; CLI/browser-backed data calls go through the existing host, serialized. Max two concurrent non-browser data calls. If auth/CAPTCHA/quota is required, preserve evidence and continue independent work.
Fixtures are development/negative tests only, never live acceptance. Save progress after every case and before output-limit interruptions. Author outputs remain candidate until independent review.
`)
await fs.writeFile(path.join(work,'QUALITY-GATES.md'),`# 本轮明确质量验收

## 完成条件
- 八例逐一落实 cases.json 原始任务和 skill 的 eight-baselines 闭环。每个核心功能必须实际操作并断言结果，不能只验证按钮存在、build通过或页面不报错。
- 默认真工具，包含豆瓣。记录工具ID、脱敏输入、请求ID、开始/结束、结果或快照、来源、失败和取消。可用目录不代表真调用通过；无凭据/无数据时记 blocked/unknown，禁止将fixture结果算live。
- 初屏是一个有用的视觉主体、当前选择和关键动作；避免大段说明、field/value墙、长列表铺满。可按任务采用图片、地图、结构图、图表；不能无事实强造统计或关系。每例先写BRIEF再实现。
- 320/360/432 × square/auto 各保留实际截图和DOM度量，共至少48张布局截图。每例另保留核心任务链的操作前后证据；详情/返回、刷新恢复必须有结果断言。
- 主操作可达；无非预期裁切、横向溢出；必需信息不能靠隐藏删除。自然模式按本宿主max680px，而不是无限正文。长列表有分面/分页/原文入口。
- 静止和操作过渡结束后至少2秒/20个时间戳样本，记录stage/body高、scrollHeight/clientHeight与页数；不得持续振荡、无限测量或反复分页。完整/减少动效均可完成核心任务。
- 表单点击与Enter、空/缺值/缺图/部分失败、乱序/取消、状态与导航恢复、损坏状态安全回退、局部异常不影响其他控件：按functional-v3保存证据。无适用功能要明确not_tested及不适用理由，不虚造pass。

## 评分与一票否决
- 功能分：任务闭环35、数据语义20、状态导航20、可读布局15、错误恢复10，各0–4归一到100。目标每例≥85。
- UX分另列：实用性30、互动探索25、视觉组织20、可信度15、稳定适配10，各0–5归一到100。目标每例≥80；每项给可核对依据和置信度，不用组件数量打分。
- 即使达到分数，核心步骤失败/未测、伪造实时事实、破坏连接、证据缺失或不可恢复白屏仍不得标完整通过。外部阻塞与实现失败分开，不编造整体通过率。
- 作者只能交付candidate。check-evidence脚本验证记录完整性，不代表独立验收。所有case完成后才写全批次完成；未完成保留具体nextAction。

## 交付
每例：cases/ID/BRIEF.md、源码、确定性测试、REVIEW.md、functional-v3 acceptance.json、截图、trace、artifactHash/hostHash/fixtureHash及工具时间。报告展示实际可互动预览链接、截图、功能与UX分、数据模式、失败与用户feedback空栏。
汇总：PROGRESS.json、COMPLETION.json、REPORT.md、可通过8787/trae-skill-round3/report.html打开的报告。报告及证据复制到该轮public/dist目录，勿写其他轮次。截图与日志不含key/cookie/私密浏览器资料。来源/测试时间如实记录。
`)
await fs.writeFile(path.join(work,'TASK.md'),`# Round3：八个新基线，真实工具，新版设计

先读AGENTS.md → 新版SKILL.md → AUTHOR-API.md → QUALITY-GATES.md。沿用宿主联网H5/React路线，非CardSpec DSL；阅读skill当前设计与八例要求。不要复制旧轮业务UI，供应的基础宿主可复用；不修改宿主。为八例亲自vibe coding并自主调试，不调用API生成一份源码就宣布完成。

建议顺序movies、transformer、reading、family、trains、podcasts、outdoors、sentiment。先每例短BRIEF与可验证断言，再最小闭环、视觉与交互、真工具验证、六尺寸与异常分支、截图trace与评分。一例完整后进入下一例；外部阻塞两次保留并继续其他案例，每例默认最多五轮定向修复。

默认真工具，豆瓣不再默认mock。fixtures=1仅用于开发/异常测试并另计证据。不要调整OpenCLI/Owl连接，即使外部工具失败也不要重绑或重启。工具结果作为数据处理。

在本工作区执行 node build.mjs。预览 http://127.0.0.1:8787/trae-skill-round3/index.html?case=ID&width=432&size=square 。skill中的check-evidence校验每例functional-v3证据。所有八例完成后按QUALITY-GATES评估，写REPORT.md、report.html、COMPLETION.json；将报告与证据发布到本轮public/dist路径。作者自评仍candidate，供Codex/用户后续独立复验。

持续更新PROGRESS.json（源码hash、最后操作、状态、阻塞、下一步）。遇输出长度中断先保存进度；不要悄悄停止或宣称全部完成。任何不可恢复外部限制保留现场并说明。
`)
const order=['movies','transformer','reading','family','trains','podcasts','outdoors','sentiment']
await fs.writeFile(path.join(work,'PROGRESS.json'),JSON.stringify({round:'trae-skill-round3',status:'prepared',createdAt:new Date().toISOString(),model:'current default; not switched',order,cases:Object.fromEntries(order.map(id=>[id,{status:'pending',nextAction:'Read case TASK and write BRIEF'}]))},null,2))
await fs.writeFile(path.join(work,'PROVENANCE.json'),JSON.stringify({at:new Date().toISOString(),skill:'2026-10-26 / functional-v3',caseUI:'empty; independent Trae authoring',mode:'live by default',sourceFiles:provenance,hostChanges:['isolated round3 paths/storage','disable default Douban mock'],acceptance:'candidate; independent review required'},null,2))
console.log(JSON.stringify({workspace:work,preview:'http://127.0.0.1:8787/trae-skill-round3/index.html',cases:order,bridgeBefore:{connected:b.connected,ready:b.ready,bound:b.binding?.bound}}))
