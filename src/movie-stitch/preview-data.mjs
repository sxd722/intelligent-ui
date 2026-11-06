// Explicit review-only fixture. Never used automatically when a real tool fails.
export const previewEnabled=new URLSearchParams(location.search).get('preview')==='controlled';
const titles=['夜航测试','森林测试','红月测试','漫游测试','雨城测试','日落测试','后补测试'];
const rows=titles.map((title,i)=>({id:String(101+i),title,year:'2024',rating:i===4?null:8-i*.2}));
export function previewTool(tool,input){let items=[];if(tool.endsWith('movie-hot'))items=rows;else if(tool.endsWith('top250'))items=[rows[2],rows[1]];else if(tool.endsWith('.subject')){const i=Number(input.id)-101;if(rows[i])items=[{...rows[i],type:'movie',genres:[i%2?'动作':'剧情'],duration:i===2?null:(i%2?140:95),directors:['测试导演'],casts:['测试演员'],summary:'这段介绍用于人工检查详情与返回交互，来自明确标记的工具替身，不代表真实电影。',assetRef:'qa-'+input.id}]};return{kind:'json',value:{items,source:'人工交互预览 · 测试数据',fetchedAt:new Date().toISOString()}}}
