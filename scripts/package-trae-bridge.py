from pathlib import Path
import zipfile
root=Path(__file__).resolve().parent.parent
out=root/'artifacts/rsi-agent/cardspec-workbench.vsix'
out.parent.mkdir(parents=True,exist_ok=True)
manifest='''<?xml version="1.0" encoding="utf-8"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="cardspec-workbench" Version="0.1.0" Publisher="local-cardspec"/><DisplayName>CardSpec Workbench Bridge</DisplayName><Description xml:space="preserve">Local Trae workbench task bridge</Description><Tags></Tags><Categories>Other</Categories><GalleryFlags>Public</GalleryFlags><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.98.0"/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>'''
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('extension.vsixmanifest',manifest)
 z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>')
 for f in (root/'integrations/trae-workbench').iterdir():
  if f.is_file(): z.write(f,'extension/'+f.name)
print(out)
