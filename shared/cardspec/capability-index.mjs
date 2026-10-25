import {REGISTRY} from './registry.mjs'
import {TOOLS,selectToolIds} from './tools.mjs'

// Search hints only. Exact schemas, permissions and events always come from
// the existing registries; this directory never grants execution capability.
export const COMPONENT_ROUTES=[
 ['布局分区','布局 排版 容器 layout space',['region','box','stack','row','grid','grid-item','divider','spacer']],
 ['文字公式','正文 说明 代码 数学 公式 text math',['title','text','caption','strong','emphasis','code','math','badge','icon']],
 ['选择与表单','输入 勾选 筛选 选项 表单 form filter choice',['button','pressable','input','textarea','checkbox','toggle','chips','chip','segmented','select','radio-group','slider']],
 ['候选比较','候选 多选 比较 清单 搜索 推荐 片单 shortlist compare playlist',['experience','collection','table','list','list-item','popover']],
 ['滑动导航','轮播 翻页 滑动 swipe carousel navigation',['carousel','carousel-item','swipe-stack','navigation']],
 ['关系与过程','关系 原理 流程 思维导图 时序 因果 网络 阶段 步骤 process relation',['mindmap','flowchart','mermaid']],
 ['数量与矩阵','图表 热力图 折线 柱状 趋势 统计 分布 对比 数量 矩阵 激活 进度 matrix trend chart',['chart','heatmap','stats','stat','progress']],
 ['图片与地点','图片 封面 海报 相片 位置 地点 地图 poi map photo',['image','map','link']],
 ['时间与反馈','日期 日历 月历 时钟 时区 时间 倒计时 复制 庆祝 time calendar',['calendar','clock','countdown','copy','confetti']],
 ['计算与生成','模拟 多步 规则 重排 计算 动画 解释 下一页 react simulation reorder',['logic','sandbox','slot','each','if']],
]
export function componentIndex(){
 return '【组件速查：任务→组件】\n'+COMPONENT_ROUTES.map(([label,,names])=>`${label}: ${names.filter(n=>REGISTRY[n]).join(',')}`).join('\n')+
 '\n连接：binding.value→组件数据；事件→action→state；复杂计算用logic(input→local)；React增强用sandbox(input/actions)；下一页/局部用glm.generate→slot/页面栈。图只表达真实关系，map是坐标示意，stack是纵向布局。索引不是属性契约。'
}
export function findCapabilities(query,{catalog=[],renderMode='native',limit=6}={}){
 if(typeof query!=='string'||!query.trim()||query.length>160)throw Error('query must be 1–160 characters')
 const q=query.trim().toLowerCase(),words=q.split(/[\s,，、/]+/).filter(Boolean)
 const matches=text=>words.some(w=>text.toLowerCase().includes(w))
 const routes=COMPONENT_ROUTES.filter(([label,keywords,names])=>matches(label+' '+keywords+' '+names.join(' '))||keywords.split(' ').some(w=>q.includes(w.toLowerCase())))
 const exact=Object.keys(REGISTRY).filter(n=>words.includes(n))
 const names=[...new Set([...exact,...routes.flatMap(r=>r[2])])].filter(n=>renderMode==='hybrid'||n!=='sandbox').slice(0,limit)
 const ranked=selectToolIds(catalog.filter(t=>t.available&&!t.unsupportedReason&&TOOLS[t.id]).map(t=>t.id),q)
 const hits=catalog.filter(t=>TOOLS[t.id]&&!t.unsupportedReason&&(matches(t.id+' '+(t.description||''))||ranked.includes(t.id)&&!['glm.generate','workflow.run','dataset.analyze'].includes(t.id)))
 hits.sort((a,b)=>Number(b.id.toLowerCase()===q)-Number(a.id.toLowerCase()===q)||Number(b.available)-Number(a.available)||((ranked.indexOf(a.id)+1||999)-(ranked.indexOf(b.id)+1||999)))
 return {components:names.map(name=>({name,purpose:REGISTRY[name].purpose,events:REGISTRY[name].events||{},describe:'component_describe'})),
  tools:hits.slice(0,limit).map(t=>({id:t.id,purpose:t.description?.slice(0,150),available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'需要连接或启用'}:{}),describe:'cli_describe'})),
  moreComponents:routes.flatMap(r=>r[2]).length>limit,moreTools:hits.length>limit,instruction:'结果是候选不是必选；使用前读取精确契约。无匹配不代表缺少能力，可换用途或站点关键词。索引不执行工具。'}
}
