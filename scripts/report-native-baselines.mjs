import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
const root='public/cardspec-baselines';
const cards=JSON.parse(await readFile('shared/cardspec/baselines/generated.json','utf8')),ui=JSON.parse(await readFile('artifacts/native-baselines/ui/results.json','utf8')),live=JSON.parse(await readFile('artifacts/native-baselines/live/results.json','utf8')),replay=JSON.parse(await readFile('artifacts/native-baselines/live/replay.json','utf8')),unit=await readFile('artifacts/native-baselines/unit-tests.txt','utf8');
if(ui.length!==30||ui.some(r=>r.artifactHash!==cards.find(c=>c.id===r.id)?.sha256))throw Error('Report requires all 30 checks against the current canonical artifacts');
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rows={
 sentiment:['新闻与社交线索 → 评论正文 → 带引文分类 → 样本统计、日期图 → 原文核对','改为手动换源；每次选择一条 B站视频获取评论。标题与新闻不计态度；未接入车系口碑分支和代表观点摘要。'],
 family:['坐标图选最多四处 → 保存地点 → 按年龄/预算规划 → 校验地点与时段 → 准备清单','原生坐标示意图，无 OSM 底图/导航。没有真实图片时不拿示意图冒充地点。'],
 movies:['搜索/热映 → 评分与海报 → 结构化详情 → 三部比较 → 今晚选择 → 视频/购票入口','原生比较与详情替代 H5 自定义海报布局；本轮未做 AI 分组摘要。购票仍为官方入口，无库存或下单。'],
 transformer:['六个 token / 4→6→4 → 注意力、两条残差、GELU、输出 → 扰动与神经元贡献','数值与 H5 算法一致；热图和向量图替代自由 SVG 连线，未复制输出维度的独立权重选择。不做真实语言预测。'],
 trains:['去返程查询 → 确认两班完整快照 → 起售倒计时 → 原车次余票刷新 → 复制/官方购票','每次最多二十条，可调整时间；不自动购票。起售时间由用户核实，不根据发车时间推测。']
};
const issues=[
 ['P0 · 已修','渲染器：logic 的 grow 没有落到 DOM','滚动区会缩为 48px，却被布局检查认为 fit。现在沿用通用 grow 契约，方形容器分配剩余空间；自然高度继续展开。'],
 ['P0 · 已修','宿主：合法业务 ID 被 rowKey 规则误杀','来源原始 ID 与选择键同值时误拒详情。现在要求原始同名字段作为证据；合成 row: 键仍拒绝。'],
 ['P0 · 已修','运行时：响应更新吞掉未提交点击','输入变化原来清空全部 JS 队列。现在先同步新输入，再重算未提交的用户事件；已提交 effects 不重放，显式取消仍清空。另修正 DSL 回调强制切回结果页的写法。'],
 ['P1 · 待设计','契约：数据归一化与身份仍靠作者','同一实体跨 search / hot / detail 有不同 rowKey；字段 text/content、日期时区、真实 ID、标题与正文语义需要明确处理。建议暴露已验证的实体键与证据类型，避免模型重复编写。'],
 ['P1 · 待设计','契约：异步状态与引用校验样板较长','本轮需要请求输入快照、取消/恢复、引用去重和局部 JSON 校验代码。建议把可证明的通用模式收敛为宿主能力；业务计算仍允许隔离 logic。'],
 ['P1 · 待设计','数据预算：logic 的输入不是无限数据容器','当前边界为 12k 源码、64KiB JSON、4k 节点。局部截断在进入 JS 之后才发生；更大工具结果需要宿主投影/数据引用，而不是不断放宽限制。'],
 ['P1 · 模型/harness','结构正确不等于事实保真','实时分类出现不在原文中的引文，被宿主拒绝。亲子计划引用和时段合法，但理由仍出现未证实的适龄判断；目前只能标明待核实，不能把结构通过算作事实通过。'],
 ['P2 · 表达差距','地图、图表、局部详情仍不如 H5 自由','无地图底图；热图替代自定义网络边。窄方卡仍需局部滚动，控制区占用空间。已缩短图表浮点标签，保留完整数值与事件。']
];
const passed=ui.filter(x=>x.passed).length,unitCount=unit.match(/tests (\d+)/)?.[1]||'?',unitPass=unit.match(/pass (\d+)/)?.[1]||'?';
const calls=live.results.flatMap(r=>r.events.filter(e=>e.op).map(e=>({...e,id:r.id})));
const data={authoring:'codex-handcrafted',reviewStatus:'unreviewed',trainingEligible:false,cards:cards.map(({source,...c})=>({...c,characters:source.length})),ui,live,replay,unit:{total:Number(unitCount),passed:Number(unitPass)},issues,scope:'Local 8787 only; no generation benchmark or automatic training eligibility'};
await mkdir(root+'/screenshots',{recursive:true});
for(const c of cards)await copyFile(`artifacts/native-baselines/ui/${c.id}-360-square.png`,`${root}/screenshots/${c.id}.png`);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>五个原生 CardSpec：功能验收与 DSL 缺陷</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f5f1;color:#243b35;font:15px/1.7 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.2;letter-spacing:-1px}h2{margin-top:44px;font-size:23px}small{color:#657971}a{color:#2a705a}section,.intro{padding:22px;border-radius:20px;background:#fff9;margin:20px 0}.metrics{display:flex;gap:16px;flex-wrap:wrap}.metrics strong{display:block;font-size:28px}.metrics>div{background:#e5ede5;border-radius:14px;padding:14px 24px;flex:1}.shots{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.shots img{width:100%;border-radius:18px;box-shadow:0 4px 18px #233d3520}.shots a{font-weight:600}.shots small{display:block}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:13px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #dce4dc}th{color:#557467}code{overflow-wrap:anywhere}.scroll{overflow:auto}.warn{background:#fff0d1;padding:18px;border-radius:14px}.fix{display:grid;grid-template-columns:150px 1fr;gap:14px;margin:22px 0}.tag{font-size:12px;color:#50705e}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}@media(max-width:800px){.shots{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}.fix{grid-template-columns:1fr}.metrics>div{min-width:140px}}@media print{main{padding:16px}.shots{grid-template-columns:repeat(5,1fr)}}
</style><main><small>RSI / NATIVE REFERENCE / 2026-10-20</small><h1>五个 H5 基线，五份可执行的 CardSpec。</h1><p>核心功能可以用原生组件 + 隔离 JS 实现。无需 React sandbox；每份 DSL 可单独下载编译。这里验证功能等价范围，不宣称像素等价或 GLM 能在一次生成中写出同样质量。</p>
<p><a href="/cardspec-baselines.html">打开交互工作台 ↗</a> · <a href="/h5-baseline/index.html">H5 原基线 ↗</a> · <a href="data.json">机器可读结果</a> · <a href="manifest.json">DSL 清单与 SHA-256</a></p>
<div class="metrics"><div><strong>${passed} / ${ui.length}</strong>尺寸 × 交互 × 恢复检查</div><div><strong>${unitPass} / ${unitCount}</strong>项目自动测试</div><div><strong>${calls.filter(x=>x.status==='success').length} / ${calls.length}</strong>本次真实工具调用成功</div><div><strong>5 / 5</strong>原生 DSL，可独立编译</div></div>
<section class="shots">${cards.map(c=>`<div><a href="/cardspec-baselines.html?case=${c.id}">${c.title} ↗</a><small>测试数据 · 方形 360px</small><img src="screenshots/${c.id}.png" alt="${c.title}原生 CardSpec 测试截图"><a download href="${c.id}.cardspec">下载 DSL</a></div>`).join('')}</section>
<h2>等价范围与有意保留的差异</h2><div class="scroll"><table><tr><th>案例</th><th>已实现的功能闭环</th><th>与 H5 的差异 / 边界</th><th>DSL 字符数</th></tr>${cards.map(c=>`<tr><td><b>${c.title}</b></td><td>${rows[c.id][0]}</td><td>${rows[c.id][1]}</td><td>${c.source.length.toLocaleString()}<br><small>${c.sha256.slice(0,12)}</small></td></tr>`).join('')}</table></div>
<h2>真实工具与模型调用</h2><p>8 次 OpenCLI 读取均成功；豆瓣海报真实加载成功。亲子 GLM 输出通过引用与时段校验。舆情分析的模型引文不匹配，被严格校验拒绝；不把它算作态度分析通过。失败后仍能查看原始评论和新闻。</p><div class="scroll"><table><tr><th>案例</th><th>操作</th><th>结果</th><th>耗时</th></tr>${calls.map(e=>`<tr><td>${esc(cards.find(c=>c.id===e.id)?.title)}</td><td>${esc(e.label)}</td><td>${e.status==='success'?'成功'+(e.count!=null?' · '+e.count+' 条':''):'未通过：'+esc(e.error)}${e.op==='analyze'?'<br><small>analysis quote is not present in source record</small>':''}</td><td>${(e.elapsedMs/1000).toFixed(1)}s</td></tr>`).join('')}</table></div>
<p class="warn">亲子模型输出仍有“适合 3–6 岁”的未经来源证实判断。虽然界面标明适龄待核实，结构校验只能保证引用、覆盖与时段，不证明建议事实正确。模型输出的内容质量需单独人工审核。</p>
<h2>本轮识别的通用缺陷</h2>${issues.map(([priority,title,body])=>`<div class="fix"><span class="tag">${priority}</span><div><strong>${title}</strong><p>${body}</p></div></div>`).join('')}
<h2>验证方法与证据边界</h2><section><ul><li>320 / 360 / 432 px，square / auto。每例执行关键操作，刷新后核对完整选择、计划、票夹或实验状态；检查页面错误、横向溢出和实际内容区高度。</li><li>校验浏览器加载的源码与下载的 canonical DSL 字节一致。作者函数在构建前序列化，避免压缩器重命名参数后破坏隔离 JS。</li><li>计算显微镜对多种句子、扰动与残差开关，逐项比较 input、attention、h、GELU、投影与最终输出，误差阈值 1e-10。</li><li>检查未知/重复/缺失的计划引用、过期详情、保存完整快照、引文不匹配、来源失败保留资料、局部 JS 异常和异步输入更新。</li><li>真实数据 trace 已用最终 DSL 离线重放 ${replay.filter(x=>x.passed).length}/${replay.length}；其中舆情验证的是正确拒绝失败并保留资料，不是分类成功。</li><li>正常响应的测试通过不等于任意外部服务永远可用。不宣称像素、美学或事实完整性已达到 H5；本轮没有运行新的 20 题 GLM 生成对比。</li></ul><p>OpenCLI/Owl：前后 session 一致，daemon PID ${live.connection.after.daemonPid}，connected=${live.connection.after.connected}。没有关闭或重绑连接，也没有发布 GPT Site。</p></section>
<h2>对下一轮 RSI 的建议</h2><p>把这五份 DSL 用作功能与执行语义参考，优先抽取“数据规范化 → 保留实体选择 → 请求快照 → 有依据的局部更新”的通用宿主能力，再减少模型要写的桥接代码。不要把整份手写成品直接塞进提示词，也不要把测试通过直接当作偏好训练许可。</p><p>工作台反馈绑定 artifact hash；默认 unreviewed、trainingEligible=false。保留原始失败与修复记录，人工确认后再决定是否纳入训练/评估集。</p></main></html>`;
await writeFile(root+'/report.html',html);await writeFile(root+'/data.json',JSON.stringify(data,null,2));
await mkdir('dist/cardspec-baselines/screenshots',{recursive:true});
for(const file of ['report.html','data.json','manifest.json',...cards.map(c=>c.id+'.cardspec')])await copyFile(root+'/'+file,'dist/cardspec-baselines/'+file);
for(const c of cards)await copyFile(root+'/screenshots/'+c.id+'.png','dist/cardspec-baselines/screenshots/'+c.id+'.png');
console.log(JSON.stringify({ui:`${passed}/${ui.length}`,unit:`${unitPass}/${unitCount}`,realCalls:`${calls.filter(x=>x.status==='success').length}/${calls.length}`,report:'/cardspec-baselines/report.html'}));
