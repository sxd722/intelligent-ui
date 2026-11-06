import fs from 'node:fs/promises';
const root='artifacts/mock-head-20261103',dest='dist/mock-head';
const results=JSON.parse(await fs.readFile(root+'/acceptance.json'));
const body=`# 图片先行：头部修复与生成诊断

2026-11-03。本次回放原模型产物，未重新生成或手工修改 CardSpec。仅更新本地宿主。

## 已修复的头部

将标题、说明和图片合并为同一头部：图片覆盖完整头部，真实文字叠在上层，下方渐变增强对比。窄屏有设置按钮时头部随内容增高；图片失败保留渐变、标题和交互。左右分栏构图仍保留左侧图文封面，窄屏回到顶部封面。

古希腊、克苏鲁、湘湖三个原产物，在 320/360/432px、square/auto 两种模式检查头图覆盖、标题边界和横向溢出，并检查选择、详情返回、勾选以及图片失败。此验收针对头部改动；不代表整卡无内部滚动或内容质量全部合格。一次回放挂载超过测试原定 8 秒，调整等待为 15 秒后重跑；没有修改生成超时。

## 古希腊：为什么下方不一致

设计图是「横向图标选项 → 单一详情区」，模型产物却为「柱图 → 第二组选项按钮 → 详情」。耗时 68.782 秒，记录 2 次修复。

1. 代码模型拿到的是 vision 提取的 JSON，而非设计图本身。现有 JSON 保留配色、裁切、hero/split/editorial、列数和图片块，却没有表达选择器、详情面板和区域顺序。
2. 通用生成提示鼓励图表等高阶表达；缺少具体结构约束时，模型自行添加了柱图与重复选择器。6→1 是排序编码，不是实测权重，需求本来不需要统计图。
3. 宿主主要落实材质、图片裁切和宽泛构图，没有对照设计图验收区域结构。列数投影也无法把柱图和按钮转成设计图的选项条。

这次修复头部没有解决下方结构偏离。下一步应提取短小的内容模式（如 selector-detail）、区域顺序和图片槽位，由宿主提供组合，检测重复的信息表达；无需让模型重新推敲整张图的布局。

## 克苏鲁：两次请求必须分开看

| 记录 | 实际情况 | 主要根因 |
| --- | --- | --- |
| 较早沙箱尝试 ee79c3e4… | 9 次测试：4 failed、5 partial；首末测试相隔约 200 秒，测试耗时合计约 32 秒；完整请求总时长缺失 | height=520 超过 480；JSX map 表达式多分号；最终 DSL 多一个闭合花括号；中间缩成测试片段，不是完整卡片通过 |
| 后来原生实现 9d92c2a0… | 175.359 秒，4 次模型调用、2 次搜索、0 次实现修复；两次浏览器测试后 partial 提交 | 扩展模式提高推理强度，模型调用约 142 秒；测试按钮名与实际名称不匹配，随后又未返回列表就找下一实体 |

早一轮的 JSX 错误中，模型多次修改 CSS 写法，仍保留 DATA.map 表达式中的非法分号。报错虽含 JSX 行列号，源码上下文却主要指向外层 sandbox 起点，无法直接突出真正错误。后面的微型测试片段混在同一调试历史中，使「局部可运行」与「完整需求通过」容易混淆。解析失败后的视觉丢失提示是次生信息，不应视作独立退化证据。

后来一轮使用 glm-5.3-flash，但开启 extendedGeneration，实际启用高推理；输入上下文约从 17,000 增至 31,405 tokens。4 次调用累计输入 101,104（含重复上下文，不能当作独立新内容），输出 7,068，其中 reasoning 4,392。搜索约 12.8 秒，浏览器测试合计 15.9 秒；设计图缓存命中约 3ms，并非生图拖慢。

因此不能简单归因于沙箱不够开放。优先改进：内部 JSX 错误定位；scratch 探针与正式候选隔离；测试按真实可见控件和返回路径执行；重复错误停止整卡重写并给出局部修复；上下文保留最新候选及有效失败摘要。

## 证据

- Greek run: artifacts/rsi-adaptive/runs/9e80a8e0-4279-44d0-870c-a6b1d1f12ae2.json
- Cthulhu run: artifacts/rsi-adaptive/runs/9d92c2a0-bac1-4f90-8843-3ed1181dab6b.json
- Earlier sandbox: artifacts/generation-debug/ee79c3e4-1a9a-400a-afd4-572b8727a384
- Later native: artifacts/generation-debug/31b31bc7-4f05-4fbf-ab03-4889be0a145e
- Current regression: acceptance.json、screenshots/、三个 *-browser.zip
`;
await fs.writeFile(root+'/report.md',body);
await fs.mkdir(dest+'/screenshots',{recursive:true});for(const f of await fs.readdir(root+'/screenshots'))await fs.copyFile(root+'/screenshots/'+f,dest+'/screenshots/'+f);
for(const f of ['report.md','acceptance.json','greek-browser.zip','cthulhu-browser.zip','trip-browser.zip'])await fs.copyFile(root+'/'+f,dest+'/'+f);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图片先行：头部与生成诊断</title><style>body{max-width:1160px;margin:auto;padding:24px;font:16px/1.7 system-ui;background:#eef1f5;color:#182637}a{color:#2458a0}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}figure{margin:0;background:white;padding:12px;border-radius:16px}img{width:100%;max-height:620px;object-fit:contain;object-position:top}pre{white-space:pre-wrap;font:inherit;background:white;padding:24px;border-radius:16px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ccd4df}</style><h1>图片先行：头部修复与生成诊断</h1><p>原模型产物回放 · 本地宿主改动 · <a href="report.md">分析原文</a> · <a href="acceptance.json">验收数据</a></p><div class="gallery"><figure><img src="greek-design.jpg"><figcaption>原设计图：横向选项与单一详情</figcaption></figure><figure><img src="screenshots/greek-before.png"><figcaption>修改前：标题与图片分开</figcaption></figure><figure><img src="screenshots/greek-432-square.png"><figcaption>修改后：标题叠在完整头图上；下方仍是原模型结构</figcaption></figure></div><h2>头部回归</h2><table><tr><th>案例</th><th>布局</th><th>交互 / 图片失败</th><th>查看</th></tr>${results.map(r=>`<tr><td>${r.id}</td><td>${r.layouts.filter(l=>l.artCoversHead&&l.titleInside&&!l.outerOverflow).length}/${r.layouts.length}</td><td>${r.interaction?'通过':'未通过'} / ${r.imageFailure?.status||'未执行'}</td><td><a href="viewer.html?id=${r.id}">交互回放</a> · <a href="${r.id}-browser.zip">trace</a></td></tr>`).join('')}</table><pre>${escape(body)}</pre></html>`;
await fs.writeFile(dest+'/report.html',html);await fs.writeFile(root+'/report.html',html);console.log('Report: /mock-head/report.html');
