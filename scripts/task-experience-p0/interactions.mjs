import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {createStore,makeScope} from '../../shared/cardspec/store.mjs'
import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
const root='artifacts/task-experience-p0'
const click=(name,expect)=>({op:'click',name,...(expect?{expect}:{})})
const fill=(name,value,expect)=>({op:'fill',name,value,...(expect?{expect}:{})})
for(const id of ['traffic','travel','news','appointment','schedule','reviews']){
 if(process.env.P0_ONLY&&!process.env.P0_ONLY.split(',').includes(id))continue
 const record=JSON.parse(await fs.readFile(`${root}/generated/${id}.json`)),spec=structuredClone(record.spec)
 if(!spec)continue
 const scope=makeScope(spec,createStore()),replay=[]
 for(const [name,b]of Object.entries(spec.bindings||{})){
  let input;try{input=evaluate(b.input,scope)}catch{}
  const saved=(spec.prefetched||[]).find(r=>r.tool===b.tool&&canonicalInput(r.input)===canonicalInput(input))
  if(saved){b.initial={type:'literal',value:saved.value};replay.push({name,tool:b.tool,dataset:saved.id})}
  b.load='manual';delete b.refresh
 }
 let steps=[],limitations=[]
 if(id==='traffic')steps=[fill('出发时间','06:30',{derived:{arriveAt:'07:32',margin:-32}}),click('打车',{derived:{arriveAt:'07:15',margin:-15}}),fill('到站时限','08:00',{derived:{margin:45}}),fill('出发地','滨江',{derived:{stale:true}}),click('网约车 / 出租车直达'),click('查看详情'),click('收起',{state:{mode:'taxi'}}),{op:'reload'}]
 if(id==='appointment'){
  steps=[fill('出发时间','08:50',{derived:{arrival:'09:15',diff:15}}),click('骑车 12分',{derived:{arrival:'09:02',diff:2}}),fill('目的地地址','新地址',{derived:{stale:true}}),click('展开步骤'),click('收起步骤'),{op:'reload'},click('按当前方式重新估算',{derived:{stale:true}})]
  limitations.push('请求要求预约时间可编辑，但产物固定09:00；最后一步应保持地址未核实，不能以复制地址当真实重算。')
 }
 if(id==='schedule'){
  const original=structuredClone(scope.state.rows),replacement=[original[0],scope.data.candidate]
  steps=[click('替换为化学',{derived:{sorted:replacement}}),{op:'reload',expect:{derived:{sorted:replacement}}},click('撤销替换',{derived:{sorted:original}})]
  limitations.push('当前只允许替换物理；原请求允许选任一门，数学替换入口缺失。')
 }
 if(id==='reviews'){
  const rows=scope.data.rows,forum=rows.filter(r=>r.source==='论坛'),unknown=rows.filter(r=>r.id==='c')
  steps=[click('论坛',{derived:{filtered:forum,count:2}}),click('未知',{derived:{filtered:unknown,count:1}}),click('c',{text:'样本 c 原话'}),click('收起',{state:{source:'论坛',stance:'未知'}}),{op:'reload',expect:{derived:{filtered:unknown,count:1}}},click('重置筛选'),click('论坛 2',{derived:{filtered:forum,count:2}})]
  limitations.push('分类与来源是两个重叠口径，不能将五根柱求和称总样本；图表当前取全量数据，需核对筛选后口径说明。样本原话被扩写，不能记为信息保真通过。')
 }
 if(id==='news'){
  steps=[click('城市'),click('可核实指标'),{op:'reload'}]
  limitations.push('本轮未检索，events与geo均为空；不得将空壳与“已检索”的文案记为真实新闻功能通过。')
 }
 if(id==='travel'){
  steps=[{op:'check'},{op:'reload'}]
  limitations.push('生成失败，只检视流中保留候选，不当作最终交付；完整行程替换与日期联动未通过。')
 }
 const dir=`${root}/interactions/${id}`
 await fs.mkdir(dir,{recursive:true})
 await fs.writeFile(dir+'/steps.json',JSON.stringify({sourceHash:createHash('sha256').update(record.source).digest('hex'),steps,limitations,replay},null,2))
 const result=await runDebugBrowser(spec,{steps,viewports:[432,320],scenarios:['normal'],size:'full',artifactDir:dir,captureSteps:true,signal:AbortSignal.timeout(120000)})
 await fs.writeFile(dir+'/browser.json',JSON.stringify({id,generationStatus:record.status,limitations,replay,...result},null,2))
 console.log(JSON.stringify({id,status:result.status,runs:result.runs?.map(r=>({width:r.width,actions:r.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,assertion:a.assertion,restored:a.restored,error:a.error})),errors:r.final.errors}))}))
}
