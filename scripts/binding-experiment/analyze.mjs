import {readFile,writeFile,copyFile} from 'node:fs/promises'
const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2',rows=JSON.parse(await readFile(dir+'/results.json','utf8')),dom=JSON.parse(await readFile(dir+'/browser.json','utf8')),maps=JSON.parse(await readFile(dir+'/maps.json','utf8')),s=JSON.parse(await readFile(dir+'/summary.json','utf8')).summary;
const arms=s.map(a=>({...a,browserCases:rows.filter(r=>r.arm===a.arm&&dom.filter(d=>d.arm===a.arm&&d.case===r.case).length===6&&dom.filter(d=>d.arm===a.arm&&d.case===r.case).every(d=>d.passed)).length,coldMappingMs:a.arm==='A4'?maps.calls.reduce((v,c)=>v+c.ms,0):a.arm==='A3'?Object.values(maps.maps).reduce((v,c)=>v+(c.A3meta?.elapsedMs||0),0):0}));
const first=arms.find(x=>x.arm==='A0'),auto=arms.find(x=>x.arm==='A2'),coldTokens=maps.calls.reduce((s,c)=>s+(c.response?.usage?.total_tokens||0),0);
const content=JSON.parse(await readFile(dir+'/content-audit.json','utf8'));
for(const a of arms)a.contentPassed=content.filter(r=>r.arm===a.arm&&r.passed).length;
const failures=Object.fromEntries(arms.map(a=>[a.arm,rows.filter(r=>r.arm===a.arm).map(r=>({case:r.case,hostPassed:r.passed,errors:r.diagnostics?.filter(d=>d.severity==='error').map(d=>d.message),runtime:r.runtime?.checks.filter(c=>!c.passed),browser:[...new Set(dom.filter(d=>d.arm===r.arm&&d.case===r.case).flatMap(d=>d.checks.filter(c=>!c.passed).map(c=>c.name+': '+(c.error||'not passed'))))]}))]));
await writeFile(dir+'/findings.json',JSON.stringify({arms,failures,coldMappingTokens:coldTokens},null,2));
const md=`# DeepSeek V4 Flash 工具绑定实验：首轮结果

日期：2026-11-02。请求模型 \`deepseek-v4-flash\`；探针与生成 trace 记录网关返回模型名。当前为 S0/S1 小规模实验，不是完整生产策略验收。

## 已完成与证据

- 8 个受控任务 × 5 策略 × 1 次 = **40 张模型生成产物**；每张最多两轮修复。
- **127/127** 离线适配器/参数保护检查通过；已有工具展示回归 **6/6** 通过。离线配置组不是学习泛化成绩。
- 编译成功产物共 ${rows.filter(r=>r.complete).length} 张，完成 ${dom.length} 次浏览器尺寸/模式检查（320/360/432 × square/auto）；${dom.filter(r=>r.passed).length} 次通过既定交互/布局探针，不代表内容质量通过。编译失败的3张没有可交互页面，不能从总通过率分母消失。
- 合成 CLI 替身，覆盖筛选、实体选择、详情依赖、比较、刷新与恢复，以及写操作点击前不执行。另有一次真实 opencli.wttr.forecast 只读冒烟：3条预报、2.184秒，A2/A4字段适配可用，证据见 live-weather.json；这不等于完整S3。未执行真实购买/账号写入。OpenCLI/Owl 未被实例化、重绑、重启或关闭。
- [HTML 报告](http://127.0.0.1:8787/tool-binding-qa/report.html)提供交互产物、截图、源码、逐轮 trace、反馈输入。反馈只存当前浏览器 localStorage；尚未成为服务端 RSI 训练数据。

## 对照结果

|策略|首次宿主通过|修复后宿主通过|六种交互/布局探针均通过|基础内容检查|生成/修复中位秒|累计输入token中位|回退例数|
|---|---:|---:|---:|---:|---:|---:|---:|
${arms.map(a=>`|${a.arm}|${a.firstPass}/8|${a.hostPassed}/8|${a.browserCases}/8|${a.contentPassed}/6|${(a.medianMs/1000).toFixed(2)}|${a.medianInputTokens}|${a.fallback}|`).join('\n')}

A0：受控手写接线对照，保留现有 tool-view 选项；A1：统一字段、模型接线；A2：审核映射＋宿主接线；A3：MiniLM候选＋拒配回退；A4：一次性模型映射＋宿主接线。

**当前没有一组通过产物质量门控。** 基础内容检查仅覆盖6个数据案例的432px方形选择后状态：实体名、关键数值、原始JSON误展示，以及源字段非空却显示“暂无”。通过也不代表整体美观、语义完整或无重复；它与交互列不是同一指标。证据见 content-audit.json 和 content-*.png。A2天气在选中详情中有温度，但候选列表仍全显示暂无；列车时间/余票同样误空；评分与视频卡把 raw 对象直接展示。不能用7/8交互通过掩盖这些问题。

A2 相对 A0，本轮生成/修复中位耗时下降 **${((1-auto.medianMs/first.medianMs)*100).toFixed(1)}%**，累计输入 tokens 中位下降 **${((1-auto.medianInputTokens/first.medianInputTokens)*100).toFixed(1)}%**。不是生产请求的速度承诺，也不代表从输入到完成用户任务的全程时延。

A4 在6个有数据的来源上另有6次映射调用，合计 ${(maps.calls.reduce((a,c)=>a+c.ms,0)/1000).toFixed(2)} 秒、${coldTokens} total tokens；必须计入首次接入成本，不能隐藏到生成中位数中。A3 的模型加载/编码也另计，含首次本地加载约 ${(maps.maps.movies.A3meta.elapsedMs/1000).toFixed(2)} 秒。A1/A2 人工配置时间尚未量化；不能据此证明维护成本最优。

## 主要发现

1. **统一字段不等于消除接线负担。** A1 仍会自行拼错动作、缺少初始化取数、误用字段路径；仅把 rating 改名为 metric 不足以解决依赖与状态问题。
2. **宿主接线有明显候选价值。** A2 固定保存完整选中行，区分 UI rowKey 与业务 ID，由宿主构造详情参数，并维护比较/刷新/返回动作。模型只写视图，运行时通过率和生成时间比本轮手写对照更好；尚有事件未接、详情可达性与布局问题。
3. **MiniLM不适合直接承担关键字段的最终裁决。** 本轮原型的严格角色一致率为9/30，5个数据任务退回A0。它使用字段名称、样本、类型及固定0.28阈值，未经系统阈值校准，不能推广为所有语义匹配器的上限。回退后的成功不算 MiniLM 直接匹配成功。
4. **一次性模型适配器适合探索长尾接入，但必须验证动作。** A4 严格角色一致率为26/30；其中可选副标题/分面有合理替代，不可简单等同事实错误。真实问题是评分维度缺少稳定选择标识，使比较将不同项当成同一项：需要分开定义 viewKey 与业务 entityId。
5. **运行时通过不能替代浏览器验收。** 必须检查新增详情实际可达、比较内容有信息、返回恢复，以及移动布局。执行成功但视图仍读错误层级，应归因于数据呈现契约/模型实现，不能记完整通过。
6. **装饰性容错值得单独做。** 对第一轮源码只移除无效根属性 card.surface 后，A2 宿主交互通过从0/8变为5/8，A4从2/8变为6/8。没有新增模型调用；仅为事后离线反事实，未对这些版本做浏览器验收，不混入主表。见 tolerance.json。
7. **泛化语义契约还缺显示元数据与槽位所有权。** metric/facet 等通用名字直接出现在 UI；模型仍会在归一化后引用 avgTempC、start_time 等旧字段。候选列表把 raw 当普通可展示字段，形成大片JSON。应由宿主提供类型化显示字段、中文标签、单位/尺度及覆盖率；原始对象通过独立引用按需读取，不参加默认字段枚举。不是简单增加一条“不要显示raw”的提示。

## 实验与测试脚本问题：保留，不冒充模型失败

首批试跑位于相邻 \`deepseek-v4-flash-20261102\` 目录。共同提示的命名空间/根属性说明含糊；自动接线修复错误带出了宿主注入声明，引发模型重复定义。该批次中止后保留源码、trace和pilot-code；修正所有组的共同提示及自动组的所有权声明，重新从头运行40例。两批不混算。

浏览器脚本最初未打开宿主 role=details 的弹窗，误判详情不可见；旧记录保留在 browser-before-details-support.json / browser-before-dialog-support.json。补齐实际点击后重评失败项，未修改生成产物。脚本仍是按指定组件/标签编写的功能探针；替代布局不满足该探针时应结合源码和人工观察判断，不把脚本定位问题自动等同业务失败。

内容审查在生成结束后追加，是诊断性门控，不是预登记主指标。保留原始DOM文本，可复核匹配规则；没有根据这些结果重新挑选或生成产物。写操作替身还有协议局限：规范描述归一化回执，实际替身返回 status 原字段，相关显示失败须归入实验适配器契约不一致，不能全算模型失误。初始system中仍有宽泛的surface建议，再由精确规则限定根不支持，这种披露冲突也会增加无效修复。

## 范围限制与后续门控

- 为隔离接线，使用共同精简原生组件契约与固定 collection/控件标签；未走完整生产的体验规划/深度构建，未提供真实海报或 React/SVG。A0 是受控手写基线，不能将其失败率当作当前线上总体失败率。
- 评分维度任务替代了复杂舆情聚合；天气、视频等也采用明确的小规模 CUJ。因此本轮覆盖8类连接机制，不等于原20例或原H5基线全部需求已验收。
- 仅一次生成重复，没有独立人工盲评或统计显著性结论。原20+新增8的S2、真实CLI的S3、图片/地图/沙箱、取消乱序完整矩阵均尚未执行。按预设门控，当前不晋级默认策略，也不把S1计作整项实验完成。
- 下一轮先把 A2/A4 共用接口补成“viewKey/entityId分离＋类型/单位/标签＋宿主控制字段到槽位＋明确动作结果落点”，隔离raw引用，修正回执与装饰属性的披露冲突，补充浏览器真实内容断言。内容门控通过后，再以A0/A2候选跑28例、两次重复，并增加真实工具验证。MiniLM先用于候选建议，不自动接业务ID、金额、时间与写操作参数。
- TODO1分段披露仍待实施；本轮没有改变生产检索和生成模式。没有 GPT Site 发布。
`;
await writeFile(dir+'/report.md',md);await copyFile(dir+'/report.md','dist/tool-binding-qa/report.md');await copyFile(dir+'/findings.json','dist/tool-binding-qa/findings.json');console.log(JSON.stringify(arms));
