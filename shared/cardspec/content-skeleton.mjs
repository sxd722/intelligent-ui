// A short information relationship, not another component tree or source format.
export const RELATIONS = Object.freeze(['compare','sequence','apply','explore'])
export const CONTENT_SKELETON_SCHEMA = {
 type:'object',properties:{question:{type:'string',maxLength:100},anchors:{type:'array',minItems:1,maxItems:3,items:{type:'string',maxLength:60}},relation:{type:'string',enum:RELATIONS},outcome:{type:'string',maxLength:140}},required:['question','anchors','relation','outcome'],additionalProperties:false,
}
export function normalizeContentSkeleton(value){
 if(!value||!RELATIONS.includes(value.relation)||!Array.isArray(value.anchors)||value.anchors.length<1||value.anchors.length>3)return null
 const short=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n
 if(!short(value.question,100)||!short(value.outcome,140)||value.anchors.some(v=>!short(v,60)))return null
 return {question:value.question.trim(),anchors:value.anchors.map(v=>v.trim()),relation:value.relation,outcome:value.outcome.trim()}
}
export const CONTENT_RELATION_INSTRUCTION = `【内容关系】按“问题→具体对象→关系→操作结果”组织内容，不按提纲逐段写完。已有plan_cards时用contentSkeleton替代重复说明；direct直接落实到data/state/derive，无需额外规划。
需要探索时：主题用segmented，案例用collection/具名入口；data保留主题→案例→证据ID关系，一个选择同步更新关联集合、当前解释和资料查询。读书检索不默认使用私人书架/笔记。完整长页允许连续阅读，不等于把所有主题解释同时平铺。
原生region.presentation：compare=同一对象的两个有标题子区并置，余项全宽放依据/边界；sequence=步骤；apply=解释→操作→反馈。例：主题改变案例集合；案例详情用compare放事实/解释，再用sequence放过程。magazine按标题分组长文，不替代对照或联动。折叠入口必须可辨认对象，展开有新增信息。宿主管窄屏/间距；无真实关系不强画图，不用沙箱重写。用结果集合/解释变化验收，不只选中样式。`
export const RELATION_PRESENTATIONS = new Set(['compare','sequence','apply'])
export function relationPartRoles(kind,kinds){
 const hasGroups=kinds.some(k=>['box','region','stack','row','list-item'].includes(k))
 let step=0,comparePart=0
 return kinds.map(k=>({kind:k,compare:kind==='compare'&&!['caption','title','strong','badge'].includes(k)?++comparePart:null,step:kind==='sequence'&&(!hasGroups||!['text','caption','title','strong','badge'].includes(k))?++step:null,control:['input','textarea','button','slider','segmented','checkbox','radio-group'].includes(k)}))
}
export function contentRelationDiagnostics(nodes=[]){
 const diagnostics=[]
 const walk=children=>{for(const n of children||[]){
  const p=n.props?.presentation?.value
  if(n.type==='region'&&RELATION_PRESENTATIONS.has(p)){
   const c=n.children||[]
   if(c.length<2)diagnostics.push({severity:'warning',code:'content_relation',message:`${p} needs at least two meaningful parts; no automatic content invention`,nodeId:n.id})
   if(['paginate','details','inline'].includes(n.props?.overflow?.value))diagnostics.push({severity:'warning',code:'content_relation',message:'Relationship parts should remain together; put secondary evidence in a nested details region',nodeId:n.id})
  }
  walk(n.children)
 }};walk(nodes);return diagnostics
}
