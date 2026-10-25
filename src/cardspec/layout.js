import {auditLayout} from './layout-audit.js'
// General finite layout candidates, driven by actual content and flexible regions.
// Calendar is one intrinsic component; no news/date-specific layout branch exists.
export function attachLayout(stage, onLayout) {
  if (!stage) return () => {}
  let frame = 0, last = '', disposed = false
  let minimumCandidate = 0, lastWidth = 0
  const candidates = [
    { name: 'natural', padding: 12, space: 8, cell: 44 },
    { name: 'compact', padding: 10, space: 6, cell: 40 },
    { name: 'dense', padding: 8, space: 4, cell: 36 },
    { name: 'minimum', padding: 8, space: 4, cell: 32 },
  ]
  function fit() {
    if (disposed || !stage.clientHeight) return
    const card = stage.querySelector('.cs-card')
    if (!card) return
    if(stage.dataset.compositionVersion==='2'||stage.dataset.cardSize==='auto'||stage.dataset.layoutTemplate&&stage.dataset.layoutTemplate!=='default'){
      minimumCandidate=0
      for(const region of card.querySelectorAll('[data-auto-overflow]')){
        delete region.dataset.autoOverflow
        if(!region.dataset.overflow)region.querySelector('.cs-region-body')?.removeAttribute('tabindex')
      }
      card.dataset.emergency='false'
      for(const [key,value] of Object.entries({'--cs-padding':'12px','--cs-space-normal':'8px','--cs-space-tight':'4px','--cs-space-loose':'12px','--cs-calendar-cell':'44px','--cs-calendar-gap':'2px','--cs-hero-height':`${Math.max(64,Math.round(stage.clientWidth*.19))}px`}))stage.style.setProperty(key,value)
      // Template body scrolling is deliberate, but outer overflow must remain
      // observable (for example, an unusually long required heading).
      const outerOverflow=stage.dataset.cardSize==='square'?Math.max(0,card.scrollHeight-card.clientHeight):0
      card.dataset.emergency=outerOverflow>1?'true':'false'
      const audit=auditLayout(card)
      stage.dataset.csDensity='natural';stage.dataset.csFit=audit.pass?'fit':'overflow'
      const detail={size:stage.dataset.cardSize,template:stage.dataset.layoutTemplate,density:'natural',available:card.clientHeight,demand:card.scrollHeight,overflow:Math.max(outerOverflow,audit.innerOverflow),outerOverflow,emergencyScroll:outerOverflow>1,automaticScrollRegions:[],accessoryIds:[],...audit}
      const json=JSON.stringify(detail)
      if(json!==last){last=json;onLayout?.(detail);stage.dispatchEvent(new CustomEvent('cardspec-layout',{bubbles:true,detail}))}
      return
    }
    if (lastWidth !== stage.clientWidth || !stage.dataset.streaming) minimumCandidate = 0
    lastWidth = stage.clientWidth
    let chosen = candidates.at(-1), overflow = 0, chosenIndex = candidates.length - 1
    for (const region of card.querySelectorAll('[data-auto-overflow]')) {
      delete region.dataset.autoOverflow
      if (!region.dataset.overflow) region.querySelector('.cs-region-body')?.removeAttribute('tabindex')
    }
    card.dataset.emergency = 'false'
    for (let index = minimumCandidate; index < candidates.length; index++) {
      const c = candidates[index]
      // Measure the typography/controls of this candidate, not the previous
      // frame's density. Otherwise a CSS density change can oscillate fit/scroll.
      stage.dataset.csDensity = c.name
      stage.style.setProperty('--cs-padding', `${c.padding}px`)
      stage.style.setProperty('--cs-space-normal', `${c.space}px`)
      stage.style.setProperty('--cs-space-tight', `${Math.max(2, c.space / 2)}px`)
      stage.style.setProperty('--cs-space-loose', `${c.space + 4}px`)
      stage.style.setProperty('--cs-calendar-cell', `${c.cell}px`)
      stage.style.setProperty('--cs-calendar-gap', c.cell <= 36 ? '1px' : '2px')
      stage.style.setProperty('--cs-hero-height', `${Math.max(64, Math.round(stage.clientHeight * (c.name === 'natural' ? .19 : .15)))}px`)
      overflow = card.scrollHeight - card.clientHeight
      if (overflow <= 1) { chosen = c; chosenIndex = index; break }
    }
    if (stage.dataset.streaming) minimumCandidate = chosenIndex
    // A content region is semantically eligible for local overflow even when
    // the author omitted a policy. Keep intrinsic selection grids visible.
    const automaticScrollRegions = []
    if (overflow > 1) {
      const regions = [...card.children].filter((el) => el.matches('.cs-region[data-role=content]:not([data-overflow])') && !el.querySelector('.cs-calendar,.cs-carousel'))
        .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)
      for (const region of regions) {
        region.dataset.autoOverflow = 'scroll'
        region.querySelector('.cs-region-body')?.setAttribute('tabindex', '0')
        automaticScrollRegions.push(region.dataset.csNode)
        overflow = card.scrollHeight - card.clientHeight
        if (overflow <= 1) break
      }
    }
    // Plain footnotes may sit immediately below the square, like intro/outro.
    // Never move controls, titles, or the caption inside a content region.
    const accessoryIds = overflow > 1 ? [...card.children].filter((el) => {
      if (el.matches('.cs-caption')) return true
      if (!el.matches('.cs-region[data-role=summary]')) return false
      const children = [...(el.querySelector('.cs-region-body')?.children || [])]
      return children.length > 0 && children.every((child) => child.matches('.cs-caption'))
    }).filter((el) => !el.querySelector('button,input,textarea,a,select')).map((el) => el.dataset.csNode?.slice(1)).filter(Boolean) : []
    // Fallback keeps content reachable and is observable. Generation QA treats it
    // as a layout failure; never silently clip required information or shrink type.
    card.dataset.emergency = overflow > 1 ? 'true' : 'false'
    stage.dataset.csDensity = chosen.name
    stage.dataset.csFit = overflow > 1 ? 'overflow' : 'fit'
    const audit=auditLayout(card)
    const detail = { density: chosen.name, available: card.clientHeight, demand: card.scrollHeight, overflow: Math.max(0, overflow,audit.innerOverflow), outerOverflow:Math.max(0,overflow), emergencyScroll: overflow > 1, automaticScrollRegions, accessoryIds,...audit }
    stage.dataset.csFit=audit.pass?'fit':'overflow'
    const json = JSON.stringify(detail)
    if (json !== last) { last = json; onLayout?.(detail); stage.dispatchEvent(new CustomEvent('cardspec-layout', { bubbles: true, detail })) }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; fit() }) }
  const observer = new ResizeObserver(schedule); observer.observe(stage)
  const card=stage.querySelector('.cs-card');if(card)observer.observe(card)
  const mutation = new MutationObserver(schedule)
  mutation.observe(stage, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-loaded', 'data-weeks', 'data-selected', 'data-streaming', 'data-content-height','data-card-size','data-composition','data-compose-role','data-design','data-visual-style','data-material-version','data-layout-template'] })
  document.fonts?.ready.then(schedule)
  stage.addEventListener('scroll',schedule,true)
  stage.addEventListener('input',schedule,true)
  stage.addEventListener('cardspec-sandbox-layout',schedule)
  schedule()
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect();stage.removeEventListener('scroll',schedule,true);stage.removeEventListener('input',schedule,true);stage.removeEventListener('cardspec-sandbox-layout',schedule) }
}
