// Resolve aliases/color-mix in the host, then forward only known design values.
export const SANDBOX_THEME_KEYS = ['--cs-ink','--cs-muted','--cs-accent','--cs-field-mask','--cs-surface-mask','--cs-radius','--cs-space-normal','--cs-title-size','--cs-title-weight','--cs-title-tracking','--cs-stat-size','--font-title','--cs-motion-ease','--cs-motion-fast','--cs-motion-duration']
export function readDesignEnvironment(root) {
  const style=getComputedStyle(root), theme={}, probe=root.ownerDocument.createElement('span')
  probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none'
  root.append(probe)
  for (const [key,fallback] of Object.entries({'--cs-ink':'--color-text-prose','--cs-muted':'--color-text-muted','--cs-accent':'--color-primary','--cs-field-mask':'--color-surface','--cs-surface-mask':'--cs-panel-mask'})) {
    probe.style.backgroundColor=`var(${key},var(${fallback},${style.color}))`
    theme[key]=getComputedStyle(probe).backgroundColor
  }
  probe.remove()
  const defaults={'--cs-motion-ease':'cubic-bezier(.22,1,.36,1)','--cs-motion-fast':'140ms','--cs-motion-duration':'280ms','--cs-radius':'12px','--cs-space-normal':'8px','--cs-title-size':'20px','--cs-title-weight':'650','--cs-title-tracking':'normal','--cs-stat-size':'24px','--font-title':style.fontFamily}
  for (const [key,fallback] of Object.entries(defaults)) theme[key]=style.getPropertyValue(key).trim() || (key==='--cs-radius' ? style.getPropertyValue('--cs-control-radius').trim() : '') || fallback
  return {...theme,color:style.color,font:style.fontFamily}
}
