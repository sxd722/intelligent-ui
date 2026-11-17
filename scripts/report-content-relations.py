import json, shutil, html, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'artifacts/content-relations-qa/controlled'
OUT=ROOT/'public/content-relations-qa'
OUT.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
esc=lambda x:html.escape(str(x))
names={'bamboo':'竹书纪年','cs343':'CS343','care':'婴儿护理'}
jobs={'bamboo':'a3dc2c30-2ec0-47a6-8e23-fe29e9a573b2','cs343':'da6aea18-7bef-46b2-aa43-b6a0c0361ab5','care':'889dcb7e-a39b-4807-a9e5-c0f05874e285'}
observations={
'bamboo':('关系版更明确地并置两种叙述；对照组也已经用 facts 做局部对照，并非完全无结构。关系版减少了初始依据文字，但需要再打开依据。','两组都出现固定材料之外的补写；关系版左栏混有另一方叙述，仍有重复。Stitch 的同一事件→双方证据→差异解释更清楚。','两组生成端均 failed：对照组把 check 当勾选，关系组期待折叠区里的“未标记”文字。独立真实点击路径通过，仍只能作为保留预览，不能把交付成功率记成通过。'),
'cs343':('关系版将题干与输入直接接在解释之后；对照组还需先点题目。两组都能按主题保存输入和薄弱标记、展开新增答案。','关系版仍是文字主体，apply 用于多个小区而非一个完整学习闭环；解释较长，窄屏和操作后仍会分页。未达到 Stitch 的机制图与概念/例题紧密组合。','两组交付 succeeded / partial。原测试脚本未处理宿主分页导致定位失败；后续只修测试前置导航，未改模型 DSL，复验通过。'),
'care':('关系版将行动/观察/异常做出顺序层级，并直接展示记录表单；对照组把主要记录功能放进“偏好设置”。记录增改删、场景隔离和刷新都能完成。','数字顺序不等于完整护理决策流程，仍缺少行动与记录之间的明确反馈；方形空间需要滚动。这里仅验证UI，不评价临床有效性。','两组交付 succeeded / partial。对照组“本场景记录”和textarea的可访问名称与测试预期不同；按实际观察到的handle/标签定位后通过，保留之前失败记录。'),
}
def cp(src,dst):
 p=OUT/dst;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,p);return dst
cases=read(BASE/'cases.json');cp(BASE/'cases.json','cases.json')
manifest=[];rows=[];sections=[]
for name,title in names.items():
 figures=[];detail=[]
 for arm,label in [('off','对照：现有流程'),('on','实验：内容关系骨架')]:
  src=BASE/f'{name}-{arm}';r=read(src/'result.json');spec=r.get('spec')
  target=OUT/'evidence'/f'{name}-{arm}';target.mkdir(parents=True,exist_ok=True)
  for folder in src.iterdir():
   if folder.is_dir() and (folder.name.startswith('layout-') or folder.name.startswith('journey-')):shutil.copytree(folder,target/folder.name,dirs_exist_ok=True)
  cp(src/'card.cardspec',f'evidence/{name}-{arm}/card.cardspec')
  (target/'spec.json').write_text(json.dumps(spec,ensure_ascii=False),encoding='utf-8')
  (target/'generation.json').write_text(json.dumps({k:r.get(k) for k in ['case','arm','contentHash','elapsedMs','status','request','events']},ensure_ascii=False),encoding='utf-8')
  traces=[read(src/f'journey-{w}-final/trace.json')for w in [320,432]]
  layouts=read(src/'layouts.json')
  usage=[e for e in r['events']if e.get('type')=='research_model']
  tokens={k:sum(e.get('usage',{}).get(k,0)for e in usage)for k in ['prompt_tokens','completion_tokens']}
  cached=sum(e.get('usage',{}).get('prompt_tokens_details',{}).get('cached_tokens',0)for e in usage)
  row={'case':name,'arm':arm,'status':r['status'],'ms':r['elapsedMs'],'calls':len(usage),'tokens':tokens,'cachedInput':cached,'models':sorted(set(e.get('model','unknown')for e in usage)),'journeys':[{'width':t['width'],'ok':t['ok'],'actions':len(t['actions']),'failure':t.get('failure')}for t in traces],'layouts':layouts,'contentHash':r['contentHash'],'sourceHash':hashlib.sha256(r['source'].encode()).hexdigest(),'skeleton':spec.get('context',{}).get('contentSkeleton')if spec else None}
  manifest.append(row)
  passed=sum(t['ok']for t in traces);steps=sum(len(t['actions'])for t in traces)
  ver='partial'if r['status']=='succeeded'else'失败后的预览'
  rows.append(f'<tr><td>{title}</td><td>{label}</td><td>{r["elapsedMs"]/1000:.1f}s</td><td>{len(usage)}</td><td>{r["status"]} / {ver}</td><td>{passed}/2 · {steps}步</td></tr>')
  figures.append(f'<figure><figcaption>{label} · 432px</figcaption><a href="evidence/{name}-{arm}/layout-432-auto/initial.png"><img loading="lazy" src="evidence/{name}-{arm}/layout-432-auto/initial.png"></a><a class="preview" href="viewer.html?case={name}&arm={arm}">打开可交互{ver} ↗</a></figure>')
  links=[]
  for t in traces:
   w=t['width'];links.append(f'<a href="evidence/{name}-{arm}/journey-{w}-final/trace.json">{w}px 交互 trace · {len(t["actions"])}步</a>')
   for i,a in enumerate(t['actions']):links.append(f'<a href="evidence/{name}-{arm}/journey-{w}-final/{a["screenshot"]}">{w}px · {i+1}. {esc(a["name"])} · {"✓" if a["ok"] else "失败"}</a>')
  for size in ['auto','square']:
   for w in [320,360,432]:links.append(f'<a href="evidence/{name}-{arm}/layout-{w}-{size}/initial.png">{w}px / {size} 截图</a><a href="evidence/{name}-{arm}/layout-{w}-{size}/layout.json">DOM / 稳定性</a>')
  detail.append(f'<details><summary>{label}：源码、全部动作截图与 trace</summary><div class="links"><a href="evidence/{name}-{arm}/card.cardspec">模型原始 DSL</a><a href="evidence/{name}-{arm}/generation.json">请求与完整 SSE trace</a>{"".join(links)}</div><p>模型报告累计输入 {tokens["prompt_tokens"]:,} tokens（含重复上下文；其中缓存 {cached:,}），输出 {tokens["completion_tokens"]:,} tokens。调用数含规划/调试，缓存差异会影响耗时。</p></details>')
 mock=ROOT/'artifacts/stitch-comparison'/jobs[name]/'mock.png'
 if not mock.exists():mock=mock.with_name('screen.png')
 cp(mock,f'images/{name}-stitch.png')
 gain,gap,limit=observations[name]
 sections.append(f'<section id="{name}"><h2>{title}</h2><div class="pair">{"".join(figures)}</div><h3>信息组织与交互增量</h3><p>{gain}</p><h3>仍然存在的差距</h3><p>{gap}</p><p class="notice">{limit}</p><details><summary>原 Stitch 设计参照（内容范围较本次固定子集更大）</summary><img class="mock" loading="lazy" src="images/{name}-stitch.png"></details>{"".join(detail)}</section>')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
