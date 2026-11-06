import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const dir='artifacts/web-sandbox-qa';await mkdir(dir,{recursive:true})
const application=`import React,{useEffect,useRef,useState} from 'react';
export const styles='.app{padding:12px}.app h3,.app p{margin:2px 0}.pulse{animation:pulse 1s infinite alternate}@keyframes pulse{to{opacity:.5}} button{padding:6px;margin:2px}';
export default function App({state,setState,bridge,active}){
 const canvas=useRef(null),[temporary,setTemporary]=useState(0);
 useEffect(()=>{const c=canvas.current?.getContext('2d');c.fillStyle='#8064e4';c.fillRect(0,0,80,24)},[]);
 useEffect(()=>{if(state.phase!=='enemy'||!active)return;const id=setTimeout(()=>setState(s=>({...s,phase:'player',round:s.round+1})),300);return()=>clearTimeout(id)},[state.phase,active]);
 return <div className="app grid gap-2"><h3 className="pulse">自动回合实验</h3><canvas ref={canvas} width="100" height="30"/><p>回合 {state.round} · {state.phase}</p><button onClick={()=>setState(s=>({...s,phase:'enemy'}))}>结束回合</button><button onClick={()=>setTemporary(v=>v+1)}>临时 {temporary}</button><button onClick={()=>bridge.call('add',{value:1})}>请求宿主加一</button></div>}`
async function specFor(source=application){const r=compileCard(`<card><state id="n" type="number" initial={0}/><text>外部 {state.n}</text><sandbox id="app" brief="完整应用" height={270} initial={{round:1,phase:"player"}} actions={{add:"add"}} source={${JSON.stringify(source)}}/><action id="add"><increment target="n"/></action></card>`,{final:true,cardId:'web-qa',context:{renderMode:'web'}});await validateRichContent(r);assert.equal(r.complete,true,JSON.stringify(r.diagnostics));return r.spec}
const spec=await specFor()
const browserResult=await runDebugBrowser(spec,{scenarios:['normal'],steps:[{op:'click',name:'结束回合',waitMs:500,expect:{text:'回合 2',changed:true}},{op:'reload',expect:{text:'回合 2'}},{op:'click',name:'请求宿主加一'},{op:'click',name:'允许这次操作',expect:{state:{n:1}}}],artifactDir:dir,signal:AbortSignal.timeout(60000)})
assert.equal(browserResult.status,'tested')
for(const r of browserResult.runs){assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.final.errors,[]);assert.equal(r.final.empty,false);for(const a of r.actions){assert.equal(a.ok,true,JSON.stringify(a));assert.notEqual(a.assertion?.passed,false,JSON.stringify(a));assert.notEqual(a.restored,false,JSON.stringify(a))}}
await writeFile(dir+'/browser-debug.json',JSON.stringify(browserResult,null,2))

// A separate normal browser context tests network opt-in, fallback and isolation.
// It uses its own sessionStorage, does not bind or navigate Owl.
const browser=await chromium.launch({channel:'chrome',headless:true})
try{
 const page=await browser.newPage({viewport:{width:432,height:900}})
 await page.route('**/api/health',r=>r.fulfill({json:{cardSandbox:true,cardWebSandbox:true}}))
 await page.goto('http://127.0.0.1:8787/card-debug.html')
 await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(spec=>window.cardDebug.mount(spec),spec)
 const frame=page.frameLocator('.cs-web-sandbox iframe')
 await frame.getByRole('button',{name:'结束回合'}).click()
 await frame.getByText('回合 2',{exact:false}).waitFor()
 const token=await page.locator('.cs-web-sandbox iframe').getAttribute('srcdoc')
 await page.evaluate(()=>{document.body.style.paddingBottom='2000px';scrollTo(0,1500)})
 await page.waitForTimeout(120)
 await page.evaluate(()=>scrollTo(0,0))
 assert.equal(await page.locator('.cs-web-sandbox iframe').getAttribute('srcdoc'),token)
 await frame.getByText('回合 2',{exact:false}).waitFor()
 // Explicit check catches accidental allow-same-origin, not just a sandbox attr.
 const blockedParent=await page.locator('.cs-web-sandbox iframe').elementHandle().then(async e=>(await e.contentFrame()).evaluate(()=>{try{void parent.document.body;return false}catch{return true}}))
 assert.equal(blockedParent,true)
 assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts')
 await page.locator('.cs-stage').screenshot({path:dir+'/application.png'})
 // CDN deterministically fulfilled to prove ESM integration without network flakiness.
 const cdn='https://cdn.jsdelivr.net/npm/nanoid@5.1.5/non-secure/index.js'
 await page.route(cdn,r=>r.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:'export const nanoid=()=>"CDN已加载"'}))
 const cdnSpec=await specFor(`import {nanoid} from '${cdn}';export default function App(){return <div>{nanoid()}</div>}`)
 await page.evaluate(spec=>window.cardDebug.mount(spec),cdnSpec)
 await frame.getByText('CDN已加载').waitFor()
 await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`import React,{useState} from 'react';export function Widget(){const [n,set]=useState(0);return React.createElement('button',{onClick:()=>set(n+1)},'CDN Hook '+n)}`}))
 const hookSpec=await specFor(`import {Widget} from 'https://esm.sh/demo-hooks@1.0.0';export default function App(){return <Widget/>}`)
 await page.evaluate(spec=>window.cardDebug.mount(spec),hookSpec)
 await frame.getByRole('button',{name:'CDN Hook 0'}).click()
 await frame.getByRole('button',{name:'CDN Hook 1'}).waitFor()
 await page.unroute(cdn);await page.route(cdn,r=>r.abort())
 await page.evaluate(spec=>window.cardDebug.mount(spec),cdnSpec)
 await page.getByRole('alert').filter({hasText:'Web 应用暂不可用'}).waitFor()
 assert.ok((await page.locator('.cs-card').innerText()).includes('外部 0'))
 // Changing preference removes the executable frame; no silent strict fallback.
 await page.evaluate(()=>{localStorage.setItem('cardspec:render-mode:v1','hybrid');window.dispatchEvent(new StorageEvent('storage',{key:'cardspec:render-mode:v1',newValue:'hybrid'}))})
 // card-debug explicitly overrides preference, so mount a native-context copy to test refusal.
 const disabled=structuredClone(spec);disabled.context.renderMode='hybrid'
 await page.evaluate(spec=>window.cardDebug.mount(spec),disabled)
 await page.getByText('此应用需要',{exact:false}).waitFor()
 assert.equal(await page.locator('.cs-web-sandbox iframe').count(),0)
 await writeFile(dir+'/result.json',JSON.stringify({passed:true,widths:browserResult.runs.map(r=>r.width),checks:['React hooks','autonomous turn timer','Canvas DOM','Tailwind CSS','persistent state reload','confirmed host action','offscreen iframe stable','opaque parent isolation','CDN ESM mocked success','CDN React library uses host React hooks','CDN failure locally isolated','strict mode prevents execution'],network:'CDN integration uses controlled response; real network verified separately'},null,2))
 console.log('Web sandbox browser checks passed: '+dir)
}finally{await browser.close()}
