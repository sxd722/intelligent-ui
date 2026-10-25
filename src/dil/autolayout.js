// Auto-layout engine — the host runtime's sizing authority.
//
// The MODEL never emits sizes. For a card mounted in a square .dil-stage this
// engine derives component dimensions from:
//   - the canvas (stage side)
//   - content (chip text length, row text length)
//   - sibling counts (carousel items, chips, list rows)
// and re-fits while the DSL streams in (MutationObserver) or when the stage
// resizes (ResizeObserver). Overflow is absorbed in priority stages:
// spacing first, media sizes second, type scale last.

// Priority-ordered squeeze: media yields first, then rhythm, then controls.
// Type scale moves ONLY in discrete density steps — continuous shrink flattens
// hierarchy (the "cheap" look); discrete tiers keep it deliberate.
const SQUEEZE_STAGES = [
  { hero: 0.78 },
  { carH: 0.84 },
  { spacing: 0.8 },
  { hero: 0.85, carH: 0.85 },
  { spacing: 0.8 },
  { radioH: 0.85 },
]

// density ladder: [label, fontScale] — steps down only at real pressure
const DENSITY_STEPS = [
  ['natural', 1.0],
  ['compact', 0.92],
  ['dense', 0.84],
  ['floor', 0.78],
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function attachAutoLayout(stage) {
  if (!stage) return () => {}

  let raf = 0
  let timer = 0
  let appliedScale = 1 // monotone floor while streaming (anti oscillation)

  function fit() {
    const unlimited=stage.dataset.cardSize==='auto'
    const S = unlimited?stage.clientWidth:Math.min(stage.clientWidth, stage.clientHeight)
    if (!S || S < 100) return
    const card = stage.querySelector('.dil-card')
    if (!card) return
    const streaming = card.classList.contains('dil-card--streaming')

    const chips = [...stage.querySelectorAll("[data-d-component='chip']")]
    // clones extend the track but must not change the density budget
    const carItems = stage.querySelectorAll(
      "[data-d-component='carousel-item']:not([data-clone])"
    ).length
    const rows = stage.querySelectorAll(
      "[data-d-component='list-item'], [data-d-component='checkbox-row']"
    ).length
    const hasCarousel = carItems > 0
    const hasChips = chips.length > 0
    const chipText = chips.reduce((a, c) => a + (c.textContent || '').length, 0)

    // ---- base rhythm ----
    const base = {
      spacing: S * 0.0095, // ~4.1px at 432px — matches the default token
      fontScale: 1,
      heroH: S * (rows >= 4 ? 0.15 : 0.19), // flat full-bleed banner
      carW: hasCarousel ? S * (carItems <= 2 ? 0.74 : carItems === 3 ? 0.58 : 0.46) : 0,
      carH: hasCarousel ? S * (carItems <= 2 ? 0.24 : 0.205) * (rows >= 4 ? 0.84 : 1) : 0,
      chipCol: clamp(S / 3.4, 60, S / 2),
      chipFs: 0,
      radioH: S * 0.07,
      radioFs: (S / 38),
      dot: S * 0.016,
    }
    if (hasChips) {
      const fs = (S / 33) * clamp(1 - (chipText - 8) / 42, 0.7, 1)
      base.chipFs = fs
      base.chipPx = fs * 0.7
      base.chipPy = fs * 0.42
      base.chipGap = fs * 0.55
    }

    const f = { spacing: 1, fontScale: 1, carH: 1, radioH: 1, hero: 1, thumbGap: 1 }
    const apply = () => {
      const s = stage.style
      s.setProperty('--spacing', `${(base.spacing * f.spacing).toFixed(2)}px`)
      s.setProperty('--font-scale', f.fontScale.toFixed(3))
      s.setProperty('--al-side', `${S}px`)
      // hero couples to font-scale only at half power and never flattens below 64px
      s.setProperty('--u-hero-h', `${Math.max(64, base.heroH * f.hero * Math.sqrt(f.fontScale)).toFixed(1)}px`)
      if (hasCarousel) {
        s.setProperty('--u-car-w', `${(base.carW * f.fontScale).toFixed(1)}px`)
        s.setProperty('--u-car-h', `${(base.carH * f.carH).toFixed(1)}px`)
        s.setProperty('--u-gap', `${(S * 0.022 * f.spacing).toFixed(1)}px`)
      }
      if (hasChips) {
        s.setProperty('--u-chip-col', `${(base.chipCol * f.fontScale).toFixed(1)}px`)
        s.setProperty('--u-chip-fs', `${(base.chipFs * f.fontScale).toFixed(2)}px`)
        s.setProperty('--u-chip-px', `${(base.chipPx * f.fontScale).toFixed(2)}px`)
        s.setProperty('--u-chip-py', `${(base.chipPy * f.fontScale).toFixed(2)}px`)
        s.setProperty('--u-chip-gap', `${(base.chipGap * f.spacing).toFixed(2)}px`)
      }
      s.setProperty('--u-radio-h', `${(base.radioH * f.radioH).toFixed(1)}px`)
      s.setProperty('--u-radio-fs', `${(base.radioFs * f.fontScale).toFixed(2)}px`)
      s.setProperty('--u-dot', `${base.dot.toFixed(1)}px`)
    }

    if(unlimited){
      appliedScale=1;apply();stage.classList.remove('al-measuring','al-scroll')
      stage.dataset.alDensity='natural';stage.dataset.alFit='1.00'
      return
    }
    // measurement pass: freeze flex shrink so scrollHeight reflects real demand
    stage.classList.add('al-measuring')
    const over = () => card.scrollHeight - card.clientHeight - 1
    apply()

    // 1) priority-ordered structural squeeze (media → rhythm → controls)
    for (const st of SQUEEZE_STAGES) {
      if (over() <= 0) break
      for (const [k, m] of Object.entries(st)) f[k] *= m
      apply()
    }

    // 2) discrete density ladder — smallest step that fits
    let [label, scale] = DENSITY_STEPS[0]
    for (const [l, sc] of DENSITY_STEPS) {
      f.fontScale = sc
      apply()
      ;[label, scale] = [l, sc]
      if (over() <= 0) break
    }
    // streaming monotonicity: mid-stream program replacements must never
    // relax the density tier (grow-shrink oscillation = the glitchy feel)
    if (streaming && scale > appliedScale) {
      ;[label, scale] = DENSITY_STEPS.find(([, sc]) => sc === appliedScale) ?? DENSITY_STEPS[0]
      f.fontScale = scale
      apply()
    }
    appliedScale = scale

    stage.classList.remove('al-measuring')
    apply()
    stage.dataset.alDensity = label
    stage.dataset.alFit = scale.toFixed(2)

    // graceful give-up: content that still doesn't fit scrolls inside the square
    // (engine marks it; CSS adds the scroll + fade) rather than clipping silently
    if (over() > 0) stage.classList.add('al-scroll')
    else stage.classList.remove('al-scroll')
  }

  const schedule = () => {
    cancelAnimationFrame(raf)
    clearTimeout(timer)
    raf = requestAnimationFrame(() => {
      timer = setTimeout(fit, 60) // let fonts/images settle a beat
    })
  }

  const mo = new MutationObserver(schedule)
  mo.observe(stage, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-loaded', 'data-selected', 'data-state','data-card-size'],
  })
  const ro = new ResizeObserver(schedule)
  ro.observe(stage)
  if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(() => {})
  schedule()

  // Belt-and-braces: late images, font swaps and post-stream state changes
  // don't always surface as observed mutations — re-fit on a decaying interval
  // until the layout signature has been stable for ~10 s (capped at 3 min).
  let ticks = 0
  let lastSig = ''
  const iv = setInterval(() => {
    ticks++
    try {
      fit()
    } catch { /* never let the interval kill the page */ }
    const sig = `${stage.dataset.alFit}:${stage.dataset.alDensity}:${stage.classList.contains('al-scroll')}`
    if ((sig === lastSig && ticks > 8) || ticks > 150) clearInterval(iv)
    lastSig = sig
  }, 1200)

  return () => {
    mo.disconnect()
    ro.disconnect()
    clearInterval(iv)
    cancelAnimationFrame(raf)
    clearTimeout(timer)
  }
}
