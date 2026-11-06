import React,{useContext,useEffect,useRef,useState} from 'react'
import {MapEnvironment,OFFLINE_MAP_TILE} from './MapEnvironment.jsx'
import {geoPoints} from '../../shared/cardspec/composition.mjs'
import {separateMapPins} from '../../shared/cardspec/map-layout.mjs'
import {useViewState} from './view-state.jsx'
import 'leaflet/dist/leaflet.css'
import './geographic-map.css'
import {useCompositionSpace} from './useCompositionSpace.js'

// Maps live in the host, never in the no-network React sandbox. Only visible
// tiles are requested; normal HTTP caching and provider attribution remain intact.
export function GeographicMap({p,fire}){
 const offline=useContext(MapEnvironment)==='offline'
 const [container,space]=useCompositionSpace({fill:false})
 const root=useRef(null),engine=useRef(null),latest=useRef(null)
 const [selected,setSelected]=useViewState('map-selection','')
 const [viewport,saveViewport]=useViewState('map-viewport',null)
 const [status,setStatus]=useState('loading'),[spread,setSpread]=useState(false),[ready,setReady]=useState(0)
 const points=geoPoints(p.items||[]).map(point=>({...point,number:(p.items||[]).indexOf(point.item)+1}))
 const stamp=JSON.stringify(points.map(({id,lat,lon,number})=>[id,lat,lon,number]))
 latest.current={points,p,fire,selected:p.selectedId??selected,viewport,stamp}
 const pick=point=>{if(latest.current.fire('onSelect',{id:point.id,value:point.id,item:point.item})!==false)setSelected(point.id)}
 const pickRef=useRef(pick);pickRef.current=pick
 useEffect(()=>{if(status!=='loading'||!points.length)return;const timer=setTimeout(()=>setStatus(value=>value==='loading'?'error':value),15000);return()=>clearTimeout(timer)},[status,!!points.length])
 useEffect(()=>{
  if(!points.length)return
  setStatus('loading')
  let disposed=false,map,observer
  import('leaflet').then(({default:L})=>{
   if(disposed)return
   map=L.map(root.current,{zoomControl:false,scrollWheelZoom:false,attributionControl:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,minZoom:2,maxZoom:18,zoomSnap:.25})
   // Raster tiles deliberately extend beyond the viewport. Only that visual
   // layer is decorative; pin/control clipping is still audited normally.
   map.getPane('tilePane').setAttribute('aria-hidden','true')
   const tiles=L.tileLayer(offline?OFFLINE_MAP_TILE:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:0,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin'}).addTo(map)
   let loaded=false;const failures=new Set(),tileKey=e=>`${e.coords.z}/${e.coords.x}/${e.coords.y}`
   tiles.on('tileload',e=>{loaded=true;failures.delete(tileKey(e));setStatus(failures.size?'partial':'ready')})
   tiles.on('tileerror',e=>{failures.add(tileKey(e));setStatus(loaded?'partial':'error')})
   const layer=L.layerGroup().addTo(map)
   const draw=()=>{
    const {points,p,selected}=latest.current,size=map.getSize()
    const visible=points.map(point=>({...point,...map.latLngToContainerPoint([point.lat,point.lon])})).filter(v=>v.x>=0&&v.x<=size.x&&v.y>=0&&v.y<=size.y)
    const arranged=separateMapPins(visible,size.x,size.y,[{left:size.x-146,top:0,right:size.x,bottom:54}])
    layer.clearLayers();setSpread(arranged.some(v=>v.displaced))
    for(const point of arranged){
     const at=map.containerPointToLatLng([point.x,point.y])
     if(point.displaced){L.polyline([[point.lat,point.lon],at],{color:'#27616e',weight:1.5,opacity:.65,interactive:false}).addTo(layer);L.circleMarker([point.lat,point.lon],{radius:2.5,color:'#163d48',fillOpacity:1,weight:1,interactive:false}).addTo(layer)}
     const button=document.createElement('button')
     button.type='button';button.className='cs-map-pin';button.textContent=String(point.number)
     button.title=point.label;button.setAttribute('aria-label',`${point.number} · ${point.label}`)
     button.dataset.pointId=point.id
     button.setAttribute('aria-pressed',String(Array.isArray(p.selectedIds)?p.selectedIds.map(String).includes(point.id):String(selected)===point.id))
     button.addEventListener('click',e=>{e.stopPropagation();pickRef.current(point)})
     L.marker(at,{icon:L.divIcon({html:button,className:'cs-map-marker',iconSize:[44,44],iconAnchor:[22,22]}),keyboard:false}).addTo(layer)
    }
   }
   const fit=()=>{const pts=latest.current.points;if(pts.length)map.fitBounds(pts.map(v=>[v.lat,v.lon]),{padding:[32,34],maxZoom:15,animate:false});else map.setView([0,0],2)}
   const restore=latest.current.viewport
   if(restore?.stamp===latest.current.stamp&&Array.isArray(restore.center))map.setView(restore.center,restore.zoom,{animate:false});else fit()
   map.on('moveend',()=>{draw();const c=map.getCenter();saveViewport({stamp:latest.current.stamp,center:[c.lat,c.lng],zoom:map.getZoom()})})
   engine.current={map,draw,fit,retry:()=>{failures.clear();loaded=false;setStatus('loading');tiles.redraw()}};draw();setReady(v=>v+1)
   observer=new ResizeObserver(()=>{map.invalidateSize({pan:false});draw()});observer.observe(root.current)
  }).catch(()=>{if(!disposed)setStatus('unavailable')})
  return()=>{disposed=true;observer?.disconnect();engine.current=null;map?.remove()}
 },[!!points.length,offline])
 useEffect(()=>{if(engine.current){engine.current.fit();engine.current.draw()}},[stamp])
 // Selection changes update only pin styles, preserving viewport and keyboard focus.
 useEffect(()=>{root.current?.querySelectorAll('.cs-map-pin').forEach(button=>button.setAttribute('aria-pressed',String(Array.isArray(p.selectedIds)?p.selectedIds.map(String).includes(button.dataset.pointId):String(p.selectedId??selected)===button.dataset.pointId)))},[p.selectedId,JSON.stringify(p.selectedIds),selected,ready])
 const bad=status==='error'||status==='partial'||status==='unavailable'
 return <section ref={container} className="cs-point-map cs-geographic-map" style={space!==null?{'--cs-map-budget':Math.max(120,space-32)+'px'}:undefined} data-map-size={p.size||'normal'} aria-label={p.label||'地点地图'}>
  <div className="cs-map-stage" data-gesture-owner="map">
   <div ref={root} className="cs-map-tiles" role="group" aria-label="街道底图与编号地点标记"/>
   {!!points.length&&<div className="cs-map-controls"><button type="button" aria-label="放大地图" onClick={()=>engine.current?.map.zoomIn()}>＋</button><button type="button" aria-label="缩小地图" onClick={()=>engine.current?.map.zoomOut()}>−</button><button type="button" aria-label="显示全部地点" onClick={()=>engine.current?.fit()}>全览</button></div>}
   {(!points.length||status==='loading'||bad)&&<div className="cs-map-notice" role="status">{!points.length?'暂无可核实坐标':status==='loading'?'加载街道底图…':status==='unavailable'?'地图未能初始化，请用下方地点列表选择':'底图暂未完整加载；标点仍可选择'}{!!points.length&&bad&&status!=='unavailable'&&<button type="button" onClick={()=>engine.current?.retry()}>重试底图</button>}</div>}
   {offline?<span className="cs-map-attribution">离线调试底图 · 生产环境使用街道底图</span>:<a className="cs-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>}
  </div>
  <details className="cs-map-index"><summary>地点 · {points.length}{points.length<(p.items||[]).length?<small> · {(p.items||[]).length-points.length}项缺坐标</small>:null}</summary><small className="cs-map-note">{!points.length?'没有有效坐标，未请求底图':'拖动或缩放查看地点；邻近标记展开时，细线指向输入坐标。非路线导航。'}</small><div>{points.map(point=><button type="button" key={point.id} aria-pressed={Array.isArray(p.selectedIds)?p.selectedIds.map(String).includes(point.id):String(p.selectedId??selected)===point.id} onClick={()=>pick(point)}>{point.number} · {point.label}</button>)}</div></details>
 </section>
}
