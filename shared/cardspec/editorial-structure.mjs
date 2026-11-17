// Group only adjacent content. Never reorder, summarize, or duplicate a node.
export function editorialGroups(kinds){
 const groups=[];let current=null
 for(const [index,kind] of kinds.entries()){
  if(kind==='title'||kind==='strong'||!current||!['text','caption','facts','image','region'].includes(kind)){
   current=[];groups.push(current)
  }
  current.push(index)
  if(['box','stack','grid','row','list','collection','segmented'].includes(kind))current=null
 }
 return groups
}
export function disclosureTitle(label,parts=[]){
 if(typeof label==='string'&&label.trim())return label.trim()
 return parts.find(p=>['title','strong'].includes(p.kind)&&p.text?.trim())?.text?.trim()||'查看详情'
}
