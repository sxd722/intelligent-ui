import {motionPreference,effectiveMotion} from '../motion-preference.mjs'
export const MOTION_FRAMES={fade:[{opacity:.7},{opacity:1}],slide:[{opacity:.7,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],emphasis:[{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}]}
export const MOTION_EASE='cubic-bezier(.22,1,.36,1)'
function designFrames(root,frames){
 const design=(root.matches?.('.cs-stage')?root:root.querySelector?.('.cs-stage'))?.dataset.design||root.closest?.('.cs-stage')?.dataset.design
 if(effectiveMotion()!=='full')return frames
 if(design==='rebel')return [{clipPath:'inset(0 100% 0 0)',opacity:.65,transform:'translateX(10px)'},{clipPath:'inset(0 0 0 0)',opacity:1,transform:'translateX(0)'}]
 if(design==='atlas')return [{opacity:.6,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}]
 return frames
}
const navigationAnimations=new WeakMap()
const pileOf=root=>root?.closest?.('.cs-card-pile[data-stacked]')||root?.querySelector?.('.cs-card-pile[data-stacked]')
// Animate existing DOM only: no duplicate controls, remounts or delayed actions.
export function animateNavigation(root,direction=1){
 if(!root)return
 navigationAnimations.get(root)?.cancel();root.style.transform=''
 const pile=pileOf(root);if(pile){delete pile.dataset.pilePhase;pile.style.removeProperty('--pile-drag')}
 const mode=effectiveMotion();if(mode==='off'||document.hidden||!root.animate)return
 const offset=mode==='light'?'0px':`${direction*100}%`
 const a=root.animate([{opacity:mode==='light'?.65:1,transform:`translateX(${offset})${pile&&mode==='full'?' scale(.97) rotate('+direction*1.5+'deg)':''}`},{opacity:1,transform:'translateX(0) scale(1) rotate(0deg)'}],{duration:mode==='light'?120:pile?360:240,easing:MOTION_EASE})
 const reduced=matchMedia('(prefers-reduced-motion: reduce)')
 const suspend=()=>{if(document.hidden||reduced.matches)a.cancel()}
 const cleanup=()=>{document.removeEventListener('visibilitychange',suspend);reduced.removeEventListener('change',suspend);if(navigationAnimations.get(root)===a)navigationAnimations.delete(root);if(root.isConnected)root.dispatchEvent(new CustomEvent('cardspec-navigation-settled',{bubbles:true}))}
 document.addEventListener('visibilitychange',suspend);reduced.addEventListener('change',suspend)
 navigationAnimations.set(root,a);a.onfinish=cleanup;a.oncancel=cleanup
}
export async function exitNavigation(root,direction=1){
 if(!root)return
 if(effectiveMotion()!=='full'||document.hidden||!root.animate){cancelNavigation(root);return}
 const start=root.style.transform||'translateX(0)',pile=pileOf(root)
 cancelNavigation(root)
 if(pile)pile.dataset.pilePhase='exit'
 const a=root.animate([{transform:start},{transform:`translateX(${-direction*100}%)${pile?' rotate('+(-direction*3)+'deg) scale(.96)':''}`}],{duration:pile?230:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'})
 navigationAnimations.set(root,a)
 const stop=()=>{if(document.hidden||effectiveMotion()!=='full')a.cancel()}
 const unsubscribe=motionPreference.subscribe(stop),reduced=matchMedia('(prefers-reduced-motion: reduce)')
 reduced.addEventListener('change',stop);document.addEventListener('visibilitychange',stop)
 try{await a.finished}catch{}finally{a.cancel();unsubscribe();reduced.removeEventListener('change',stop);document.removeEventListener('visibilitychange',stop);if(navigationAnimations.get(root)===a)navigationAnimations.delete(root)}
}
export function dragNavigation(root,dx){if(root&&effectiveMotion()==='full'){const x=Math.max(-90,Math.min(90,dx*.55));root.style.transform=`translateX(${x}px) rotate(${x/60}deg)`;pileOf(root)?.style.setProperty('--pile-drag',`${-x*.06}px`)}}
export function settleNavigation(root){
 if(!root)return
 const from=root.style.transform;cancelNavigation(root)
 if(!from||effectiveMotion()!=='full'||document.hidden||!root.animate)return
 const a=root.animate([{transform:from},{transform:'translateX(0) rotate(0deg)'}],{duration:200,easing:MOTION_EASE})
 navigationAnimations.set(root,a)
 const done=()=>{if(navigationAnimations.get(root)===a)navigationAnimations.delete(root)};a.onfinish=done;a.oncancel=done
}
export function cancelNavigation(root){if(root){navigationAnimations.get(root)?.cancel();navigationAnimations.delete(root);root.style.transform='';const pile=pileOf(root);if(pile){delete pile.dataset.pilePhase;pile.style.removeProperty('--pile-drag')}}}
export function attachContentMotion(stage){
 if(!stage)return()=>{}
 const preference=matchMedia('(prefers-reduced-motion: reduce)'),active=new Map(),pending=new Set(),positions=new Map()
 let frame=0,visible=false,interactionUntil=-1
 const cancel=()=>{active.forEach(a=>a.cancel());active.clear();pending.clear();positions.clear();cancelAnimationFrame(frame);frame=0}
 const update=()=>{const mode=effectiveMotion(motionPreference.getSnapshot(),preference.matches);stage.dataset.motionLevel=mode;stage.dataset.motionActive=String(visible&&!document.hidden&&mode==='full'&&!stage.hasAttribute('data-streaming'));if(mode==='off'||!visible||document.hidden)cancel()}
 const intersection=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;update()});intersection.observe(stage)
 const play=(el,frames)=>{
  if(!el.isConnected||!el.animate||el.closest('[data-motion="none"],input,textarea,[contenteditable]'))return
  active.get(el)?.cancel();const animation=el.animate(designFrames(el,frames),{duration:effectiveMotion()==='light'?150:280,easing:MOTION_EASE})
  active.set(el,animation);animation.onfinish=()=>{if(active.get(el)===animation)active.delete(el)}
 }
 const flush=()=>{
  frame=0;if(effectiveMotion()==='off'||!visible||document.hidden){pending.clear();positions.clear();return}
  for(const el of [...pending].slice(0,4))play(el,MOTION_FRAMES[el.dataset.motion]||MOTION_FRAMES.fade)
  for(const [el,before] of positions){
   if(!el.isConnected||pending.has(el)||[...pending].some(p=>p.contains(el)))continue
   const after=el.getBoundingClientRect(),dx=before.left-after.left,dy=before.top-after.top
   if((Math.abs(dx)>1||Math.abs(dy)>1)&&Math.abs(dy)<stage.clientHeight)play(el,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}])
  }
  pending.clear();positions.clear()
 }
 const interaction=e=>{
  // Typing and slider updates must not pulse surrounding prose.
  if(e.target.closest('input,textarea,[contenteditable]')||effectiveMotion()==='off')return
  interactionUntil=performance.now()+500;positions.clear();active.forEach(a=>a.cancel());active.clear()
  for(const el of [...stage.querySelectorAll('.cs-card > [data-cs-node]')].slice(0,12))positions.set(el,el.getBoundingClientRect())
 }
 const observer=new MutationObserver(records=>{
  if(preference.matches||document.hidden||!visible)return
  for(const record of records){
   const el=record.target.nodeType===3?record.target.parentElement:record.target
   if(record.type==='attributes'&&record.attributeName==='data-streaming'){update();continue}
   if(stage.hasAttribute('data-streaming'))continue
   const explicit=record.type==='attributes'&&record.attributeName==='data-motion-key'
   if(!explicit&&performance.now()>interactionUntil)continue
   const target=explicit?el:el?.closest?.('[data-motion],.cs-widget-caption,.cs-region-body,.cs-stat,.cs-text')
   if(target&&!target.closest('button,input,textarea,[contenteditable],[data-motion="none"]'))pending.add(target)
  }
  if((pending.size||positions.size)&&!frame)frame=requestAnimationFrame(flush)
 })
 observer.observe(stage,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-motion-key','data-selected','aria-pressed','data-streaming']})
 stage.addEventListener('click',interaction,true);stage.addEventListener('keydown',interaction,true)
 const unsubscribe=motionPreference.subscribe(update)
 preference.addEventListener('change',update);document.addEventListener('visibilitychange',update);update()
 return()=>{observer.disconnect();intersection.disconnect();unsubscribe();cancel();stage.removeEventListener('click',interaction,true);stage.removeEventListener('keydown',interaction,true);preference.removeEventListener('change',update);document.removeEventListener('visibilitychange',update)}
}
