// Trusted, bounded decorative painters. Models supply neither shaders nor loops.
import {createPearlTexture} from './pearl-texture.js'
export function paintPearl(ctx,w,h,t){
      ctx.clearRect(0,0,w,h);
      const cx=w*.51,cy=h*.49,unit=Math.min(w,h)*.315,U=96,V=24,TAU=Math.PI*2;
      const ax=.54+Math.sin(t*.16)*.07,az=-.48+Math.sin(t*.12)*.09,ay=.28+Math.sin(t*.11)*.07;
      const sx=Math.sin(ax),coX=Math.cos(ax),sz=Math.sin(az),coZ=Math.cos(az),sy=Math.sin(ay),coY=Math.cos(ay);
      function rotate(x,y,z){const y1=y*coX-z*sx,z1=y*sx+z*coX,x2=x*coY+z1*sy,z2=-x*sy+z1*coY;return[x2*coZ-y1*sz,x2*sz+y1*coZ,z2]}
      function point(u,v){
        const cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);
        const major=.86+.075*Math.sin(3*u+t*.23)+.025*Math.sin(5*u-t*.13);
        const tube=.235+.065*Math.sin(2*u+t*.2)+.022*Math.sin(3*u+2*v-t*.12);
        const p=rotate((major+tube*cv)*cu,(major+tube*cv)*su*.96,tube*sv+.135*Math.sin(2*u-t*.17));
        const n=rotate(cv*cu,cv*su,sv),pers=3.9/(3.9-p[2]);
        return{x:cx+p[0]*unit*pers,y:cy-p[1]*unit*pers,z:p[2],nx:n[0],ny:n[1],nz:n[2],u,v};
      }
      const halo=ctx.createRadialGradient(cx,cy,unit*.25,cx,cy,unit*1.45);halo.addColorStop(0,'rgba(115,196,198,.06)');halo.addColorStop(.6,'rgba(125,166,204,.07)');halo.addColorStop(1,'rgba(95,168,184,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(cx,cy+unit*.67);ctx.scale(1,.2);const sh=ctx.createRadialGradient(0,0,unit*.12,0,0,unit);sh.addColorStop(0,'rgba(0,5,12,.65)');sh.addColorStop(1,'rgba(0,5,12,0)');ctx.fillStyle=sh;ctx.beginPath();ctx.arc(0,0,unit,0,TAU);ctx.fill();ctx.restore();
      const grid=[];for(let i=0;i<=U;i++){const row=[];for(let j=0;j<=V;j++)row.push(point(i/U*TAU,j/V*TAU));grid.push(row)}
      const faces=[];for(let i=0;i<U;i++)for(let j=0;j<V;j++){const p=[grid[i][j],grid[i+1][j],grid[i+1][j+1],grid[i][j+1]];faces.push({p,z:(p[0].z+p[1].z+p[2].z+p[3].z)/4})}faces.sort((a,b)=>a.z-b.z);
      const cap=x=>Math.max(0,Math.min(255,Math.round(x)));
      for(const f of faces){const a=f.p;let nx=0,ny=0,nz=0;for(const p of a){nx+=p.nx;ny+=p.ny;nz+=p.nz}const len=Math.hypot(nx,ny,nz);nx/=len;ny/=len;nz/=len;
        const rx=2*nz*nx,ry=2*nz*ny,rz=2*nz*nz-1;
        const soft=.2+.8*Math.max(0,ny*.35+nx*-.22+nz*.7);
        const band=Math.exp(-Math.pow((ry+.14+rx*.32)/.16,2));
        const narrow=Math.exp(-Math.pow((rx*.68+ry*.4-.22)/.045,2));
        const broad=Math.exp(-Math.pow((rx*.3-ry*.55+.34)/.4,2));
        const edge=Math.pow(1-Math.abs(nz),3);
        const pearl=.5+.5*Math.sin(rx*4.5+ry*2+t*.15);
        const spec=Math.pow(Math.max(0,nx*-.33+ny*.44+nz*.833),85);
        const bright=band*96+narrow*86+broad*45+spec*135;
        const facing=.35+.65*Math.max(0,nz);
        const r=cap((17+soft*37+bright*(.87+.13*pearl)+edge*30)*facing);
        const g=cap((40+soft*58+bright*(1.03-.08*pearl)+edge*76)*facing);
        const b=cap((57+soft*70+bright*(1.1-.2*pearl)+edge*92)*facing);
        const color=`rgb(${r},${g},${b})`;ctx.beginPath();ctx.moveTo(a[0].x,a[0].y);for(let k=1;k<4;k++)ctx.lineTo(a[k].x,a[k].y);ctx.closePath();ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.fill();ctx.stroke();
      }
      ctx.save();ctx.globalCompositeOperation='screen';
      for(let k=0;k<3;k++){
        const v=.78+k*.055,grad=ctx.createLinearGradient(cx-unit,cy-unit,cx+unit,cy+unit);grad.addColorStop(0,'rgba(240,255,228,0)');grad.addColorStop(.36,'rgba(235,255,232,.56)');grad.addColorStop(.6,'rgba(177,203,255,.08)');grad.addColorStop(1,'rgba(222,249,255,0)');ctx.strokeStyle=grad;ctx.lineWidth=(k===0?1.4:.55)*w/650;ctx.beginPath();let open=false;
        for(let i=0;i<=220;i++){const p=point(i/220*TAU,v+.04*Math.sin(i/220*TAU*3+t*.2));if(p.nz>.12){if(!open){ctx.moveTo(p.x,p.y);open=true}else ctx.lineTo(p.x,p.y)}else open=false}ctx.stroke();
      }
      ctx.restore();
    }

