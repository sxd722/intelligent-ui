import fs from 'node:fs/promises';import {build} from 'esbuild';
const d='dist/transformer-stitch';await fs.mkdir(d,{recursive:true});
await build({entryPoints:['src/transformer-stitch/App.jsx'],bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:d+'/app.js',define:{'process.env.NODE_ENV':'"production"'},logLevel:'error'});
await fs.writeFile(d+'/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>一层 Transformer · 计算显微镜</title><link rel="stylesheet" href="app.css"><div id="root"></div><script type="module" src="app.js"></script></html>');
console.log('built transformer candidate');
