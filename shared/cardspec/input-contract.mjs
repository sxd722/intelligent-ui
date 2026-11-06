// An upstream argument named *-id may actually carry a signed URL. Preserve
// that semantic type before applying the convenience numeric-ID widening.
export function normalizeIdentifierSchema(schema){
 const url=/(?:\burl\b|https?:\/\/|完整链接)/i.test(schema.description||'')
 return url?{...schema,type:/^full\b.*\burl\b/i.test(schema.description||'')?'string':['string','integer'],minLength:1,maxLength:8192}:{...schema,type:['string','integer'],minLength:1,maxLength:128}
}
