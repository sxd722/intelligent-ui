// Validated host art directions. Separate from legacy card.design (Atlas is paper).
export const BOARD_SKINS=Object.freeze({
 signal:{label:'信号台',background:'#0c1720',panel:'#152733',ink:'#eaf6f7',muted:'#9fb9c3',accent:'#4ce0cd',onAccent:'#092c2b',line:'#365160',font:'Inter, "Segoe UI", sans-serif'},
 editorial:{label:'编辑部',background:'#f4efe4',panel:'#e9e1d2',ink:'#28271f',muted:'#696353',accent:'#a94d27',onAccent:'#fff8ee',line:'#c9bea8',font:'Georgia, "Noto Serif SC", serif'},
 studio:{label:'光感工作室',background:'#eeebfa',panel:'#e0d9f0',ink:'#30294b',muted:'#716789',accent:'#6b52ad',onAccent:'#fff',line:'#c6bada',font:'Inter, "Segoe UI", sans-serif'},
 poster:{label:'海报剧场',background:'#1e1d21',panel:'#302e34',ink:'#fff6e7',muted:'#c3b9b4',accent:'#ff765f',onAccent:'#2f1715',line:'#5c4a48',font:'"Arial Black", "Microsoft YaHei", sans-serif'}
})
export function boardDesign(view={},props={}){
 const layout=props.layout&&props.layout!=='auto'?props.layout:view.mode==='map'?'map':view.mode==='feed'?'evidence':'decision'
 const skin=Object.hasOwn(BOARD_SKINS,props.skin)?props.skin:layout==='map'?'studio':layout==='evidence'||layout==='plan'?'editorial':layout==='detail'?'poster':'signal'
 return {layout,skin,tokens:Object.fromEntries(Object.entries(BOARD_SKINS[skin]).filter(([k])=>k!=='label').map(([k,v])=>['--board-'+k,v]))}
}
export const BOARD_DESIGN_GUIDE='静态推荐和异构多源任务用宿主task-board；已提供nativeDecision配方的工具使用tool-view，不重写each列表。构图layout=auto/map/decision/detail/evidence/compare/plan；材质skin=auto/signal(暗青网格)/editorial(纸面杂志)/studio(浅紫玻璃)/poster(粗字海报)，与旧card.design独立。task-board已有页头和导航，直接作卡片主体，不再外加title/caption/分页；宿主提供大图、筛选、多选、对比、详情返回和恢复，不重复搭导航。静态短例：<task-board label="探索" items={data.rows} skin="editorial"/>，rows每项{id,title,summary,detail,category,imageQuery}；imageQuery是简短英文素材检索词。筛选和详情内置，复杂筛选放settings。'
