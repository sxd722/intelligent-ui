// Width decisions use content demand, never the previous rendered height. This
// keeps font fitting and column selection from feeding back into each other.
export function contentColumns(width, requested, demands, gap=8){
 const cap=Math.min(8,Math.max(1,Math.floor(Number(requested)||1)),Math.max(1,demands.length))
 const minimum=Math.max(1,...demands.map(x=>Number(x)||1))
 for(let n=cap;n>1;n--)if((width-gap*(n-1))/n>=minimum+2)return n
 return 1
}
export function valueFontSize(width, measured, base, floor=14){
 return Math.max(Math.min(base,floor),Math.min(base,Math.floor(base*Math.max(0,width-2)/Math.max(1,measured)*10)/10))
}

// Editorial columns represent peer content, never arbitrary sibling positions.
// Pair only adjacent compatible fragments; titles and complex widgets own a row.
export function editorialSpans(width, items, gap=16){
 const spans=items.map(()=>12)
 for(let i=0;i<items.length-1;i++){
  const a=items[i],b=items[i+1]
  if(a.kind&&a.kind===b.kind&&contentColumns(width,2,[a.minimum,b.minimum],gap)===2){spans[i]=spans[i+1]=6;i++}
 }
 return spans
}

// Structural recognition only; leave forms, rich stages and long reading alone.
export function isCompactDecision(parts){
 return parts.length>=3&&parts.length<=4&&parts[0].kind==='title'&&parts[0].length<=60
  &&parts.at(-1).kind==='action'&&parts.at(-1).length<=32
  &&parts.slice(1,-1).every(p=>p.kind==='copy'&&p.length>0)
  &&parts.slice(1,-1).reduce((n,p)=>n+p.length,0)<=180
}
