// Shared by compilation, prompts and rendering. No randomized layout decisions.
export const COMPOSITIONS=Object.freeze({focus:'大数值与整体比例',stage:'计算/图形舞台',menu:'候选菜单',flow:'通用分步内容'})
export function requestedDesign(goal,preference){
 if(['default','pearl','atlas','rebel','parchment','business','academy'].includes(preference))return preference
 const text=String(goal||'')
 for(const [id,name] of [['pearl','月距力|pearl'],['atlas','动态学术|atlas'],['rebel','persona'],['parchment','羊皮纸|parchment'],['business','专业商务|商务|business'],['academy','辉石学院|辉石|academy'],['default','默认']])if(new RegExp(`(?:用|使用|采用).{0,3}(?:${name})(?:风格|样式|设计)|(?:${name})\\s*(?:风格|样式|设计)`,'i').test(text))return id
 return undefined
}
const headings=new Set(['title','caption','badge'])
const actionNode=n=>['button','toggle'].includes(n.type)||n.type==='region'&&n.props?.role?.value==='actions'||['row','if'].includes(n.type)&&(n.children||[]).some(actionNode)
const feedbackNode=n=>['text','caption','badge','run'].includes(n.type)||n.type==='if'&&(n.children||[]).every(feedbackNode)
export function projectComposition(nodes=[],design='default',requested='auto'){
 if(!['default','pearl','atlas','rebel','parchment','business','academy'].includes(design))return null
 let end=0;while(end<nodes.length&&headings.has(nodes[end].type))end++
 if(!end||end===nodes.length)return null // Never flatten scoped containers.
 const rest=nodes.slice(end),footer=[]
 // Include trailing status feedback without flattening its conditional scope.
 let tail=rest.findLastIndex(actionNode)
 if(tail>=0&&rest.slice(tail+1).every(feedbackNode)){
  while(tail>0&&actionNode(rest[tail-1]))tail--
  footer.push(...rest.splice(tail))
 }
 if(!footer.length&&rest.filter(actionNode).length<=3){for(let i=rest.length-1;i>=0;i--)if(actionNode(rest[i]))footer.unshift(...rest.splice(i,1))}
 // A single view switch must not become an otherwise empty first page.
 // Multiple parameter selectors remain supporting body content.
 const singleView=rest.filter(n=>n.type==='segmented').length===1&&!rest.some(n=>n.type==='slider')
 const controlNode=n=>n.type==='slider'||singleView&&n.type==='segmented'
 const controls=rest.filter(controlNode)
 for(let i=rest.length-1;i>=0;i--)if(controlNode(rest[i]))rest.splice(i,1)
 // A graph is the result, selectors and extra readouts are supporting views.
 // Scoped logic/regions are kept intact; only direct semantic nodes move.
 const visual=rest.findIndex(n=>['chart','heatmap','flowchart','mindmap','mermaid','collection','image','sandbox'].includes(n.type))
 if(visual>0)rest.unshift(...rest.splice(visual,1))
 const automatic=rest.some(n=>n.type==='heatmap')?'stage':rest.some(n=>n.type==='collection')?'menu':rest.some(n=>n.type==='chart'&&n.props?.kind?.value==='proportion')?'focus':'flow'
 return {family:design,id:Object.hasOwn(COMPOSITIONS,requested)?requested:automatic,header:nodes.slice(0,end),body:rest,controls,footer,version:2}
}
export const compositionReference=()=>`构图由宿主统一：title+短caption开头，一个主体，slider等控制，末尾button/含按钮row或region role="actions"固定操作区。chart kind="proportion"表达非负部分/整体（月距力的形体+大数值）；heatmap计算舞台；collection presentation="poster"用timeKey/subtitleKey映射时间与标签。选中状态在换步骤时保留，数值用derive从当前数据读取。宿主按内容自动选构图并分页；不要重复同一读数或给所有组件套背景。surface="bare"可去外壳；collection presentation="folio"是章节插画，"spread"是三牌选择（revealed可绑定布尔状态，标题titleKey、解释subtitleKey）；folio/spread已提供选中解释和翻页，不重复外置；subtitleKey可绑定当前视角字段。chart kind="comparison"用共用正负刻度，跨区间比较设置scaleMax并保持对象id不变。普通控件保持原生，特殊视觉才用已允许的sandbox。`
