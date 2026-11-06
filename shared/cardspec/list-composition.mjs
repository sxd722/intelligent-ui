import {parseExpression} from './expression.mjs'
const lit=value=>({type:'literal',value})
const heading=n=>['title','caption','badge','strong'].includes(n?.type)||n?.type==='row'&&n.children?.length&&n.children.every(c=>['badge','caption','strong','text'].includes(c.type))
// Only adjacent explicit heading/each pairs; never infer dates or regroup records.
export function projectListColumns(nodes,design){
 if(!design||design.contentColumns===1)return nodes
 const out=[]
 for(let i=0;i<nodes.length;){
  const groups=[];let j=i
  while(heading(nodes[j])&&nodes[j+1]?.type==='each'&&nodes[j+1].children.length>0&&nodes[j+1].children.every(n=>['box','stack','list-item'].includes(n.type))&&groups.length<3){groups.push([nodes[j],nodes[j+1]]);j+=2}
  if(groups.length<2){out.push(nodes[i++]);continue}
  out.push({type:'list',id:groups[0][1].id+'-columns',props:{columns:lit(Math.min(design.contentColumns||2,3)),presentation:lit(design.listStyle||'timeline')},children:groups.map(([header,each])=>{
   const alias=each.props.as?.value||'item'
   const children=each.children.map(n=>['box','stack','list-item'].includes(n.type)?{...n,type:'list-item',props:{...n.props,mockTile:n.props.mockTile||parseExpression(`${alias}.imageQuery ? -1 : (${alias}.mockTile ?? -1)`),imageQuery:n.props.imageQuery||parseExpression(`${alias}.imageQuery ?? ""`)}}:n)
   return {type:'list-group',id:each.id+'-group',props:{},headerNodes:[header],children:[{...each,children}]}
  })})
  i=j
 }
 return out
}
