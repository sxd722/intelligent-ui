import {chromium} from 'playwright'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import {normalizeDesignBrief} from '../shared/cardspec/design-brief.mjs'

// Raster-only, isolated renderer: no generated JS, remote resources, host API,
// browser profile, or live tools. Original Stitch screenshot is kept separately.
export async function renderStitchMock(html,{output,width=432,tools=[],signal}={}){
 signal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)])
 if(html.length>2*1024*1024)throw Error('Stitch HTML exceeds static preview limit')
 signal?.throwIfAborted()
 const css=await postcss([tailwind({content:[{raw:html,extension:'html'}]})]).process('@tailwind base; @tailwind utilities;',{from:undefined})
 const browser=await chromium.launch({channel:'chrome',headless:true,timeout:15000})
 const cancel=()=>{void browser.close()};signal?.addEventListener('abort',cancel,{once:true})
 try{
  signal?.throwIfAborted()
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:1024},serviceWorkers:'block',reducedMotion:'reduce'})
  await context.route('**/*',r=>r.abort())
  const page=await context.newPage();page.setDefaultTimeout(12000)
  const style='<style>'+css.css+'\n*,*::before,*::after{animation:none!important;transition:none!important}</style>'
  await page.setContent(/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,match=>match+style):style+html,{waitUntil:'domcontentloaded',timeout:12000})
  const metadata=await page.evaluate(({width,tools})=>{
   const candidates=[...document.querySelectorAll('[data-stitch-card],#card-root,body>main,body>div,body>article')].filter(e=>{const b=e.getBoundingClientRect();return b.width>=200&&b.width<=1000&&b.height>=120&&b.height<=4000})
   candidates.sort((a,b)=>Number(b.hasAttribute('data-stitch-card'))-Number(a.hasAttribute('data-stitch-card'))||Math.abs(a.getBoundingClientRect().width-width)-Math.abs(b.getBoundingClientRect().width-width))
   const root=candidates[0];if(!root)throw Error('No bounded card root in Stitch HTML')
   root.setAttribute('data-host-stitch-capture','true');const bounds=root.getBoundingClientRect()
   const regions=[...root.querySelectorAll('[data-tool-id]'),...(root.hasAttribute('data-tool-id')?[root]:[])].flatMap(el=>{
    const ids=el.getAttribute('data-tool-id').split(/[\s,]+/).filter(id=>tools.includes(id)),r=el.getBoundingClientRect(),x=Math.max(0,r.left-bounds.left),y=Math.max(0,r.top-bounds.top),right=Math.min(bounds.width,r.right-bounds.left),bottom=Math.min(bounds.height,r.bottom-bounds.top)
    if(!ids.length||right<=x||bottom<=y||getComputedStyle(el).visibility==='hidden')return []
    return [{ids,x:x/bounds.width,y:y/bounds.height,width:(right-x)/bounds.width,height:(bottom-y)/bounds.height}]
   })
   const cs=getComputedStyle(root),title=root.querySelector('h1,h2'),text=root.querySelector('p'),blocks=[...root.querySelectorAll('section,main>div')]
   const colors=[...root.querySelectorAll('button,summary,h1,h2,small,span')].slice(0,120).map(e=>getComputedStyle(e).color)
   const chroma=s=>{const c=s.match(/\d+/g)?.slice(0,3).map(Number)||[0,0,0];return Math.max(...c)-Math.min(...c)}
   const accent=colors.sort((a,b)=>chroma(b)-chroma(a))[0]||cs.color
   // Infer adjacency from measured geometry, including grid-cols-12/span-5/7.
   // No mock text, claims, prices or IDs enter the generation reference.
   const splits=[...root.querySelectorAll('main,section,div')].flatMap(el=>{
    const st=getComputedStyle(el),r=el.getBoundingClientRect();if(!['grid','flex'].includes(st.display)||r.width<bounds.width*.65||r.height<bounds.height*.2)return []
    const children=[...el.children].map(c=>c.getBoundingClientRect()).filter(b=>b.width>r.width*.2&&b.height>r.height*.4)
    if(children.length!==2||Math.abs(children[0].top-children[1].top)>12||children[0].right>children[1].left+3)return []
    return [{area:r.width*r.height,choiceFraction:children[0].width/r.width}]
   }).sort((a,b)=>b.area-a.area)
   const layout=splits.length?{mode:'split',choiceFraction:splits[0].choiceFraction,outcome:'persistent'}:{mode:'flow'}
   const designBrief={version:1,layout,palette:{base:cs.backgroundColor,ink:title?getComputedStyle(title).color:cs.color,muted:text?getComputedStyle(text).color:cs.color,accent,panel:blocks[0]?getComputedStyle(blocks[0]).backgroundColor:cs.backgroundColor},typography:title&&/serif/.test(getComputedStyle(title).fontFamily)&&!/sans/.test(getComputedStyle(title).fontFamily)?'serif':'sans',regions:[...(root.querySelector('svg,canvas,img')?['graphic']:[]),...(root.querySelector('dl')?['facts']:[]),...(blocks.some(e=>getComputedStyle(e).display==='grid'&&getComputedStyle(e).gridTemplateColumns.split(' ').length>1)||root.querySelector('[class*=grid-cols-2]')?['compare']:[]),...(root.querySelectorAll('h2,h3').length>1?['chapters']:[]),...(root.querySelector('details')?['disclosure']:[]),...(root.querySelector('input[type=checkbox]')?['checklist']:[])]}
   return {width:bounds.width,height:bounds.height,regions,designBrief}
  },{width,tools})
  await page.locator('[data-host-stitch-capture=true]').screenshot({path:output,timeout:12000})
  signal?.throwIfAborted();return {...metadata,extractionVersion:2,designBrief:normalizeDesignBrief(metadata.designBrief)}
 }finally{signal?.removeEventListener('abort',cancel);await browser.close()}
}
