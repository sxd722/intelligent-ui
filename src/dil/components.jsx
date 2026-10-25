// Host component library — the "DIL component" half of the runtime.
// Follows the observed host contract:
//   - variants ride on data-d-* attributes, never on class names
//   - styles consume design tokens (var(--color-*), var(--radius-*), var(--spacing))
//   - containers get sibling-based auto spacing (data-d-auto-spacing) unless gap is set
//   - string children are split into word spans while streaming (data-d-stream-word)

import React, { useContext, useEffect, useId, useRef, useState } from 'react'
import { StreamingContext, AppDataContext } from './runtime.jsx'
import { Icon, colorStyle } from './icons.jsx'

// ---------- token helpers ----------

const BG_TOKENS = /^(surface|surface-secondary|surface-tertiary|surface-elevated|surface-inverse|success|success-soft|danger|danger-soft|warning|warning-soft|info|info-soft)$/

function bg(v) {
  if (v == null) return undefined
  if (v.startsWith('#') || v.startsWith('rgb')) return v
  if (BG_TOKENS.test(v)) return `var(--color-${v})`
  return v
}

function radius(v) {
  if (v == null) return undefined
  if (/^(sm|md|lg|xl|2xl|3xl|full)$/.test(v)) return `var(--radius-${v})`
  return v
}

function spacing(v) {
  if (v == null) return undefined
  if (typeof v === 'number') return `calc(var(--spacing) * ${v})`
  const s = String(v)
  if (/^\d+(\.\d+)?$/.test(s)) return `calc(var(--spacing) * ${s})`
  return s
}

const TEXT_SIZES = new Set(['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl'])

// ---------- layout ----------

function BoxImpl({ dName = 'box', direction, align, justify, gap, padding, background, radius: rad, width, height, minWidth, maxWidth, flex, wrap, clip, border, children, style, shadow }) {
  const dir = direction ?? (dName === 'row' ? 'row' : 'col')
  const autoSpacing = gap == null
  const style_ = {
    backgroundColor: bg(background),
    borderRadius: radius(rad),
    gap: spacing(gap),
    padding: padding != null ? spacing(padding) : undefined,
    width: width != null ? String(width) : undefined,
    height: height != null ? String(height) : undefined,
    minWidth: minWidth != null ? String(minWidth) : undefined,
    maxWidth: maxWidth != null ? String(maxWidth) : undefined,
    flex: flex != null ? String(flex) : undefined,
    flexWrap: wrap ?? undefined,
    overflow: clip ? 'hidden' : undefined,
    boxShadow: shadow ? 'var(--shadow-card)' : undefined,
    border: border ? '1px solid var(--color-border)' : undefined,
    ...style
  }
  return (
    <div
      data-d-component={dName}
      data-d-direction={dir}
      data-d-align={align}
      data-d-justify={justify}
      data-d-auto-spacing={autoSpacing ? '' : undefined}
      style={style_}
    >
      {children}
    </div>
  )
}

const Box = (props) => <BoxImpl {...props} dName="box" />
const Row = (props) => <BoxImpl {...props} dName="row" />
const Card = (props) => <BoxImpl {...props} dName="box" background={props.background ?? 'surface-elevated'} radius={props.radius ?? '3xl'} shadow />

function Divider({ size }) {
  return <div data-d-component="divider" style={{ '--divider-size': size ?? '1px' }} />
}

function Spacer({ minSize }) {
  return <div data-d-component="spacer" style={{ '--w-spacer-min-size': minSize != null ? String(minSize) : 'auto' }} />
}

function Grid({ columns = 'md', gap, rowGap, columnGap, children }) {
  const cols =
    typeof columns === 'number'
      ? `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`
      : columns === 'sm'
        ? 'repeat(2, minmax(0, 1fr))'
        : columns === 'lg'
          ? 'repeat(4, minmax(0, 1fr))'
          : 'repeat(3, minmax(0, 1fr))'
  return (
    <div
      data-d-component="grid"
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: spacing(gap ?? 2),
        rowGap: spacing(rowGap),
        columnGap: spacing(columnGap)
      }}
    >
      {children}
    </div>
  )
}

