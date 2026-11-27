const assert=require('node:assert/strict');
const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync }=require('node:fs');
const { join, resolve }=require('node:path');
const { tmpdir }=require('node:os');
const { createHash }=require('node:crypto');
const { openBrowser, project }=require('./browser.cjs');

const candidate=resolve(process.argv.find(s=>s.startsWith('--candidate='))?.slice(12)??join(tmpdir(),'jingge-browser-replay'));
const baseline=join(project,'docs','audit','visual-baseline');
const update=process.argv.includes('--update');
const tolerance=.02;
const levels=['bay','porcelain','violet','magma','sanctuary'];
const names=readdirSync(candidate);
const shots=levels.flatMap((key,index)=>['DEEP','BOSS'].map(state=>{
  const matches=names.filter(file=>file.startsWith((index+1)+'-'+key+'-')&&file.endsWith('-'+state+'.webp')).sort();
  const file=matches.at(-1);
  if(!file)throw new Error('Missing '+key+' '+state+' replay screenshot');
  return { name:key+'-'+state.toLowerCase()+'.webp', file };
}));
async function run(){
  const hash=()=>Object.fromEntries(shots.map(({name})=>[name,createHash('sha256').update(readFileSync(join(baseline,name))).digest('hex')]));
  if(update){
    mkdirSync(baseline,{recursive:true});
    for(const {name,file} of shots)copyFileSync(join(candidate,file),join(baseline,name));
    writeFileSync(join(baseline,'manifest.json'),JSON.stringify({tolerance,files:hash()},null,2)+'\n');
    console.log('Wrote baseline for review. Run comparison with a separate capture.');return;
  }
  assert.ok(existsSync(join(baseline,'manifest.json')),'No baseline. Generate a reviewed --update capture.');
  assert.deepEqual(hash(),JSON.parse(readFileSync(join(baseline,'manifest.json'),'utf8')).files);
  const harness=await openBrowser();
  try{
    const results=[];
    for(const {name,file} of shots){
      const encode=p=>'data:image/webp;base64,'+readFileSync(p).toString('base64');
      const sources=[encode(join(baseline,name)),encode(join(candidate,file))];
      const metrics=await harness.page.evaluate(async sources=>{
        const images=await Promise.all(sources.map(src=>{
          const image=new Image();image.src=src;return image.decode().then(()=>image);
        }));
        const [a,b]=images;
        if(a.width!==b.width||a.height!==b.height)return {ratio:1,differentSize:true};
        const canvas=document.createElement('canvas');canvas.width=a.width;canvas.height=a.height;
        const c=canvas.getContext('2d',{willReadFrequently:true});
        const pixels=images.map(image=>{c.clearRect(0,0,a.width,a.height);c.drawImage(image,0,0);return c.getImageData(0,0,a.width,a.height).data;});
        let count=0;
        for(let i=0;i<pixels[0].length;i+=4)if(pixels[0].slice(i,i+4).some((v,offset)=>Math.abs(v-pixels[1][i+offset])>8))count++;
        return {ratio:count/(a.width*a.height),size:[a.width,a.height]};
      },sources);
      results.push({name,...metrics,pass:metrics.ratio<=tolerance});
    }
    const report={tolerance,pixelChannelAllowance:8,results};
    writeFileSync(join(candidate,'visual-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
    assert.ok(results.every(r=>r.pass),'Visual regression exceeds 2%.');
  }finally{await harness.close();}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
