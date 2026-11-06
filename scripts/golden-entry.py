from pathlib import Path
import json
p=Path('package.json');j=json.loads(p.read_text(encoding='utf-8'));j['scripts']['portfolio:build']='node scripts/build-golden-portfolio.mjs';j['scripts']['postbuild']='node scripts/build-golden-portfolio.mjs';p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=Path('src/App.jsx');s=p.read_text(encoding='utf-8');needle='          <a className="chip" href="/design-templates.html?preset=pearl">';s=s.replace(needle,'          {!CLOUD_NO_TOOLS&&!CLOUD_DEMO_TOOLS&&<a className="chip" href="/golden-cases/">Golden Case Portfolio ↗</a>}\n'+needle);p.write_text(s,encoding='utf-8')