function GridItem({ span, rowSpan, children }) {
  return (
    <div
      data-d-component="grid-item"
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        gridRow: rowSpan ? `span ${rowSpan}` : undefined,
        minWidth: 0
      }}
    >
      {children}
    </div>
  )
}

// ---------- text ----------

function Words({ text }) {
  const streaming = useContext(StreamingContext)
  if (!streaming || typeof text !== 'string' || !text) return text
  const parts = text.match(/\S+\s*|\s+/g) ?? [text]
  return parts.map((w, i) => (
    <span key={i} data-d-text-flow="word" data-d-stream-word="">
      {w}
    </span>
  ))
}

function textChildren(children) {
  return React.Children.map(children, (c) => (typeof c === 'string' ? <Words text={c} /> : c))
}

function Text({ size, weight, color, align, inline, clamp, children, style }) {
  // clamp = max visible lines (line-clamp contract; the engine counts it in the height budget)
  const clampStyle =
    clamp != null && Number(clamp) > 0
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: String(Math.round(Number(clamp))),
          overflow: 'hidden'
        }
      : null
  return (
    <span
      data-d-component="text"
      data-d-size={TEXT_SIZES.has(size) ? size : undefined}
      data-d-weight={weight}
      data-d-inline={inline ? '' : undefined}
      data-d-clamp={clamp != null ? '' : undefined}
      style={{
        color: colorStyle(color),
        textAlign: align,
        ...(inline && !clampStyle ? { display: 'inline' } : null),
        ...clampStyle,
        ...style
      }}
    >
      {textChildren(children)}
    </span>
  )
}

const TITLE_TAGS = { sm: 'h4', md: 'h3', lg: 'h2', xl: 'h1', '2xl': 'h1', '3xl': 'h1' }

function Title({ size = 'md', color, align, children }) {
  const Tag = TITLE_TAGS[size] ?? 'h3'
  return (
    <Tag data-d-component="title" data-d-size={size} style={{ color: colorStyle(color), textAlign: align }}>
      {textChildren(children)}
    </Tag>
  )
}

function Caption({ size = 'md', color, children }) {
  return (
    <span data-d-component="caption" data-d-size={size} style={{ color: colorStyle(color) }}>
      {textChildren(children)}
    </span>
  )
}

function Label({ size = 'sm', color, children, htmlFor }) {
  return (
    <label data-d-component="label" data-d-size={size} htmlFor={htmlFor} style={{ color: colorStyle(color) }}>
      {textChildren(children)}
    </label>
  )
}

function Bold({ children }) {
  return (
    <span data-d-component="text" data-d-default-strong="" data-d-inline="">
      {textChildren(children)}
    </span>
  )
}
function Italic({ children }) {
  return (
    <em data-d-component="text" data-d-font-style="italic" data-d-inline="">
      {textChildren(children)}
    </em>
  )
}
function Underline({ children }) {
  return (
    <span data-d-component="text" data-d-text-decoration="underline" data-d-inline="">
      {textChildren(children)}
    </span>
  )
}

// ---------- visual ----------

function Badge({ color = 'secondary', weight = 'medium', children, pill }) {
  return (
    <span data-d-component="badge" data-d-color={color} data-d-weight={weight} data-pill={pill === false ? undefined : ''}>
      {textChildren(children)}
    </span>
  )
}

// ---------- interaction ----------

const BTN_COLORS = new Set(['primary', 'secondary', 'success', 'danger', 'warning'])

function Button({ color = 'primary', variant = 'solid', size = 'md', pill = true, block, disabled, onClick, children }) {
  return (
    <button
      type="button"
      data-d-component="button"
      data-d-color={BTN_COLORS.has(color) ? color : 'secondary'}
      data-d-variant={variant}
      data-d-size={size}
      data-pill={pill ? '' : undefined}
      data-d-block={block ? '' : undefined}
      disabled={!!disabled}
      onClick={onClick}
    >
      <span data-d-button-inner="">{children}</span>
    </button>
  )
}

