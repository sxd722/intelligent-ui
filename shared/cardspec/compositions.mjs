// Shared by compilation, prompts and rendering. No randomized layout decisions.
export const COMPOSITIONS=Object.freeze({focus:'大数值与整体比例',stage:'计算/图形舞台',menu:'候选菜单',flow:'通用分步内容'})
export function requestedDesign(goal,preference){
 if(['folio','default','pearl','atlas','rebel','parchment','business','academy'].includes(preference))return preference
 const text=String(goal||'')
 for(const [id,name] of [['folio','平面纸感|folio'],['pearl','月距力|pearl'],['atlas','动态学术|atlas'],['rebel','persona'],['parchment','羊皮纸|parchment'],['business','专业商务|商务|business'],['academy','辉石学院|辉石|academy'],['default','默认']])if(new RegExp(`(?:用|使用|采用).{0,3}(?:${name})(?:风格|样式|设计)|(?:${name})\\s*(?:风格|样式|设计)`,'i').test(text))return id
 return undefined
}
const headings=new Set(['title','caption','badge'])
const headingNode=n=>headings.has(n.type)||['row','box','stack'].includes(n.type)&&(n.children||[]).length>0&&(n.children||[]).every(headingNode)
const role=n=>n.type==='region'?n.props?.role?.value:undefined
const actionNode=n=>['button','toggle'].includes(n.type)||n.type==='region'&&n.props?.role?.value==='actions'||['row','if'].includes(n.type)&&(n.children||[]).some(actionNode)
const feedbackNode=n=>['text','caption','badge','run'].includes(n.type)||n.type==='if'&&(n.children||[]).every(feedbackNode)
export function projectComposition(nodes=[],design='default',requested='auto',{size}={}){
 let end=0;while(end<nodes.length&&headingNode(nodes[end]))end++
 if(!end||end===nodes.length)return null // Never flatten scoped containers.
 // Geometry is shared across style families. Explicit functional zones retain
 // their scopes and stay adjacent, rather than becoming unrelated swipe pages.
 const zones=nodes.slice(end),workspace=zones.some(n=>role(n)==='choices')&&zones.some(n=>role(n)==='focus')
 if(workspace)return {family:design,id:'workspace',header:nodes.slice(0,end),body:zones.filter(n=>!['result','actions'].includes(role(n))),controls:[],footer:zones.filter(n=>['result','actions'].includes(role(n))),version:2}
 // Document flow has no fixed console. Keep each local control beside its
 // result instead of collecting all sliders/actions at the end of a long card.
 if(size==='full')return {family:design,id:Object.hasOwn(COMPOSITIONS,requested)?requested:'flow',header:nodes.slice(0,end),body:nodes.slice(end),controls:[],footer:[],version:2}
 const rest=nodes.slice(end),footer=[]
 // Include trailing status feedback without flattening its conditional scope.
 let tail=rest.findLastIndex(actionNode)
 if(tail>=0&&rest.slice(tail+1).every(feedbackNode)){
  while(tail>0&&actionNode(rest[tail-1]))tail--
  footer.push(...rest.splice(tail))
 }
 if(!footer.length&&rest.filter(actionNode).length<=3){for(let i=rest.length-1;i>=0;i--)if(actionNode(rest[i]))footer.unshift(...rest.splice(i,1))}
 // Selection owns the adjacent result; component count is not a layout role.
 // Preserve selectors in author order. Sliders retain the preset console.
 const controlNode=n=>n.type==='slider'
 const controls=rest.filter(controlNode)
 for(let i=rest.length-1;i>=0;i--)if(controlNode(rest[i]))rest.splice(i,1)
 // Never lift a result across its selector/input/description. A visual is not
 // necessarily the first step of a task. Explicit source order is the fallback.
 const automatic=rest.some(n=>n.type==='heatmap')?'stage':rest.some(n=>n.type==='collection')?'menu':rest.some(n=>n.type==='chart'&&n.props?.kind?.value==='proportion')?'focus':'flow'
 return {family:design,id:Object.hasOwn(COMPOSITIONS,requested)?requested:automatic,header:nodes.slice(0,end),body:rest,controls,footer,version:2}
}
export const compositionReference=()=>`title/短caption→主体→控制，surface="bare"去外壳。同一任务的图形+facts、候选+当前详情、决策+影响+行动放同一region，宿主按内容宽度局部并排；不跨作用域。stat自动区分数值与次要事实，可用presentation="primary|meta"覆盖。变化记录用facts before/after。chart proportion表达非负整体，comparison用scaleMax统一刻度；heatmap计算舞台；collection poster/folio/spread表达海报/章节/揭示。保持选中ID，不重复读数与内置详情；`
export const FOLIO_REFERENCE=`folio: segmented variant="icons"，options:[{value,label,icon}]，事件event.value；detail-stage title/description/eyebrow/icon，子项放原生交互，motionKey绑定选择ID。`;
