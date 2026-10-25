import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const dir='artifacts/pearl-composition',pub='public/pearl-review-evidence'
const results=JSON.parse(await readFile(`${dir}/results.json`)),regression=JSON.parse(await readFile(`${dir}/regression.json`)),production=JSON.parse(await readFile(`${dir}/production.json`))
if(results.stats.unexpected||results.stats.skipped||regression.stats.unexpected||regression.stats.skipped)throw Error('Cannot mark incomplete/failed browser checks as passed')
const files=['demos/pearl-whole-card.jsx','src/pearl-review.jsx','src/pearl-review.css','src/cardspec/layout-audit.js','src/cardspec/layout.js','src/cardspec/SandboxPanel.jsx','src/cardspec/sandbox-document.mjs']
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])))
await mkdir(pub,{recursive:true})
const layouts=[]
for(const size of ['square','auto'])for(const width of [320,360,432]){
 const record=JSON.parse(await readFile(`${dir}/${width}-${size}.json`));if(!record.before.pass||!record.after.pass)throw Error('Layout failure')
 for(const state of ['initial','saved'])await cp(`${dir}/${width}-${size}-${state}.png`,`${pub}/${width}-${size}-${state}.png`)
 layouts.push({width,size,screenshot:`${width}-${size}-initial.png`,after:`${width}-${size}-saved.png`,mainVisiblePx:production.layouts.find(l=>l.width===width&&l.size===size).mainVisiblePx,horizontalOverflow:record.after.containers.some(c=>c.axis==='x'),primaryReachable:record.after.controls.every(c=>c.visible&&!c.occluded),touchHeight:Math.min(...record.after.controls.map(c=>c.height))})
}
const old=JSON.parse(await readFile(`${dir}/old-overflow.json`))
for(const w of [320,432])await cp(`${dir}/old-${w}.png`,`${pub}/old-${w}.png`)
const acceptance={caseId:'pearl-whole-card-v1',status:'candidate',humanApproved:false,trainingEligible:false,mode:'fixture',testVersion:'functional-v2',artifactHash:hashes[files[0]],hostHash:hashes['src/cardspec/SandboxPanel.jsx'],hashes,tests:{reference:results.stats,regression:regression.stats},layouts,checks:[
 {id:'host-input',status:'pass',action:'浏览器真实键盘操作slider、点击保存',expected:'可信事件经现有bridge回写宿主状态',actual:'六尺寸通过，无工具调用',evidence:['results.json','production.json']},
 {id:'invalid-state',status:'not_tested',reason:'本轮布局样板未增加损坏历史注入；不将其计为通过。'},
 {id:'empty-partial',status:'not_tested',reason:'固定数值模拟器无外部数据；不作空工具结果能力声明。'},
 {id:'stale-cancel',status:'not_tested',reason:'没有模型或CLI异步请求；本轮仅验证慢初始化期间的最新输入。'},
 {id:'local-recovery',status:'pass',action:'关闭Web回退原生、原生修改后返回；已有sandbox失败回退回归',expected:'保留可用功能与共享状态',actual:'参考及既有回归通过',evidence:['results.json','regression.json']},
 {id:'core-loop',status:'pass',action:'真实键盘调节40→64，点击保存；0/100边界',expected:'主数值/余量/保存值一致',actual:'六尺寸通过',evidence:['results.json','320-square.json','432-square.json']},
 {id:'restore',status:'pass',action:'刷新及原生/沙箱互切，原生改为23后返回',expected:'共享状态保留并同步',actual:'六尺寸通过',evidence:['results.json']},
 {id:'layout',status:'pass',action:'初始与操作后检查容器、裁切、控件命中',expected:'无必要内滚动、主控件44px',actual:'六尺寸均无issues',evidence:['results.json',...layouts.map(l=>l.screenshot)]},
 {id:'negative-controls',status:'pass',action:'检查旧Pearl及294/311、206/311、零高裁切、遮挡替身',expected:'具体元素及超限被检出',actual:'negative-control断言通过',evidence:['old-overflow.json','synthetic-overflow.json']},
 {id:'cold-start',status:'pass',action:'延迟WASM加载并修改父页输入',expected:'等待初始化后使用最新输入',actual:'启动及保存55%通过',evidence:['regression.json']}
],limitations:['作者自测，尚待用户确认设计质量；非人工金标。','预编译确定性React参考，不代表GLM自由生成质量。','第一轮不替换全局preset/生成prompt；无外壳通用组件接口留待样板确认。','原生fallback验证功能闭环，未宣称与沙箱视觉等价。','没有真机GPU/电池测试；无外部工具和事实查询。']}
acceptance.limitations.push('开发预览曾出现一次Vite/WASM冷加载超过原有启动期限，保留development-failure记录；最终样板门控针对本地8787生产构建，未放宽运行时限。')
await writeFile(`${dir}/acceptance.json`,JSON.stringify(acceptance,null,2))
await cp(`${dir}/acceptance.json`,`${pub}/acceptance.json`)
for(const name of ['results.json','regression.json','production.json','old-overflow.json','synthetic-overflow.json',...layouts.map(l=>`${l.width}-${l.size}.json`)])await cp(`${dir}/${name}`,`${pub}/${name}`)
const overflowRows=old.map(d=>{const c=d.containers.find(c=>c.element==='卡片内容');return `<tr><td>${d.width}px</td><td>${c.available}px</td><td>${c.demand}px</td><td>+${c.overflow}px</td><td>已检出；外层 ${d.outerOverflow}px</td></tr>`}).join('')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pearl 整卡构图验收</title><style>body{margin:0;background:#edf0ed;color:#20353b;font:15px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:24px}h1{font:40px Georgia,serif}.grid{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;width:320px;max-width:100%}img{width:100%;border-radius:20px}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #ccd5d1}a{color:#245e6c}small{color:#607575}.sizes{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px}section{margin:30px 0}</style><main><small>RENDERER / PEARL WHOLE CARD · CANDIDATE</small><h1>从组件外壳，到整卡构图。</h1><p><a href="/pearl-review.html">打开可交互对照 ↗</a> · <a href="acceptance.json">证据与源码哈希</a></p><p>同一40/60储能任务：一个主数值、一条比例、紧凑滑杆与保存。React通过现有隔离执行器运行，业务状态仍由CardSpec持有。</p><section><h2>320px：初始 / 操作后 / 旧版</h2><div class="grid"><figure><img src="320-square-initial.png"><figcaption>新版40% · 无内部滚动</figcaption></figure><figure><img src="320-square-saved.png"><figcaption>新版64% · 已保存</figcaption></figure><figure><img src="old-320.png"><figcaption>旧版：保留作为反例，不隐藏错误</figcaption></figure></div></section><section><h2>旧版内层溢出</h2><table><tr><th>宽度</th><th>可用高度</th><th>实际内容</th><th>超出</th><th>诊断</th></tr>${overflowRows}</table><p>诊断包括真实内层滚动、必要内容裁切、控件首屏可见性和命中遮挡。装饰裁切仍记录但不作为必要内容错误；关闭的details不误报。sandbox内部由可信iframe渲染器报告。</p></section><section><h2>六尺寸</h2><div class="sizes">${layouts.map(l=>`<figure><img src="${l.screenshot}"><figcaption>${l.width}px · ${l.size} · 主要触控≥${l.touchHeight}px</figcaption></figure>`).join('')}</div></section><section><h2>验证与边界</h2><p>样板 ${results.stats.expected} 项；既有模板与沙箱回归 ${regression.stats.expected} 项通过。包含状态恢复、原生回退、真实手势联动、减少动态效果、慢WASM启动及故障反例。截图和trace为本次浏览器实测，数据为确定性示例。</p><ul>${acceptance.limitations.map(l=>`<li>${l}</li>`).join('')}</ul><p>下一步：先确认此构图，再抽取复合视觉与无外壳组件接口；模型只选择验证后的构图及状态绑定。</p></section></main></html>`
await writeFile(`${pub}/index.html`,html)
await mkdir('dist/pearl-review-evidence',{recursive:true});await cp(pub,'dist/pearl-review-evidence',{recursive:true})
console.log(JSON.stringify({report:'/pearl-review-evidence/',candidate:true,tests:results.stats.expected+regression.stats.expected}))
