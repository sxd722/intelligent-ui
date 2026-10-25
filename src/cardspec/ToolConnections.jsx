import React,{useState} from 'react'
import './tool-card.css'
import {BROWSER_SITES} from '../../shared/cardspec/browser-sites.mjs'
export function ToolConnections(){
 const [open,setOpen]=useState(false),[status,setStatus]=useState(null),[tools,setTools]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[profile,setProfile]=useState(''),[query,setQuery]=useState(''),[notice,setNotice]=useState('')
 const refresh=async()=>{
  setBusy(true);setError('')
  try{const results=await Promise.all(['/api/tools/connections','/api/tools'].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error('连接状态读取失败');return r.json()}));setStatus(results[0]);setTools(results[1].tools);setProfile(results[0].browser.profile||'')}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const connect=async()=>{
  setBusy(true);setError('')
  try{const r=await fetch('/api/tools/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile})});const value=await r.json();if(!r.ok)throw new Error(value.error);await refresh()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const update=async(url,body,success)=>{
  setBusy(true);setError('');setNotice('')
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.error);await refresh();setNotice(value.message||success)}catch(e){await refresh();setError(e.message)}finally{setBusy(false)}
 }
 const disabled=new Set(status?.disabledTools||[])
 const toggle=(ids,enabled)=>{const next=new Set(disabled);for(const id of ids)enabled?next.delete(id):next.add(id);setStatus(current=>({...current,disabledTools:[...next]}));void update('/api/tools/configure',{disabledTools:[...next]},'能力配置已保存；新生成和已有卡片的后续调用立即生效。')}
 const entries=tools.filter(t=>t.provider==='opencli')
 const visible=entries.filter(t=>`${t.id} ${t.description}`.toLowerCase().includes(query.toLowerCase()))
 const sites=[...new Set(visible.map(t=>t.site||t.id.split('.')[1]))]
 return <div className="cs-connections">
  <button type="button" className="chip" onClick={()=>{setOpen(!open);if(!open)void refresh()}}>工具连接</button>
  {open&&<section className="cs-connections-panel" aria-label="工具连接设置">
   <div className="cs-connection-heading"><strong>工具与账号连接</strong><button type="button" onClick={()=>setOpen(false)}>关闭</button></div>
   {status?.environment==='cloud'?<div className="cs-connection-box"><strong>云端工具</strong><p>支持 GLM 生成后续页面和局部内容。AutoCLI / OpenCLI 需要本机运行时与浏览器连接，请在本地版本使用。</p></div>:<p>公开数据无需登录。私人数据使用所选浏览器中的网站账号，首次调用时验证登录。写操作会在卡片中单独确认。</p>}
   {status&&status.environment!=='cloud'&&<><div className="cs-connection-box"><strong>运行环境</strong><p>项目运行时 {status.version} · {status.installed?'已安装':status.reason}</p>
    {status.desktopApp?.installed?<p>检测到本机 OpenCLIApp · 内置 CLI {status.desktopApp.runtimeVersion} · 目录含 {status.desktopApp.commandCount} 项命令。当前卡片使用已验证的项目运行时 {status.version}。</p>:<p>尚未检测到标准安装位置的 OpenCLIApp；项目运行时仍可独立使用。</p>}
    {!!status.desktopApp?.skills?.length&&<p>已发现本机 {status.desktopApp.skills.length} 个 OpenCLI skills，作为配置和开发参考；它们不直接作为卡片工具执行。</p>}
    <small>桌面 App 负责环境管理；网页通过本机服务执行已接入的能力。登录与扩展权限仍需在浏览器完成。</small></div>
    <div className="cs-connection-box"><strong>浏览器连接</strong><p role="status">{status.browser.reason}</p>
    <a href="https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk" target="_blank" rel="noreferrer">在桌面 Chrome 安装 OpenCLI 扩展</a>
    <label>浏览器 profile <select aria-label="浏览器 profile" value={profile} onChange={e=>setProfile(e.target.value)}><option value="">自动选择唯一连接</option>{status.browser.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <button type="button" disabled={busy||!status.installed} onClick={connect}>连接浏览器</button>
    <div className="cs-connection-box"><strong>Owl：复用专用标签页</strong><p>打开测试页并在该页点击“绑定此测试页”。工具会在这张页面上导航，其他标签页保持不变。仅开放读取；所有浏览器调用排队执行。</p><a href="/opencli-probe.html" target="_blank" rel="noreferrer">打开 OpenCLI 连接测试</a><p>{status.browser.binding?.reason||'尚未绑定'}</p><button type="button" disabled={busy||!status.browser.binding?.bound} onClick={()=>void update('/api/tools/unbind',{},'已解除绑定')}>解除专用页绑定</button><small>服务器或浏览器桥接重启、执行超时后可能需要重新绑定；取消只读请求等待会保留连接。上方“连接浏览器”切回独立窗口模式。</small></div>
    <button type="button" disabled={busy||!(status.browser.connected??status.browser.ready)} onClick={()=>void update('/api/tools/diagnose',{},'检查完成')}>测试实际浏览器能力</button>
    <small>{status.browser.binding?.mode==='bound'?'测试只在已绑定页面执行常量表达式，不创建窗口。':'测试会创建并关闭一个独立空白自动化窗口，验证窗口、导航和脚本能力，不访问你的账号数据。'}</small>
    {status.browser.diagnostic&&<div className="cs-connection-diagnostic" role="status"><strong>{status.browser.diagnostic.ok?'实际操作通过':'实际操作未通过'}</strong><p>{status.browser.diagnostic.message}</p><small>{status.browser.diagnostic.error}</small><small>检查时间：{new Date(status.browser.diagnostic.checkedAt).toLocaleString()}</small></div>}</div>
    <details><summary>Spotify 授权</summary><p>{status.spotify?'已发现本项目的授权记录。':'尚未授权。先配置 Spotify 应用凭据，再完成浏览器授权。播放控制需要 Premium 和在线设备。'}</p><p>在项目私有目录 <code>.tools/opencli/1.8.6/profile/.opencli/spotify.env</code> 配置 SPOTIFY_CLIENT_ID、SPOTIFY_CLIENT_SECRET。回调地址为 http://127.0.0.1:8888/callback，然后在项目终端运行 <code>npm run tools:spotify-auth</code>。</p></details>
   </>}
   {status?.environment!=='cloud'&&<section className="cs-connection-box" aria-label="网站登录"><strong>网站登录</strong><p>在当前连接的同一浏览器中登录，完成后回到卡片手动重试。项目不接收密码、验证码或 Cookie。</p>{Object.entries(BROWSER_SITES).map(([id,site])=><p key={id}><a href={site.loginUrl} target="_blank" rel="noreferrer">打开{site.name}登录</a><small> · {entries.filter(t=>t.site===id).some(t=>t.health?.status==='healthy')?'已有工具读取成功':'尚未验证数据读取'}；登录成功不代表所有数据都可访问。</small></p>)}</section>}
   <button type="button" disabled={busy} onClick={refresh}>{busy?'检查中…':'刷新连接状态'}</button>
   {error&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   {status?.environment!=='cloud'&&<><p>{entries.length} 项 OpenCLI 能力 · 可调用 {entries.filter(t=>t.available).length} 项（不代表外部站点已实测通过）</p>
   <label>筛选能力<input aria-label="筛选能力" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="天气、Spotify、京东或工具 ID"/></label>
   <small>勾选表示允许卡片使用；未连接或实际测试失败的能力仍不可调用。配置保存在本机，停用不会撤销已经提交的外部操作。</small>
   {sites.map(site=>{const group=visible.filter(t=>(t.site||t.id.split('.')[1])===site),all=entries.filter(t=>(t.site||t.id.split('.')[1])===site),enabled=all.every(t=>!disabled.has(t.id));return <section className="cs-connection-group" key={site} aria-label={`${site} 能力`}><div className="cs-connection-heading"><strong>{site}</strong><button type="button" disabled={busy} onClick={()=>toggle(all.map(t=>t.id),!enabled)}>{enabled?'停用此站点':'启用此站点'}</button></div><ul>{group.map(t=><li key={t.id}><label className="cs-tool-toggle"><input type="checkbox" aria-label={`启用 ${t.id}`} checked={!disabled.has(t.id)} disabled={busy||!status} onChange={e=>toggle([t.id],e.target.checked)}/><span>{t.description}</span></label><small>{t.id} · {t.readOnly?'读取':'手动操作'} · {t.auth==='oauth'?'OAuth 授权':t.browser?'浏览器登录态':'公开接口'}{t.strategy?` · ${t.strategy}`:''}</small><small>{t.reason}</small><small>近期调用：{({unknown:"尚未验证",healthy:"最近成功",degraded:"最近异常",blocked:"访问受限"})[t.health?.status||"unknown"]}{t.health?.lastErrorCode?" · "+t.health.lastErrorCode:""}{t.health?.lastSuccessAt?" · 上次成功 "+new Date(t.health.lastSuccessAt).toLocaleString():""}</small></li>)}</ul></section>})}
   {!visible.length&&<p>没有匹配的能力。</p>}</>}
  </section>}
 </div>
}
