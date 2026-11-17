// Author CSS/inline styles can opt into transparency or an intentional surface.
// Only outer SVG stages get a background; nested SVGs and icons remain seamless.
export const GRAPHIC_SURFACE_CSS = `svg:not(svg svg){background-color:var(--cs-graphic-surface,var(--cs-base,transparent))}svg:not([font-size]){font-size:16px}svg:not([fill]){fill:var(--cs-ink,currentColor)}`
export const GRAPHIC_FILL_CSS = `html,body{background-color:var(--cs-base,transparent)}[data-host-graphic-fill=true]{height:100%!important;min-height:0!important;max-height:none!important}html[data-host-graphic=true] #root{height:100%;min-height:0}html[data-host-graphic=true] svg{display:block}`
