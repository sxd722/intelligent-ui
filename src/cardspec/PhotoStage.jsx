import React from 'react'
// Only already validated host resource URLs reach this component. Crop and
// reveal are independent; text/controls never inherit the image's alpha mask.
const crops={center:'50% 50%',top:'50% 20%',bottom:'50% 80%',left:'25% 40%',right:'75% 35%'}
const masks={spotlight:{x:'78%',y:'28%'},'fade-left':{x:'88%',y:'48%'},mist:{x:'50%',y:'85%'}}
export function PhotoStage({photo,crop='center',mask='spotlight'}){
 const reveal=masks[mask]||masks.spotlight,color=/^#[0-9a-f]{6}$/i.test(photo.resource?.avgColor||'')?photo.resource.avgColor:undefined
 return <div className="cs-photo-stage" data-status={photo.status} data-mask={mask} style={{'--photo-crop':crops[crop]||crops.center,'--photo-mask-x':reveal.x,'--photo-mask-y':reveal.y,'--photo-average':color}} aria-hidden="true">
  <div className="cs-photo-stage-fallback"/>
  {photo.src&&photo.status!=='error'&&<img key={photo.src} src={photo.src} alt="" decoding="async" onLoad={photo.loaded} onError={photo.failed}/>}
 </div>
}
