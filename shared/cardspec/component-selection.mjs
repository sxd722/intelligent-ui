import {REGISTRY} from './registry.mjs'
import {editorialRecipe} from './editorial.mjs'
// Bounded host shortlist, not a second planner or a restriction on the DSL.
// Selection is explainable and adds no inference/network round trip.
const BASE=['title','text','caption','strong','button','row','region','image','if','each','box','grid']
const ROUTES=[
 ['候选浏览',/候选|比较|对比|推荐|片单|门店|景点|路线|清单|商店|卡牌|手牌|candidate|compare|browse|recommend|shop|route/i,['collection','choice-grid','choice-item','settings','segmented','list','list-item']],
 ['表单记录',/输入|表单|记录|备注|预算|登记|form|input|record|note|budget/i,['input','select','checkbox','settings','stat']],
 ['关系解释',/原理|关系|流程|因果|结构|机制|principle|relation|process|mechanism/i,['flowchart','mindmap','mermaid','detail-stage']],
 ['数量变化',/统计|股价|价格|趋势|折线|指标|预算|计算|参数|滑块|图表|chart|trend|statistic|calculat|slider/i,['chart','stats','stat','slider','table']],
 ['时间记录',/日历|月历|时钟|时区|倒计时|calendar|clock|timezone|countdown/i,['calendar','clock','countdown']],
 ['过程模拟',/模拟|游戏|回合|矩阵|激活|实验|MLP|FFN|transformer|simulat|game|experiment/i,['logic','heatmap','progress','segmented','stat']],
 ['地点探索',/旅行|旅游|地图|地点|景点|路线|亲子|travel|map|place|poi|route/i,['map','choice-grid','choice-item','settings','select']],
 ['图文阅读',/文章|书|阅读|历史|新闻|文学|article|read|history|news/i,['list','list-item','collection','detail-stage']],
 ['分组浏览',/轮播|左右滑|carousel|swipe/i,['carousel','carousel-item']],
 ['图形创作',/动画|绘图|SVG|Canvas|React|animation|illustration/i,['sandbox']],
 ['局部材质',/WebGPU|shader|珠光|波场|GPU/i,['gpu-material']],
]
export function componentSelection(goal='',{renderMode='native',toolsEnabled=false}={}){
 const routes=ROUTES.filter(([,test])=>test.test(goal)),allowed=name=>REGISTRY[name]&&(name!=='sandbox'||['hybrid','web'].includes(renderMode))
 // Round robin avoids the first matched group consuming the entire shortlist.
 const recipe=editorialRecipe(goal),selected=[...(toolsEnabled?['task-board','tool-view']:[]),...recipe.names]
 for(let at=0;at<7;at++)for(const [,,names]of routes)if(names[at]&&allowed(names[at])&&!selected.includes(names[at])&&selected.length<18)selected.push(names[at])
 const names=[...new Set([...BASE,...selected])].filter(allowed)
 return {strategy:'host-task-shortlist-v2',names,totalAvailable:Object.keys(REGISTRY).length,matched:routes.map(([name])=>name),recipe,extraModelCalls:0}
}
export function componentSelectionReference(selection){
 return `【组件选型】${selection.matched.join('、')||'通用交互'}；仅展开${selection.names.length}个相关契约。工具结果优先task-board/tool-view，候选用collection/choice-grid；each只迭代数据，不是默认展示主体。${selection.recipe?.hint||''}可自由组合，不删需求迎合配方；未披露能力用capability_find/component_describe按需查询。`
}
export function compactComponentIndex(){
 return '【可扩展能力】候选与比较 collection/choice-grid；工具任务 task-board/tool-view；关系与过程 flowchart/mindmap/mermaid；数量与矩阵 chart/heatmap；时间 calendar/clock；空间 map；图文 list/detail-stage；复杂计算 logic；Web开启时原创图像与动效 sandbox。精确契约按需查询，简单容器不是默认主体。'
}
