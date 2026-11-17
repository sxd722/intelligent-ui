// Preserve real relationships; focusing is an explicit view, never fabricated edges.
export function diagramWindow(type,nodes,edges,selected,focused){
 const links=type==='mindmap'?nodes.filter(n=>n.parentId).map(n=>({from:n.parentId,to:n.id})):edges||[]
 const id=nodes.some(n=>n.id===selected)?selected:nodes[0]?.id
 if(!focused)return {nodes,edges:links,id}
 const ids=new Set([id,...links.filter(e=>e.from===id||e.to===id).flatMap(e=>[e.from,e.to])])
 return {nodes:nodes.filter(n=>ids.has(n.id)).map(n=>({...n,...(n.parentId&&!ids.has(n.parentId)?{parentId:undefined}:{})})),edges:links.filter(e=>ids.has(e.from)&&ids.has(e.to)),id}
}
