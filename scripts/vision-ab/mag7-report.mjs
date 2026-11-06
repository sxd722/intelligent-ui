import fs from'node:fs/promises';const root='artifacts/mag7-stitch',dest='dist/mag7-stitch',read=n=>fs.readFile(root+'/'+n,'utf8'),qa=JSON.parse(await read('controlled-qa.json')),live=JSON.parse(await read('live-qa.json')),stitch=JSON.parse(await read('stitch-url.txt')).data.url,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calls=live.trace.filter(t=>t.payload),succeeded=calls.filter(t=>t.status==='succeeded');
const doc=`# MAG7 修正与 Stitch 重设计

状态：本地可交互候选，待用户设计验收；未加入 Golden，未发布 GPT Site。

## 根因（原始 run 6bc6be18-5e70-4430-9543-c48653cc8669）
- 模型/数据契约：spark 将 open、(open+high)/2、low、(low+high)/2、price 拼成五点走势；不是带时间戳历史序列。1d/5d/1mo 只改 win，没有历史工具 binding。
- 行为缺失：refresh=0；iv 设置没有调度消费者。刷新时间是日期格式，而不是实际成功响应时间。
- 资料选择：一次 HackerNews 搜索塞入七家企业名称；其余为 36kr/HN 通用榜单。未按当前股票取得摘要，外层主要展示条数。
- 外部服务：东方财富报价成功 7 项，kline 小时/日线均 fetch failed，Node 直查同样 UND_ERR_SOCKET。没有把这一故障冒充成模型失败，也没有用合成走势掩盖。

## 实现
- 两个通用宿主 OpenCLI 扩展：opencli.yahoo-finance.chart（symbol/range）与 opencli.yahoo-finance.news（symbol/company/limit），独立于生成的上游清单。执行继续走相同 worker、参数校验、公共网络守卫与额度限制。没有浏览器登录或交易权限。
- 图只接受实际 timestamp/close，排除 null，不将 OHLC 当时间序列。周期对应 5m/60m/1d；空数据明确留空。日涨跌与区间首末采样变化分开。
- Yahoo ticker RSS 也可能含无关新闻，标题/摘要须明确匹配股票代码或传入公司名后才展示。保留来源摘要，不调用 LLM 翻译/编写新闻。正文是摘要，全文通过来源链接访问。
- 每个工具按参数缓存，报价/历史过期阈值 60 秒，新闻 300 秒；定时检查，隐藏页面暂停，返回过期再查。普通刷新/切股/切周期不调用模型。刷新失败保留同 key 内容，绝不把旧股票/周期显示为新数据。
- Stitch 编辑式配色与股票横向 tabs、价格主视觉、紧凑指标、摘要卡；首条显示摘要，第二条紧凑标题，点击均可读取完整来源摘要和链接。移除 interval、数据与工具等操作面板。
- sessionStorage 恢复当前股票和周期。取消过期请求，选择无关状态不被重置。独立候选页面可验收；没有覆盖用户历史卡片，也没有把这套手工实现声称为重新一次性模型生成。

## 验证
- ${qa.checks.filter(c=>c.pass).length}/${qa.checks.length} 受控浏览器检查通过（轮询/失败/乱序使用替身与虚拟时钟）。
- 真实工具调用 ${succeeded.length}/${calls.length} 成功；初载报价 7，AAPL 1d/5d/1mo 采样 79/36/22；NVDA 另测 5d/1mo、新闻详情和返回、刷新恢复。
- 320/360/432px 无横向溢出或主要内容内层滚动。自然高度约 ${live.checks.filter(c=>c.height).map(c=>c.height).join('/')}px；并非强制 432px 正方形一屏，手机可沿页面自然滚动。
- 单元与相关回归见 tests/yahoo-finance-adapter.test.mjs、opencli、public-fetch-guard、tool-discovery。
- OpenCLI/Owl 保持原 daemon PID 17048 与原绑定会话，未创建或关闭浏览器窗口。

## 限制及后续
- Yahoo 公共接口属于非稳定公开端点，可能限流/变化；东方财富历史请求当前仍失败，未宣称已修好上游。
- 市场休市时返回最近交易时段；同步成功不代表逐笔实时价格。公开报价与历史来自不同服务，可能存在延迟差异。
- 本轮修复数据通道和当前候选；全局生成“需求→取数→交互验收”尚不能保证模型每次自行选到历史工具。后续通用门控应要求时间范围控件驱动查询或可证明的数据子集，不允许用当前快照拼趋势。
- 待设计验收后再晋级 Golden；本次未动历史 Golden 快照。
`;
await fs.writeFile(root+'/report.md',doc);await fs.mkdir(dest,{recursive:true});for(const name of ['report.md','controlled-qa.json','live-qa.json','controlled-browser.zip','live-browser.zip','original-trace.json','original.cardspec','live-320.png','live-360.png','live-432.png','live-news-detail.png','probe-quotes.json','probe-hour.json','probe-day.json','kline-cli-error.txt','connection-after.json'])await fs.copyFile(root+'/'+name,dest+'/'+name);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAG7 · 设计与验证</title><style>*{box-sizing:border-box}body{max-width:1160px;margin:auto;padding:32px 20px;background:#f5f4ed;color:#223b38;font:15px/1.65 system-ui}h1{font-size:32px;line-height:1.2}h2{margin-top:36px}a{color:#07795a}header p{max-width:800px}.pill{background:#deeee4;border-radius:20px;padding:6px 12px;display:inline-block;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.grid img{max-width:100%;max-height:740px;object-fit:contain;object-position:top;background:#e5e9e3;border-radius:18px}.shots{display:flex;gap:18px;align-items:start;overflow-x:auto}.shots figure{margin:0;flex:0 0 30%}.shots img{width:100%;border-radius:16px}table{width:100%;border-collapse:collapse;background:#fff8}td,th{padding:12px;text-align:left;border-bottom:1px solid #dfe4dc;font-size:13px;vertical-align:top}code{font-size:12px;overflow-wrap:anywhere}.ok{color:#137759}.note{color:#6f7e73;font-size:13px}textarea{width:100%;min-height:110px;padding:12px;border:1px solid #c9d3c8;border-radius:10px;background:white;font:inherit}button,.cta{border:0;background:#244f40;color:white;padding:12px 18px;border-radius:10px;cursor:pointer;text-decoration:none;display:inline-block;font:inherit}.cta{margin:12px 10px 0 0}@media(max-width:650px){.grid{grid-template-columns:1fr}.shots figure{flex-basis:80%}body{padding:20px 14px}}</style><header><span class="pill">Stitch 重设计 · 真实数据候选 · 待你验收</span><h1>MAG7，从“像行情”到可验证的行情</h1><p>原卡片把开、高、低、现价拼成五个点，时间按钮只换了文字。新版按股票和周期读取真实历史、自动同步，并显示可阅读的新闻摘要。以下为宿主实现的可交互候选，不是一次模型重新生成的结果。</p><a class="cta" href="./">打开交互卡片 →</a><a href="${esc(stitch)}" target="_blank" rel="noreferrer">查看 Stitch 设计</a> · <a href="report.md">完整说明 MD</a></header>
<div class="grid"><section><h2>真实数据成品</h2><a href="./"><img src="live-432.png" alt="432px真实NVDA数据截图"></a><p class="note">一条展开摘要 + 一条紧凑标题；两条均可点开阅读。英文为来源原文，未编写模拟新闻。</p></section><section><h2>Stitch 原稿</h2><a href="stitch.png"><img src="stitch.png" alt="Stitch设计图"></a><p class="note">只复用设计，不复用图中的示例价格、新闻或假走势。<a href="stitch-prompt.txt">设计 prompt</a></p></section></div>
<h2>根因与纠正</h2><table><tr><th>层次</th><th>原问题</th><th>新行为</th></tr><tr><td>模型 / 绑定</td><td>OHLC 伪时间序列；range 无数据依赖</td><td>timestamp + close；1d/5d/1mo 分别真实查询 5m/60m/1d</td></tr><tr><td>外部服务</td><td>东方财富 kline 连接被关闭</td><td>报价仍用已验证来源，历史接 Yahoo；不在空值处造曲线</td></tr><tr><td>生命周期</td><td>iv 状态无调度；刷新=0</td><td>自动过期刷新、隐藏暂停、最新请求优先；不提供间隔操作</td></tr><tr><td>内容</td><td>全公司同一 HN 查询；通用新闻条数</td><td>按股票取标题、摘要、原文；实体匹配过滤无关 feed 内容</td></tr><tr><td>设计</td><td>七支股票与工具信息堆叠</td><td>横向 tabs + 单股票走势 + 精简指标 + 新闻阅读层</td></tr></table>
<h2>真实工具证据</h2><p>${succeeded.length}/${calls.length} 次真实调用成功，控制测试与真实服务测试分开记录。休市时显示最近交易时段；“更新”是成功取数时间，不是实时成交承诺。</p><table><tr><th>工具</th><th>输入</th><th>结果</th></tr>${calls.map(t=>`<tr><td><code>${esc(t.payload.tool)}</code></td><td><code>${esc(JSON.stringify(t.payload.input))}</code></td><td>${esc(t.status)} · ${t.result?.value?.items?.length??'—'} 项</td></tr>`).join('')}</table>
<h2>交互与尺寸</h2><p>受控 ${qa.checks.filter(c=>c.pass).length}/${qa.checks.length} 通过；自然高度不强行裁成正方形。快速切股、空结果与失败、自动刷新用可控替身验证。</p><table>${qa.checks.map(c=>`<tr><td>${esc(c.name)}</td><td class="ok">${c.pass?'通过':'未通过'}</td></tr>`).join('')}</table><div class="shots">${[320,360,432].map(w=>`<figure><h3>${w}px</h3><a href="live-${w}.png"><img src="live-${w}.png" alt="${w}px真实数据"></a></figure>`).join('')}</div>
<p><a href="live-qa.json">真实工具 trace</a> · <a href="live-browser.zip">真实浏览器 trace</a> · <a href="controlled-qa.json">受控检查</a> · <a href="controlled-browser.zip">受控浏览器 trace</a> · <a href="original.cardspec">原卡片</a> · <a href="original-trace.json">原生成 trace</a> · <a href="live-news-detail.png">新闻详情截图</a></p><p class="note">本次只更新本地，Owl 原连接保持。Yahoo 公共端点仍有可用性风险；未来自动生成的全局需求门控未因此自动全部解决。候选尚未加入 Golden。</p>
<h2>你的设计反馈</h2><textarea id="feedback" placeholder="股票切换、走势高度、新闻密度、配色……"></textarea><p><button id="save">保存本机反馈</button> <button id="export">导出反馈</button> <span id="saved"></span></p><script>const key='mag7-stitch-feedback:v1',el=document.querySelector('#feedback');try{el.value=localStorage.getItem(key)||''}catch{}document.querySelector('#save').onclick=()=>{try{localStorage.setItem(key,el.value);document.querySelector('#saved').textContent='已保存'}catch{document.querySelector('#saved').textContent='请使用导出'}};document.querySelector('#export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify({case:'mag7-stitch',at:new Date().toISOString(),feedback:el.value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='mag7-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};</script></html>`;
await fs.writeFile(root+'/report.html',html);await fs.writeFile(dest+'/report.html',html);console.log('MAG7 report ready',succeeded.length,calls.length);
