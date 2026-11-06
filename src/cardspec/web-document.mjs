import {GRAPHIC_SURFACE_CSS} from './graphic-surface.mjs'
import runtime from '../../shared/cardspec/web-runtime.generated.mjs'
import {WEB_CDNS,webReactShim} from '../../shared/cardspec/web-policy.mjs'
const safeScript=s=>s.replace(/<\/script/gi,'<\\/script')
const safeStyle=s=>s.replace(/<\/style/gi,'<\\/style')
export function webDocument(module,token){
 if(module?.kind!=='web'||!/^[\w-]+$/.test(token))throw Error('Invalid Web application document')
 const policy=`default-src 'none'; script-src 'unsafe-inline' blob: data: ${WEB_CDNS.join(' ')}; connect-src https:; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: blob: data:; frame-src 'none'; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'`
 const imports=Object.fromEntries(['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime'].map(name=>[name,'data:text/javascript,'+encodeURIComponent(webReactShim(name))]))
 return `<!doctype html><html data-web-token="${token}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;height:100%;min-height:100%;width:100%;box-sizing:border-box}*{box-sizing:border-box}body{font:14px system-ui,sans-serif;color:var(--cs-ink,#202331);background:transparent}button,input,select,textarea{font:inherit}img,canvas,svg{max-width:100%}html[data-reduced-motion=true] *,html[data-reduced-motion=true] *::before,html[data-reduced-motion=true] *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}${GRAPHIC_SURFACE_CSS}${safeStyle(module.css||'')}</style></head><body><div id="root"></div><script>${safeScript(runtime)}</script><script type="importmap">${JSON.stringify({imports})}</script><script type="module">${safeScript(module.code)}</script></body></html>`
}
