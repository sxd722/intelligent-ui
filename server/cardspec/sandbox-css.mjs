import postcss from 'postcss'
// CSS runs only inside the opaque iframe. Author CSS is narrower than generated
// Tailwind output; no escapes/resources/HTML or resource-bearing at-rules.
export function validateAuthorCSS(css=''){
 if(typeof css!=='string'||css.length>16000||/[<\\]/.test(css)||/url\s*\(|expression\s*\(/i.test(css))throw Error('Unsafe sandbox stylesheet')
 const root=postcss.parse(css)
 root.walkAtRules(rule=>{if(!['keyframes','media','supports'].includes(rule.name.toLowerCase()))throw Error('Unsupported sandbox CSS rule: '+rule.name)})
 root.walkDecls(d=>{if(/(?:url|image-set)\s*\(|@import/i.test(d.value)||/^(?:behavior|-moz-binding)$/i.test(d.prop))throw Error('External CSS resources are not allowed')})
 return css
}
