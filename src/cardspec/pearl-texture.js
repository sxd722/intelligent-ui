import {PEARL_FRAGMENT} from './pearl-shader.js'
// Own, detached drawing surface; never touches an app/browser connection.
export function createPearlTexture(){
 const canvas=document.createElement('canvas');let gl,program,buffer,lost=false
 const shaders=[]
 const dispose=()=>{if(!gl)return;try{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext()}catch{}gl=null}
 try{
  gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'})
  if(!gl)return null
  const shader=(type,source)=>{const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('host shader compile');return s}
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,PEARL_FRAGMENT));gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('host shader link')
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW)
  const pos=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0)
  const res=gl.getUniformLocation(program,'ures'),time=gl.getUniformLocation(program,'utime')
  canvas.addEventListener('webglcontextlost',()=>{lost=true})
  return {dispose,draw(ctx,w,h,t){
   if(lost||!gl||gl.isContextLost())return false
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(res,w,h);gl.uniform1f(time,t);gl.drawArrays(gl.TRIANGLES,0,6)
   ctx.clearRect(0,0,w,h);ctx.drawImage(canvas,0,0);return true
  }}
 }catch{dispose();return null}
}
