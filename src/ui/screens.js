import { LEVELS, SPECIES, text, UPGRADES } from '../data/index.js';
import { ACHIEVEMENTS, UPGRADE_NAMES, MISSION_NAMES } from '../data/meta.js';
import { SOUVENIRS, AFTER_STORIES, SPECIES_NOTES, CODEX_FIELDS } from '../data/narrative.js';
const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t = id => escape(text('ui.' + id));
const button = (action,label,primary=false) => '<button data-action="'+action+'" class="'+(primary?'primary':'')+'">'+label+'</button>';
const night = n => n + ' ' + t('night');
export class Screens {
 constructor(root,meta,onAction){
  this.root=root;this.meta=meta;this.onAction=onAction;this.selected=1;this.mode='';this.game=null;
  root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)onAction(b.dataset.action,b.dataset);});
  root.addEventListener('input',e=>{const k=e.target.dataset.setting;if(!k)return;meta.settings[k]=e.target.type==='checkbox'?e.target.checked:+e.target.value;meta.save(true);onAction('settings.changed');});
  root.addEventListener('toggle',e=>{if(e.target.open&&e.target.dataset.textKey)this.dialogue(e.target.dataset.textKey);},true);
 }
 dialogue(textKey,speaker='player'){this.game?.bus?.emit('dialogue',{speaker,textKey});}
 tasks(){return this.meta.data.missions.active.map(id=>escape(MISSION_NAMES[id])).join(' · ');}
 assistance(level){
  if(!level||this.meta.levels[level].failures<2)return '';
  return '<label class="assist-option">'+t('assistanceActive')+'<input type="checkbox" data-setting="assistance" '+(this.meta.settings.assistance?'checked':'')+'></label>';
 }
 show(mode,game){
  this.mode=mode;this.game=game;document.body.classList.toggle('playing',mode==='PLAY');
  const m=this.meta,level=LEVELS.find(l=>l.level===this.selected)||LEVELS[0];
  const heading=(name,aside='')=>'<div class="panel-top"><h2>'+name+'</h2><span class="tiny">'+aside+'</span>'+button('home',t('home'))+'</div>';
  if(mode==='ENDING'){this.root.innerHTML='';return;}
  if(mode==='PLAY'){
   if(game?.state==='DESCENT'){this.root.innerHTML='<nav class="play-tools">'+button('skip',text('cinema.skip'))+'</nav>';return;}
   this.root.innerHTML='<nav class="play-tools">'+button('map','Tab · '+t('map'))+button('pause','Esc · '+t('pause'))+'</nav>';return;
  }
  if(mode==='TITLE'){
   this.root.innerHTML='<section class="panel title-card"><div class="eyebrow">WHALE PALACE / NIGHT SHIFT</div><h1>'+t('title')+'</h1><p class="subtitle">'+t('titleLine')+'</p>'+button('orders',t('start'),true)+'<div class="footer-nav">'+button('journal',t('journal'))+button('shop',t('shop'))+button('room',t('room'))+button('settings',t('settingsShort'))+'</div><p class="tiny">'+t('controlsMove')+'<br>'+t('song')+'</p><span class="stamp">'+t('shift')+'</span></section>';return;
  }
  if(mode==='ORDERS'){
   this.root.innerHTML='<section class="panel work-panel">'+heading(t('orders'),t('office'))+'<div class="dispatch">'+LEVELS.map(l=>{
    const v=m.levels[l.level];return '<button class="order '+(this.selected===l.level?'active':'')+'" data-action="select" data-level="'+l.level+'" '+(!v.unlocked?'disabled':'')+'><span class="night">'+night(l.level)+'</span><h3>'+escape(text(l.nameKey))+'</h3><p>'+escape(text(l.client.nameKey))+'</p><p>'+escape(text(l.client.summaryKey))+'</p><span class="rating">'+('★'.repeat(l.pressure))+'<br>'+(v.cleared?t('rank')+' '+v.best:v.unlocked?t('available'):t('locked'))+'</span></button>';
   }).join('')+'</div><div class="brief-foot"><p>'+escape(text(level.client.lineKey))+'</p><div class="actions">'+(m.levels[this.selected].cleared?button('revisit',t('retry')):'')+button('accept',t('accept'),true)+'</div></div></section>';return;
  }
  if(mode==='BRIEF'){
   const l=game?.level||level;this.root.innerHTML='<section class="panel centered"><div class="eyebrow">NIGHT '+l.level+' / DREAM DELIVERY</div><h2>'+escape(text(l.client.nameKey))+'</h2><p>'+escape(text(l.client.lineKey))+'</p><p class="tiny">'+t('briefText')+'</p><p class="tiny">'+t('tasks')+'：'+this.tasks()+'</p>'+this.assistance(l.level)+'<div class="actions">'+button('begin',t('begin'),true)+'</div></section>';
   this.dialogue(l.client.lineKey);return;
  }
  if(mode==='PAUSE'){
   this.root.innerHTML='<section class="panel centered"><h2>'+t('pauseLine')+'</h2><p class="tiny">'+t('controlsMove')+'<br>'+t('controlsPause')+'</p><p class="tiny">'+t('tasks')+'：'+this.tasks()+'</p><div class="actions">'+button('resume',t('resume'),true)+button('settings',t('settingsShort'))+button('home',t('home'))+'</div></section>';return;
  }
  if(mode==='SHOP'){
   this.root.innerHTML='<section class="panel work-panel">'+heading(t('shopTitle'),t('pearlUnit')+' '+m.pearls)+'<div class="shop-grid">'+Object.entries(UPGRADES).map(([k,u])=>{
    const lv=m.upg[k],cost=u.prices[lv];return '<div class="upgrade"><h3>'+escape(UPGRADE_NAMES[k])+'</h3><p>'+[0,1,2,3,4].map(i=>i<lv?'●':'○').join('')+'</p><p>'+t('upg.'+k)+'</p><button data-action="buy" data-key="'+k+'" '+(cost===undefined||m.pearls<cost?'disabled':'')+'>'+(cost===undefined?t('maxLevel'):cost+' '+t('pearlUnit'))+'</button></div>';
   }).join('')+'</div><p class="tiny">'+t('tasks')+'：'+this.tasks()+'</p></section>';return;
  }
  if(mode==='JOURNAL'){
   const d=m.data;
   const species=Object.values(SPECIES).map(s=>d.codex.species.includes(s.key)?'<details class="species-entry"><summary>'+escape(text(s.nameKey))+'</summary><dl>'+CODEX_FIELDS.map(f=>'<dt>'+escape(text('codex.'+f))+'</dt><dd>'+escape(text(SPECIES_NOTES[s.key][f]))+'</dd>').join('')+'</dl></details>':'<span class="entry">？</span>').join('');
   const stories=LEVELS.map(l=>'<section><h3>'+night(l.level)+' · '+escape(text(l.client.nameKey))+'</h3>'+[0,1,2].map(i=>'<blockquote>'+(d.codex.fragments.includes(l.level+'-'+(i+1))?escape(text('level.'+l.level+'.fragment.'+i)):t('unknownFragment'))+'</blockquote>').join('')+(d.codex.hearts.includes(l.level)?'<details class="later-entry" data-text-key="'+AFTER_STORIES[l.level-1].textKey+'"><summary>'+t('later')+'</summary><p>'+escape(text(AFTER_STORIES[l.level-1].textKey))+'</p></details>':'')+'</section>').join('');
   this.root.innerHTML='<section class="panel work-panel">'+heading(t('journal'),d.achievements.length+' / 20 '+t('achievements'))+'<div class="journal"><section><h3>'+t('speciesTitle')+' · '+d.codex.species.length+'/9</h3><div class="entries codex-grid">'+species+'</div></section>'+stories+'<section><h3>'+t('souvenirs')+' · '+d.souvenirs.length+'/5</h3><p>'+SOUVENIRS.map(s=>d.souvenirs.includes(s.level)?escape(text(s.nameKey)):'？').join(' · ')+'</p>'+button('room',t('room'))+'</section><section><h3>'+t('achievementsTitle')+'</h3><div class="entries">'+ACHIEVEMENTS.map(a=>'<span class="entry">'+(d.achievements.includes(a.id)?'● ':'○ ')+escape(a.name)+'</span>').join('')+'</div></section></div></section>';return;
  }
  if(mode==='ROOM'){
   this.root.innerHTML='<section class="panel room-heading">'+heading(t('room'),m.data.souvenirs.length+' / 5')+'<p>'+SOUVENIRS.map(s=>m.data.souvenirs.includes(s.level)?escape(text(s.nameKey)):'？').join(' · ')+'</p></section>';return;
  }
  if(mode==='SETTINGS'){
   const s=m.settings,canAssist=Object.values(m.levels).some(l=>l.failures>=2);
   this.root.innerHTML='<section class="panel centered"><h2>'+t('settings')+'</h2><div class="settings-list"><label>'+t('shake')+'<input aria-label="'+t('shake')+'" data-setting="shake" type="range" min="0" max="1" step=".1" value="'+s.shake+'"></label><label>'+t('contrast')+'<input data-setting="contrast" type="checkbox" '+(s.contrast?'checked':'')+'></label><label>'+t('muted')+'<input data-setting="muted" type="checkbox" '+(s.muted?'checked':'')+'></label><label>'+t('assistance')+'<input data-setting="assistance" type="checkbox" '+(s.assistance?'checked':'')+' '+(!canAssist?'disabled':'')+'></label></div>'+(!m.persistent?'<p class="tiny">'+t('noSave')+'</p>':'')+'<div class="actions">'+button('settings.back',t('close'),true)+'</div></section>';return;
  }
  if(mode==='DAWN'){
   const r=game.result,rc=r.receipt;
   const row=(a,b,i)=>'<div class="receipt-row" style="animation-delay:'+i*.08+'s"><span>'+a+'</span><strong>'+b+'</strong></div>';
   this.root.innerHTML='<section class="panel receipt"><div class="eyebrow">WHALE PALACE / DAILY RECEIPT</div><h2>'+t('dawn')+'</h2><p class="receipt-head">'+(rc.win?t('victory'):t('failure.'+r.outcome))+'</p><div class="stamp">'+(rc.win?rc.rank:t('returnStamp'))+'</div>'+row(t('doneDream'),night(game.level.level),0)+row(t('resultCounts'),rc.delivered+' / '+rc.fragments+' / '+rc.melodies,1)+row(t('duration'),Math.floor(rc.seconds/60)+t('minute')+Math.floor(rc.seconds%60)+t('second'),2)+row(t('score'),rc.score,3)+row(t('incomeParts'),rc.wage+' / '+rc.taskPay+' / '+rc.first,4)+row(t('income')+(rc.win?'':'（'+t('failurePay')+'）'),'+'+rc.pay+' '+t('pearlUnit'),5)+(rc.earned.length?'<p class="tiny">'+rc.earned.map(a=>escape(a.name)).join(' · ')+'</p>':'')+this.assistance(game.level.level)+'<div class="actions">'+button('retry',t('retry'),true)+button('orders',t('ordersClose'))+'</div><p class="tiny">'+t('upgradeHint')+'</p></section>';
   this.dialogue(rc.win?'ui.victory':'ui.failure.'+r.outcome);return;
  }
  if(mode==='MAP')this.root.innerHTML='<section class="panel map-panel"><div class="panel-top"><h3>'+t('mapTitle')+'</h3><span class="tiny">'+t('mapLegend')+'</span>'+button('resume',t('mapClose'))+'</div><canvas id="map" width="900" height="360"></canvas></section>';
 }
}
