// CSS used sizes exclude visual transforms and retain subpixel precision.
// Mixing a transformed DOMRect with integer clientHeight feeds rounding error
// back into auto height on every ResizeObserver notification.
export function blockBox(element) {
  const css = getComputedStyle(element)
  const px = name => parseFloat(css[name]) || 0
  const padding = px('paddingTop') + px('paddingBottom')
  const border = px('borderTopWidth') + px('borderBottomWidth')
  const height = px('height') + (css.boxSizing === 'border-box' ? 0 : padding + border)
  return {height, content: Math.max(0, height - padding - border), outer: height + px('marginTop') + px('marginBottom')}
}

export function naturalCompositionHeight(content, chrome, cap, fillsAvailableSpace = false) {
  // A widget consuming the parent's budget has no independent intrinsic height.
  // Assign its viewport budget first instead of solving parent = child(parent).
  if (fillsAvailableSpace) return cap
  // Round the final budget up once, rather than rounding a different operand
  // on every pass. The small tolerance only covers CSS's 1/64px quantization.
  return Math.min(cap, Math.max(280, Math.ceil(content + chrome - 1 / 64)))
}
