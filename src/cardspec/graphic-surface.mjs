// Author CSS/inline styles can opt into transparency or an intentional surface.
// Only outer SVG stages get a background; nested SVGs and icons remain seamless.
export const GRAPHIC_SURFACE_CSS = `svg:not(svg svg){background-color:var(--cs-graphic-surface,var(--cs-base,transparent))}svg:not([font-size]){font-size:16px}svg:not([fill]){fill:var(--cs-ink,currentColor)}`
