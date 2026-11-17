// Lives only in the opaque Web iframe. No model code executes in the host.
export function createWebGraphics({enabled=false,report=()=>{},environment=()=>({})}={}){
 let sequence=0;const surfaces=new Set()
 const api={enabled,capabilities:()=>({canvas2d:true,webgl:typeof WebGLRenderingContext!=='undefined',webgpu:!!navigator.gpu,secureContext:globalThis.isSecureContext===true}),shader(canvas,options={}){
  if(!canvas||typeof canvas.getContext!=='function')throw Error('graphics.shader requires a canvas ref')
  const id='surface-'+(++sequence),backend=options.backend||'webgl';let dead=false,failed=false,raf=0,last=0,start=performance.now(),dirty=true,draw,release=()=>{},params=[0,0,0,0],device,gl
  const emit=(status,kind='',message='')=>{canvas.dataset.graphicsStatus=status;canvas.dataset.graphicsBackend=backend;report({id,status,kind,backend,message:String(message).slice(0,1200)})}
  const stop=()=>{cancelAnimationFrame(raf);raf=0}
  const fail=(error,kind='implementation')=>{if(dead||failed)return;failed=true;stop();release();canvas.style.background='radial-gradient(ellipse at 30% 25%,#9c85c877,transparent 70%),linear-gradient(135deg,#24304744,#8996af44)';emit('fallback',kind,error?.message||error)}
  const tick=now=>{
   raf=0;if(dead||failed)return
   const env=environment(),active=env.active!==false&&!document.hidden
   if(active&&draw&&(dirty||!env.reducedMotion&&now-last>=1000/30)){
    const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.min(2048,Math.round(r.width*dpr))),h=Math.max(1,Math.min(2048,Math.round(r.height*dpr)))
    if(r.width&&r.height)try{if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}draw(w,h,env.reducedMotion?0:(now-start)/1000,params);last=now;dirty=false}catch(e){fail(e)}
   }
   if(!dead&&!failed&&active&&!env.reducedMotion)raf=requestAnimationFrame(tick)
  }
  const wake=()=>{dirty=true;if(draw&&!raf&&!dead&&!failed)raf=requestAnimationFrame(tick)}
  const handle={ready:null,update(values){if(!Array.isArray(values)||values.length>4||values.some(v=>!Number.isFinite(v)))throw Error('shader params: up to four finite numbers');params=[...values,0,0,0,0].slice(0,4);wake()},dispose(){if(dead)return;dead=true;stop();observer.disconnect();release();surfaces.delete(handle);emit('disposed')},wake}
  const observer=new ResizeObserver(wake);observer.observe(canvas);surfaces.add(handle)
  try{handle.update(options.params||[])}catch(e){handle.dispose();throw e}emit('loading')
  handle.ready=(async()=>{
   try{
    if(!enabled){fail('GPU generation is disabled','disabled');return false}
    if(typeof options.fragment!=='string'||!options.fragment.trim())throw Error('shader fragment source is required')
    if(backend==='webgl'||backend==='webgl2'){
     gl=canvas.getContext(backend,{alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'})
     if(!gl){fail('WebGL context unavailable','environment');return false}
     const shaders=[];let program,buffer
     const lost=e=>{e.preventDefault();fail('WebGL context lost','environment')};canvas.addEventListener('webglcontextlost',lost)
     release=()=>{canvas.removeEventListener('webglcontextlost',lost);shaders.forEach(s=>gl.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program)}
     const compile=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'GLSL compile failed');return s}
     const vertex=options.vertex||(backend==='webgl2'?'#version 300 es\nin vec2 position;void main(){gl_Position=vec4(position,0.,1.);}':'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}')
     program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,options.fragment));gl.linkProgram(program)
     if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'GLSL link failed')
     gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW)
     const location=gl.getAttribLocation(program,'position');if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0)}
     const time=gl.getUniformLocation(program,'u_time'),resolution=gl.getUniformLocation(program,'u_resolution'),values=gl.getUniformLocation(program,'u_params')
     draw=(w,h,t,p)=>{gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform1f(time,t);gl.uniform2f(resolution,w,h);gl.uniform4fv(values,p);gl.drawArrays(gl.TRIANGLES,0,3)}
    }else if(backend==='webgpu'){
     if(!navigator.gpu){fail('WebGPU unavailable in this browser/secure context','environment');return false}
     let timedOut=false;const timer=setTimeout(()=>{timedOut=true;fail('WebGPU initialization timeout','environment')},8000)
     try{
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});if(dead||timedOut)return false
      if(!adapter){fail('WebGPU adapter unavailable','environment');return false}
      device=await adapter.requestDevice();if(dead||timedOut){device.destroy();return false}
      let buffer,context;const uncaptured=e=>fail(e.error)
      release=()=>{device.removeEventListener('uncapturederror',uncaptured);context?.unconfigure();buffer?.destroy();device.destroy()}
      device.addEventListener('uncapturederror',uncaptured)
      device.lost.then(info=>{if(!dead&&!failed)fail('WebGPU device lost: '+info.reason,'environment')})
      const source='struct CardUniforms { viewport:vec4f, params:vec4f }; @group(0) @binding(0) var<uniform> card:CardUniforms;\n'+(options.vertex||'@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {var points=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(points[i],0.,1.);}')+'\n'+options.fragment
      const shader=device.createShaderModule({code:source});const messages=(await shader.getCompilationInfo()).messages.filter(m=>m.type==='error')
      if(dead||failed)return false
      if(messages.length)throw Error(messages.map(m=>`WGSL ${m.lineNum}:${m.linePos} ${m.message}`).join('\n'))
      context=canvas.getContext('webgpu');if(!context){fail('WebGPU canvas unavailable','environment');return false}
      const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'premultiplied'})
      // Keep the supplied uniform binding valid even for constant shaders whose
      // compiler removes unused card parameters from automatic reflection.
      const groupLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]})
      const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),vertex:{module:shader,entryPoint:'vs'},fragment:{module:shader,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}})
      if(dead||failed)return false
      buffer=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer}}]})
      draw=(w,h,t,p)=>{device.queue.writeBuffer(buffer,0,new Float32Array([w,h,t,w/h,...p]));const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.draw(3);pass.end();device.queue.submit([encoder.finish()])}
     }finally{clearTimeout(timer)}
    }else throw Error('backend must be webgl, webgl2 or webgpu')
    if(dead||failed)return false;emit('ready');raf=requestAnimationFrame(tick);return true
   }catch(e){fail(e);return false}
  })()
  return handle
 },refresh(){surfaces.forEach(s=>s.wake())},dispose(){[...surfaces].forEach(s=>s.dispose())}}
 return api
}
