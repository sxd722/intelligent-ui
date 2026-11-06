import {GRAPHIC_SURFACE_CSS} from './graphic-surface.mjs'
import {drawCanvas} from './canvas-render.js'
import {createSvgMotion} from './svg-motion.js'
import {auditLayout} from './layout-audit.js'
import {auditVisuals} from './visual-audit.mjs'
import {SANDBOX_THEME_KEYS} from './design-environment.js'
import {sandboxGraphic} from '../../shared/cardspec/sandbox-graphic.mjs'
// Only this trusted renderer runs in the iframe. Model JavaScript never does.
export const SANDBOX_RENDER_SCRIPT=String.raw`(()=>{
 const drawCanvas=(${drawCanvas.toString()});
 const svgMotion=(${createSvgMotion.toString()})();
 const auditLayout=(${auditLayout.toString()});
 const auditVisuals=(${auditVisuals.toString()});let visualSignature="";
 const sandboxGraphic=(${sandboxGraphic.toString()});let graphic=null;
 const token=document.documentElement.dataset.sandboxToken, root=document.getElementById('root');let revision=0,pending=false;const queue=[];
 const post=x=>parent.postMessage({sandbox:token,...x},'*');
 let reportedOverflow=-1;
 function fitGraphic(){
  document.documentElement.toggleAttribute('data-fit-graphic',!!graphic);
  for(const el of root.querySelectorAll('[data-host-fit-wrapper],[data-host-fit-graphic]')){el.removeAttribute('data-host-fit-wrapper');el.removeAttribute('data-host-fit-graphic')}
  if(!graphic)return;
  let el=root.firstElementChild;
  for(let i=0;el&&i<graphic.depth;i++){el.setAttribute('data-host-fit-wrapper','');el=el.firstElementChild}
  if(!el)return;el.setAttribute('data-host-fit-graphic','');
  if(graphic.kind==='svg')el.setAttribute('preserveAspectRatio','xMidYMid meet');
  else{const width=Math.min(document.documentElement.clientWidth,innerHeight*graphic.ratio);el.style.setProperty('--cs-fit-canvas-width',width+'px');el.style.setProperty('--cs-fit-canvas-height',width/graphic.ratio+'px')}
 }
 const checkFit=()=>{fitGraphic();const visuals=auditVisuals(root),signature=JSON.stringify(visuals);if(signature!==visualSignature){visualSignature=signature;post({type:'visuals',detail:visuals})}const width=document.documentElement.clientWidth;post({type:'layout',detail:auditLayout(document.documentElement)});if(width>0&&root.scrollWidth>width+2&&reportedOverflow!==revision){reportedOverflow=revision;post({type:'error',message:'增强视图超出可用宽度，已保留原生功能；可重试生成适配当前尺寸的视图'})}};
 new ResizeObserver(checkFit).observe(root);
 addEventListener('resize',checkFit);
 function flush(){if(pending)return;while(queue.length){const next=queue.shift(),h=next.el._handlers?.[next.key];if(!root.contains(next.el)||!h)continue;pending=true;post({type:'event',revision,handler:h.handler,event:next.event});break}}
 function enqueue(el,key,event){if(['onInput','onChange','onPointerMove'].includes(key)){const last=queue[queue.length-1];if(last?.el===el&&last.key===key){last.event=event;return}}if(queue.length>=32)queue.shift();queue.push({el,key,event});flush()}
 const types={onClick:'click',onChange:'change',onInput:'input',onPointerDown:'pointerdown',onPointerMove:'pointermove',onPointerUp:'pointerup',onPointerCancel:'pointercancel',onPointerEnter:'pointerenter',onPointerLeave:'pointerleave',onKeyDown:'keydown',onKeyUp:'keyup',onFocus:'focus',onBlur:'blur'};
 function patch(parent,old,n,svg=false){
  if(n==null){old?.remove();return null}if(typeof n==='string'){if(old?.nodeType===3){if(old.data!==n)old.data=n;return old}const text=document.createTextNode(n);old?old.replaceWith(text):parent.append(text);return text}
  if(Array.isArray(n))n={type:'div',props:{},children:n};svg=svg||n.type==='svg';
  let el=old;if(!el||el.nodeType!==1||el.localName!==n.type){el=svg?document.createElementNS('http://www.w3.org/2000/svg',n.type):document.createElement(n.type);old?old.replaceWith(el):parent.append(el)}
  const props=n.props||{},geometry=svg&&el===old&&el._props?.id===props.id?svgMotion.capture(el):null;el._handlers=props;
  for(const k of Object.keys(el._props||{}))if(!(k in props)&&!k.startsWith('on')){if(k==='style')el.removeAttribute('style');else el.removeAttribute(k==='className'?'class':k)}
  for(const [k,v]of Object.entries(props)){
   if(k==='drawing'&&n.type==='canvas')continue
   if(types[k]){if(!el._listeners)el._listeners={};if(!el._listeners[k]){el._listeners[k]=true;const type=k==='onChange'&&(n.type==='textarea'||n.type==='input'&&!['checkbox','radio'].includes(props.type))?'input':types[k];el.addEventListener(type,e=>{
    const h=el._handlers[k];if(!h)return;if(e.type==='pointerdown'&&el.setPointerCapture)try{el.setPointerCapture(e.pointerId)}catch{}
    const svg=el.ownerSVGElement||(n.type==='svg'?el:null),rect=(svg||el).getBoundingClientRect();let x=(e.clientX||0)-rect.left,y=(e.clientY||0)-rect.top;
    if(svg)try{const p=svg.createSVGPoint();p.x=e.clientX||0;p.y=e.clientY||0;const q=p.matrixTransform(svg.getScreenCTM().inverse());x=q.x;y=q.y}catch{}
    if(n.type==='canvas'){x*=el.width/(rect.width||1);y*=el.height/(rect.height||1)}
    enqueue(el,k,{type:e.type,trusted:e.isTrusted,value:e.target.type==='number'||e.target.type==='range'?Number(e.target.value):e.target.value??'',checked:!!e.target.checked,key:e.key||'',buttons:e.buttons||0,x,y,clientX:e.clientX||0,clientY:e.clientY||0})
   })}continue}
   if(k==='style'){el.removeAttribute('style');for(const [name,value]of Object.entries(v)){if(name.startsWith('--'))el.style.setProperty(name,value);else el.style[name]=typeof value==='number'&&!/^(opacity|zIndex|fontWeight|lineHeight|flex|flexGrow|flexShrink|order|strokeWidth|fillOpacity|strokeOpacity)$/.test(name)?value+'px':value}continue}
   if(['value','checked','disabled','readOnly','multiple'].includes(k)&&!svg){const editing=(k==='value'||k==='checked')&&queue.some(q=>q.el===el&&['onInput','onChange'].includes(q.key));if(!editing&&el[k]!==v)el[k]=v;continue}
   const aliases={className:'class',htmlFor:'for',tabIndex:'tabindex',strokeWidth:'stroke-width',strokeDasharray:'stroke-dasharray',strokeDashoffset:'stroke-dashoffset',strokeMiterlimit:'stroke-miterlimit',fillRule:'fill-rule',clipRule:'clip-rule',vectorEffect:'vector-effect',strokeLinecap:'stroke-linecap',strokeLinejoin:'stroke-linejoin',fillOpacity:'fill-opacity',strokeOpacity:'stroke-opacity',textAnchor:'text-anchor',dominantBaseline:'dominant-baseline',fontSize:'font-size',fontWeight:'font-weight',letterSpacing:'letter-spacing',markerStart:'marker-start',markerMid:'marker-mid',markerEnd:'marker-end',stopColor:'stop-color',stopOpacity:'stop-opacity',clipPath:'clip-path'};
   const name=aliases[k]||k;if(v===null||v===false&&!name.startsWith('aria-'))el.removeAttribute(name);else el.setAttribute(name,v===true&&!name.startsWith('aria-')?'':String(v))
  }if(n.type==='canvas')drawCanvas(el,props.drawing,k=>getComputedStyle(el).getPropertyValue(k).trim());if(svg)svgMotion.update(el,geometry);el._props=props;
  const children=n.children||[],previous=[...el.childNodes],used=new Set(),keyed=new Map(previous.filter(c=>c._props?.id).map(c=>[c._props.id,c]));let index=0;
  for(let i=0;i<children.length;i++){const child=children[i];if(child==null)continue;const key=child?.props?.id,candidate=key?keyed.get(key):previous[i]?._props?.id?null:previous[i],next=patch(el,used.has(candidate)?null:candidate,child,svg);if(next){used.add(next);if(next!==el.childNodes[index])el.insertBefore(next,el.childNodes[index]||null);index++}}
  for(const child of [...el.childNodes])if(!used.has(child))child.remove();return el
 }
 addEventListener('message',e=>{if(e.source!==parent||e.data?.sandbox!==token)return;if(e.data.type==='environment'){document.documentElement.toggleAttribute('data-motion-paused',!e.data.active);document.documentElement.dataset.motionLevel=['full','light','off'].includes(e.data.motionLevel)?e.data.motionLevel:'full';if(!e.data.active||e.data.motionLevel==='off')svgMotion.finish();for(const [k,v]of Object.entries(e.data.theme||{})){if(typeof v!=='string'||v.length>200)continue;if(${JSON.stringify(SANDBOX_THEME_KEYS)}.includes(k))document.documentElement.style.setProperty(k,v);if(k==='color')document.body.style.color=v;if(k==='font')document.body.style.fontFamily=v}for(const canvas of root.querySelectorAll('canvas'))if(canvas._props?.drawing)drawCanvas(canvas,canvas._props.drawing,k=>getComputedStyle(canvas).getPropertyValue(k).trim());return}if(e.data.type!=='render')return;try{revision=e.data.revision;graphic=sandboxGraphic(e.data.tree);patch(root,root.firstChild,e.data.tree);fitGraphic();pending=false;post({type:'rendered',revision});requestAnimationFrame(checkFit);flush()}catch(err){post({type:'error',message:String(err.message).slice(0,200)})}});
 addEventListener('error',e=>post({type:'error',message:String(e.message).slice(0,200)}));post({type:'ready'});
})();`
export function sandboxDocument(css,token){
 if(typeof css!=='string'||css.length>70000||/url\s*\(|@import|@font-face|<\/style/i.test(css))throw Error('Unsafe sandbox CSS')
 if(typeof token!=='string'||!/^[a-zA-Z0-9-]{1,128}$/.test(token))throw Error('Invalid sandbox token')
 const nonce=token.replace(/[^a-zA-Z0-9]/g,'')
 const script=SANDBOX_RENDER_SCRIPT
 return `<!doctype html><html data-sandbox-token="${token}"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; frame-src 'none'; worker-src 'none'; font-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><style>@layer cs-host-motion;html,body,#root{height:100%;min-height:100%;width:100%}*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui;color:var(--cs-ink,#183448);background:transparent}button,input,select,textarea{font:inherit}h1,h2,h3,h4,h5,p{margin:0}h1,h2,h3,h4,h5{font-family:var(--font-title,inherit);font-size:var(--cs-title-size,20px);font-weight:var(--cs-title-weight,650);letter-spacing:var(--cs-title-tracking,normal)}button{cursor:pointer;color:inherit;background:transparent;border:0}button:focus-visible,input:focus-visible{outline:2px solid #28749a;outline-offset:2px}button{touch-action:manipulation}svg,canvas{max-width:100%;touch-action:none}canvas{display:block;height:auto}#root:has(button,input,select,textarea) svg{max-height:max(64px,calc(100vh - 96px))}${GRAPHIC_SURFACE_CSS}${css}html[data-fit-graphic],html[data-fit-graphic] body,html[data-fit-graphic] #root{height:100%;min-height:0!important}html[data-fit-graphic] #root,[data-host-fit-wrapper]{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important}svg[data-host-fit-graphic]{display:block;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important}canvas[data-host-fit-graphic]{display:block;margin:0!important;width:var(--cs-fit-canvas-width)!important;height:var(--cs-fit-canvas-height)!important}html,body,#root,#root *{scrollbar-width:none!important;scrollbar-gutter:auto!important}html::-webkit-scrollbar,body::-webkit-scrollbar,#root::-webkit-scrollbar,#root *::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}@layer cs-host-motion{[data-motion-paused] *,[data-motion-paused] *::before,[data-motion-paused] *::after{animation-play-state:paused!important}[data-motion-level=off] *,[data-motion-level=off] *::before,[data-motion-level=off] *::after{animation:none!important;transition:none!important}[data-motion-level=light] *{transition-duration:160ms!important}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}}</style></head><body><div id="root"></div><script nonce="${nonce}">${script}</script></body></html>`
}


