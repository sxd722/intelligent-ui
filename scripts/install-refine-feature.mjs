import fs from 'node:fs'
const cloud=process.argv.includes('--cloud'),root=cloud?'sites/intelligent-ui/':''
const edit=(path,fn)=>{const before=fs.readFileSync(path,'utf8'),after=fn(before);if(before===after)throw Error('No edit: '+path);fs.writeFileSync(path,after)}
const app=root+(cloud?'ui/src/':'src/')
if(cloud){for(const name of ['src/PromptComposer.jsx','server/cardspec/refine-prompt.mjs'])fs.copyFileSync(name,root+(name.startsWith('src/')?'ui/':'')+name)}
edit(app+'App.jsx',s=>{
 s="import PromptComposer from './PromptComposer.jsx'\n"+s
 s=s.replace("const [input, setInput] = useState('')","const [input, setInputValue] = useState('')\n  const [draftRevision,setDraftRevision]=useState(0)\n  const setInput=useCallback(value=>{setInputValue(value);setDraftRevision(n=>n+1)},[])")
 const start=s.indexOf('          <div className="composer-inner">'),end=s.indexOf('        </footer>',start)
 if(start<0||end<0)throw Error('composer missing')
 return s.slice(0,start)+'          <PromptComposer key={draftRevision} input={input} onChange={setInputValue} onGenerate={send} streaming={streaming} onStop={()=>abortRef.current?.abort()} modelProfile={modelProfile} cardSize={cardSize} renderMode={renderMode}/>\n'+s.slice(end)
})
if(!cloud){
 edit('server/index.mjs',s=>"import {handleRefineRequest} from './cardspec/refine-prompt.mjs'\n"+s.replace("'/api/chat': 'POST'","'/api/chat': 'POST', '/api/refine-prompt':'POST'").replace("    if (url.pathname === '/api/chat' && req.method === 'POST') {","    if(url.pathname==='/api/refine-prompt'){\n      if(req.headers.origin && req.headers.origin !== `${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`){res.writeHead(403).end();return}\n      await handleRefineRequest(req,res,{readBody,streamUpstream});return\n    }\n    if (url.pathname === '/api/chat' && req.method === 'POST') {"))
}else{
 edit(root+'server/engine.mjs',s=>"import {refinePrompt} from './cardspec/refine-prompt.mjs'\n"+s.replace('return {handleChat,placeholderSvg,toolService}','return {handleChat,placeholderSvg,toolService,refinePrompt:(payload,signal)=>refinePrompt(payload,{streamUpstream,signal})}'))
 edit(root+'server/web-adapter.mjs',s=>s.replace("'/api/chat': 'POST'","'/api/chat': 'POST', '/api/refine-prompt':'POST'").replace('  const engine=currentEngine(env,url.origin,fetchImpl,photo)','  const engine=currentEngine(env,url.origin,fetchImpl,photo)\n  if(url.pathname===\'/api/refine-prompt\'){\n    try {const payload=JSON.parse(await readLimitedBody(request));return json(await engine.refinePrompt(payload,request.signal),200,{\'Cache-Control\':\'no-store\'})}\n    catch(e){return json({error:e.statusCode?e.message:\'需求提炼暂不可用，原始输入已保留，请重试\'},e.statusCode||502)}\n  }'))
}
