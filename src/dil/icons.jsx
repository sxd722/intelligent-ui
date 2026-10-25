// Inline icon set (lucide-style 24x24 stroke icons) used by <icon name="..."/>.
const P = (d, key) => <path key={key} d={d} />

export const ICONS = {
  sprout: [
    'M7 20h10',
    'M10 20c5.5-2.5.8-6.4 3-10',
    'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z',
    'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z'
  ],
  leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  search: ['M10.875 4.5C7.35 4.5 4.5 7.35 4.5 10.875S7.35 17.25 10.875 17.25s6.375-2.85 6.375-6.375S14.4 4.5 10.875 4.5Z', 'M16.047 16.048 21.207 21.208'],
  check: ['M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 1 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z'],
  x: ['M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 1 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Zm-7.414 0-7 7 7 7'],
  info: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm1 1a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm8-8a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0V5Zm1 5a1 1 0 0 1 1 1v6h.01a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z'],
  'help-circle': ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm1 1a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm8-8a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0V5Zm1 5a1 1 0 0 1 1 1v6h.01a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z'],
  'chevron-left': ['M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 1 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z'],
  'chevron-right': ['M8.293 4.293a1 1 0 0 1 1.414 0l7 7a1 1 0 0 1 0 1.414l-7 7a1 1 0 1 1-1.414-1.414L14.586 12 8.293 5.707a1 1 0 0 1 0-1.414Z'],
  sunrise: ['M12 2v8', 'm4.93 10.93 1.41 1.41', 'M2 18h2', 'M20 18h2', 'm19.07 10.93-1.41 1.41', 'M22 22H2', 'm8 6 4-4 4 4', 'M16 18a4 4 0 0 0-8 0'],
  sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z', 'M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'],
  star: ['M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.57l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5Z'],
  heart: ['M12 21s-7.5-4.7-9.5-9C1 8.5 3 5 6.5 5c2 0 3.7 1.2 5.5 3.2C13.8 6.2 15.5 5 17.5 5 21 5 23 8.5 21.5 12c-2 4.3-9.5 9-9.5 9Z'],
  sun: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM2 12h2M20 12h2M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z'],
  clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm1 1a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm8-8a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0V5Zm1 5a1 1 0 0 1 1 1v6h.01a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z'],
  thermometer: ['M12 3a2 2 0 0 0-2 2v8.5a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z'],
  scissors: ['M6 6l12 12M6 18L18 6', 'M7 7a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm0 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  'book-open': ['M12 6c-1.5-1.6-3.7-2.5-9-2.5v15c5.3 0 7.5.9 9 2.5 1.5-1.6 3.7-2.5 9-2.5v-15c-5.3 0-7.5.9-9 2.5Zm0 0v15'],
  flag: ['M5 21V4', 'M5 5c4-2 7 2 11 0v8c-4 2-7-2-11 0'],
  droplet: ['M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3Z'],
  bulb: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1.1 2.1h4.8c.1-.9.5-1.6 1.1-2.1A6 6 0 0 0 12 3Z'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z'],
  alert: ['M12 3 2 20h20L12 3Zm0 7v4m0 3v.01'],
  'arrow-right': ['M4 12h14m-5-6 6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  music: ['M9 18V6l10-2v12', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z']
}

const ALIASES = {
  'circle-help': 'help-circle',
  'help': 'help-circle',
  'lightbulb': 'bulb',
  'book-open': 'book-open',
  'arrow': 'arrow-right',
  'drop': 'droplet',
  'water': 'droplet'
}

const SIZE_MAP = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24 }

export function Icon({ name, color, size, weight }) {
  const resolved = ALIASES[name] || name
  const paths = ICONS[resolved] || ICONS.sparkles
  const px = SIZE_MAP[size] ?? 16
  const style = { fontSize: px, width: px, height: px, color: colorStyle(color) }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight === 'bold' ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-d-component="icon"
      aria-hidden="true"
      style={style}
    >
      {paths.map((d, i) => P(d, i))}
    </svg>
  )
}

export function colorStyle(color) {
  if (!color) return undefined
  if (color.startsWith('#') || color.startsWith('rgb')) return color
  return `var(--color-text-${color}, currentColor)`
}
