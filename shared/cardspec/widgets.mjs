import { validateContract } from './contracts.mjs'
const assert = (ok, message) => { if (!ok) throw new Error(message) }
// Compact visual labels only; plots, events and accessible labels retain values.
export const chartNumber=value=>Number.isInteger(value)?String(value):String(Number(value.toPrecision(4)))
export function validateWidget(type, p) {
  validateContract(type,p)
  if(type==='heatmap'){
    for(const key of ['rows','columns'])assert(Array.isArray(p[key])&&p[key].length>=1&&p[key].length<=12&&p[key].every(x=>x&&typeof x.id==='string'&&x.id&&typeof x.label==='string')&&new Set(p[key].map(x=>x.id)).size===p[key].length,'heatmap axes require 1–12 unique {id,label}')
    assert(Array.isArray(p.values)&&p.values.length===p.rows.length&&p.values.every(row=>Array.isArray(row)&&row.length===p.columns.length&&row.every(v=>v===null||typeof v==='number'&&Number.isFinite(v))),'heatmap.values must match axes, containing finite numbers or null')
  }
  if(['collection','experience','map'].includes(type)){
    if(type==='experience'&&p.items===undefined)p={...p,items:[]}
    assert(Array.isArray(p.items),'collection.items requires an array')
    const ids=new Set()
    for(const row of p.items){const id=row?.rowKey??row?.id;assert(row&&typeof row==='object'&&!Array.isArray(row)&&id!=null&&id!==''&&!ids.has(String(id)),'collection items require unique id or rowKey');ids.add(String(id))}
    assert(p.fields===undefined||Array.isArray(p.fields)&&p.fields.length<=3&&p.fields.every(f=>typeof f==='string'),'collection.fields requires up to 3 field names')
    if(type==='experience'){
      assert(p.maxSelected===undefined||Number.isInteger(p.maxSelected)&&p.maxSelected>=1&&p.maxSelected<=50,'experience.maxSelected requires an integer from 1 to 50')
      assert(p.facets===undefined||Array.isArray(p.facets)&&p.facets.length<=3&&p.facets.every(f=>typeof f==='string'),'experience.facets requires up to 3 field names')
      assert(p.selectedIds===undefined||Array.isArray(p.selectedIds)&&p.selectedIds.every(x=>typeof x==='string'),'experience.selectedIds requires string IDs')
    }
  }
  if (type === 'calendar') {
    const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
    assert(p.month==null || (typeof p.month==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)), 'calendar.month requires YYYY-MM; use monthOf(context.localDate), not a full date')
    assert(p.selectedDate==null || p.selectedDate==='' || validDate(p.selectedDate), 'calendar.selectedDate requires a real YYYY-MM-DD date, or empty string for no selection')
    assert(p.markedDates==null || (Array.isArray(p.markedDates) && p.markedDates.every(validDate)), 'calendar.markedDates requires an array of YYYY-MM-DD strings, not objects; filter string elements with item, not item.id')
  }
  if (type === 'slider') {
    const min = p.min ?? 0, max = p.max ?? 100, step = p.step ?? 1
    assert(max > min && step > 0 && step <= max - min, 'slider requires max > min and a positive step within range')
    assert(p.value == null || (p.value >= min && p.value <= max), 'slider.value must be within min/max')
  }
  if (type === 'chart') {
    assert(Array.isArray(p.data) && p.data.length <= 40, 'chart.data requires at most 40 {id,label,value} points')
    const ids = new Set()
    for (const point of p.data) {
      assert(point && typeof point.id === 'string' && point.id && !ids.has(point.id) && typeof point.label === 'string' && Number.isFinite(point.value), 'chart points require unique string id, label and finite numeric value')
      assert(point.series==null||typeof point.series==='string','chart.series must be string')
      assert(p.kind!=='stacked'||point.value>=0,'stacked chart requires nonnegative values')
      assert(point.recordIds==null||Array.isArray(point.recordIds)&&point.recordIds.length<=1000&&point.recordIds.every(id=>typeof id==='string'),'chart recordIds must be string array')
      ids.add(point.id)
    }
  }
  if (type === 'mindmap' || type === 'flowchart') {
    assert(Array.isArray(p.nodes) && p.nodes.length > 0 && p.nodes.length <= 40, 'diagram requires 1–40 nodes')
    const byId = new Map()
    for (const n of p.nodes) {
      assert(n && typeof n.id === 'string' && n.id && !byId.has(n.id) && typeof n.label === 'string' && n.label.length <= 120, 'diagram nodes require unique string id and label (max 120 characters)')
      assert(n.description == null || typeof n.description === 'string', 'node description must be a string')
      assert(n.value == null || Number.isFinite(n.value), 'node value must be finite')
      byId.set(n.id, n)
    }
    if (type === 'mindmap') {
      const roots = p.nodes.filter((n) => n.parentId == null || n.parentId === '')
      assert(roots.length === 1, `mindmap requires exactly one root without parentId; found ${roots.length} (${roots.map(n => n.id).join(', ')}). Give every other node a parentId referencing an existing node; unrelated nodes belong in a list, not an invented tree`)
      for (const n of p.nodes) {
        const seen = new Set(); let current = n
        while (current) {
          assert(!seen.has(current.id), 'mindmap must not contain cycles'); seen.add(current.id)
          if (!current.parentId) break
          assert(byId.has(current.parentId), 'mindmap parentId must reference a node')
          current = byId.get(current.parentId)
        }
      }
    } else {
      assert(Array.isArray(p.edges) && p.edges.length <= 80, 'flowchart.edges requires at most 80 edges')
      for (const e of p.edges) assert(e && byId.has(e.from) && byId.has(e.to) && (e.label == null || typeof e.label === 'string') && (e.value == null || Number.isFinite(e.value)), 'flowchart edges require valid endpoints and finite optional value')
    }
  }
}