function Pressable({ onClick, disabled, gap, align, flex, inline, role, ariaLabel, children }) {
  const Tag = inline ? 'span' : 'button'
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : null)}
      data-d-component="pressable"
      data-d-align={align}
      data-d-inline={inline ? '' : undefined}
      disabled={Tag === 'button' ? !!disabled : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      aria-label={ariaLabel}
      role={role}
      onClick={disabled ? undefined : onClick}
      style={{ gap: spacing(gap), flex: flex != null ? String(flex) : undefined }}
    >
      {children}
    </Tag>
  )
}

function Checkbox({ checked, onChange, disabled, children }) {
  const labelId = useId()
  const toggle = () => {
    if (!disabled && typeof onChange === 'function') onChange(!checked)
  }
  return (
    <div data-d-component="checkbox-row" data-d-disabled={disabled ? '' : undefined} onClick={toggle}>
      <button
        type="button"
        role="checkbox"
        aria-labelledby={labelId}
        aria-checked={checked ? 'true' : 'false'}
        data-d-component="checkbox"
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={!!disabled}
      />
      <span id={labelId} data-d-checkbox-label="">{textChildren(children)}</span>
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled, pill = true, block }) {
  return (
    <input
      data-d-component="input"
      data-pill={pill ? '' : undefined}
      data-d-block={block ? '' : undefined}
      type={type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      placeholder={placeholder}
      disabled={!!disabled}
      onChange={(e) => typeof onChange === 'function' && onChange(e.target.value)}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3, disabled }) {
  return (
    <textarea
      data-d-component="textarea"
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      disabled={!!disabled}
      onChange={(e) => typeof onChange === 'function' && onChange(e.target.value)}
    />
  )
}

// ---------- list ----------

function List({ children }) {
  return <ul data-d-component="list">{children}</ul>
}

function ListItem({ children, description, marker, disabled }) {
  return (
    <li data-d-component="list-item" data-d-disabled={disabled ? '' : undefined}>
      <span data-d-marker={marker ?? 'bullet'} />
      <div data-d-item-content="">
        <div data-d-item-label="">{textChildren(children)}</div>
        {description ? <div data-d-item-desc="">{description}</div> : null}
      </div>
    </li>
  )
}

// ---------- chips / radio / carousel / rating (sized by the auto-layout engine) ----------

function Chips({ children }) {
  return <div data-d-component="chips" role="tablist">{children}</div>
}

function Chip({ selected, onClick, disabled, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected ? 'true' : 'false'}
      data-d-component="chip"
      data-selected={selected ? '' : undefined}
      disabled={!!disabled}
      onClick={onClick}
    >
      {textChildren(children)}
    </button>
  )
}

// Segmented control. When the options can't fit (long labels, narrow card),
// it collapses to a picker: a trigger labelled with the current selection that
// opens a themed popover listing every option in full — no ellipsis soup.
function Radio({ children }) {
  return <div data-d-component="radio" role="radiogroup">{children}</div>
}

function RadioOption({ selected, onClick, disabled, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected ? 'true' : 'false'}
      data-d-component="radio-option"
      data-selected={selected ? '' : undefined}
      disabled={!!disabled}
      onClick={onClick}
    >
      {textChildren(children)}
    </button>
  )
}

