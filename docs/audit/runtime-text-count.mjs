import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
const root=fileURLToPath(new URL('../../',import.meta.url));
const chinese=s=>(s.match(/[\u3400-\u9fff]/gu)||[]).length;
const result=await esbuild.build({absWorkingDir:root,entryPoints:['src/main.js'],bundle:true,write:false,metafile:true,
  treeShaking:true,format:'iife',charset:'utf8',legalComments:'none',loader:{'.webp':'dataurl','.png':'dataurl','.jpg':'dataurl','.svg':'dataurl'}});
const perFile=[];
for(const file of Object.keys(result.metafile.inputs).filter(f=>f.endsWith('.js'))){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const parsed=await esbuild.transform(source,{loader:'js',charset:'utf8',legalComments:'none'});
 const count=chinese(parsed.code);
 if(count)perFile.push({file,chinese:count});
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'');
const js=result.outputFiles.filter(f=>/\.js$/.test(f.path)||f.path==='<stdout>').reduce((sum,f)=>sum+chinese(f.text),0);
const report={method:'esbuild dependency graph and tree-shaken active JS, compiler strips source comments; static index.html visible/ARIA/title text included. No retired src/side or old entry points.',
  entry:'src/main.js',activeModules:Object.keys(result.metafile.inputs).filter(f=>f.endsWith('.js')).length,
  javascriptChinese:js,htmlChinese:chinese(html),totalChinese:js+chinese(html),limit:2500,passed:js+chinese(html)<=2500,perFile};
fs.writeFileSync(path.join(root,'docs/audit/runtime-text-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
