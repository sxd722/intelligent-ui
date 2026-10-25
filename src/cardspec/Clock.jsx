import React, {useEffect, useMemo, useState} from 'react'
import {clockFormatters} from '../../shared/cardspec/clock.mjs'

export function Clock({timeZone, label, format='HH:mm', showDate=true}) {
  const [now,setNow]=useState(()=>new Date())
  const formats=useMemo(()=>clockFormatters(timeZone,format),[timeZone,format])
  useEffect(()=>{
    let timer
    const tick=()=>{
      clearTimeout(timer)
      if(document.hidden)return
      setNow(new Date())
      const interval=format==='HH:mm:ss'?1000:60000
      timer=setTimeout(tick,interval-Date.now()%interval+20)
    }
    tick()
    document.addEventListener('visibilitychange',tick)
    return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',tick)}
  },[format,timeZone])
  return <div className="cs-clock" aria-label={label||timeZone}>
    <span>{label||timeZone}</span>
    <time dateTime={now.toISOString()}>{formats.time.format(now)}</time>
    {showDate&&<small>{formats.date.format(now)}</small>}
  </div>
}
