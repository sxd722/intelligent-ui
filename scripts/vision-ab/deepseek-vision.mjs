import fs from 'node:fs/promises';import {createModelClient} from '../../server/research/model-client.mjs';import {loadApiKey} from '../../server/env.mjs';
const root='artifacts/deepseek-vision-20261104';await fs.mkdir(root,{recursive:true});
const prompt=`请仅依据附件图片输出可供UI实现使用的设计结构JSON，不输出代码。若看不到图片，明确返回{"imageAvailable":false}，不要猜测。
结构字段：imageAvailable；canvas（整图与卡片边界，坐标归一化0–100，以完整图片为基准）；regions（按从上到下顺序，每区id、role、bounds、children、可见视觉描述）；navigation（实际可见选项数量、逐项图标、选中项和选中标记）；detailLayout（文字与图片的左右关系）；style（颜色、材质、圆角、阴影、装饰）；interactionHypotheses（仅推测，不能从截图确认的行为）；uncertainties。
只描述可见信息，空白条不要当作真实文字、数据或进度值。说明关键对齐、比例、间距。不要虚构图片中不存在的按钮或内容。`;
const image={type:'image_url',image_url:{url:'data:image/jpeg;base64,'+(await fs.readFile('dist/vision-ab/greek-design.jpg')).toString('base64'),detail:'high'}};
const model='volcengine/deepseek-v4.1-flash',http=[];
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model,fetchImpl:async(url,args)=>{const r=await fetch(url,args);http.push({status:r.status,...(!r.ok?{error:(await r.clone().text()).slice(0,1600)}:{})});return r}});
const started=Date.now();let evidence={requestedModel:model,prompt,image:'dist/vision-ab/greek-design.jpg'};
try{const result=await round([{role:'user',content:[{type:'text',text:prompt},image]}],{maxTokens:3500,temperature:0,signal:AbortSignal.timeout(90000)});evidence={...evidence,model:result.model,answer:result.message.content,usage:result.usage};}catch(e){evidence.error=e.message}
Object.assign(evidence,{elapsedMs:Date.now()-started,http});await fs.writeFile(root+'/result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
