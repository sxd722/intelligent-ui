// Only a standalone illustration is eligible for host fitting. Forms, prose,
// multiple graphics and mixed dashboards retain their own document layout.
export function sandboxGraphic(tree) {
 let node=tree,depth=0
 while(depth<=8){
  if(Array.isArray(node))node={type:'div',children:node}
  if(!node||typeof node!=='object')return null
  if(node.type==='svg'){
   const box=String(node.props?.viewBox||'').trim().split(/[\s,]+/).map(Number)
   return box.length===4&&box.every(Number.isFinite)&&box[2]>0&&box[3]>0?{kind:'svg',depth,ratio:box[2]/box[3]}:null
  }
  if(node.type==='canvas'){
   const width=Number(node.props?.width??300),height=Number(node.props?.height??150)
   return width>0&&height>0&&Number.isFinite(width/height)?{kind:'canvas',depth,ratio:width/height}:null
  }
  if(!['div','section','main','figure'].includes(node.type))return null
  const children=(node.children||[]).filter(n=>n!=null&&!(typeof n==='string'&&!n.trim()))
  if(children.length!==1)return null
  node=children[0];depth++
 }
 return null
}

export function graphicBudgets(preferred,available,minimum=96){
 const total=preferred.reduce((sum,n)=>sum+n,0)
 return preferred.map(n=>Math.min(n,Math.max(minimum,total>0?Math.max(0,available)*n/total:minimum)))
}
