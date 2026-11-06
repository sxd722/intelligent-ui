from pathlib import Path
p=Path('src/cardspec/Renderer.jsx');s=p.read_text(encoding='utf-8-sig').replace("import './folio.css'\n",'').replace("import './seamless.css'","import './seamless.css'\nimport './folio.css'");p.write_text(s,encoding='utf-8')
# Actual registered icon names, no silent generic fallback for these universal concepts.
p=Path('src/dil/icons.jsx');s=p.read_text(encoding='utf-8');s=s.replace('export const ICONS = {', '''export const ICONS = {
  user:['M20 21v-2a7 7 0 0 0-14 0v2','M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  'message-circle':['M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.8-5A9 9 0 1 1 21 11'],
  landmark:['m3 9 9-6 9 6H3','M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18'],''');p.write_text(s,encoding='utf-8')
