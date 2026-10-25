// One explicitly leased page per host. Never auto-bind on a model invocation.
export function createBoundBrowser(control) {
 let lease=null,enabled=false,tail=Promise.resolve(),closed=false
 const exclusive=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task}
 const invalidate=async()=>{const old=lease;lease=null;if(old)await control('unbind',old).catch(()=>{})}
 return {
  restore(saved){return exclusive(async()=>{
   if(closed||lease)throw Error('Cannot restore an active binding')
   enabled=true
   if(!saved||!saved.page||!saved.profile||!saved.session?.startsWith('cardspec-bound-')||!Number.isInteger(saved.daemonPid))throw Error('Invalid binding checkpoint')
   await control('check',saved)
   lease={...saved}
  })},
  status(bridge){
   if(lease&&(bridge.daemonPid!==lease.daemonPid||bridge.profile!==lease.profile))lease=null
   return {mode:enabled?'bound':'owned',bound:!!lease,...(lease?{session:lease.session,title:lease.title,url:lease.url}:{}),reason:lease?'专用标签页已绑定；浏览器读取串行执行':enabled?'请打开并选中连接测试页，然后重新绑定':'使用独立自动化窗口'}
  },
  bind(profile){return exclusive(async()=>{if(closed)throw Error('OpenCLI closed');enabled=true;await invalidate();lease=await control('bind',{profile});return {ok:true,message:'专用标签页已绑定；只读工具可复用该页，无需创建窗口。'}})},
  release(){return exclusive(async()=>{enabled=true;await invalidate();return {ok:true,message:'已解除绑定，页面保留；再次调用前请重新绑定。'}})},
  owned(){return exclusive(async()=>{await invalidate();enabled=false})},
  run(fn,signal){const expected=lease;return exclusive(async()=>{
   signal?.throwIfAborted()
   if(closed||!expected||lease!==expected)throw Error('专用标签页绑定已失效，请重新绑定')
   try{return await fn(expected)}catch(e){
    // The provider drains cancelled reads before releasing this queue. Only an
    // uncertain browser operation or a broken lease requires retiring the page.
    if(/bound_tab|stale page|绑定|daemon|profile|超时|取消|timeout|timed out|connection dropped|connection lost|disconnected|may (still |have )?complete/i.test(e.message))await invalidate()
    throw e
   }
  })},
  close(){closed=true;void exclusive(invalidate)}
 }
}
