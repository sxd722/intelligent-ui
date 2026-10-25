export function clockFormatters(timeZone, format='HH:mm') {
  return {
    time: new Intl.DateTimeFormat('en-GB', {timeZone, hour:'2-digit', minute:'2-digit', ...(format==='HH:mm:ss'?{second:'2-digit'}:{}), hourCycle:'h23'}),
    date: new Intl.DateTimeFormat('zh-CN', {timeZone, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short'}),
  }
}