// Carousels ship with their own affordances — ‹ n/N › strip, looping track
// (last item connects back to the first via clones), and edge fade masks that
// signal continuation. The model never wires navigation itself.
function Carousel({ children, index, onIndexChange }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const items = React.Children.toArray(children)
  const loop = items.length > 1

  const step = () => {
    const track = trackRef.current
    const first = track?.children[0]
    if (!track || !first) return 1
    const gap = parseFloat(getComputedStyle(track).gap) || 0
    return first.offsetWidth + gap || 1
  }
  const scrollToIndex = (i, behavior = 'smooth') => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: (i + (loop ? 1 : 0)) * step(), behavior })
  }

  // (re)position on mount and whenever the item set changes mid-stream
  useEffect(() => {
    if (!trackRef.current) return
    scrollToIndex(Math.max(0, Math.min(active, items.length - 1)), 'auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, loop])

  useEffect(() => {
    if (index == null) return
    scrollToIndex(Number(index))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const s = step()
        let i = Math.round(track.scrollLeft / s) - (loop ? 1 : 0)
        if (loop && i < 0) {
          i = items.length - 1
          track.scrollTo({ left: (items.length) * s, behavior: 'auto' }) // landed on the leading clone → hop to the real last
        } else if (loop && i >= items.length) {
          i = 0
          track.scrollTo({ left: s, behavior: 'auto' }) // landed on the trailing clone → hop to the real first
        }
        i = Math.max(0, Math.min(items.length - 1, i))
        setActive(i)
        if (typeof onIndexChange === 'function') onIndexChange(i)
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [items.length, loop])

  const go = (dir) => scrollToIndex(active + dir === items.length ? 0 : active + dir === -1 ? items.length - 1 : active + dir)

  return (
    <CarouselContext.Provider value={true}>
      <div data-d-component="carousel-wrap" data-loop={loop ? '' : undefined}>
        <div data-d-component="carousel" ref={trackRef}>
          {loop ? <div data-d-component="carousel-item" data-clone="lead" aria-hidden="true">{items[items.length - 1]}</div> : null}
          {children}
          {loop ? <div data-d-component="carousel-item" data-clone="tail" aria-hidden="true">{items[0]}</div> : null}
          {loop ? <div data-d-component="carousel-spacer" aria-hidden="true" /> : null}
        </div>
        <div data-d-component="carousel-nav">
        <button type="button" data-d-component="carousel-nav-btn" aria-label="上一项" onClick={() => go(-1)}>
          <Icon name="chevron-left" size="sm" />
        </button>
        <span data-d-carousel-counter="">{Math.min(active + 1, items.length)}/{items.length}</span>
        <button type="button" data-d-component="carousel-nav-btn" aria-label="下一项" onClick={() => go(1)}>
          <Icon name="chevron-right" size="sm" />
        </button>
        </div>
      </div>
    </CarouselContext.Provider>
  )
}

const CarouselContext = React.createContext(false)

function CarouselItem({ children }) {
  // stray carousel-items outside a carousel degrade to plain boxes — the
  // model occasionally drops them elsewhere and fake track styling (plus
  // out-of-range state bindings) is exactly the "dead heart" glitch class
  const inCarousel = useContext(CarouselContext)
  return (
    <div data-d-component={inCarousel ? 'carousel-item' : 'box'} data-d-direction="col">
      {children}
    </div>
  )
}

// State-backed toggle affordance (favorite / want-to-go / bookmark marks).
// The model must use this instead of a bare pressable+icon: the visual always
// reflects the state (outline → filled + tint + pop), so clicks always show.
function ToggleIcon({ name = 'heart', on, onChange, disabled }) {
  // optimistic self-state: clicks ALWAYS show visually, and sync back whenever
  // the bound state changes — survives models that mis-wire on/onChange pairs
  const [self, setSelf] = useState(!!on)
  useEffect(() => setSelf(!!on), [on])
  return (
    <button
      type="button"
      role="switch"
      aria-checked={self ? 'true' : 'false'}
      aria-label={name}
      data-d-component="toggle-icon"
      data-state={self ? 'on' : 'off'}
      disabled={!!disabled}
      onClick={() => {
        if (disabled) return
        setSelf(!self)
        if (typeof onChange === 'function') onChange(!self)
      }}
    >
      <Icon name={name} size="md" />
    </button>
  )
}

function Rating({ value = 0, max = 5 }) {
  const n = Number(value)
  const v = Math.round(Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0)))
  return (
    <span data-d-component="rating" role="img" aria-label={`${v} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < v ? 'on' : ''} />
      ))}
    </span>
  )
}

// ---------- stats (header metrics strip; packs into a 2-D grid) ----------

function Stats({ children }) {
  return <div data-d-component="stats">{children}</div>
}

function Stat({ value, label }) {
  return (
    <div data-d-component="stat">
      <span data-d-stat-value="">{value}</span>
      {label != null ? <span data-d-stat-label="">{label}</span> : null}
    </div>
  )
}

// ---------- AsyncImage (server-resolved async component) ----------

function ratioCss(ratio) {
  if (!ratio) return undefined
  const m = /^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/.exec(String(ratio))
  return m ? `${m[1]} / ${m[2]}` : String(ratio)
}

export function AsyncImage({ __resolutionId, aspectRatio = '16:9', width, radius: rad = 'xl', fit = 'cover' }) {
  const appData = useContext(AppDataContext)
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [failedSrc, setFailedSrc] = useState(null)
  const result = appData?.opGenui?.componentResults?.[__resolutionId]
  const state = result?.state
  const img = state?.images?.[0]
  const src = img?.thumbnail_url || img?.content_url || img?.url
  const crop = img?.thumbnail_crop_info
  const showImage = src && loadedSrc === src

  const style = {
    aspectRatio: ratioCss(aspectRatio),
    width: width != null ? String(width) : '100%',
    maxWidth: '100%',
    borderRadius: radius(rad)
  }

  return (
    <div data-d-component="image" data-d-stream-media="" style={style}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={img?.title ?? ''}
          referrerPolicy="no-referrer"
          draggable={false}
          data-loaded={showImage ? '' : undefined}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          style={{
            objectFit: fit,
            objectPosition: crop
              ? `${crop.center_x_percent ?? 50}% ${crop.center_y_percent ?? 50}%`
              : undefined
          }}
        />
      ) : null}
      {!showImage && <div data-d-image-loading="" role="status">{src && failedSrc === src ? '图片暂不可用' : ''}</div>}
      {img?.provider === 'Pexels' && <span style={{position:'absolute',right:4,bottom:4,padding:'2px 4px',background:'#000b',color:'#fff',fontSize:10,lineHeight:1.3}}>Photo: <a href={/^https:\/\/(www\.)?pexels\.com\//.test(img.photoUrl || '') ? img.photoUrl : 'https://www.pexels.com'} target="_blank" rel="noreferrer" style={{color:'inherit'}}>{img.photographer || 'Pexels'}</a> · <a href="https://www.pexels.com" target="_blank" rel="noreferrer" style={{color:'inherit'}}>Pexels</a></span>}
    </div>
  )
}

// ---------- progress ----------

const PROGRESS_COLORS = { success: 'var(--color-success)', primary: 'var(--color-primary)', danger: 'var(--color-danger)', warning: 'var(--color-warning)' }

function Progress({ value = 0, color = 'success', height = 8 }) {
  const n = Number(value)
  const pct = Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
  const fill = PROGRESS_COLORS[color] ?? (colorStyle(color) || 'var(--color-success)')
  return (
    <div
      data-d-component="progress"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-surface-tertiary)',
        overflow: 'hidden',
        width: '100%'
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: 'var(--radius-full)',
          background: fill,
          transition: 'width 0.2s ease-out'
        }}
      />
    </div>
  )
}

// ---------- registry ----------

export const HOST_COMPONENTS = {
  box: Box,
  row: Row,
  card: Card,
  text: Text,
  title: Title,
  caption: Caption,
  label: Label,
  bold: Bold,
  italic: Italic,
  underline: Underline,
  icon: Icon,
  badge: Badge,
  button: Button,
  pressable: Pressable,
  checkbox: Checkbox,
  input: Input,
  textarea: Textarea,
  divider: Divider,
  progress: Progress,
  grid: Grid,
  'grid-item': GridItem,
  spacer: Spacer,
  list: List,
  'list-item': ListItem,
  chips: Chips,
  chip: Chip,
  radio: Radio,
  'radio-option': RadioOption,
  carousel: Carousel,
  'carousel-item': CarouselItem,
  'toggle-icon': ToggleIcon,
  rating: Rating,
  stats: Stats,
  stat: Stat,
  AsyncImage
}
