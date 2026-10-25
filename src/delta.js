// Client-side delta_encoding v1 applier.
// Mirrors the observed frame shapes:
//   {"p":"","o":"add","v":ENVELOPE}                     root add
//   {"o":"patch","v":[OP,OP,...]}                        batch patch
//   {"v":OPERAND}                                        shorthand: repeat last op (p+o) with a new value
//   {"v":[OP,...]}                                       another batch (o:"patch" repeated)
// OP = { p: "/json/pointer", o: "add"|"replace"|"remove"|"append", v: any }
// append semantics (extended, as observed):
//   string + string -> concat
//   object + object -> key upsert (values replace per key)
//   array  + any    -> push

export function isControlEvent(frame) {
  return (
    frame &&
    typeof frame === 'object' &&
    !Array.isArray(frame) &&
    typeof frame.type === 'string' &&
    !('v' in frame) &&
    !('p' in frame) &&
    !('o' in frame)
  )
}

export function createDeltaApplier() {
  let lastAtomic = { p: '', o: 'add' }
  return {
    apply(target, frame) {
      if (frame.p !== undefined) lastAtomic = { p: frame.p, o: frame.o ?? 'add' }
      else if (frame.o !== undefined) lastAtomic = { ...lastAtomic, o: frame.o }

      let ops
      if (Array.isArray(frame.v)) ops = frame.v
      else ops = [{ p: lastAtomic.p, o: lastAtomic.o, v: frame.v }]

      for (const op of ops) {
        if (op && op.p !== undefined) lastAtomic = { p: op.p, o: op.o ?? lastAtomic.o }
        else if (op && op.o !== undefined) lastAtomic = { ...lastAtomic, o: op.o }
        applyOp(target, op)
      }
    }
  }
}

function decodePointer(p) {
  return String(p)
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

export function applyOp(target, op) {
  if (!op || op.p === undefined) return
  const segs = decodePointer(op.p)

  // root replace/add: mutate the envelope in place so references stay valid
  if (segs.length === 0) {
    for (const k of Object.keys(target)) delete target[k]
    Object.assign(target, clone(op.v))
    return
  }

  let cur = target
  for (let d = 0; d < segs.length - 1; d++) {
    const seg = segs[d]
    const nextSeg = segs[d + 1]
    if (cur[seg] == null || typeof cur[seg] !== 'object') {
      cur[seg] = isArrayIndex(nextSeg) ? [] : {}
    }
    cur = cur[seg]
  }

  const leaf = segs[segs.length - 1]
  switch (op.o) {
    case 'add':
    case 'replace':
      cur[leaf] = clone(op.v)
      break
    case 'remove':
      if (Array.isArray(cur) && isArrayIndex(leaf)) cur.splice(Number(leaf), 1)
      else delete cur[leaf]
      break
    case 'append': {
      const existing = cur[leaf]
      if (typeof existing === 'string' && typeof op.v === 'string') cur[leaf] = existing + op.v
      else if (Array.isArray(existing)) {
        const add = Array.isArray(op.v) ? op.v : [op.v]
        cur[leaf] = existing.concat(add)
      } else if (existing && typeof existing === 'object' && op.v && typeof op.v === 'object') {
        Object.assign(existing, op.v)
      } else {
        cur[leaf] = clone(op.v)
      }
      break
    }
    default:
      break
  }
}

function isArrayIndex(s) {
  return /^(0|[1-9]\d*)$/.test(s)
}

function clone(v) {
  if (v == null || typeof v !== 'object') return v
  try {
    return structuredClone(v)
  } catch {
    return JSON.parse(JSON.stringify(v))
  }
}
