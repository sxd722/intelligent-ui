// Deterministic host layout: no model tokens, random variants or content truncation.
// Only the preview is abbreviated; the full source remains in the named control/dialog.
export function studyPreview(value,units){
 const text=String(value??'');let used=0,result=''
 for(const c of text){used+=/[\u0000-\u007f]/.test(c)?.55:1;if(used>Math.max(1,units)-1)return result+'…';result+=c}
 return result
}
export function studyLayout({width=400,space=300,size='square',titles=[],count=0,start=0}={}){
 const units=s=>Array.from(String(s)).reduce((n,c)=>n+(/[\u0000-\u007f]/.test(c)?.55:1),0)
 const long=titles.some(t=>units(t)>10)
 const focus=size!=='auto'&&space<210
 const compact=size!=='auto'&&space<260
 const capacity=Math.min(Math.max(1,count),focus?1:width>=355&&!long?3:2)
 const pages=Math.max(1,Math.ceil(count/capacity)),page=Math.min(Math.floor(Math.max(0,start)/capacity),pages-1)
 const reading=compact?56:size==='auto'||space>=300?88:78,chrome=(compact?18:24)+reading+(pages>1?44:0)+18
 const ideal=focus?86:Math.min(210,Math.max(132,(width-(capacity-1)*10)/capacity*1.5))
 const height=size==='auto'?Math.min(410,ideal+chrome):Math.min(Math.max(140,space),ideal+chrome)
 return {capacity,page,pages,start:page*capacity,end:Math.min(count,(page+1)*capacity),height,reading,compact,mode:focus?'focus':capacity===3?'trinity':capacity===2?'diptych':'focus'}
}
