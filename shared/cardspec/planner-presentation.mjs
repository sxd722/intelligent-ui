// Presentation-only adaptation for existing map + selectable-image planners.
// Never changes state, actions, bindings or evaluates effects.
const literal=value=>({type:'literal',value})
const controls=new Set(['input','select','slider','segmented','radio-group','toggle','checkbox'])
const controlGroup=n=>controls.has(n.type)||['row','stack','box'].includes(n.type)&&n.children?.length>0&&n.children.every(controlGroup)
const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children||[])])
export function plannerPresentation(nodes=[],bindings={}){
 const all=walk(nodes),hasPlan=Object.values(bindings).some(b=>b.tool==='glm.generate')
 const collections=all.filter(n=>n.type==='each'&&n.children?.length===1).map(each=>{
  const wrapper=each.children[0],candidate=wrapper.type==='grid-item'&&wrapper.children?.length===1?wrapper.children[0]:wrapper
  if(candidate.type==='pressable'&&candidate.children?.[0]?.type==='image'&&candidate.props?.selected&&candidate.props?.args&&candidate.props?.onPress){
   // A selected photo tile is equivalent to a native choice-item. Preserve its
   // exact action/data scope, but let the host own the only selection marker.
   const children=walk(candidate.children.slice(1))
   if(children.some(n=>n.props?.onPress||n.props?.onChange))return null
   return {each,row:wrapper,image:candidate.children[0],button:candidate,tile:true}
  }
  if(wrapper.type!=='row')return null
  const row=wrapper,image=row.children.find(n=>n.type==='image'),buttons=row.children.filter(n=>n.type==='button'||n.type==='pressable')
  const button=buttons[0]
  return image&&row.children[0]===image&&buttons.length===1&&button.props?.args&&button.props?.onPress&&(button.props.selected||button.props.variant&&button.props.variant.type!=='literal')?{each,row,image,button}:null
 }).filter(Boolean)
 const active=hasPlan&&all.some(n=>n.type==='map')&&collections.length===1
 if(!active)return {nodes,settings:[],notes:[],collections:[]}
 const settings=nodes.filter(controlGroup),notes=nodes.filter(n=>n.type==='caption'),rows=new Map(collections.map(c=>[c.row.id,c]))
 function visit(n){
  const match=rows.get(n.id)
  if(match){
   const stripMarker=items=>items.filter(c=>!(c.type==='if'&&c.children?.length===1&&c.children[0].type==='icon'&&c.children[0].props?.name?.value==='check')).map(c=>({...c,children:stripMarker(c.children||[])}))
   return {...n,type:'choice-item',plannerChoice:true,props:{...match.button.props,label:match.button.props.label||match.image.props.alt},children:match.tile?stripMarker(match.button.children):n.children.filter(c=>c!==match.button)}
  }
  const source=n.type==='region'&&n.props?.role?.value==='actions'?(n.children||[]).filter(c=>{if(c.type==='caption'){notes.push(c);return false}return true}):n.children||[]
  const children=source.map(visit)
  // Convert only the exact repeated-choice container, not arbitrary regions.
  if(['region','grid'].includes(n.type)&&n.children?.length===1&&collections.some(c=>c.each===n.children[0]))return {...n,type:'choice-grid',props:{label:literal('候选地点')},children}
  return {...n,children}
 }
 return {nodes:nodes.filter(n=>!settings.includes(n)&&!notes.includes(n)).map(visit),settings,notes,collections}
}
export function plannerSelectedIds(collections,scope,evaluate){
 const ids=[]
 for(const {each,button} of collections){
  try{const items=evaluate(each.props.items,scope);if(!Array.isArray(items))continue
   for(const [index,item] of items.entries()){
    const local={...scope,item,index,[each.props.as?.value||'item']:item}
    const selected=button.props.selected?evaluate(button.props.selected,local):evaluate(button.props.variant,local)==='primary'
    const args=evaluate(button.props.args,local),id=args?.id??args?.rowKey
    if(selected&&id!=null)ids.push(String(id))
   }
  }catch{/* The normal renderer reports expression errors in the owning node. */}
 }
 return ids
}
