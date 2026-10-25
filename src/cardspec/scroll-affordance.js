// Keep native scrolling, dragging and keyboard behavior. This layer only
// describes overflow/activity for CSS; it never intercepts wheel or touch.
const targets='.cs-card,.cs-template-scroll,.cs-region-body,.cs-carousel-track,.cs-slide,.cs-diagram-pan,.cs-chart-pan,.cs-widget-caption,.cs-segmented,.cs-table-pan,.cs-code-block,.cs-math,.cs-mermaid-pan,.cs-dialog,.cs-popover,textarea'
export function attachScrollAffordances(root) {
  if(!root)return()=>{}
  const records=new Map()
  let frame=0,disposed=false
  const set=(el,key,value)=>{const text=String(value);if(el.dataset[key]!==text)el.dataset[key]=text}
  function reveal(el,record) {
    set(el,'scrollActive',true);clearTimeout(record.timer)
    record.timer=setTimeout(()=>set(el,'scrollActive',false),1100)
  }
  function measure(el,record) {
    const style=getComputedStyle(el),visible=el.getClientRects().length>0
    const y=visible&&/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+2
    const x=visible&&/auto|scroll/.test(style.overflowX)&&el.scrollWidth>el.clientWidth+2
    set(el,'scrollY',y);set(el,'scrollX',x)
    set(el,'scrollTopMore',y&&el.scrollTop>2)
    set(el,'scrollBottomMore',y&&el.scrollTop+el.clientHeight<el.scrollHeight-2)
    // CSS scrollLeft is negative in RTL. Use distance from the right edge.
    const position=style.direction==='rtl'?el.scrollWidth-el.clientWidth+el.scrollLeft:el.scrollLeft
    set(el,'scrollLeftMore',x&&position>2)
    set(el,'scrollRightMore',x&&position+el.clientWidth<el.scrollWidth-2)
    if((x||y)&&!record.overflow)reveal(el,record)
    record.overflow=x||y
  }
  function flush() {
    frame=0;if(disposed)return
    const present=new Set(root.querySelectorAll(targets))
    for(const [el,r] of records)if(!present.has(el)) {r.destroy();records.delete(el)}
    for(const el of present) {
      let record=records.get(el)
      if(!record) {
        record={timer:0,overflow:false}
        const onScroll=()=>{reveal(el,record);schedule()}
        el.addEventListener('scroll',onScroll,{passive:true})
        resize.observe(el)
        set(el,'scrollManaged',true)
        record.destroy=()=>{clearTimeout(record.timer);resize.unobserve(el);el.removeEventListener('scroll',onScroll);for(const key of ['scrollManaged','scrollActive','scrollY','scrollX','scrollTopMore','scrollBottomMore','scrollLeftMore','scrollRightMore'])delete el.dataset[key]}
        records.set(el,record)
      }
      measure(el,record)
    }
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(flush)}
  const resize=new ResizeObserver(schedule),mutation=new MutationObserver(changes=>{
    // Layout fitting writes tokens on the stage. Ignore those writes, but track
    // inner geometry changes such as diagram zoom and expanded content.
    if(changes.some(change=>change.attributeName!=='style'||change.target!==root))schedule()
  })
  resize.observe(root)
  mutation.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','open','hidden','class','data-overflow','data-auto-overflow','data-emergency','data-content-height']})
  root.addEventListener('load',schedule,true)
  // Opening a top-layer popover/dialog can change overflow without changing text.
  root.addEventListener('toggle',schedule,true)
  document.fonts?.ready.then(schedule)
  flush()
  return()=>{disposed=true;cancelAnimationFrame(frame);mutation.disconnect();resize.disconnect();root.removeEventListener('load',schedule,true);root.removeEventListener('toggle',schedule,true);records.forEach(r=>r.destroy());records.clear()}
}