off=sum(r['ms']for r in manifest if r['arm']=='off');on=sum(r['ms']for r in manifest if r['arm']=='on')
total_steps=sum(j['actions']for r in manifest for j in r['journeys']);success=sum(j['ok']for r in manifest for j in r['journeys'])
document='''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容关系骨架 · 固定内容配对实验</title><style>*{box-sizing:border-box}body{margin:0;background:#eef2f3;color:#20333a;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1160px;margin:auto;padding:36px 24px}h1{font-size:34px;line-height:1.3}h2{margin-top:0}h3{margin-bottom:4px}section,.panel{background:#fff;padding:26px;border-radius:20px;margin:24px 0}a{color:#146d79}.eyebrow{font-size:13px;letter-spacing:1px;color:#58777b}.notice{background:#fff4d9;border-radius:10px;padding:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:0;min-width:0}figcaption{font-weight:700;margin-bottom:12px}img{max-width:100%;height:auto;border-radius:14px}.pair img{display:block;max-width:432px;width:100%;margin:auto}.mock{display:block;max-width:500px;margin:20px auto}.preview{display:block;padding:14px;text-align:center}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px;text-align:left;border-bottom:1px solid #dde5e7;vertical-align:top}th{white-space:nowrap}details{margin-top:20px}summary{cursor:pointer;font-weight:650}.links{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:18px;font-size:13px}small{color:#526b72}@media(max-width:700px){main{padding:20px 12px}.pair,.links{grid-template-columns:1fr}section{padding:18px}h1{font-size:28px}}</style><main><div class="eyebrow">LOCAL 8787 · CONTENT RELATIONS · 2026-11-10</div><h1>同样的信息，能否组织成更有价值的体验？</h1><p>原生 CardSpec 对照实验：竹书纪年、CS343、婴儿护理。每例两臂使用同一个内容包、模型、用户请求、风格、尺寸和调试设置，只切换轻量内容关系能力。无外部工具、图片生成或 Web 沙箱。</p>'''
document+=f'<p class="notice"><b>结论：有局部改善，尚未达到全面胜出。</b>关系版的对照与任务入口更明确，但内容保真和模型自测仍是限制。两组生成端均 2/3 成功，且都是 partial；竹书两组仍为失败后的预览。独立复验 {success}/12 路径、{total_steps} 步通过，不等于全部需求/事实通过。</p><div class="panel scroll"><table><thead><tr><th>案例</th><th>流程</th><th>生成耗时</th><th>模型响应次数</th><th>生成端状态</th><th>独立 UI 路径</th></tr></thead><tbody>{"".join(rows)}</tbody></table><p><small>单次配对总耗时：对照 {off/1000:.1f}s，关系版 {on/1000:.1f}s（本样本约降低 {(1-on/off)*100:.1f}%）。样本少、缓存与运行时负载不一致，不能证明稳定提速。深度构建未参与本实验。</small></p></div>'
document+=''.join(sections)+'''<section><h2>哪些结论可以成立？</h2><ul><li>新增能力由宿主完成：region.presentation=compare/sequence/apply。原生动作、绑定、状态恢复继续复用，没有增加固定规划调用。</li><li>CS343 用已有 plan_cards 返回四字段骨架；另外两例直接生成，未强制先规划。模型不需要提供尺寸、CSS 或另一棵组件树。</li><li>六个产物均能在独立浏览器执行关键操作，原始 DSL 未手工修改。竹书的失败状态没有因为独立测试通过而被静默改成成功。</li><li>页面主要关系是否正确、有没有新增理解，不能由“用了关系组件”替代人工审阅。关系版仍存在重复、无依据补写以及普通文字堆叠。</li></ul><h3>证据边界</h3><p>材料来自上轮生成快照，保留信息、去除失效的旧工具引用标号；这不是历史/课程/医学事实验证。三例每组只跑一次，非盲测。UI在320/432 auto验证完整核心路径；320/360/432 × square/auto另做布局与20次稳定性采样。没有横向溢出/抖动不等于无内部滚动；方形及展开后仍需分页或滚动，具体见DOM记录。</p><h3>保留的失败与测试修订</h3><p>预跑中，CUJ行格式不正确、旧引用标号失效，已保留在 artifacts/content-relations-qa/ 根目录及 paired/，不混入正式实验。独立测试最初遗漏宿主分页，以及可访问名称与标签不一致；只修改观察与操作前置条件，未把断言改成当前结果。原始失败路径同样保留在 evidence 下。</p><h3>下一步</h3><p>优先让已有主题、示例与反馈承担明确的信息职责，约束“保留材料但不增加未经提供的断言”；再解决测试预期和页面前置条件，不增加一轮全量审稿。构图继续复用宿主，暂不扩大组件库或强制每卡进入关系模式。</p><div class="links"><a href="cases.json">固定请求与内容SHA256</a><a href="manifest.json">完整指标与布局索引</a></div><p>仅更新本地8787；未部署GPT Site，未重绑或关闭OpenCLI/Owl。</p></section></main></html>'''
(OUT/'index.html').write_text(document,encoding='utf-8')
(OUT/'viewer.html').write_text('''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容关系 · 交互复验</title><style>body{font:15px/1.6 system-ui;margin:0;padding:20px;background:#e9eef0;color:#20333a}header{max-width:850px;margin:auto}iframe{display:block;width:min(100%,500px);height:950px;border:0;margin:20px auto;background:transparent}select{padding:6px}#status{padding:12px;background:#fff3d7}</style><header><a href="./">← 返回报告</a><h2>实际模型产物</h2><p id="status">正在加载…</p><label>宽度 <select id="width"><option>432</option><option>360</option><option>320</option></select></label> <label>尺寸 <select id="size"><option value="auto">自然高度</option><option value="square">方形</option></select></label><p>独立调试预览，无真实工具请求；不自动修改生成端状态。</p></header><iframe title="原生CardSpec交互预览" src="/card-debug.html"></iframe><script type="module">const q=new URLSearchParams(location.search),name=q.get('case'),arm=q.get('arm');if(!['bamboo','cs343','care'].includes(name)||!['off','on'].includes(arm))throw Error('Unknown case');const rows=await(await fetch('manifest.json')).json(),row=rows.find(r=>r.case===name&&r.arm===arm),spec=await(await fetch(`evidence/${name}-${arm}/spec.json`)).json();document.querySelector('#status').textContent=`${name} · ${arm==='on'?'关系骨架':'对照'} · 生成端 ${row.status}。${row.status==='succeeded'?'仍有未验收范围（partial）':'失败后的保留预览，不是完整通过产物'}`;const frame=document.querySelector('iframe');let ready=false;function mount(){if(!ready)return;frame.contentWindow.cardDebug.mount(spec,{width:Number(document.querySelector('#width').value),size:document.querySelector('#size').value});}const timer=setInterval(()=>{if(frame.contentWindow?.cardDebug){clearInterval(timer);ready=true;mount()}},100);setTimeout(()=>clearInterval(timer),15000);document.querySelectorAll('select').forEach(s=>s.onchange=mount);</script></html>''',encoding='utf-8')
print(json.dumps({'report':str(OUT/'index.html'),'paths':success,'steps':total_steps,'oldMs':off,'newMs':on}))
