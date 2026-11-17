// Fragment-body-only contract: host owns bindings, entry points and scheduling.
export function validateMaterial(p){
 if(typeof p.source!=='string'||!p.source.trim()||p.source.length>6000)throw Error('gpu-material.source requires 1–6000 characters')
 const s=p.source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')
 if(/[@#"'`]|\b(fn|for|while|loop|continuing|discard|enable|requires|diagnostic|override|struct|alias|array|ptr|atomic|texture\w*|sampler\w*|workgroup\w*|storage)\b/.test(s)||/\bvar\s*</.test(s))throw Error('gpu-material only accepts a bounded fragment body: no declarations, loops, textures or bindings')
 const calls=[...s.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map(m=>m[1])
 const allowed=new Set('if return vec2f vec3f vec4f f32 i32 u32 abs min max clamp mix smoothstep step sin cos tan atan2 sqrt pow exp log floor ceil fract length distance dot normalize cross reflect select sign saturate'.split(' '))
 if(calls.some(n=>!allowed.has(n)))throw Error('gpu-material contains unsupported function call')
 if(!/\breturn\b/.test(s)||s.split(';').length>100||(s.match(/\b\w+\b/g)||[]).length>1400)throw Error('gpu-material fragment body exceeds complexity budget or lacks return')
 if(p.params!==undefined&&(!Array.isArray(p.params)||p.params.length!==4||p.params.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)))throw Error('gpu-material.params must contain four finite numbers within ±10000')
 if(p.height!==undefined&&(!Number.isFinite(p.height)||p.height<96||p.height>360))throw Error('gpu-material.height must be 96–360')
}
export function materialShader(source){validateMaterial({source});return `
struct MaterialInput { timing: vec4f, params: vec4f };
@group(0) @binding(0) var<uniform> material: MaterialInput;
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
 let time=material.timing.x;
 let aspect=material.timing.y;
 let params=material.params;
 ${source}
}`}
export const PEARL_SHADER=`let p=(uv-vec2f(0.5))*vec2f(aspect,1.0)*2.2;
let r=length(p);
let z=sqrt(max(0.0,1.0-r*r));
let n=normalize(vec3f(p,z+0.01));
let l=normalize(vec3f(-0.6,-0.7,1.0));
let glow=pow(max(0.0,dot(n,l)),18.0);
let band=0.5+0.5*sin(9.0*r+time*0.35+params.x*4.0);
let tint=mix(vec3f(0.38,0.58,0.82),vec3f(0.98,0.70,0.79),band);
let color=tint*(0.42+0.58*z)+vec3f(glow*0.8);
let alpha=1.0-smoothstep(0.94,1.0,r);
return vec4f(color*alpha,alpha);`
export const WAVE_SHADER=`let p=uv*2.0-vec2f(1.0);
let y=sin(p.x*params.x-time)*0.22;
let line=exp(-abs(p.y-y)*35.0);
let halo=exp(-abs(p.y-y)*5.0)*0.3;
return vec4f(mix(vec3f(0.04,0.08,0.18),vec3f(0.20,0.85,0.92),line+halo),1.0);`
