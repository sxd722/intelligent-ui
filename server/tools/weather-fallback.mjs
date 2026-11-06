// Fixed public endpoints; never fetch a model-supplied URL or hide the provider.
export const weatherText=code=>({0:'晴',1:'晴间多云',2:'多云',3:'阴',45:'雾',48:'冻雾',51:'毛毛雨',53:'毛毛雨',55:'毛毛雨',56:'冻雨',57:'冻雨',61:'小雨',63:'雨',65:'大雨',66:'冻雨',67:'冻雨',71:'小雪',73:'雪',75:'大雪',77:'雪粒',80:'阵雨',81:'阵雨',82:'强阵雨',85:'阵雪',86:'强阵雪',95:'雷雨',96:'雷雨伴冰雹',99:'雷雨伴冰雹'}[code]||'天气代码 '+code)
export async function openMeteoForecast(input,{signal,fetchImpl=fetch}={}){
 const location=String(input.location||'').trim(),days=input.days??3
 if(!location||location.length>300||!Number.isInteger(days)||days<1||days>3)throw Error('Invalid weather location/days')
 const get=async url=>{const r=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});if(!r.ok)throw Error('Open-Meteo HTTP '+r.status);return r.json()}
 let latitude,longitude,label=location
 const pair=location.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
 if(pair){latitude=Number(pair[1]);longitude=Number(pair[2])}else{
  if(location.startsWith('@'))throw Error('Weather fallback requires a city or lat,lon, not a domain')
  const data=await get('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:location,count:'1',language:'zh',format:'json'})),place=data.results?.[0]
  if(!place)throw Error('Open-Meteo could not resolve location')
  latitude=place.latitude;longitude=place.longitude;label=[place.name,place.admin1,place.country].filter(Boolean).join(' · ')
 }
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Invalid resolved weather coordinates')
 const data=await get('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(latitude),longitude:String(longitude),daily:'temperature_2m_max,temperature_2m_min,temperature_2m_mean,weather_code,sunrise,sunset',timezone:'auto',forecast_days:String(days)})),d=data.daily
 if(!Array.isArray(d?.time)||!d.time.length||['temperature_2m_min','temperature_2m_max','temperature_2m_mean'].some(k=>data.daily_units?.[k]!=='°C'))throw Error('Weather fallback response schema/units changed')
 const n=v=>typeof v==='number'&&Number.isFinite(v)?v:null
 return {items:d.time.slice(0,days).map((date,i)=>({rowKey:'open-meteo:'+latitude+':'+longitude+':'+date,date,description:weatherText(d.weather_code?.[i]),minTempC:n(d.temperature_2m_min?.[i]),maxTempC:n(d.temperature_2m_max?.[i]),avgTempC:n(d.temperature_2m_mean?.[i]),sunrise:d.sunrise?.[i]??null,sunset:d.sunset?.[i]??null,location:label,lat:latitude,lon:longitude,coordSystem:'WGS84',timezone:data.timezone,provider:'Open-Meteo',fallbackFrom:'wttr.in',sourceUrl:'https://open-meteo.com/'})),source:'Open-Meteo · wttr.in 网络不可用时的替代来源',fetchedAt:new Date().toISOString(),truncated:false}
}
export async function readWithWeatherFallback(tool,input,read,{signal,fetchImpl,emit=()=>{}}={}){
 try{return await read()}catch(e){
  const code=e.errorInfo?.code||e.code,detail=e.errorInfo?.detail||e.message
  if(tool!=='opencli.wttr.forecast'||signal?.aborted||['AUTH_REQUIRED','ACCESS_RESTRICTED','RATE_LIMITED'].includes(code)||(code!=='NETWORK'&&!/fetch failed|network|ECONNRESET|ENOTFOUND|ETIMEDOUT|HTTP 5\d\d/i.test(detail)))throw e
  emit({type:'status',status:'fallback',provider:'Open-Meteo'})
  try{const value=await openMeteoForecast(input,{signal,fetchImpl});emit({type:'warning',code:'WEATHER_PROVIDER_FALLBACK',message:'wttr.in 暂不可用，已使用 Open-Meteo；来源与地点见返回数据。'});return value}
  catch(failure){throw Object.assign(Error('wttr.in 网络失败；Open-Meteo 替代来源也失败：'+failure.message+(failure.cause?.code?' ('+failure.cause.code+')':'')),{cause:failure})}
 }
}
