// Host-owned query adapter. Reuse the pinned upstream protocol, but filter the
// complete response BEFORE applying the UI limit. No browser session is touched.
export function validateTrainWindow(input) {
 const from=input.departureAfter??'00:00',to=input.departureBefore??'24:00'
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(to)&&to!=='24:00'||from>=to)throw Error('departureAfter/departureBefore require an increasing HH:MM range (end exclusive)')
 return {from,to}
}
export function selectTrainRows(rows,input,fromStation,toStation) {
 const window=validateTrainWindow(input)
 const filtered=rows.filter(row=>(input.exactStations===false||(row.from_code===fromStation.code&&row.to_code===toStation.code))&&row.start_time>=window.from&&row.start_time<window.to)
 const limit=input.limit??20
 return {rows:filtered.slice(0,limit),coverage:{complete:true,total:rows.length,matched:filtered.length,returned:Math.min(limit,filtered.length)},truncated:filtered.length>limit}
}
export async function queryTrains(load,input) {
 validateTrainWindow(input)
 const utils=await load('clis/12306/utils.js'),{__test__:protocol}=await load('clis/12306/trains.js')
 const date=utils.validateDate(input.date),stations=await utils.fetchStationBundle()
 const from=utils.resolveStation(stations,input.from),to=utils.resolveStation(stations,input.to)
 if(from.code===to.code)throw Error('Origin and destination must differ')
 const raw=await protocol.queryLeftTickets(await utils.mintSession(),from.code,to.code,date)
 if(raw.length>10000)throw Error('Train response exceeds query safety limit')
 const map=new Map(stations.map(s=>[s.code,s]))
 const rows=raw.map(line=>utils.parseTrainRecord(decodeURIComponent(line.replace(/%0A/g,'')),map)).filter(Boolean).map(row=>({...row,departure_date:date,bookable:row.available}))
 return selectTrainRows(rows,input,from,to)
}
