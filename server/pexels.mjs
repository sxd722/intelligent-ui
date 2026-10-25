import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

export function createPexelsService({ key, cacheDir, fetchImpl = fetch }) {
  const inflight = new Map(), ttl = 24 * 60 * 60 * 1000
  const digest = (text) => createHash('sha256').update(text).digest('hex')
  const safeImage = (value) => { const u = new URL(value); if (u.protocol !== 'https:' || u.hostname !== 'images.pexels.com') throw new Error('invalid photo source'); return u.href }
  async function download(url, filename, signal) {
    const file = path.join(cacheDir, filename)
    try { if ((await stat(file)).size > 0) return } catch {}
    const response = await fetchImpl(safeImage(url), { signal, redirect:'error' })
    if (!response.ok || !/^image\/(jpeg|png|webp)/i.test(response.headers.get('content-type') || '')) throw new Error('image download failed')
    const chunks = []; let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 8 * 1024 * 1024) { await response.body.cancel?.().catch(()=>{}); throw new Error('image too large') }
      chunks.push(chunk)
    }
    if (!size) throw new Error('empty image')
    await writeFile(file, Buffer.concat(chunks))
  }
  async function resolve(query, role, signal) {
    if (!key) return null
    await mkdir(cacheDir, { recursive:true })
    const id = digest(`${query.toLowerCase()}|${role}`), metaFile = path.join(cacheDir, `${id}.json`)
    try {
      const saved = JSON.parse(await readFile(metaFile, 'utf8'))
      if (Date.now() - saved.at < ttl) { await stat(path.join(cacheDir, path.basename(saved.photo.content))); return saved.photo }
    } catch {}
    const response = await fetchImpl(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1${role === 'thumbnail' ? '' : '&orientation=landscape'}`, { headers:{ Authorization:key }, signal })
    if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`)
    const photo = (await response.json()).photos?.[0]
    if (!photo?.src) return null
    const source = role === 'thumbnail' ? photo.src.tiny || photo.src.small : role === 'background' ? photo.src.large2x || photo.src.large || photo.src.landscape : photo.src.landscape || photo.src.large
    const asset = digest(safeImage(source))
    await download(source, `${asset}.jpg`, signal)
    const result = { id:photo.id,alt:photo.alt||query,avgColor:photo.avg_color,content:`/api/media/${asset}.jpg`, thumb:`/api/media/${asset}.jpg`, width:role === 'thumbnail' ? 280 : 1200, height:role === 'thumbnail' ? 200 : 627, title:(photo.alt || query).slice(0,120), photographer:photo.photographer, photographerUrl:photo.photographer_url, photoUrl:photo.url, provider:'Pexels' }
    await writeFile(metaFile, JSON.stringify({ at:Date.now(), photo:result }))
    return result
  }
  async function photo(query, signal, role = 'hero') {
    query = String(query || '').trim().slice(0,100)
    if (!query || !['hero','thumbnail','gallery','background'].includes(role)) return null
    signal?.throwIfAborted()
    const cacheKey = `${query.toLowerCase()}|${role}`
    let task = inflight.get(cacheKey)
    if (!task) {
      const controller = new AbortController()
      task = { users:0, controller, done:false }
      task.promise = resolve(query, role, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
        .catch(() => null).finally(() => { task.done = true; inflight.delete(cacheKey) })
      inflight.set(cacheKey, task)
    }
    task.users++
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error, value) => {
        if (settled) return; settled = true; signal?.removeEventListener('abort', abort)
        task.users--; if (!task.users && !task.done) task.controller.abort()
        error ? reject(error) : resolve(value)
      }
      const abort = () => finish(signal.reason || new Error('cancelled'))
      signal?.addEventListener('abort', abort, { once:true })
      task.promise.then((value) => finish(null,value), finish)
    })
  }
  async function media(filename) {
    if (!/^[a-f0-9]{64}\.jpg$/.test(filename)) return null
    try {
      const bytes = await readFile(path.join(cacheDir, filename))
      const contentType = bytes[0] === 0x89 && bytes.subarray(1,4).toString() === 'PNG' ? 'image/png' : bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg'
      return { bytes, contentType }
    } catch { return null }
  }
  return { photo, media }
}
