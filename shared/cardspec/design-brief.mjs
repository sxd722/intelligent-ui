// Renderer-owned, bounded visual references. No HTML, selectors, scripts or facts.
const rgb=s=>{if(typeof s!=='string')return null;const h=s.match(/^#([\da-f]{6})$/i);if(h)return [0,2,4].map(i=>parseInt(h[1].slice(i,i+2),16));const m=s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);return m&&(+m[4]||m[4]===undefined)&&m.slice(1,4).every(x=>+x<=255)?m.slice(1,4).map(Number):null}
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')
const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
export function normalizeDesignBrief(raw){
 if(!raw||raw.version!==1)return null
 const base=rgb(raw.palette?.base);if(!base)return null
 const dark=luminance(base)<.25,fallback=contrast(base,[250,252,255])>=contrast(base,[15,23,32])?[250,252,255]:[15,23,32],readable=(value,min=4.5)=>{const c=rgb(value);return c&&contrast(base,c)>=min?c:fallback}
 const ink=readable(raw.palette.ink),muted=readable(raw.palette.muted),accent=readable(raw.palette.accent,3),panel=rgb(raw.palette.panel)
 const layout=raw.layout?.mode==='split'?{mode:'split',choiceFraction:Math.max(.32,Math.min(.5,Number(raw.layout.choiceFraction)||.42)),outcome:'persistent'}:{mode:'flow'}
 return {version:1,layout,scheme:dark?'dark':'light',palette:{base:hex(base),ink:hex(ink),muted:hex(muted),accent:hex(accent),panel:hex(panel&&Math.abs(luminance(panel)-luminance(base))<.15?panel:base)},typography:raw.typography==='serif'?'serif':'sans',regions:[...new Set((Array.isArray(raw.regions)?raw.regions:[]).filter(x=>['graphic','facts','compare','chapters','disclosure','checklist'].includes(x)))].slice(0,6),scope:'Visual roles only; no source content, claims or tool results.'}
}
export function designBriefTokens(input){
 const b=normalizeDesignBrief(input);if(!b)return {}
 const c=b.palette
 return {'--reference-choice-width':`${(b.layout.choiceFraction||.42)*100}%`,'--reference-base':c.base,'--reference-ink':c.ink,'--reference-muted':c.muted,'--reference-accent':c.accent,'--reference-panel':c.panel,'--reference-font':b.typography==='serif'?'Georgia, serif':'Inter, Segoe UI, sans-serif','--cs-base':c.base,'--cs-ink':c.ink,'--cs-muted':c.muted,'--cs-accent':c.accent,'--cs-selected-ink':contrast(rgb(c.accent),[11,23,32])>=contrast(rgb(c.accent),[255,255,255])?'#0b1720':'#ffffff','--cs-surface':c.panel,'--cs-surface-solid':c.panel,'--cs-scrim':`linear-gradient(${c.base},${c.base})`,'--cs-fallback':c.base,'--cs-font-body':'Inter, "Segoe UI", "Microsoft YaHei", sans-serif','--font-title':b.typography==='serif'?'Georgia, "Noto Serif SC", serif':'Inter, "Segoe UI", sans-serif','--cs-title-size':'23px','--cs-space-normal':'8px','--cs-padding':'12px','--cs-control-radius':'8px','--cs-radius':'10px',colorScheme:b.scheme}
}
export const designBriefInstruction=b=>b?`【已选视觉参考】${JSON.stringify(b)}。按区域职责组织原生组件；split时将候选放顶层region role="choices"，当前解释/对比放role="focus"，紧凑的选择结果放role="result"。主体用关系图/封面/具体证据，不能把详情缩成数量。配色与几何由宿主实现，不写CSS。参考不含事实，不补造报价、地点、来源或工具。区域是表达建议，不是强制模板；与用户需求冲突时优先需求。`:''
