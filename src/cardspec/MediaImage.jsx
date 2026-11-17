import React,{useState,useEffect} from 'react'
import {photoKey} from '../../shared/cardspec/images.mjs'
import {illustrations} from './illustration-queue.mjs'
import {ImageCredit} from './ImageCredit.jsx'
export function ImageNode({ p, resource, streaming, embedded }) {
  if(resource?.status==='deferred')resource=null
  const asset=Object.hasOwn(p,'assetRef'),validAsset=typeof p.assetRef==='string'&&/^asset\.v1\.[\w-]+\.[\w-]+$/.test(p.assetRef)&&p.assetRef.length<=3000
  const key = asset?p.assetRef:photoKey(p.query,p.mediaRole), [resolved, setResolved] = useState(null)
  useEffect(() => {
    if (asset || resource || streaming || !p.query) return
    const controller = new AbortController()
    const generated=/^gen:/i.test(p.query)
    ;(generated?illustrations.request(p.query,p.mediaRole||'hero'):fetch(`/api/photo?query=${encodeURIComponent(p.query)}&role=${encodeURIComponent(p.mediaRole || 'hero')}`, { signal:controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error('photo unavailable'); return r.json() })
    ).then((value) => {if(!controller.signal.aborted)setResolved({ key, value })})
      .catch(() => { if (!controller.signal.aborted) setResolved({ key, value:{ status:'error' } }) })
    return () => controller.abort()
  }, [key, !!resource, streaming,asset])
  if(asset)resource=validAsset?{url:'/api/tools/assets/'+encodeURIComponent(p.assetRef),kind:'source-image'}:{status:'error'}
  resource = resource || (resolved?.key === key ? resolved.value : null)
  const [status, setStatus] = useState('loading')
  const src = resource?.url
  useEffect(() => setStatus('loading'), [src])
  const failed = status === 'error' || resource?.status === 'error'
  return <div className="cs-photo"><figure className="cs-image" data-media-role={p.mediaRole || 'hero'} data-loaded={status === 'loaded'}>
    {src && <img src={src} alt={p.alt || p.query || ''} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} hidden={failed} />}
    {(!src || status !== 'loaded') && <span role="status">{failed ? '图片暂不可用' : /^gen:/i.test(p.query||'') ? '生成插画中…' : '图片加载中…'}</span>}
  </figure><ImageCredit resource={resource} asset={asset} embedded={embedded}/></div>
}
