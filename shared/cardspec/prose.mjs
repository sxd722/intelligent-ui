// Preserve every character; fragment only at sentence boundaries. No generated
// summaries or permanent clipping of user content.
export function fragmentProse(text, target = 150) {
  const sentences = String(text).match(/[^。！？.!?\n]+[。！？.!?\n]*|[。！？.!?\n]+/gu) || [String(text)]
  const fragments = []; let current = ''
  for (const sentence of sentences) {
    if (current.length >= target) { fragments.push(current); current = '' }
    current += sentence
  }
  if (current) fragments.push(current)
  return fragments
}
