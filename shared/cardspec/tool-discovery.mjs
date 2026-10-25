import {TOOLS,selectToolIds} from './tools.mjs'

const areas={workflow:'数据组合与样本分析',weather:'天气气温',travel:'出行旅行住宿车票',movies:'电影影视',reading:'读书书架',shopping:'购物比价',music:'音乐播放控制',images:'图片处理',dining:'饭店美食',learning:'视频与问答学习',notes:'笔记整理',social:'社交内容',podcasts:'播客音频',knowledge:'百科知识',language:'词典语言',games:'游戏桌游棋类',cars:'汽车新能源',finance:'财经行情',news:'新闻资讯',search:'网页检索'}
// The runtime catalog, not an independent adapter list, is the source of IDs,
// availability and descriptions. A directory entry is not execution permission.
export function toolDiscoveryReference(catalog,goal='',{compact=false}={}){
  const preferred=new Set(selectToolIds(catalog.filter(t=>t.available).map(t=>t.id),goal))
  const groups=new Map()
  for(const t of catalog){
    if(!TOOLS[t.id]||t.unsupportedReason)continue
    const site=t.provider==='host'?t.id.split('.').slice(0,-1).join('.'):t.site||t.id.split('.').slice(0,-1).join('.')
    const group=groups.get(site)||{prefix:t.provider==='opencli'?'opencli.'+t.site+'.':site+'.',area:areas[t.group]||'生成或资讯',ready:[],unavailable:[]}
    const item={command:t.provider==='host'?t.id.split('.').at(-1):t.command||t.id.split('.').at(-1),purpose:t.description?.slice(0,40),...(t.readOnly===false?{write:true}:{}),...(t.available?{}:{reason:String(t.reason||'尚未连接').slice(0,48)})}
    group[t.available?'ready':'unavailable'].push(item);groups.set(site,group)
  }
  const ordered=[...groups.values()].sort((a,b)=>Number(b.ready.some(t=>preferred.has(b.prefix+t.command)))-Number(a.ready.some(t=>preferred.has(a.prefix+t.command)))||a.area.localeCompare(b.area)||a.prefix.localeCompare(b.prefix))
  if(compact)return '【工具速查】ID=prefix+command；ready仅表示允许调用，不保证查询成功；off不可执行。用途查找用capability_find，参数/输出用cli_describe，不猜ID或字段。\n'+ordered.map(g=>`${g.area} ${g.prefix} ready:${g.ready.map(t=>t.command+(t.write?'[写]':'')).join(',')||'-'}${g.unavailable.length?' off:'+g.unavailable.map(t=>t.command).join(','):''}`).join('\n')
  const compactJson=(level)=>JSON.stringify(ordered.map(g=>({...g,ready:g.ready.map(t=>[t.command,...(level?[]:[t.purpose]),...(t.write?['需确认写操作']:[])]),unavailable:g.unavailable.map(t=>[t.command,level>1?'需连接或启用':t.reason])})))
  let index=compactJson(0);if(index.length>14000)index=compactJson(1);if(index.length>14000)index=compactJson(2)
  return `【能力地图】这是宿主已接入的能力索引，ID=prefix+command。ready仅表示当前允许调用，不保证来源成功；unavailable是已接入但目前不能调用，应说明连接/启用条件，不能称为不存在。不把本轮展开的少数工具当成全部能力。没有索引项的能力不编造。优先匹配用户用途，静态任务可不用工具。写操作需独立用户动作及宿主确认。\n${index}\n目录只用于发现；参数以展开契约为准。规划在现有信息/规则字段里注明选中的完整工具ID和用途，不新增规划字段、不输出工具源码。`
}
export function expandedToolIds(catalog,goal,documents=[]){
  const allowed=catalog.filter(t=>t.available&&!t.unsupportedReason).map(t=>t.id)
  const text=documents.map(d=>JSON.stringify(d)).join('\n').slice(0,20000)
  const explicit=allowed.filter(id=>text.includes(id))
  const ranked=selectToolIds(allowed,`${goal}\n${text}`)
  const selected=[];let budget=22000,openCount=0
  for(const id of new Set([...explicit,...ranked])){
    const t=TOOLS[id],size=JSON.stringify(t).length
    if(t.provider==='opencli'&&(openCount>=18||size>budget))continue
    selected.push(id);if(t.provider==='opencli'){openCount++;budget-=size}
  }
  return selected
}
export function requestedToolContracts(source,catalog){
  const ids=[...String(source).matchAll(/<binding\b[^>]*\btool\s*=\s*["']([^"']+)["']/g)].map(m=>m[1])
  const selected=catalog.filter(t=>ids.includes(t.id)&&t.available&&!t.unsupportedReason).slice(0,4)
  return selected.length?'\n宿主补充实际所选工具的完整契约（修复参数与结果字段，不要改成无关工具）：'+JSON.stringify(selected.map(t=>({id:t.id,input:TOOLS[t.id].inputSchema,columns:[...(t.columns||[]),...(t.additionalFields||[])],output:TOOLS[t.id].outputSchema,readOnly:t.readOnly}))):''
}
