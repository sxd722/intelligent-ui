import {TOOLS} from '../../shared/cardspec/tools.mjs'
import {CORE_TASKS} from '../../shared/cardspec/core-task.mjs'
import {toolDiscovery} from './semantic-discovery.mjs'
import {taskPresentation} from '../../shared/cardspec/task-presentation.mjs'
import {capabilityDomains,entryTool,personalTool,personalIntent} from './capability-domain.mjs'

// Source priors describe audiences, never individual named queries. Registry remains authoritative.
export const SOURCE_PROFILES=Object.freeze({
 bilibili:{domains:['gaming','games','游戏','二次元','learning','学习'],roles:['discussion','tutorial']},
 xiaohongshu:{domains:['travel','旅游','旅行','family','亲子','生活','shopping','购物'],roles:['discussion','places']},
 weibo:{domains:['news','新闻','entertainment','娱乐'],roles:['discussion','news']},
 douban:{domains:['movies','电影','reading','阅读'],roles:['candidates','reviews']},
 weread:{domains:['reading','阅读'],roles:['books','passages']},
 ctrip:{domains:['travel','旅游','旅行'],roles:['places','booking']},
 dianping:{domains:['dining','餐饮','family','亲子','travel','旅游'],roles:['places','reviews']},
 wttr:{domains:['weather','天气'],roles:['weather']},
 '12306':{domains:['transport','交通','train','火车'],roles:['booking']}
})
const isOpinion=t=>['monitor','decide','find'].includes(t.kind)&&/social|sentiment|opinion|positive|negative|舆情|口碑|评论|反馈|喜欢|讨厌|态度|正负|正面|负面/i.test([t.domain,t.query,...t.terms,...(t.kind==='monitor'?[t.outcome]:[])].join(' '))
const isEntry=entryTool
const generalSearch=t=>t.command==='search'&&['search','knowledge','learning'].includes(t.group)
export async function routeCoreTasks(catalog,intent,{signal,discover=toolDiscovery.discover,limit=6}={}){
 const started=performance.now(),eligible=catalog.filter(t=>TOOLS[t.id]&&!t.unsupportedReason&&t.provider!=='host'&&t.id!=='glm.generate'),byId=new Map(eligible.map(t=>[t.id,t]))
 const results=[]
 for(const [index,task]of intent.tasks.entries()){
  if(task.data!=='live'){results.push({task:index,kind:task.kind,query:task.query,data:task.data,tools:[],route:'local',instruction:'使用用户资料或本地状态；不因领域关键词强制调用工具。'});continue}
  const opinion=isOpinion(task),q=[task.query,task.domain,...task.terms,CORE_TASKS[task.kind]].join(' ').slice(0,6000)
  const rail=/火车|车次|高铁|动车|\brail\b|\btrain\b/i.test([task.query,...task.terms].join(' '))
  const domains=capabilityDomains(task.domain),domainText=[task.domain,...domains].join(' ').toLowerCase()
  const knownDomain=eligible.some(t=>domainText.includes(t.group))||Object.values(SOURCE_PROFILES).some(p=>p.domains.some(d=>domainText.includes(d)))
  const found=eligible.length?await discover(catalog,q,{signal,limit:12}):{tools:[],retrieval:{method:'disabled',catalogSize:0}},semantic=new Map(found.tools.map(t=>[t.id,t])),all=new Map(semantic)
  // Important sources can belong to a different coarse registry group (video -> learning).
  for(const t of eligible){const p=SOURCE_PROFILES[t.site];if(p&&isEntry(t)&&(opinion&&p.roles.includes('discussion')||p.domains.some(d=>domainText.includes(d)))&&(!domains.includes('reading')||t.group==='reading'||!['weread','douban'].includes(t.site)))all.set(t.id,semantic.get(t.id)||{id:t.id,purpose:t.description})}
  const scores=[...all.values()].flatMap(candidate=>{
   const t=byId.get(candidate.id);if(!t||t.readOnly===false)return []
   // Semantic similarity alone is not evidence of a niche capability. Keep a
   // general knowledge search exit rather than filling the list with wrong domains.
   if(!knownDomain&&!opinion&&!generalSearch(t)&&!(candidate.semanticScore>=.4&&isEntry(t))&&!q.includes(t.id))return []
   if(personalTool(t)&&!personalIntent(q))return []
   if(rail&&t.site!=='12306'&&!generalSearch(t))return []
   const p=SOURCE_PROFILES[t.site],topic=!!p?.domains.some(d=>domainText.includes(d))&&(!domains.includes('reading')||t.group==='reading'||!['weread','douban'].includes(t.site)),discussion=!!p?.roles.includes('discussion')
   if(opinion&&!discussion&&!topic&&!generalSearch(t))return []
   // A specific opinion query needs queryable samples, not hot lists or an
   // unrelated account profile. Details can be discovered after real IDs exist.
   if(opinion&&task.query&&discussion&&t.command!=='search')return []
   const reasons=[...(topic?['source audience matches domain']:[]),...(opinion&&discussion?['public discussion source']:[]),...(candidate.matchedBy?[candidate.matchedBy]:[])]
   const targeted=!!task.query&&t.command==='search'
   const score=(candidate.score||0)+(topic?.5:0)+(opinion&&discussion?1:0)+(rail&&t.command==='trains'?1:0)+(isEntry(t)?.3:-.6)+(targeted?.4:0)+(t.available?.15:0)
   return [{id:t.id,purpose:String(t.description||candidate.purpose||'').slice(0,150),available:!!t.available,...(!t.available?{reason:t.reason||'需连接'}:{}),source:t.site||t.group,score:+score.toFixed(3),reasons,role:isEntry(t)?'entry':'followup',related:t.detail?.tool||null}]
  }).filter(t=>t.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
  const chosen=[],counts=new Map()
  for(const item of scores){if((counts.get(item.source)||0)>=2)continue;chosen.push(item);counts.set(item.source,(counts.get(item.source)||0)+1);if(chosen.length===limit)break}
  const sources=new Set(),first=chosen.filter(t=>{if(!t.available||t.role!=='entry'||sources.has(t.source))return false;sources.add(t.source);return true}).slice(0,opinion?2:1)
  const requiresBinding=first.length>0&&(knownDomain||opinion)&&(opinion||task.kind==='monitor'||['find','decide','plan','understand'].includes(task.kind)&&/选择|筛选|对比|刷新|详情|定位|阅读入口|检索|select|filter|compare|refresh|detail|passage/i.test(task.outcome))
  results.push({task:index,kind:task.kind,query:task.query,data:task.data,requiresBinding,tools:chosen,presentation:taskPresentation(task,{opinion,candidateTools:first.length>0&&knownDomain}),next:{describe:first.map(t=>t.id),...(opinion?{organize:'dataset_analyze对实际dataset逐条标注立场及原句；随后采用返回hostView与完整path.items。工具摘要的统计不是binding.value字段；不按sample手抄总量，不自写关键词分类。',render:'采用dataset_analyze返回的hostView：task-board evidence通过compose的annotations绑定统一分类分布、来源筛选、详情与原文。不要再独立手写统计与样本列表。'}:{})},route:chosen.some(t=>t.available)?knownDomain||opinion?'cli':'general-search':'search-or-unavailable',retrieval:found.retrieval,
   instruction:opinion?'先取相关来源样本，必要时按真实ID补评论；标题不能代表评论，样本不能代表总体。分类引用原文，宿主groupCounts统计，保留未知。':'cli_describe按需展开所选契约，再读取；用户条件必须影响查询或本地结果。'})
 }
 return {version:1,tasks:results,elapsedMs:Math.round(performance.now()-started),instruction:'优先采用本轮任务路由，不受之前整段prompt的粗召回限制。先describe next列出的少量工具；已覆盖任务就不重复cli_discover。候选未执行，目录仍为唯一契约。presentation决定可用视图；宿主负责字段、分页、筛选/选择/详情/恢复及计数，不用React重写。无合适映射可自由使用原生组件或隔离逻辑/沙箱。'}
}
