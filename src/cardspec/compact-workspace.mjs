// Semantic, content-bounded adaptation of repeated interactive groups. No text
// matching and no DOM reparenting: React owns state, event handlers and focus.
export function workspaceColumns(kind,width,count,longest=0){
 if(!Number.isFinite(width)||width<1||count<3)return 1
 const minimum=kind==='cards'?(longest>36?108:78):kind==='actions'?(longest>100?160:116):76
 return Math.max(1,Math.min(kind==='cards'?5:kind==='actions'?2:6,count,Math.floor((width+6)/(minimum+6))))
}

export function compactWorkspace(root,columns=workspaceColumns){
 if(!root)return
 if(root.closest('[data-layout-density="comfortable"]')){
  for(const el of [root,...root.querySelectorAll('[data-host-workspace-group],[data-host-workspace-metrics],[data-host-workspace-panel]')])
   for(const name of ['data-host-workspace','data-host-workspace-group','data-host-workspace-columns','data-host-workspace-metrics','data-host-workspace-panel'])el.removeAttribute(name)
  return
 }
 const visible=e=>e.getBoundingClientRect().width>0
 const text=e=>(e.textContent||'').trim()
 const mark=(el,name,value)=>{if(el.getAttribute(name)!==String(value))el.setAttribute(name,String(value))}
 const matches=[]
 for(const group of root.querySelectorAll('div,section,ul')){
  if(group.closest('svg,table,[role="dialog"],[data-layout-density="comfortable"]')||!visible(group))continue
  const items=[...group.children].filter(visible)
  if(items.length<3||items.length>24)continue
  let kind
  if(items.every(e=>e.matches('button[draggable]')&&text(e).length<=70&&!e.querySelector('img,svg,canvas,input')))kind='cards'
  else if(items.length<=8&&items.every(e=>!e.matches('button')&&e.querySelector('strong,b,h3,h4')&&e.querySelector('button')&&e.querySelectorAll('button').length<=6&&text(e).length<=160&&!e.querySelector('input,textarea,select,table,svg,canvas,img,section')))kind='actions'
  else continue
  const width=group.clientWidth-parseFloat(getComputedStyle(group).paddingLeft||0)-parseFloat(getComputedStyle(group).paddingRight||0)
  const count=columns(kind,width,items.length,Math.max(...items.map(e=>text(e).length)))
  matches.push(group);mark(group,'data-host-workspace-group',kind);mark(group,'data-host-workspace-columns',count)
 }
 for(const old of root.querySelectorAll('[data-host-workspace-group]'))if(!matches.includes(old)){old.removeAttribute('data-host-workspace-group');old.removeAttribute('data-host-workspace-columns')}
 const workspace=matches.some(e=>e.dataset.hostWorkspaceGroup==='cards')&&matches.some(e=>e.dataset.hostWorkspaceGroup==='actions')
 mark(root,'data-host-workspace',workspace)
 const panels=new Set(workspace?matches.map(e=>e.closest('section')).filter(Boolean):[])
 // Pure short metrics within an action workspace can share a line per cell.
 for(const group of root.querySelectorAll('div')){
  const items=[...group.children]
  const metrics=workspace&&items.length>=3&&items.length<=8&&items.every(e=>e.children.length===2&&e.querySelector('strong')&&text(e).length<=24&&!e.querySelector('button,input,svg,canvas'))
  if(metrics){mark(group,'data-host-workspace-metrics',true);if(group.closest('section'))panels.add(group.closest('section'))}
  else if(group.hasAttribute('data-host-workspace-metrics'))group.removeAttribute('data-host-workspace-metrics')
 }
 for(const panel of panels)mark(panel,'data-host-workspace-panel',true)
 for(const panel of root.querySelectorAll('[data-host-workspace-panel]'))if(!panels.has(panel))panel.removeAttribute('data-host-workspace-panel')
}

export const COMPACT_WORKSPACE_CSS=`
[data-host-workspace-group]{display:grid!important;gap:6px!important;align-items:stretch!important;grid-template-columns:repeat(1,minmax(0,1fr))!important}
${[2,3,4,5,6].map(n=>`[data-host-workspace-columns="${n}"]{grid-template-columns:repeat(${n},minmax(0,1fr))!important}`).join('')}
[data-host-workspace-group]>*{min-width:0!important;overflow-wrap:anywhere}
[data-host-workspace-group=cards]>button{min-height:82px!important;height:auto!important;padding:5px!important;gap:3px!important;justify-content:center!important}
[data-host-workspace-group=cards]>button>span{font-size:22px!important}
[data-host-workspace-group=actions]>*{padding:8px!important;margin:0!important}
[data-host-workspace-group=actions]>*>div{flex-wrap:wrap!important;gap:4px!important}
[data-host-workspace-group=actions] button{min-height:36px;padding:6px 8px!important;max-width:100%;overflow-wrap:anywhere}
[data-host-workspace-group=actions]>*>button:last-child{min-height:40px;width:100%}
[data-host-workspace-group=actions]>*>div>span:only-child{padding:3px!important}
[data-host-workspace=true]>div{padding:8px!important}
[data-host-workspace-panel=true]{padding:8px!important;margin-top:8px!important;margin-bottom:8px!important}
[data-host-workspace-panel=true] p{margin-top:6px!important;margin-bottom:6px!important}
[data-host-workspace=true] [role=status]{padding:6px 8px;border-radius:4px;background:rgb(128 128 128 / .12);line-height:1.4}
[data-host-workspace-metrics]>div{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:4px!important;padding:5px 7px!important}
[data-host-workspace-metrics] strong{font-size:19px!important}
@media(pointer:coarse){[data-host-workspace-group=actions] button{min-height:44px}}
`