// Host-owned positioning: model supplies relationships, never coordinates or SVG.
export function diagramLayout(type, nodes, edges = [], direction = 'horizontal', viewport = {}) {
  const links = type === 'mindmap' ? nodes.filter(n => n.parentId).map(n => ({from:n.parentId,to:n.id})) : edges
  const positions = new Map(), gap = 24, nodeHeight = 48, margin = 16
  let columns = 1, rows = 1
  if (type === 'mindmap') {
    const root = nodes.find(n => !n.parentId), children = id => nodes.filter(n => n.parentId === id)
    const leaves = n => Math.max(1, children(n.id).reduce((sum,c) => sum + leaves(c),0))
    const branches = children(root.id), sides = [[],[]], loads = [0,0]
    for (const branch of branches) { const side = loads[0] <= loads[1] ? 0 : 1; sides[side].push(branch); loads[side] += leaves(branch) }
    const depth = n => 1 + Math.max(0,...children(n.id).map(depth))
    const left = Math.max(0,...sides[0].map(depth)), right = Math.max(0,...sides[1].map(depth))
    columns = left + right + 1; rows = Math.max(1,...loads)
    positions.set(root.id,{col:left,row:(rows-1)/2})
    const place = (n,level,sign,start) => {
      const span=leaves(n); positions.set(n.id,{col:left+sign*level,row:start+(span-1)/2})
      let offset=start; for(const child of children(n.id)){place(child,level+1,sign,offset);offset+=leaves(child)}
    }
    sides.forEach((branches,side)=>{let start=(rows-loads[side])/2;for(const branch of branches){place(branch,1,side===0?-1:1,start);start+=leaves(branch)}})
  } else {
    // A visited traversal assigns levels once. Return edges stay edges rather
    // than turning an entire cyclic component into an unnecessarily long chain.
    const levels=new Map(), queue=[]
    for(const n of nodes.filter(n=>!links.some(e=>e.to===n.id))) {levels.set(n.id,0);queue.push(n.id)}
    const visit=()=>{while(queue.length){const id=queue.shift();for(const e of links.filter(e=>e.from===id)){if(!levels.has(e.to)){levels.set(e.to,levels.get(id)+1);queue.push(e.to)}}}}
    visit()
    for(const n of nodes)if(!levels.has(n.id)){levels.set(n.id,0);queue.push(n.id);visit()}
    const groups=new Map();for(const n of nodes){const d=levels.get(n.id);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(n)}
    const breadth=Math.max(1,...[...groups.values()].map(g=>g.length)),depth=Math.max(...levels.values())+1
    const vertical=direction!=='horizontal';columns=vertical?breadth:depth;rows=vertical?depth:breadth
    for(const n of nodes){const level=levels.get(n.id),group=groups.get(level),index=group.indexOf(n)+(breadth-group.length)/2;positions.set(n.id,{col:vertical?index:level,row:vertical?level:index})}
  }
  const candidates=[{positions,columns,rows,vertical:type==='flowchart'&&direction!=='horizontal'}]
  if(type==='mindmap') {
    // A rooted, layered tree is often more compact than a bilateral map on
    // phones, especially for chains. Compare topology-preserving arrangements.
    const levels=new Map(),root=nodes.find(n=>!n.parentId),queue=[root]
    levels.set(root.id,0)
    while(queue.length){const n=queue.shift();for(const child of nodes.filter(c=>c.parentId===n.id)){levels.set(child.id,levels.get(n.id)+1);queue.push(child)}}
    const groups=new Map();for(const n of nodes){const level=levels.get(n.id);if(!groups.has(level))groups.set(level,[]);groups.get(level).push(n)}
    const breadth=Math.max(...[...groups.values()].map(g=>g.length)),depth=groups.size,layered=new Map()
    for(const n of nodes){const level=levels.get(n.id),group=groups.get(level);layered.set(n.id,{col:group.indexOf(n)+(breadth-group.length)/2,row:level})}
    candidates.push({positions:layered,columns:breadth,rows:depth,vertical:true})
  }
  for(const candidate of [...candidates])candidates.push({positions:new Map([...candidate.positions].map(([id,p])=>[id,{col:p.row,row:p.col}])),columns:candidate.rows,rows:candidate.columns,vertical:!candidate.vertical})
  const measure=c=>{
    const nodeWidth=Math.max(80,Math.min(132,((viewport.width||432)-margin*2-gap*(c.columns-1))/c.columns))
    const width=c.columns*nodeWidth+(c.columns-1)*gap+margin*2,height=c.rows*nodeHeight+(c.rows-1)*gap+margin*2
    const fit=Math.min(1,(viewport.width||432)/width,(viewport.height||280)/height)
    return {...c,nodeWidth,width,height,fit}
  }
  const preferredVertical=direction==='vertical'
  const best=candidates.map(measure).sort((a,b)=>
    (a.fit>=.85&&b.fit>=.85 ? Number(b.vertical===preferredVertical)-Number(a.vertical===preferredVertical) : 0) || b.fit-a.fit)[0]
  return {nodes:nodes.map(n=>({...n,x:margin+best.positions.get(n.id).col*(best.nodeWidth+gap),y:margin+best.positions.get(n.id).row*(nodeHeight+gap)})),edges:links,nodeWidth:best.nodeWidth,nodeHeight,width:best.width,height:best.height,vertical:best.vertical}
}
