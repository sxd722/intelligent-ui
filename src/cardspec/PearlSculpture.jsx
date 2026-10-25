import React,{useId} from "react"
export function PearlSculpture(){
 const id=useId().replace(/:/g,"");
 const ribbons=[];
 for(let j=0;j<32;j++){
  const angle=j/31*Math.PI*2,points=[];
  for(let i=0;i<=96;i++){
   const t=i/96*Math.PI*2,rad=95+25*Math.cos(angle),x=180+rad*Math.cos(t),y=160+(rad*Math.sin(t)*.69)+25*Math.sin(angle)*Math.cos(t+.5);
   points.push((i?'L':'M')+x.toFixed(2)+','+y.toFixed(2));
  }
  ribbons.push(<path key={j} d={points.join(' ')+'Z'} fill="none" stroke={j%7===0?'#effff7':j%5===0?'#b0d1ec':'#6696aa'} strokeWidth={j%7===0?2:1.2} opacity={.24+.65*Math.pow(Math.abs(Math.cos(angle)),4)}/>);
 }
 return (   <svg className="cs-proportion-sculpture" viewBox="0 0 360 320" aria-hidden="true">
    <defs><radialGradient id={id+"halo"}><stop stopColor="#6ddcdd" stopOpacity=".18"/><stop offset="1" stopColor="#102b38" stopOpacity="0"/></radialGradient><linearGradient id={id+"edge"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edf9eb"/><stop offset=".28" stopColor="#628d9f"/><stop offset=".52" stopColor="#d6f4ff"/><stop offset=".8" stopColor="#46728c"/><stop offset="1" stopColor="#edcfe9"/></linearGradient></defs>
    <ellipse cx="180" cy="175" rx="173" ry="144" fill={"url(#"+id+"halo)"}/>
    <g className="cs-proportion-orbit"><g transform="rotate(-28 180 160)"><ellipse cx="180" cy="160" rx="120" ry="83" fill="none" stroke="#102530" strokeWidth="34"/><ellipse cx="180" cy="160" rx="113" ry="77" fill="none" stroke={"url(#"+id+"edge)"} strokeWidth="19"/>{ribbons}<path d="M77 124 C103 66 224 56 279 128" fill="none" stroke="#e2ffff" strokeWidth="1.6" opacity=".8"/></g></g>
   </svg>);
}
