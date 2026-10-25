import {build} from 'esbuild';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
const bundle=await build({entryPoints:['src/baseline/card.jsx'],bundle:true,write:false,format:'iife',minify:true,define:{'process.env.NODE_ENV':'"production"'},legalComments:'none'});
const css=(await postcss([tailwind({content:['src/baseline/card.jsx'],corePlugins:{preflight:false}})]).process(await readFile('src/baseline/card.css','utf8'),{from:undefined})).css;
const code=bundle.outputFiles[0].text,hash=createHash('sha256').update(code+css).digest('hex').slice(0,16);
const host=await build({entryPoints:['src/baseline/host.mjs'],bundle:true,write:false,format:'esm',minify:true});
for(const dir of ['public/h5-baseline','dist/h5-baseline']){await mkdir(dir,{recursive:true});await writeFile(`${dir}/card-${hash}.js`,code);await writeFile(`${dir}/card-${hash}.css`,css);await writeFile(`${dir}/host.js`,host.outputFiles[0].text);await writeFile(`${dir}/manifest.json`,JSON.stringify({version:hash,script:`card-${hash}.js`,css:`card-${hash}.css`,builtAt:new Date().toISOString()},null,2));await copyFile('src/baseline/index.html',`${dir}/index.html`)}
console.log('Built /h5-baseline/index.html',hash);
