import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const dir='artifacts/fifo-state-qa';await mkdir(dir,{recursive:true})
const source=await readFile('artifacts/generation-debug/0edb1620-1ec5-4364-abc9-6d8df1b30d65/ad2852be623834f1cad8/candidate.cardspec','utf8')
async function compile(source){const r=compileCard(source,{final:true,context:{renderMode:'web'}});await validateRichContent(r);assert(r.complete,JSON.stringify(r.diagnostics));return r.spec}
const spec=await compile(source),browser=await chromium.launch({channel:'chrome',headless:true}),results=[]
let currentPage
try{
 for(const width of [320,432]){
  const page=await browser.newPage({viewport:{width,height:850}})
  currentPage=page
  page.on('pageerror',e=>console.error('pageerror',e.message))
  page.on('console',m=>{if(m.type()==='error')console.error('console',m.text())})
  await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
  await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'auto',persistenceKey:'fifo-go'}),{spec,width})
  const frame=page.frameLocator('.cs-web-sandbox iframe')
  await page.locator('.cs-web-sandbox[data-sandbox-ready="true"]').waitFor()
  const cols='ABCDEFGHJKLMNOPQRST'
  for(let i=0;i<38;i++){await frame.getByRole('button',{name:'落子 '+cols[i%19]+(19-Math.floor(i/19)),exact:true}).click();await frame.getByText('手数 '+(i+1)+' ·',{exact:false}).waitFor()}
  await page.locator('[data-persistence-warning]').waitFor()
  assert.equal(await page.locator('.cs-web-sandbox iframe').count(),1)
  await page.screenshot({path:dir+`/go-${width}-38-moves.png`})
  // Wait for the debounced host snapshot, not an arbitrary fixed sleep.
  await page.waitForFunction(()=>Object.values(sessionStorage).some(v=>v.includes('"moves":38')))
  await page.reload();await page.waitForFunction(()=>!!window.cardDebug)
  await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'auto',restore:true,persistenceKey:'fifo-go'}),{spec,width})
  await frame.getByText('手数 38 ·',{exact:false}).waitFor()
  await frame.getByRole('button',{name:'悔棋',exact:true}).click();await frame.getByText('手数 37 ·',{exact:false}).waitFor()
  await page.screenshot({path:dir+`/go-${width}-restored-undo.png`})
  await frame.getByRole('button',{name:'重开',exact:true}).click();await frame.getByText('手数 0 ·',{exact:false}).waitFor()
  results.push({width,continuousMoves:38,restoredMoves:38,undoMoves:37,resetMoves:0,iframeRetained:true})
  // Cross-domain: untrimmable current records must not remove the frame, and a
  // subsequent valid transaction must still work.
  const editor=await compile('<card><sandbox id="editor" brief="编辑" initial={{n:0}} source={`export default function App({state,setState}){return <div><p>计数 {state.n}</p><button onClick={()=>setState({n:state.n,records:Array(5000).fill(1)})}>超大记录</button><button onClick={()=>setState({n:state.n+1})}>继续编辑</button></div>}`} /></card>')
  await page.evaluate(spec=>window.cardDebug.mount(spec,{size:'auto'}),editor)
  await frame.getByRole('button',{name:'超大记录',exact:true}).click();await page.locator('[data-persistence-warning]').waitFor()
  assert.equal(await page.locator('.cs-web-sandbox iframe').count(),1)
  await frame.getByRole('button',{name:'继续编辑',exact:true}).click();await frame.getByText('计数 1',{exact:true}).waitFor()
  await page.screenshot({path:dir+`/editor-${width}-recovery.png`})
  results.at(-1).untrimmableRecovery=true;await page.close()
 }
 await writeFile(dir+'/result.json',JSON.stringify({passed:true,results,note:'Isolated browser; no model calls, no CLI/Owl session changes. Game rules beyond the exercised moves are not fully validated.'},null,2))
 console.log(JSON.stringify(results))
}catch(e){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:dir+'/failure.png'});console.error(await currentPage.locator('body').innerText());for(const f of currentPage.frames().slice(1))console.error(await f.locator('body').innerText())}throw e}finally{await browser.close()}