export function paintParticles(ctx,w,h,time){
 ctx.clearRect(0,0,w,h)
 for(let i=0;i<22;i++){const x=((i*.618033+time*.012)%1)*w,y=h*(.5+.35*Math.sin(i*2.4+time*.19));ctx.fillStyle=`rgba(137,110,190,${.14+(i%4)*.07})`;ctx.beginPath();ctx.arc(x,y,1+(i%3)*.8,0,Math.PI*2);ctx.fill();if(i%3===0){ctx.strokeStyle='#a48bc333';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+20,y-16);ctx.stroke()}}
}
export function mountHostEffect(canvas,kind){
 if(!canvas)return()=>{}
 const stage=canvas.closest('.cs-stage');let ctx
 try{ctx=canvas.getContext('2d',{alpha:true})}catch{}
 if(!ctx||!stage){canvas.dataset.effectStatus='unavailable';return()=>{}}
 const paint=kind==='pearl'?paintPearl:paintParticles
 const texture=kind==='pearl'?createPearlTexture():null
 let frame=0,phase=0,last=0,disposed=false,w=1,h=1,failed=false
 const draw=()=>{try{const gpu=texture?.draw(ctx,w,h,phase);if(!gpu)paint(ctx,w,h,phase);canvas.dataset.effectRenderer=gpu?'webgl':'canvas';canvas.dataset.effectStatus='ready'}catch{failed=true;canvas.dataset.effectStatus='unavailable';ctx.clearRect(0,0,w,h)}}
 const active=()=>!failed&&!disposed&&!document.hidden&&stage.dataset.motionActive==='true'&&!stage.hasAttribute('data-streaming')
 const tick=now=>{frame=0;if(!active())return;if(!last)last=now;if(now-last>=50){phase+=Math.min(.1,(now-last)/1000);last=now;draw()}if(active())frame=requestAnimationFrame(tick)}
 const sync=()=>{cancelAnimationFrame(frame);frame=0;last=0;canvas.dataset.effectRunning=String(active());if(active())frame=requestAnimationFrame(tick)}
 const size=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.25);w=Math.max(1,Math.min(420,Math.round(r.width*dpr)));h=Math.max(1,Math.min(375,Math.round(r.height*dpr)));canvas.width=w;canvas.height=h;draw();sync()}
 const resize=new ResizeObserver(size);resize.observe(canvas)
 const mutation=new MutationObserver(sync);mutation.observe(stage,{attributes:true,attributeFilter:['data-motion-active','data-streaming','data-motion-level']})
 document.addEventListener('visibilitychange',sync);size()
 return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();document.removeEventListener('visibilitychange',sync);texture?.dispose()}
}
