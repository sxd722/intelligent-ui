// Absolute time only: timezone-less wall times must never inherit the device zone.
export function countdownState(target, now = Date.now()) {
  if (!target) return {status:'unknown',seconds:null,text:'时间待确认'}
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(target)
  const parts = match?.slice(1).map(Number), year=parts?.[0], month=parts?.[1], day=parts?.[2]
  const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31]
  const valid=match&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&parts[3]<24&&parts[4]<60&&(parts[5]||0)<60
  const end = valid ? Date.parse(target) : NaN
  if (!Number.isFinite(end)) return {status:'invalid',seconds:null,text:'时间无效，请提供含时区的日期时间'}
  const seconds = Math.max(0, Math.ceil((end-now)/1000))
  const h=String(Math.floor(seconds/3600)%24).padStart(2,'0'),m=String(Math.floor(seconds/60)%60).padStart(2,'0'),s=String(seconds%60).padStart(2,'0')
  return {status:seconds?'pending':'expired',seconds,text:seconds?`${Math.floor(seconds/86400)}天 ${h}:${m}:${s}`:'已到设定时间'}
}
