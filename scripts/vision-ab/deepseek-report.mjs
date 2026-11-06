import fs from 'node:fs/promises';
const root='artifacts/deepseek-vision-20261104',dest='dist/deepseek-vision';await fs.mkdir(dest,{recursive:true});
const r=JSON.parse(await fs.readFile(root+'/result.json')),s=JSON.parse(r.answer.replace(/^```json\s*/,'').replace(/\s*```$/,''));
await fs.writeFile(root+'/structure.json',JSON.stringify(s,null,2));
const review=`# DeepSeek Greek 图片结构识别

实际请求模型 volcengine/deepseek-v4.1-flash；网关返回 deepseek-v4-1-flash-261017。一次真实请求，temperature=0，原图输入，无原有设计摘要或Greek文字提示。耗时9.228秒，输入833、输出1754 tokens。HTTP200。

识别正确：外部留白与卡片边界（x16,y2,w68,h96）；雕像/悲剧面具/剧场/海景；主图底部弧线；标题空白区与月桂叶分隔；五个选项且图标顺序正确；第一项深蓝胶囊与下划线；选项在详情上方；详情左文字右建筑；建筑周围圆弧及三个节点；底部月桂叶装饰；没有编造实际正文。

不足：主图高度32%偏短，原图约到36–37%；标题y38%略偏上；导航第五项x72+width12=84，超过父导航x20+width60=80，且实际胶囊更窄；底部分隔线整体宽度被低估为30%；颜色只返回自然语言，不能直接作为精确设计token；没有字体数值、栅格间距或响应式策略。静态截图也无法确认点击大图、展开/滚动等行为，模型虽放入hypotheses，宿主仍不能将其直接变成需求。

结论：本例足以作为结构理解与布局规划输入，尚不足以直接输出可信的精确布局。区域顺序、主次关系与图文关系可采用；坐标需宿主校验/约束，交互以CUJ为准。单例不代表模型整体成功率，也不能证明比GPT-4.1强：本次要求的结构schema远比旧提示详细，模型与prompt两项都改变了。

建议用紧凑结构传递给实现模型：hero → title → selector(5视觉选项) → detail(text-left/image-right) → decoration；具体业务要素数量仍以事实和用户需求为准，不能为了拟合五个视觉占位而删掉六个悲剧要素。保留卡片边界、比例与裁切给宿主处理，原图继续可选直传。
`;
await fs.writeFile(root+'/review.md',review);
for(const f of ['result.json','structure.json','review.md'])await fs.copyFile(root+'/'+f,dest+'/'+f);await fs.copyFile('dist/vision-ab/greek-design.jpg',dest+'/design.jpg');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
await fs.writeFile(dest+'/report.html',`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepSeek设计图识别</title><style>body{max-width:1200px;margin:auto;padding:24px;background:#eef1f4;color:#243143;font:15px/1.6 system-ui}.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}.image{position:relative;align-self:start}.image img{width:100%;display:block}.box{position:absolute;border:2px solid #d42d65;box-sizing:border-box;color:#b20c46;font-size:11px;background:#ffffff18}.box span{background:#fffd}pre{white-space:pre-wrap;background:white;padding:18px;overflow:auto;max-height:800px}@media(max-width:700px){.cols{grid-template-columns:1fr}}</style><h1>DeepSeek：Greek设计结构识别</h1><p>9.228秒 · 833输入 / 1754输出tokens · <a href="structure.json">结构JSON</a> · <a href="result.json">原始响应</a></p><p>框线为模型输出坐标，可直接对照错位。</p><div class="cols"><div class="image"><img src="design.jpg">${s.regions.map(x=>`<div class="box" style="left:${x.bounds.x}%;top:${x.bounds.y}%;width:${x.bounds.width}%;height:${x.bounds.height}%"><span>${x.id}</span></div>`).join('')}</div><pre>${esc(JSON.stringify(s,null,2))}</pre></div><pre>${esc(review)}</pre></html>`);console.log('/deepseek-vision/report.html');
