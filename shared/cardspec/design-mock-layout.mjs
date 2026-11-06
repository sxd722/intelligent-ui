const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
const readableInk=(bg,ink)=>{const a=luminance(bg),b=luminance(ink);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5?ink:a>.179?'#111111':'#ffffff'}
export function normalizeMockBounds(rect){
 const r=Object.fromEntries(['x','y','width','height'].map(k=>[k,typeof rect?.[k]==='string'&&rect[k].trim()?Number(rect[k]):rect?.[k]]))
 if(Object.values(r).every(Number.isFinite)&&r.x>=-1&&r.y>=-1&&r.width>0&&r.height>0&&r.x<100&&r.y<100&&r.x+r.width<=101&&r.y+r.height<=101){
  const x=Math.max(0,r.x),y=Math.max(0,r.y);return {x,y,width:Math.min(r.width,100-x),height:Math.min(r.height,100-y)}
 }
 // Retain the generated artwork, never invent a crop when vision is uncertain.
 return {x:0,y:0,width:100,height:100}
}
export function validateMockLayout(value){
 if(!value||!['hero','split','editorial'].includes(value.layout))throw Error('invalid mock layout')
 const color=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v)
 if(!['background','ink','accent'].every(k=>color(value[k])))throw Error('invalid mock colors')
 const original=value.art,a=normalizeMockBounds(original)
 const warnings=JSON.stringify(original)!==JSON.stringify(a)?['art_bounds_normalized']:[]
 return {warnings,contentColumns:[1,2,3].includes(value.contentColumns)?value.contentColumns:undefined,listStyle:["plain","timeline","tiles"].includes(value.listStyle)?value.listStyle:undefined,layout:value.layout,background:value.background,ink:readableInk(value.background,value.ink),accent:value.accent,onAccent:readableInk(value.accent,value.ink),art:a,description:String(value.description||'').slice(0,240),tiles:(Array.isArray(value.tiles)?value.tiles:[]).slice(0,6).filter(t=>t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))&&t.x>=0&&t.y>=0&&t.width>=5&&t.height>=5&&t.x+t.width<=100&&t.y+t.height<=100).map(t=>({x:t.x,y:t.y,width:t.width,height:t.height,description:String(t.description||'').slice(0,80)}))}
}

export const defaultMockLayout=()=>({layout:'hero',background:'#f5f2eb',ink:'#202020',accent:'#735844',onAccent:'#ffffff',art:{x:0,y:0,width:100,height:100},tiles:[],description:'原图直传；构图与材质由生成模型随卡片提供，未提供时使用宿主中性布局。'})
function literal(ast,depth=0){
 if(depth>8)throw Error('layout too deep')
 if(ast?.type==='literal')return ast.value
 if(ast?.type==='array'&&ast.items.length<=6)return ast.items.map(a=>literal(a,depth+1))
 if(ast?.type==='object'&&ast.entries.length<=16)return Object.fromEntries(ast.entries.map(([k,v])=>[k,literal(v,depth+1)]))
 throw Error('layout must be static data')
}
// Existing data syntax, not another model call or a second DSL. State cannot
// change the composition when a user clicks a control.
export function resolveMockDesign(spec){
 const mock=spec?.context?.designMock
 if(mock?.status!=='ready')return null
 if(mock.analysisMode!=='direct'||!spec.data?.designLayout)return mock
 try{return {...mock,...validateMockLayout(literal(spec.data.designLayout)),layoutSource:'generation-model'}}
 catch{return {...mock,warnings:[...(mock.warnings||[]),'invalid_inline_design_layout'],layoutSource:'host-default'}}
}

export const DIRECT_DESIGN_INSTRUCTION='附件是本卡设计原图，请直接看图实现，不另写识别报告。可在本次CardSpec中用一条静态data保存构图：<data id="designLayout" value={{layout:"hero",background:"#f5f2eb",ink:"#202020",accent:"#735844",art:{x:0,y:0,width:100,height:40},contentColumns:1,listStyle:"plain"}}/>。这是格式示例，颜色、主图裁切和分栏须按实际图片填写；layout可选hero/split/editorial，listStyle可选plain/timeline/tiles。art是整张图百分比坐标的主视觉范围；不确定就用整图0,0,100,100，不猜裁切。参数只写字面量，不绑定state；无需tiles。宿主按这些静态参数统一材质与构图，仍用真实组件承载文字、工具结果和交互，不把整张设计截图当作可操作界面。';
