import {readFile,writeFile,copyFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {ROOT as S1,DEST as D1} from './engine-v3.mjs'
import {ROOT as S2,DEST as D2,S2_CASES} from './s2-engine.mjs'
const json=async p=>JSON.parse(await readFile(p,'utf8'))
const summary=await json(D1+'/summary.json'),runs=await json(S2+'/results.json'),checks=await json(S2+'/replay.json')
if(runs.length!==112||checks.length!==runs.filter(r=>r.complete).length*6)throw Error('Experiment incomplete')
const bad=runs.filter(r=>r.arm==='A2S'&&(!r.complete||checks.filter(x=>x.id===r.id).some(x=>!x.passed)))
const metrics=summary.s2.map(r=>`| ${r.arm==='A0'?'A0：模型接线':'A2S：宿主槽位＋接线'} | ${r.compiled}/56 | ${r.host}/56 | ${r.browser}/56 | ${r.modelSeconds.toFixed(2)} 秒 | ${r.inputTokens} |`).join('\n')
const md=`# 工具绑定第二轮：宿主槽位与实体身份

日期：2026-11-02。请求模型 deepseek-v4-flash；网关实际返回 deepseek-v4-flash-ga-260731 / deepseek-v4-flash-0731，不能确认两别名是否对应完全相同的权重。

## 结论

宿主接管字段路径、中文标签、单位及业务ID后，8例内容门控通过，随后完成28例×2策略×2次，共112次生成。扩展组的候选49/56通过全部既定浏览器探针；仍有7个产物未通过，故保留为实验候选，不切换默认生成策略。

这不是“28类需求均完整实现”。本轮是受控工具绑定实验，固定工具候选和合成响应，主要检查字段保真与基础交互。未证明真实工具普遍可用、完整CUJ、美观提升或千级工具检索召回。

## 实现落地

- shared/cardspec/tool-slots.mjs：审核映射→带类型槽位；标签、单位、来源路径、缺失/格式错误由宿主决定。0与负值保留；缺失显示“未提供”，格式不合显示“格式待核对”，不补造事实。
- viewKey仅为UI选择键；entityId必须来自明确业务字段，缺少则为null；rawRef指向单独原始记录，不把raw对象当候选展示字段。
- collection、experience及ToolView共用投影；已投影行不二次解释。普通源行仍保留原始ID和事件数据，旧卡与DIL无需迁移。未知/漂移映射拒配后保留原结果路径。
- 9个显式来源配置加现有展示配置复用；S2额外的审核映射留在实验fixture，不能称全部工具都已自动适配。
- 本地前端已构建，未重启服务、未操作OpenCLI/Owl连接，未发布GPT Site。自动生成接线A2S仍只在实验入口；正常生成可受益于共享显示修复。

## 结果

S1：8例×两策略，共16次。候选8/8通过320/360/432px × square/auto共48次检查；其中六个数据案例全部通过候选行标签、数值与单位门控。22项相关单元测试通过。

S2：原discovery-cases的20个自然需求＋8个预登记绑定挑战。112次生成，81个可编译产物，486次浏览器尺寸/模式检查。编译失败仍保留在56的分母中，未伪造截图。

| 策略 | 编译通过 | 初始取数/宿主检查 | 六尺寸探针全通过 | 累计模型时间中位 | 累计输入tokens中位 |
|---|---:|---:|---:|---:|---:|
${metrics}

模型时间只含模型请求累计时间，不含浏览器、人工映射维护与真实CLI耗时。两组共享最终renderer，比较的是“宿主映射＋接线＋精简契约”的组合，不能单独归因为字段映射。最多两轮修复、temperature 0.4、6000输出token、thinking关闭。没有提升预算来获得通过。

## 测试器修正与限制

实验期间修正了投影重复覆盖、测试替身缺rowKey、模态详情读取、列表定位和跨来源同名实体定位。最终重放同一份保存源码，没有挑最好一次。原始模型请求/响应与每次attempt、修复前replay JSON保留；截图是最终验证状态。

早期误报触发过模型修复，因此耗时与tokens可描述本轮运行，但不是无混杂的因果速度比较。没有使用首次通过率作为胜出证据。S2浏览器主要核验首3个展示槽位；不代表每个字段与溢出问题全覆盖。单人截图复核不是独立盲评。

真实验证只有既有8787服务的wttr.current和wttr.forecast两次只读调用，分别返回1条与3条，投影通过（见live-slots.json）。其余用可控工具替身，写操作也只测替身，不执行真实音乐控制。

## 尚未通过的候选

${bad.map(r=>`- ${r.id}：${!r.complete?r.diagnostics.filter(x=>x.severity==='error').map(x=>x.message).join('；'):checks.find(x=>x.id===r.id&&x.width===432&&x.size==='square')?.checks.filter(x=>!x.passed).map(x=>x.name).join('；')}`).join('\n')}

原因分层：

1. 契约/模型：三份产物调用未注册detail_s1；模型由其他来源类推了不存在的能力。应由宿主提供具备enabled/reason的可执行意图清单，不让模型构造动作名。
2. 模型：B01把chosen数组当对象使用，造成不唯一itemKey；应减少对内部状态结构的暴露，提供已选集合视图。
3. 模型/呈现：写操作一例提前宣称已暂停，按钮写“继续播放”却绑定暂停。不能只验证schema；回执和按钮语义需要门控。
4. 详情可达性：亲子一例详情取数后探针未读到新增信息，保留失败，不因调用成功算通过。
5. 来源归属：词典一例把词条来源放在“真实例句”区，并重复生成同源集合。测试对其重复区域定位存在歧义，未记为通过；这是需要消除的用户可见歧义，不能仅放宽断言。

## 原始需求覆盖缺口

自动探针验证名称筛选、展示值、选择→详情业务ID、刷新、状态恢复、写操作不自动重放与横向溢出。没有独立验收预算/价格区间筛选、所有比较字段、真实地图、正负舆情分类/分母、双程固定与购票、完整动画质量或乱序故障矩阵。

B01没有真实坐标，不能证明地图完成；B03只测名称筛选，不证明预算限制；B04没有情绪标签/汇总管线，不把评分当正负比例；B07新来源映射在实验前人工建立，不是盲测自动适配。完整原始任务状态均为“尚未独立验收”，不以探针成功代替。

## 下一轮优先级

1. 先把动作能力也宿主化：来源→可用意图→所需entityId与上下文→按钮/回执；不可用动作不披露为可调用。
2. 保留类型化slots供数值/时间/类别筛选与图表使用，不只暴露title/summary；按需披露selected/selectedItems而非内部实现。
3. 将来源、详情和比较区域绑定稳定身份，宿主管理展开/返回，避免重复区域和混错源。
4. 用冻结测试器重新做一轮公平速度测量；另开完整CUJ与真实工具验收，不先扩大覆盖率宣传。
5. TODO1分段披露仍独立待办；本轮固定检索，避免把工具发现与绑定收益混在一起。

humanApproved=false；trainingEligible=false。用户可在HTML报告逐产物填写反馈。

## 证据

- HTML：http://127.0.0.1:8787/tool-binding-v3/report.html
- S1目录：${S1}
- S2目录：${S2}
- 每次请求原文/网关响应/usage：*-trace.json；每轮源码及失败：*-attempt-N.json；最终生成：results.json；浏览器动作、调用与截图：replay.json。
`
await writeFile(S1+'/report.md',md);await writeFile(D1+'/report.md',md)
const provenance={finishedAt:new Date().toISOString(),runs:runs.length,renderChecks:checks.length,modelAliases:[...new Set(runs.map(r=>r.reportedModel))],humanApproved:false,trainingEligible:false,hashes:{}}
for(const p of ['scripts/binding-experiment/s2-browser.mjs','scripts/binding-experiment/s2-engine.mjs','shared/cardspec/tool-slots.mjs',D2+'/viewer.js'])provenance.hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex')
await writeFile(S2+'/final-provenance.json',JSON.stringify(provenance,null,2));await copyFile(S2+'/final-provenance.json',D2+'/final-provenance.json')
for(const file of ['docs/tool-binding-round2.md','docs/tool-binding-experiment.md']){
 const s=await readFile(file,'utf8');const marker='## 2026-11-02 第二轮完成记录';if(!s.includes(marker))await writeFile(file,s+'\n\n'+marker+'\n\n宿主槽位实现与S1内容门控完成；S2共112次生成、486次浏览器检查。A2S为49/56探针通过，非完整任务成功率；未晋级默认。参见[完整结果](../'+S1+'/report.md)。TODO1和完整真实工具/UX验收仍待实施。\n')
}
const roadmap='docs/tooling-roadmap.md',road=await readFile(roadmap,'utf8');await writeFile(roadmap,road.replace('S2 全量28例与完整S3真实工具验收尚未执行。','第二轮S2全量28例已执行（112次生成、486次尺寸/模式检查），A2S 49/56探针通过；完整S3真实工具与原始任务UX验收仍未完成。').replace('先补宿主字段到槽位的所有权与内容断言，再扩大试验；','第二轮已补宿主字段到槽位的所有权与内容断言，S1六个数据案例全部过门后扩大试验；'))
console.log(JSON.stringify({report:D1+'/report.html',runs:runs.length,checks:checks.length,failures:bad.length,cases:S2_CASES.length}))
