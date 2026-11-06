import {createHash} from 'node:crypto'
import {TOOLS} from '../../shared/cardspec/tools.mjs'

// Source membership is host-maintained. One source may appear in several domains.
export const DOMAINS={life:['weather','travel','dining'],culture:['movies','reading','music','podcasts','games'],social:['social','news'],shopping:['shopping','cars'],knowledge:['learning','knowledge','language'],productivity:['notes','images'],finance:['finance'],search:['search']}
const LABELS={life:'生活与出行',culture:'影音与文化',social:'新闻与社区',shopping:'消费与汽车',knowledge:'学习与知识',productivity:'创作与效率',finance:'金融',search:'通用搜索',other:'其他'}
const eligible=t=>TOOLS[t.id]&&!t.unsupportedReason&&t.provider!=='host'&&t.id!=='glm.generate'
const source=t=>t.site||t.provider||'other'
const domains=t=>Object.entries(DOMAINS).filter(([,groups])=>groups.includes(t.group)).map(([id])=>id)
export function contractVersion(t){return createHash('sha256').update(JSON.stringify(["explicit-detail-v2",TOOLS[t.id]?.inputSchema,TOOLS[t.id]?.outputSchema,t.columns,t.fieldSemantics,t.detail])).digest('hex').slice(0,12)}
export function browseTools(catalog,{level='domains',domains:selected=[],sources=[],offset=0}={}){
 if(!['domains','sources','tools'].includes(level)||!Array.isArray(selected)||!Array.isArray(sources)||selected.length>4||sources.length>6)throw Error('Invalid discovery scope')
 if(selected.some(id=>!Object.hasOwn(LABELS,id)))throw Error('Unknown tool domain')
 const all=catalog.filter(eligible),known=new Set(all.map(source))
 if(sources.some(id=>!known.has(id)))throw Error('Unknown tool source')
 if(!Number.isInteger(offset)||offset<0)throw Error('Invalid discovery offset')
 const domainIds=t=>domains(t).length?domains(t):['other']
 const entries=all.filter(t=>(!selected.length||domainIds(t).some(d=>selected.includes(d)))&&(!sources.length||sources.includes(source(t))))
 const counts=list=>({count:list.length,available:list.filter(t=>t.available).length,readOnly:list.filter(t=>t.readOnly!==false).length})
 const version=createHash('sha256').update(JSON.stringify(all.map(t=>[t.id,t.group,source(t),contractVersion(t)]))).digest('hex').slice(0,12)
 if(level==='domains')return {version,domains:Object.entries(LABELS).map(([id,label])=>({id,label,...counts(all.filter(t=>domainIds(t).includes(id))),sources:[...new Set(all.filter(t=>domainIds(t).includes(id)).map(source))]})).filter(d=>d.count),next:'已知来源可直接level:"tools",sources:[id]；用途明确用query全局检索，无需逐层遍历'}
 if(level==='sources')return {version,sources:[...new Set(entries.map(source))].sort().map(id=>({id,...counts(entries.filter(t=>source(t)===id)),domains:[...new Set(entries.filter(t=>source(t)===id).flatMap(domainIds))]})),next:'选择来源后level:"tools"；query始终保留全局召回'}
 return {version,total:entries.length,offset,nextOffset:offset+24<entries.length?offset+24:null,tools:entries.slice(offset,offset+24).map(t=>({id:t.id,purpose:String(t.description||'').slice(0,160),available:!!t.available,readOnly:t.readOnly!==false,version:contractVersion(t)})),next:'cli_describe({ids:[...],knownVersions:{...}}) 按需批量展开；之后cli_read；更多命令用nextOffset或query检索'}
}
