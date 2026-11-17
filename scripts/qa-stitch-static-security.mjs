import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {renderStitchMock} from '../server/stitch-static-mock.mjs'
let requests=0
const server=createServer((req,res)=>{requests++;res.end('unexpected')})
await new Promise(ok=>server.listen(0,'127.0.0.1',ok))
const url='http://127.0.0.1:'+server.address().port
try{
 const html=`<html><head><style>body{margin:0}</style></head><body><div data-stitch-card style="width:432px;height:432px"><div data-tool-id="weather.allowed made.up" style="height:100px">Weather</div><img src="${url}/private"><script>document.body.innerHTML='SCRIPT EXECUTED';fetch('${url}/script')</script><iframe src="${url}/frame"></iframe></div></body></html>`
 const result=await renderStitchMock(html,{width:432,tools:['weather.allowed'],output:'artifacts/stitch-comparison-qa/security.png'})
 assert.equal(requests,0);assert.equal(result.width,432);assert.equal(result.height,432);assert.equal(result.regions.length,1);assert.deepEqual(result.regions[0].ids,['weather.allowed'])
 await fs.writeFile('artifacts/stitch-comparison-qa/security.json',JSON.stringify({scriptPrevented:true,remoteRequests:requests,allowlistedToolRegions:true,result},null,2))
 console.log('Static mock: scripts and network blocked; known tool mapping retained')
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok))}
