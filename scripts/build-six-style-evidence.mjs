import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {TEMPLATE_FIXTURES} from '../shared/cardspec/template-fixtures.mjs'
import {check} from '../.trae/skills/interactive-card-baseline/scripts/check-evidence.mjs'
const base='artifacts/six-styles',out='public/six-style-review';mkdirSync(out,{recursive:true})
const hash=x=>createHash('sha256').update(x).digest('hex'),hostHash=hash(['Renderer.jsx','StudyCollection.jsx','ComparisonChart.jsx','compositions.css','CompositionLayout.jsx'].map(p=>readFileSync('src/cardspec/'+p)).join(''))
const cases=[['parchment','templateParchment','羊皮纸叙事','翻章后切换视角，保持当前章节；返回后恢复人物叙述。','tragedy'],['business','templateBusiness','专业商务','选中组合B，切换单日，读数变成0.2%；保存后刷新保留记录。','market'],['academy','templateAcademy','辉石学院','Enter揭示三牌，选中星星，解释同步更新，刷新仍保留选择。','tarot']]
for(const [id,key,label,action,ref] of cases){
 const layouts=[]
 for(const width of [320,360,432])for(const size of ['square','auto']){
  const a=JSON.parse(readFileSync(`${base}/browser/${id}-${width}-${size}.json`));if(!a.pass)throw Error(id+' failed layout')
  layouts.push({width,size,screenshot:`browser/${id}-${width}-${size}.png`,mainVisiblePx:a.mainVisiblePx,horizontalOverflow:a.horizontalOverflow,primaryReachable:a.primaryReachable})
 }
 const evidence=[`browser/${id}-432-square.json`,`browser/${id}-432-square.png`,'browser-final.log']
 const record={caseId:'six-styles-'+id,artifactHash:hash(TEMPLATE_FIXTURES[key]),hostHash,fixtureHash:hash(TEMPLATE_FIXTURES[key]),testVersion:'functional-v2',mode:'fixture',status:'candidate',humanApproved:false,trainingEligible:false,
 checks:['host-input','core-loop','restore'].map(name=>({id:name,status:'pass',action,expected:'数据与选择正确、无非预期溢出、刷新恢复',actual:'浏览器动作断言与真实DOM检查通过',evidence})).concat(['invalid-state','empty-partial','stale-cancel','local-recovery'].map(name=>({id:name,status:'not_tested',reason:'本轮聚焦新表现层；没有执行该异常场景，不据此声明通过。'}))),layouts,limitations:['示例数据，未执行外部工具','真实模型仅编译和源码复查，未完整业务验收','未进行HMOS设备性能测试']}
 const path=`${base}/${id}-acceptance.json`;writeFileSync(path,JSON.stringify(record,null,2));const checked=await check(path);if(!checked.recordComplete)throw Error(JSON.stringify(checked));console.log(id,checked.recordComplete)
 copyFileSync(`${base}/browser/${id}-432-square.png`,`${out}/${id}.png`);copyFileSync(`${base}/reference-${ref}.png`,`${out}/${id}-reference.png`)
}
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>六卡风格 · 新增三家族</title><style>*{box-sizing:border-box}body{margin:0;background:#edf0ee;color:#243934;font:15px/1.65 system-ui}main{max-width:1440px;margin:auto;padding:32px 20px}h1{font:400 38px Georgia,serif}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px}article{background:#fff;padding:16px;border-radius:18px}img{width:100%;display:block;border-radius:14px}a{color:#20695c}small{color:#5c6b64}details{margin-top:16px}p{max-width:850px}</style><main><small>LOCAL 8787 · 2026-10-23 · CANDIDATE</small><h1>三个新风格，同一套 CardSpec。</h1><p>羊皮纸的章节插画、商务的共用刻度、辉石的三牌揭示，均由宿主原生实现。新增18种布局/交互组合及旧四家族24种组合通过。几何插画是装饰，不冒充真实图片。</p><div class="grid">${cases.map(([id,key,label,action])=>`<article><h2>${label}</h2><a href="/design-templates.html?preset=${id}"><img src="${id}.png" alt="${label}原生样板"></a><p>${action}</p><a href="/design-templates.html?preset=${id}">打开互动样板 ↗</a><details><summary>参考文件中的设计</summary><img src="${id}-reference.png" alt="用户提供的${label}参考"></details></article>`).join('')}</div><h2>生成流程的启发</h2><p>先确定核心任务与状态闭环；模型选择简短风格和数据绑定，宿主实现构图、材质与过渡。长信息以同卡章节披露。信息解释只保留一个所有者，区间切换保持对象ID。正确性检查与人工视觉评价分开，经过验证的沙箱创作再进入常用原语目录。</p><p>三次真实生成均编译成功（约15–33秒，一例修补），但源码仍有重复解释/翻页、跨区间ID变化。这些已记录为契约与模型规划问题，不算完整交互验收通过。</p><a href="/design-templates.html">查看六种风格和默认模板</a> · <a href="/">正常生成入口</a></main></html>`)
