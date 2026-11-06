import fs from'node:fs/promises';const root='artifacts/antarctica-stitch',dest='dist/antarctica-stitch',qa=JSON.parse(await fs.readFile(root+'/controlled-qa.json','utf8')),live=JSON.parse(await fs.readFile(root+'/live-qa.json','utf8')),stitch=JSON.parse(await fs.readFile(root+'/stitch-url.txt','utf8')).data.url,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=`# 南极旅行卡：从展示到决策

状态：本地候选，等待用户验收；未加入Golden，未发布GPT Site。

## 原因
- 地图：selectedId固定为sites[0].id，无onSelect/action。用户点击不能改变受控选择或下方内容。
- 计时：声明tick动作，却没有任何clock/timer调用；暂停仅改running布尔值，不会走时间。
- 阶段：浏览器复测能从横渡切到登陆，文本会改变，但仅改预设4/5/3计数，不驱动旅行计划；三个阶段相加12天也不能泛用于11天路线。
- 原规划明确写了“计时器至少一个”，模型照做却没有实际旅行价值。首要修复是需求→用户收益，而不只补一个setInterval。
- 原卡没有工具binding。研究期取数不能代替产物中的查价/预订能力；固定登陆点数也不能当航次保证。

## 新交互
单层探索/方案/交通；地图真实海岸几何，4个位置与标签/详情共用site状态。两类方案分别展示运营方、海路/飞航、天数、集合城市、官网参考起价及包含/另行预算；点击进入完整口径与来源。选择方案改变接驳目标机场USH/PUQ。日期/出发地进入真实携程搜索URL与OpenCLI参数。收藏、视图、方案、景点和查询条件刷新恢复；普通交互不调用模型。

## 数据与访问边界
- Quark与Antarctica21产品信息为2026-11-04官网核验快照，价格在下载的官方HTML中可检出；没有指定日期库存或同船期同舱型比价保证。产品页可能包含多航次，先确认集合点再订接驳。
- 仅选取可核验的两家作比较，并非声称其余原运营方不可用。官网订舱/询价在外站完成，未自动下单。
- Ctrip search真实成功，但“南极”混入国内地点。返回的是目的地/地标联想，不是旅行包库存；本候选不使用这些结果充作产品或地图点。
- Ctrip flight真实调用BUE→USH、2026-12-05触发AUTH_REQUIRED/CAPTCHA。已保留错误；遵循AutoFix硬停止规则，没有绕过、重复重试或补假票价。用户完成携程登录/验证码后可在卡片主动查询。入口仍支持带条件进入携程。
- 真实地图Natural Earth 1:50m public domain；坐标为公开地点近似值。点位不是保证停靠，也没有拼接虚构航线。官网图像保留来源；失败显示稳定占位。

## Stitch与实现
Stitch画稿8ce304563af04434b24a43882520b28e，采用极地图册、紧凑票券、单层导航。实现替换其示意地图，删除“IAATO校准”和“已锁定”等无证据声明，修正设计稿局部溢出，不将设计稿当事实。由宿主H5实现，不是全新模型一次生成或纯CardSpec；原卡和Golden快照保留。

## 验证
- 受控 ${qa.checks.filter(c=>c.pass).length}/${qa.checks.length}：pin→标签/详情、反向联动、运营方/集合机场、价格口径、航班参数、迟到响应、验证码/空结果、刷新恢复、图片失败；320/360/432×自然/方形布局。
- 方形用于紧凑概览：地图更小、细节点击展开，方案/交通面板可滚动；不声称所有内容一屏展开。自然版为主要验收界面。
- 无替身浏览器：${live.checks.filter(c=>c.pass).length}项通过；携程实时票价取数1项因验证码阻塞，不计通过。来源图片、官网入口与产品快照单独核验。
- 未重启服务、未操作其他窗口、未关闭OpenCLI/Owl；工具调用保留原绑定模式。

## 通用后续改进
1. 选择控件要求selection→observable effect，地图若为受控选择必须有回调或明确只读，不能只测按钮存在。
2. 计时器只有真实deadline/interval来源时才引入；旅行阶段应表达选择差异和费用包含，不硬套动画。
3. 能力分类区分目的地联想、产品目录、价格/库存、预订入口和订单动作。完整链路不能用一个搜索工具替代。
4. 产品快照可使用来源、适用条件、更新时间、金额/币种/计价单位的统一契约；跨来源和过期数据不合成确定总价。
5. 本轮实现候选，未宣称上述全局生成门控已全面上线。

## 来源
- https://www.quarkexpeditions.com/expeditions/antarctic-explorer-discovering-the-7th-continent
- https://www.antarctica21.com/our-expeditions/classic-antarctica-air-cruise
- https://www.antarctica21.com/booking/find-your-expedition
- https://documents.ats.aq/recatt/att371_e.pdf
- https://www.deceptionisland.aq/
- https://ukaht.org/
- https://brochures.quarkexpeditions.com/view/447074698/20/
- https://www.naturalearthdata.com/about/terms-of-use/
`;
await fs.writeFile(root+'/report.md',md);for(const file of ['report.md','controlled-qa.json','controlled-browser.zip','live-qa.json','live-browser.zip','source-audit.json','probe-destination.json','probe-flight.json','original.cardspec','original-trace.json','original-interaction.json','live-explore.png','live-plans.png','live-travel.png','live-site-detail.png','live-price-detail.png',...[320,360,432].flatMap(w=>['auto','square'].map(s=>`candidate-${w}-${s}.png`))])await fs.copyFile(root+'/'+file,dest+'/'+file);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>南极旅行 · 设计与验证</title><style>*{box-sizing:border-box}body{max-width:1160px;margin:auto;padding:30px 20px;background:#edf2f4;color:#1d3b50;font:15px/1.7 system-ui}h1{font-size:32px;line-height:1.2}h2{margin-top:32px}a{color:#087b9c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.grid img{max-width:100%;max-height:750px;object-fit:contain;object-position:top;border-radius:18px}.shots{display:flex;gap:16px;overflow-x:auto;align-items:start}.shots figure{margin:0;flex:0 0 30%}.shots img{width:100%;border-radius:16px}table{width:100%;border-collapse:collapse;background:#fff9}td,th{padding:12px;border-bottom:1px solid #dbe4e8;text-align:left;font-size:13px;vertical-align:top}.badge{font-size:12px;background:#d5e5ed;padding:6px 12px;border-radius:20px;display:inline-block}.warning{background:#faf0db;padding:14px;border-radius:12px;font-size:13px}.note{font-size:12px;color:#7e929e}.cta,button{display:inline-block;background:#173f57;color:white;border:0;border-radius:10px;padding:12px 18px;cursor:pointer;text-decoration:none;font:inherit}.cta{margin:8px 15px 8px 0}textarea{width:100%;min-height:100px;border:1px solid #ccdce4;border-radius:10px;padding:12px;font:inherit}@media(max-width:650px){body{padding:20px 14px}.grid{grid-template-columns:1fr}.shots figure{flex-basis:80%}}</style><span class="badge">Stitch 重设计 · 本地候选 · 待验收</span><h1>南极，先选体验，再安排出发</h1><p>把空转的阶段/计时变成真正的地图探索、运营方比较与交通入口。保留原卡，本版为人工实现的联网 H5 候选。</p><a class="cta" href="./">打开新版卡片 →</a><a href="${esc(stitch)}" target="_blank" rel="noreferrer">查看 Stitch 稿</a> · <a href="report.md">详细报告</a><p class="warning">携程航班实测触发验证码，实时票价未通过。已保留按路线/日期打开携程的入口；官网产品价格是已核验快照，不是指定航次库存。</p>
<div class="grid"><section><h2>可交互成品</h2><a href="./"><img src="live-explore.png" alt="南极候选真实界面"></a><p class="note">真实海岸几何；pin、标签与唯一景点详情联动。图片来自运营方，非生成景点照片。</p></section><section><h2>Stitch 设计</h2><a href="stitch.png"><img src="stitch.png" alt="Stitch设计原稿"></a><p class="note">保留图册式构图，修正示意地图、溢出和未经验证的标注。<a href="stitch-prompt.txt">设计 prompt</a></p></section></div>
<h2>原卡的问题</h2><table><tr><th>层次</th><th>证据</th><th>改进</th></tr><tr><td>绑定</td><td>地图固定选中首项，没有 onSelect</td><td>地图与列表共用site，点击有确定反馈</td></tr><tr><td>执行</td><td>tick从未被时钟触发，running仅是布尔状态</td><td>删除无实际用途的计时</td></tr><tr><td>需求</td><td>阶段能切换，但仅改4/5/3预设天数</td><td>海路/飞航→集合点→费用与交通条件</td></tr><tr><td>数据</td><td>研究期有查询，成品没有工具binding或预订入口</td><td>官网核验目录 + 条件驱动携程请求/入口</td></tr><tr><td>工具语义</td><td>携程“南极”联想混入国内地点；机票触发验证码</td><td>不把联想当库存，不把错误当空航班</td></tr></table>
<h2>旅行包与价格</h2><p>两类路线的取舍、包含项和来源都在“方案”页；点击“价格口径与费用详情”查看适用条件。海路的<a href="https://www.quarkexpeditions.com/expeditions/antarctic-explorer-discovering-the-7th-continent">Quark 官网产品</a>与飞航的<a href="https://www.antarctica21.com/our-expeditions/classic-antarctica-air-cruise">Antarctica21 官网产品</a>分别核验，不假设相同船期、舱型或到达安排。</p><div class="shots"><figure><h3>选择运营方</h3><img src="live-plans.png"></figure><figure><h3>费用口径</h3><img src="live-price-detail.png"></figure><figure><h3>到达交通</h3><img src="live-travel.png"></figure></div>
<h2>验证结果</h2><p>受控 ${qa.checks.filter(c=>c.pass).length}/${qa.checks.length} 通过。航班成功、空结果和乱序使用替身验证；真实携程查询被验证码阻塞，未绕过、未重复重试。</p><table>${live.checks.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.pass?'通过':'阻塞 · 验证码'}</td></tr>`).join('')}</table><details><summary>展开全部受控检查</summary><table>${qa.checks.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.pass?'通过':'未通过'}</td></tr>`).join('')}</table></details><h2>320 / 360 / 432px</h2><div class="shots">${[320,360,432].map(w=>`<figure><h3>${w}px自然布局</h3><a href="candidate-${w}-auto.png"><img src="candidate-${w}-auto.png"></a><a href="candidate-${w}-square.png">方形概览截图</a></figure>`).join('')}</div><p class="note">自然模式是主要验收布局。方形模式地图较小，依靠标签/详情渐进浏览；方案与交通可滚动，未通过裁切隐藏重要信息。</p><p><a href="controlled-qa.json">受控记录</a> · <a href="controlled-browser.zip">浏览器trace</a> · <a href="live-qa.json">无替身验证</a> · <a href="live-browser.zip">无替身trace</a> · <a href="probe-flight.json">真实机票调用错误</a> · <a href="probe-destination.json">目的地实际返回</a> · <a href="source-audit.json">来源与价格核验</a> · <a href="original-interaction.json">原阶段交互复测</a> · <a href="original.cardspec">原CardSpec</a></p><h2>你的反馈</h2><textarea id="feedback" placeholder="地图、运营方对比、交通入口、信息密度……"></textarea><p><button id="save">保存反馈</button> <button id="export">导出反馈</button> <span id="status"></span></p><script>const key='antarctica-stitch-feedback:v1',input=document.querySelector('#feedback');try{input.value=localStorage.getItem(key)||''}catch{}document.querySelector('#save').onclick=()=>{try{localStorage.setItem(key,input.value);document.querySelector('#status').textContent='已保存本浏览器'}catch{document.querySelector('#status').textContent='请导出保存'}};document.querySelector('#export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify({case:'antarctica-stitch',at:new Date().toISOString(),feedback:input.value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='antarctica-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};</script></html>`;await fs.writeFile(root+'/report.html',html);await fs.writeFile(dest+'/report.html',html);console.log('Antarctica report ready');
