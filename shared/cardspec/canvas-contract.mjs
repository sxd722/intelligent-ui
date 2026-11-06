// Familiar Canvas2D subset, recorded in QuickJS and replayed by the trusted host.
// No DOM handles, images, network, callbacks or executable strings cross the boundary.
export const CANVAS_METHODS={clearRect:[4],fillRect:[4],strokeRect:[4],beginPath:[0],closePath:[0],moveTo:[2],lineTo:[2],bezierCurveTo:[6],quadraticCurveTo:[4],arc:[5,6],ellipse:[7,8],rect:[4],fill:[0],stroke:[0],save:[0],restore:[0],translate:[2],rotate:[1],scale:[2],setTransform:[6],resetTransform:[0],fillText:[3,4],strokeText:[3,4],setLineDash:[1]}
export const CANVAS_PROPERTIES={fillStyle:'paint',strokeStyle:'paint',lineWidth:'number',globalAlpha:'alpha',lineCap:['butt','round','square'],lineJoin:['round','bevel','miter'],font:'font',textAlign:['start','end','left','right','center'],textBaseline:['top','hanging','middle','alphabetic','ideographic','bottom'],lineDashOffset:'number',shadowColor:'paint',shadowBlur:'blur',shadowOffsetX:'number',shadowOffsetY:'number'}
export function validateCanvasDrawing(commands,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024)throw Error('Canvas width/height must be integers 1–1024')
 if(!Array.isArray(commands)||commands.length>1200)throw Error('Canvas drawing exceeds 1200 commands')
 const number=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000
 const text=s=>typeof s==='string'&&s.length<=200&&!/[<>\\]|url\s*\(|@import/i.test(s)
 let depth=0
 for(const c of commands){
  if(!Array.isArray(c)||typeof c[0]!=='string')throw Error('Invalid Canvas command')
  const [op,...a]=c
  if(op==='set'){
   const [key,value]=a,rule=Object.hasOwn(CANVAS_PROPERTIES,key)?CANVAS_PROPERTIES[key]:null
   if(a.length!==2||!rule||!(Array.isArray(rule)?rule.includes(value):rule==='number'?number(value):rule==='alpha'?number(value)&&value>=0&&value<=1:rule==='blur'?number(value)&&value>=0&&value<=40:text(value)))throw Error('Unsupported Canvas property '+key)
   if(key==='lineWidth'&&value<0)throw Error('Canvas lineWidth must be positive')
   continue
  }
  if(!Object.hasOwn(CANVAS_METHODS,op)||!CANVAS_METHODS[op].includes(a.length))throw Error('Unsupported Canvas method '+op)
  if(op==='setLineDash'){if(!Array.isArray(a[0])||a[0].length>32||!a[0].every(n=>number(n)&&n>=0))throw Error('Invalid Canvas dash');continue}
  if(op.endsWith('Text')){if(!text(a[0])||!a.slice(1).every(number))throw Error('Invalid Canvas text');continue}
  if(!a.every((n,i)=>((op==='arc'&&i===5)||(op==='ellipse'&&i===7))?typeof n==='boolean':number(n)))throw Error('Canvas coordinates must be finite')
  if(op==='arc'&&a[2]<0||op==='ellipse'&&(a[2]<0||a[3]<0))throw Error('Canvas radius must be positive')
  if(op==='save'&&++depth>32)throw Error('Canvas save depth exceeds budget')
  if(op==='restore'&&--depth<0)throw Error('Unbalanced Canvas restore')
 }
 if(depth)throw Error('Balance Canvas save/restore')
 return commands
}
