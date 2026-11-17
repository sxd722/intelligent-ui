import React,{useEffect,useRef,useState} from 'react'
import {materialShader} from '../../shared/cardspec/gpu-material.mjs'
import {useMotionPreference} from '../MotionControl.jsx'
import {useCompositionSpace} from './useCompositionSpace.js'
import './gpu-material.css'

let allocated=0
export function GpuMaterial({p}){
 const [root,space]=useCompositionSpace({fill:false,sharePage:true}),canvas=useRef(null),live=useRef({}),[status,setStatus]=useState('waiting'),[error,setError]=useState(''),[seen,setSeen]=useState(false)
 const motion=useMotionPreference(),visible=useRef(false)
 live.current={params:p.params||[0,0,0,0],animated:p.animated!==false&&motion!=='off',motion}
 useEffect(()=>{const io=new IntersectionObserver(([e])=>{visible.current=e.isIntersecting;if(e.isIntersecting)setSeen(true)});io.observe(root.current);return()=>io.disconnect()},[])
 useEffect(()=>{
  if(!seen)return
  let stopped=false,failed=false,gpu,fx,target,raf,owned=false,unsubscribe,started=performance.now(),last=0,signature='',lastW=0,lastH=0,timer
  const fail=e=>{if(stopped||failed)return;failed=true;setError(String(e?.message||e).slice(0,240));setStatus('fallback');cancelAnimationFrame(raf);cleanup()}
  function cleanup(){clearTimeout(timer);unsubscribe?.();unsubscribe=null;fx?.dispose();fx=null;target?.dispose?.();target=null;gpu?.dispose();gpu=null;if(owned){allocated--;owned=false}}
  async function start(){
   try{
    setStatus('loading');setError('')
    if(!navigator.gpu)throw Error('此设备不支持 WebGPU，已显示静态材质')
    if(allocated>=4)throw Error('当前 GPU 视图已达上限，已显示静态材质')
    const source=materialShader(p.source)
    allocated++;owned=true
    timer=setTimeout(()=>fail(Error('GPU 初始化超时，已显示静态材质')),10000)
    const [api,{prepareShader}]=await Promise.all([import('vgpu'),import('@vgpu/wgsl/prepare')])
    if(stopped||failed)return
    gpu=await api.init({powerPreference:'low-power'});if(stopped||failed){cleanup();return}
    gpu.lost.then(info=>{if(!stopped&&gpu)fail(Error('GPU device lost: '+info.reason))})
    unsubscribe=gpu.onError?.(fail)
    target=api.surface(gpu,canvas.current,{dpr:1,autoResize:false,alphaMode:'premultiplied',clearColor:[0,0,0,0]})
    fx=api.effect(gpu,prepareShader(source),{set:{material:{timing:[0,1,0,0],params:live.current.params}}})
    await fx.compile(target);if(stopped||failed)return
    clearTimeout(timer)
    setStatus('ready')
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    function tick(now){
     if(stopped||!gpu)return
     raf=requestAnimationFrame(tick)
     if(document.hidden||!visible.current)return
     const current=live.current,animated=current.animated&&!reduced.matches,fps=current.motion==='light'?15:30
     const box=canvas.current.getBoundingClientRect(),w=Math.min(768,Math.max(1,Math.round(box.width))),h=Math.min(512,Math.max(1,Math.round(box.height)))
     const sig=JSON.stringify([current.params,w,h,animated])
     if(sig===signature&&(!animated||now-last<1000/fps))return
     try{
      if(w!==lastW||h!==lastH){target.resize([w,h]);lastW=w;lastH=h}
      fx.set({material:{timing:[animated?(now-started)/1000:0,w/h,0,0],params:current.params}})
      api.frame(gpu,f=>f.pass(target,fx));signature=sig;last=now
      canvas.current.dataset.params=JSON.stringify(current.params)
     }catch(e){fail(e)}
    }
    raf=requestAnimationFrame(tick)
   }catch(e){fail(e)}
  }
  start()
  return()=>{stopped=true;cancelAnimationFrame(raf);cleanup()}
 },[p.source,seen])
 const height=Math.max(96,Math.min(p.height||220,space||360))
 return <figure ref={root} className="cs-gpu-material" data-gpu-status={status} data-gpu-error={error||undefined} style={{height}} aria-label={p.label||'互动材质'}>
  <div className="cs-gpu-fallback" aria-hidden="true" style={{'--gpu-shift':`${(live.current.params[0]||0)*45}deg`}}/>
  <canvas ref={canvas} role="img" aria-label={p.label||'互动材质'} style={{opacity:status==='ready'?1:0}}/>
  {status==='fallback'&&<figcaption title={error}>静态材质 · <span>{error}</span></figcaption>}
 </figure>
}
