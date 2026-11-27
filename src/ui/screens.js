import { LEVELS, SPECIES, text, UPGRADES } from '../data/index.js';
import { ACHIEVEMENTS, UPGRADE_NAMES, MISSION_NAMES } from '../data/meta.js';
const escape = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,primary=false)=>'<button data-action="'+action+'" class="'+(primary?'primary':'')+'">'+label+'</button>';
export class Screens {
 constructor(root,meta,onAction){
  this.root=root;this.meta=meta;this.onAction=onAction;this.selected=1;this.mode='';this.game=null;
  root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)onAction(b.dataset.action,b.dataset);});
  root.addEventListener('input',e=>{const k=e.target.dataset.setting;if(!k)return;meta.settings[k]=e.target.type==='checkbox'?e.target.checked:+e.target.value;meta.save(true);onAction('settings.changed');});
 }
 show(mode,game){
  this.mode=mode;this.game=game;document.body.classList.toggle('playing',mode==='PLAY');
  const m=this.meta,level=LEVELS.find(l=>l.level===this.selected)||LEVELS[0];
  const heading=(name,aside='')=>'<div class="panel-top"><h2>'+name+'</h2><span class="tiny">'+aside+'</span>'+button('home','回鲸宫')+'</div>';
  if(mode==='PLAY'){this.root.innerHTML='<button class="pause-hint" data-action="pause" aria-label="暂停游戏">Esc · 歇一会</button>';return;}
  if(mode==='TITLE'){
   this.root.innerHTML='<section class="panel title-card"><div class="eyebrow">WHALE PALACE / NIGHT SHIFT</div><h1>鲸歌梦海</h1><p class="subtitle">今晚，也有人睡不着。</p>'+button('orders','接今晚的班',true)+'<div class="footer-nav">'+button('journal','值班手记')+button('shop','小金库')+button('settings','设置')+'</div><p class="tiny">WASD 游动 · Shift 冲刺 · J 猛扑<br>按住 F 唱四拍，圆环合拢时松手</p><span class="stamp">夜班</span></section>';return;
  }
  if(mode==='ORDERS'){
   this.root.innerHTML='<section class="panel work-panel">'+heading('今晚的派工单','鲸宫账房 · 按夜派工')+'<div class="dispatch">'+LEVELS.map(l=>{
    const v=m.levels[l.level];return '<button class="order '+(this.selected===l.level?'active':'')+'" data-action="select" data-level="'+l.level+'" '+(!v.unlocked?'disabled':'')+'><span class="night">第 '+l.level+' 夜</span><h3>'+escape(text(l.nameKey))+'</h3><p>'+escape(text(l.client.nameKey))+'</p><p>'+escape(text(l.client.summaryKey))+'</p><span class="rating">'+('★'.repeat(l.pressure))+'<br>'+(v.cleared?'评价 '+v.best:v.unlocked?'待接单':'前夜完成后开放')+'</span></button>';
   }).join('')+'</div><div class="brief-foot"><p>'+escape(text(level.client.lineKey))+'</p><div class="actions">'+(m.levels[this.selected].cleared?button('revisit','再进这个梦'):'')+button('accept','接单入梦',true)+'</div></div></section>';return;
  }
  if(mode==='BRIEF'){
   const l=game?.level||level;this.root.innerHTML='<section class="panel centered"><div class="eyebrow">NIGHT '+l.level+' / DREAM DELIVERY</div><h2>'+escape(text(l.client.nameKey))+'</h2><p>'+escape(text(l.client.lineKey))+'</p><p class="tiny">碰到梦鱼，护送回月光井。<br>穿过裂隙后，吃忆质长大，听见前辈的心事。</p><div class="actions">'+button('begin','进入这个梦',true)+'</div></section>';return;
  }
  if(mode==='PAUSE'){
   this.root.innerHTML='<section class="panel centered"><h2>灯还为你亮着</h2><p class="tiny">WASD 游动 · Shift 冲刺 · J 猛扑<br>F 鲸歌 · Tab 海图 · Esc 继续</p><div class="actions">'+button('resume','继续值班',true)+button('settings','设置')+button('home','回鲸宫')+'</div></section>';return;
  }
  if(mode==='SHOP'){
   this.root.innerHTML='<section class="panel work-panel">'+heading('鲸宫小金库','珍珠 '+m.pearls)+'<div class="shop-grid">'+Object.entries(UPGRADES).map(([k,u])=>{
    const lv=m.upg[k],cost=u.prices[lv];return '<div class="upgrade"><h3>'+UPGRADE_NAMES[k]+'</h3><p>'+['○','○','○','○','○'].map((_,i)=>i<lv?'●':'○').join('')+'</p><p>'+({belly:'稳度消耗每级 −8%',fin:'游速每级 +4%',fat:'生命每级 +10%',echo:'范围 +8% · 冷却 −0.8秒'}[k])+'</p><button data-action="buy" data-key="'+k+'" '+(cost===undefined||m.pearls<cost?'disabled':'')+'>'+(cost===undefined?'已满级':cost+' 珍珠')+'</button></div>';
   }).join('')+'</div><p class="tiny">本班任务：'+m.data.missions.active.map(id=>MISSION_NAMES[id]).join(' · ')+'</p></section>';return;
  }
  if(mode==='JOURNAL'){
   const d=m.data;this.root.innerHTML='<section class="panel work-panel">'+heading('值班手记',d.achievements.length+' / 20 成就')+'<div class="journal"><section><h3>海里遇见的朋友 · '+d.codex.species.length+'/9</h3><div class="entries">'+Object.values(SPECIES).map(s=>'<span class="entry">'+(d.codex.species.includes(s.key)?escape(text(s.nameKey)):'？')+'</span>').join('')+'</div></section>'+LEVELS.map(l=>'<section><h3>第'+l.level+'夜 · '+escape(text(l.client.nameKey))+'</h3>'+[0,1,2].map(i=>'<blockquote>'+(d.codex.fragments.includes(l.level+'-'+(i+1))?escape(text('level.'+l.level+'.fragment.'+i)):'尚未找到这段心事')+'</blockquote>').join('')+(d.codex.hearts.includes(l.level)?'<p>'+escape(text('boss.'+l.boss+'.defeat'))+'</p>':'')+'</section>').join('')+'<section><h3>收好的纪念品 · '+d.souvenirs.length+'/5</h3><p>'+['铅笔盒','半只碗','项圈','工牌','抹布'].map((s,i)=>d.souvenirs.includes(i+1)?s:'？').join(' · ')+'</p></section><section><h3>夜班印记</h3><div class="entries">'+ACHIEVEMENTS.map(a=>'<span class="entry">'+(d.achievements.includes(a.id)?'● ':'○ ')+a.name+'</span>').join('')+'</div></section></div></section>';return;
  }
  if(mode==='SETTINGS'){
   const s=m.settings;this.root.innerHTML='<section class="panel centered"><h2>值班设置</h2><div class="settings-list"><label>屏幕震动<input aria-label="屏幕震动" data-setting="shake" type="range" min="0" max="1" step=".1" value="'+s.shake+'"></label><label>高对比轮廓<input data-setting="contrast" type="checkbox" '+(s.contrast?'checked':'')+'></label><label>静音<input data-setting="muted" type="checkbox" '+(s.muted?'checked':'')+'></label></div>'+(!m.persistent?'<p class="tiny">本次存档不会保存</p>':'')+'<div class="actions">'+button('settings.back','收好',true)+'</div></section>';return;
  }
  if(mode==='DAWN'){
   const r=game.result,rc=r.receipt;const failure={FADED:'梦散了，下次再来',RESCUED:'鲸宫已经接你回家',DEVOURED:'先歇一歇，再唱一次'};
   const row=(a,b,i)=>'<div class="receipt-row" style="animation-delay:'+i*.08+'s"><span>'+a+'</span><strong>'+b+'</strong></div>';
   this.root.innerHTML='<section class="panel receipt"><div class="eyebrow">WHALE PALACE / DAILY RECEIPT</div><h2>夜班日报</h2><p class="receipt-head">'+(rc.win?'她愿意松开手了':failure[r.outcome]||'今晚辛苦了')+'</p><div class="stamp">'+(rc.win?rc.rank:'归')+'</div>'+row('完成的梦','第 '+game.level.level+' 夜',0)+row('送达 / 心事 / 旋律',rc.delivered+' / '+rc.fragments+' / '+rc.melodies,1)+row('值班用时',Math.floor(rc.seconds/60)+'分'+Math.floor(rc.seconds%60)+'秒',2)+row('忆质得分',rc.score,3)+row('工资 / 任务 / 首通',rc.wage+' / '+rc.taskPay+' / '+rc.first,4)+row(rc.win?'本班收入':'本班收入（保留三成）','+'+rc.pay+' 珍珠',5)+(rc.earned.length?'<p class="tiny">'+rc.earned.map(a=>a.name).join(' · ')+'</p>':'')+'<div class="actions">'+button('retry','再进这个梦',true)+button('orders','收好派工单')+'</div><p class="tiny">回鲸宫后可以用珍珠升级。</p></section>';return;
  }
  if(mode==='MAP'){this.root.innerHTML='<section class="panel map-panel"><div class="panel-top"><h3>梦的海图</h3><span class="tiny">● 你　◇ 目标　♫ 旋律　□ 体型门</span>'+button('resume','收起 · Tab')+'</div><canvas id="map" width="900" height="360"></canvas></section>';}
 }
}

