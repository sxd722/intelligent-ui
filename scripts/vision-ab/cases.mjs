import fs from 'node:fs/promises';
export const ROOT='artifacts/vision-ab-20261103',DEST='dist/vision-ab';
export const cases=[];
for(const [name,id] of [['greek','9e80a8e0-4279-44d0-870c-a6b1d1f12ae2'],['cthulhu','9d92c2a0-bac1-4f90-8843-3ed1181dab6b'],['antarctic','6dc4f140-3ce4-4e7c-8839-2d09f5a80752']]){
 const r=JSON.parse(await fs.readFile('artifacts/rsi-adaptive/runs/'+id+'.json'));
 for(const directImage of [false,true])cases.push({id:name+'-'+(directImage?'on':'off'),title:name+' · '+(directImage?'直传':'摘要'),prompt:r.goal,requirements:['布局还原','真实图片','核心交互与恢复'],modelProfile:'default',directImage,renderMode:'native'});
}
