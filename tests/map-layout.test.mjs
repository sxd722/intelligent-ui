import test from 'node:test'
import assert from 'node:assert/strict'
import {separateMapPins} from '../shared/cardspec/map-layout.mjs'
import {geoPoints} from '../shared/cardspec/composition.mjs'

test('six nearby pins remain individually selectable at mobile map widths',()=>{
 for(const width of [276,316,388]){
  const points=Array.from({length:6},(_,i)=>({id:String(i+1),x:width/2+i,y:100+i,lat:30,lon:120}))
  const pins=separateMapPins(points,width,190)
  assert.deepEqual(pins.map(p=>p.id),points.map(p=>p.id))
  for(const [i,p]of pins.entries()){
   assert.ok(p.x>=22&&p.x<=width-22&&p.y>=22&&p.y<=168)
   for(const q of pins.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=45)
   assert.equal(p.lat,30);assert.equal(p.lon,120)
  }
 }
})
test('missing coordinates do not invent pins or lose record identities',()=>{
 const items=[{id:'one'},{id:'two',latitude:30,longitude:120},{id:'three',lat:null,lon:120},{id:'four',lat:30,lon:120}]
 const points=geoPoints(items).map(p=>({...p,number:items.indexOf(p.item)+1}))
 assert.deepEqual(points.map(p=>p.number),[2,4])
 assert.deepEqual(points.map(p=>p.item),[items[1],items[3]])
})
test('mobile pins avoid zoom controls as well as other pins',()=>{
 const reserved=[{left:130,top:0,right:276,bottom:54}]
 const input=Array.from({length:6},(_,i)=>({id:String(i),x:145+i,y:i===5?28:86+i}))
 const pins=separateMapPins(input,276,150,reserved)
 for(const [i,p]of pins.entries()){
  assert.ok(!(p.x+22>130&&p.y-22<54))
  for(const q of pins.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=45)
 }
})
