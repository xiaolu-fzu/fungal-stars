// ===== 真菌星域 v5 —— 派遣=单种子飞往他星 / 种花占领 / 派遣范围 / 血量选中显示 =====
"use strict";
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const dpr=Math.min(devicePixelRatio||1,2);
const U={ W:3400, H:2300 }, cam={ x:0, y:0, zoom:0.5 };
const OWNER={0:'#5a646e',1:'#5fbf8f',2:'#c95f8a'}, OWNER_NAME={0:'中立',1:'我方',2:'敌方'};
const LASER={0:'#9aa4ac',1:'#2ec47a',2:'#ec5c9c'};
const BAL={ maxTrees:4, treeCost:10, prodInterval:1.8, budTime:20, perSegmentTime:10, treeDepth:5, treeSpread:0.42, treeLen0:20, treeShrink:0.6, budFlySpeed:90, flowerCost:10, flowerInterval:2.6,
  sendRatio:0.5, seedSpin:0.6, combatRange:40, atkCooldown:0.55, treeHp:22, chaseAng:2.0, treeHit:0.15, convergeSpeed:95, fleetSpeedBase:55, fleetSpeedVar:9,
  defDmg:1.6, defRate:1.0, dispatchBase:340, dispatchPerSpeed:42 };
const G={ planets:[], travel:[], lasers:[], sel:null, qty:0, shake:0, over:false, won:false, lastAI:0, time:0 };
let rngState=0;
function rnd(){ rngState=(rngState*1103515245+12345)&0x7fffffff; return rngState/0x7fffffff; }
function rr(a,b){ return a+(b-a)*rnd(); }
function reseed(s){ rngState=s; }
function newSeed(p,owner){ const ang=rnd()*6.283, rad=p.r+6+rnd()*7, spin=BAL.seedSpin*(0.7+rnd()*0.6)*(p.speed*0.06+0.7);
  return { x:p.x+Math.cos(ang)*rad, y:p.y+Math.sin(ang)*rad, ang, rad, spin, owner, mode:'orbit', tx:0,ty:0, arr:false, landing:false,
    energy:p.energy, strength:p.strength, spd:p.speed, hp:2*p.energy, attack:p.strength, atkT:0 }; }
function spawnSeed(p,owner,x,y){ const s=newSeed(p,owner); if(x!==undefined){s.x=x;s.y=y;} p.seedlings.push(s); }
function present(p,o){ return p.seedlings.filter(s=>s.owner===o&&s.mode==='orbit'); }
function dispatchRange(p){ return BAL.dispatchBase + p.speed*BAL.dispatchPerSpeed; }
function inRange(from,to){ return Math.hypot(from.x-to.x,from.y-to.y)<=dispatchRange(from); }

function genPlanets(){
  G.planets=[]; G.travel=[]; G.sel=null; G.qty=0; G.over=false; G.won=false; G.time=0;
  const N=18;
  for(let i=0;i<N;i++){
    let x=rr(120,U.W-120),y=rr(120,U.H-120),tries=0;
    while(G.planets.some(p=>Math.hypot(p.x-x,p.y-y)<300)&&tries<120){ x=rr(140,U.W-140);y=rr(140,U.H-140);tries++; }
    const energy=Math.round(rr(2,10)),strength=Math.round(rr(2,10)),speed=Math.round(rr(2,10)),maxHp=70+energy*22;
    const owner=(i===0)?1:(i===1||i===2)?2:0;
    const p={ id:i,x,y,r:26+energy*3.4,owner,hp:maxHp,maxHp,energy,strength,speed,
      prod:[],def:[],flowers:[],seedlings:[],prodT:rr(0.3,1)*BAL.prodInterval,defT:0,conv:{active:false} };
    if(owner===1||owner===2){ const _bt=buildTree(p,-0.7); p.prod.push({ang:-0.7,order:_bt.order,tips:_bt.tips,segT:0,revealed:0,budTip:0,budT:0}); }
    if(owner===2&&i===2) p.def.push({ang:1.1,born:G.time});
    const startN= owner===1?16:owner===2?12:0;
    for(let k=0;k<startN;k++) spawnSeed(p,owner===0?0:owner);
    G.planets.push(p);
  }
  G.lastAI=0;
}
function addShake(a){ G.shake=Math.max(G.shake,a); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function buildTree(p, ang){ const bx=p.x+Math.cos(ang)*p.r, by=p.y+Math.sin(ang)*p.r;
  const segs=[];
  function rec(x,y,a,d){ const L=BAL.treeLen0*Math.pow(BAL.treeShrink,d); const ex=x+Math.cos(a)*L, ey=y+Math.sin(a)*L;
    const node={x1:x,y1:y,x2:ex,y2:ey,w:Math.max(0.6,2.4*Math.pow(0.75,d)),d,children:[]}; segs.push(node);
    if(d<BAL.treeDepth){ node.children.push(rec(ex,ey,a-BAL.treeSpread,d+1)); node.children.push(rec(ex,ey,a+BAL.treeSpread,d+1)); }
    return node; }
  rec(bx,by,ang,0);
  const order=[]; const q=[segs[0]]; while(q.length){ const n=q.shift(); order.push(n); q.push(...n.children); }
  return {order, tips:segs.filter(s=>s.d===BAL.treeDepth)};
}
function defDPS(p){ if(!p.def.length) return 0; return p.def.length*(BAL.defDmg+BAL.defDmg*0.2*p.strength*0.06); }

function sendFleet(from,to,count){
  const c=present(from,from.owner); if(count<=0||count>c.length) return;
  const arr=[...c], speed=BAL.fleetSpeedBase+from.speed*BAL.fleetSpeedVar;
  for(let k=0;k<count;k++){ const idx=Math.floor(rnd()*arr.length); const s=arr.splice(idx,1)[0];
    from.seedlings.splice(from.seedlings.indexOf(s),1); G.travel.push({x:s.x,y:s.y,owner:from.owner,to,speed}); }
  Sfx.spawn();
}
function startPlant(p,owner,kind){
  if(p.conv.active){ Sfx.error(); return; }
  const cost= kind==='flower'?BAL.flowerCost:BAL.treeCost;
  if(kind==='prod' && p.owner===owner && (p.prod.length+p.def.length)>=BAL.maxTrees){ Sfx.error(); return; }
  const own=present(p,owner); if(own.length<cost){ Sfx.error(); return; }
  const ang= kind==='prod'? -0.7+p.prod.length*0.7 : kind==='def'? 1.1+p.def.length*0.8 : rnd()*6.283;
  const tx=p.x+Math.cos(ang)*p.r, ty=p.y+Math.sin(ang)*p.r;
  let marked=0; for(let k=0;k<p.seedlings.length&&marked<cost;k++){ const s=p.seedlings[k]; if(s.owner===owner&&s.mode==='orbit'){ s.mode='converge'; s.tx=tx;s.ty=ty;s.arr=false;s.landing=false; marked++; } }
  p.conv={ active:true, owner, kind, tx, ty, ang, total:cost }; Sfx.select();
}
function applyPlant(p){
  const c=p.conv;
  if(p.owner===0 && c.kind==='prod'){ // 中立星球种繁殖树=占领
    p.owner=c.owner; p.seedlings=p.seedlings.filter(s=>s.owner===c.owner); p.def=p.def.filter(()=>false); p.flowers=[]; Sfx.capture(); addShake(7);
  }
  if(c.kind==='prod'){ const _bt=buildTree(p,c.ang); p.prod.push({ang:c.ang,order:_bt.order,tips:_bt.tips,segT:0,revealed:0,budTip:0,budT:0}); Sfx.flower(); }
  else if(c.kind==='def') p.def.push({ang:c.ang,born:G.time});
  else if(c.kind==='flower'){ p.flowers.push({px:c.tx,py:c.ty,seedT:BAL.flowerInterval}); Sfx.flower(); }
  p.seedlings=p.seedlings.filter(s=>!(s.mode==='converge'&&s.owner===c.owner)); p.conv={active:false};
}

function isContested(p){ for(const s of p.seedlings){ if(s.mode==='orbit'&&s.hp>0&&s.owner!==p.owner) return true; } return false; }

function seekHostile(p,s,orbit){
  let best=null, bd=1e9;
  for(const b of orbit){ if(b===s||b.owner===s.owner||b.hp<=0) continue; const d=Math.hypot(b.x-s.x,b.y-s.y);
    if(d<bd){ bd=d; best={kind:'seed',ref:b,cx:b.x,cy:b.y,ax:b.x,ay:b.y}; } }
  if(p.owner!==s.owner){ for(const t of p.prod){ if(t.dead) continue;
    const ax=p.x+Math.cos(t.ang)*p.r, ay=p.y+Math.sin(t.ang)*p.r;
    const cx=p.x+Math.cos(t.ang)*(p.r+10), cy=p.y+Math.sin(t.ang)*(p.r+10);
    const d=Math.hypot(ax-s.x,ay-s.y); if(d<bd){ bd=d; best={kind:'tree',ref:t,cx,cy,ax,ay}; } } }
  return best;
}

function combatPlanet(p,dt){
  const orbit=p.seedlings.filter(s=>s.mode==='orbit');
  const bandLo=p.r+5, bandHi=p.r+16;
  // 轨道带内主动追击：向最近敌人/繁殖树推进，但不穿透星球、不脱离轨道带
  for(const s of orbit){ if(s.hp<=0) continue;
    const tgt=seekHostile(p,s,orbit);
    if(tgt){
      const ta=Math.atan2(tgt.cy-p.y,tgt.cx-p.x), tr=Math.min(bandHi,Math.max(bandLo,Math.hypot(tgt.cy-p.y,tgt.cx-p.x)));
      let da=ta-s.ang; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
      s.ang+=Math.sign(da)*Math.min(Math.abs(da), BAL.chaseAng*dt);
      s.rad+=(tr-s.rad)*Math.min(1, dt*5);
      s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad;
      s.atkT-=dt;
      if(s.atkT<=0 && Math.hypot(tgt.ax-s.x,tgt.ay-s.y)<=BAL.combatRange){
        if(tgt.kind==='seed') tgt.ref.hp-=s.attack;
        else { if(tgt.ref.hp===undefined) tgt.ref.hp=2*p.maxHp; tgt.ref.hp-=s.attack*BAL.treeHit; if(tgt.ref.hp<=0&&!tgt.ref.dead){ tgt.ref.dead=true; tgt.ref.bx=tgt.ax; tgt.ref.by=tgt.ay; Sfx.hit(); } }
        s.atkT=BAL.atkCooldown;
        if(cam.zoom>=7) G.lasers.push({x1:s.x,y1:s.y,x2:tgt.ax,y2:tgt.ay,life:0.11,owner:s.owner});
      }
    }
  }
  p.seedlings=p.seedlings.filter(s=>(s.mode!=='orbit')||s.hp>0);
  const own=p.seedlings.filter(s=>s.mode==='orbit'&&s.hp>0&&s.owner===p.owner);
  const inv=p.seedlings.filter(s=>s.mode==='orbit'&&s.hp>0&&s.owner!==p.owner);
  // 清光守军且繁殖树皆破 → 入侵者转入核心
  if(p.owner!==0 && inv.length>0 && own.length===0 && !p.prod.some(t=>!t.dead)){
    const cnt={}; for(const s of inv) cnt[s.owner]=(cnt[s.owner]||0)+1; let faction=inv[0].owner;
    for(const k in cnt) if(cnt[k]>(cnt[faction]||0)) faction=+k;
    for(const s of inv){ if(s.owner!==faction) continue; if(s.core) continue; s.mode='converge'; s.landing=true; s.tx=p.x; s.ty=p.y; s.arr=false; s.core=true; }
  }
  // 核心入口：收拢到中心的入侵者被销毁，伤害=它的HP
  for(const s of p.seedlings){ if(s.core&&s.mode==='converge'&&s.arr&&Math.hypot(p.x-s.x,p.y-s.y)<7){
    p.hp-=s.hp; s.dead2=true; Sfx.hit(); if(p.hp<=0){ capturePlanet(p,s.owner); return; } } }
  p.seedlings=p.seedlings.filter(s=>!s.dead2&&((s.mode!=='orbit')||s.hp>0));
}

function capturePlanet(p,newOwner){
  p.owner=newOwner; p.hp=p.maxHp;
  p.seedlings=p.seedlings.filter(s=>s.owner===newOwner&&s.mode!=='converge');
  p.prod=p.prod.filter(t=>!t.dead); p.def=p.def.filter(t=>!t.dead);
  for(const t of p.prod){ t.hp=2*p.maxHp; t.dead=false; delete t.bx; delete t.by; }
  for(const t of p.def){ t.hp=2*p.maxHp; t.dead=false; }
  Sfx.capture(); G.shake=Math.max(G.shake,8);
}

function easeIO(t){ return t*t*(3-2*t); }
function setSub(text,alert){ const el=document.getElementById('sub'); if(!el) return; el.innerHTML=text; el.className='show'+(alert?' alert':''); }
function hideSub(){ const el=document.getElementById('sub'); if(!el) return; el.className=''; }
function spawnEnvaders(){
  const s=tutor.start, st=tutor.stage; if(!st) return;
  const base=BAL.fleetSpeedBase;
  for(let k=0;k<5;k++){ const a=k*6.283/5; const rx=st.x+Math.cos(a)*(st.r+7), ry=st.y+Math.sin(a)*(st.r+7);
    G.travel.push({x:rx,y:ry,owner:2,to:s,speed:base+Math.random()*12,energy:20,strength:0,spd:6,hp:40,attack:0}); }
  Sfx.shoot();
}
function startTutorial(){
  const start=G.planets[0];
  start.owner=0; start.seedlings=[]; start.prod=[]; start.def=[]; start.flowers=[]; start.conv={active:false};
  start.energy=6; start.strength=6; start.speed=6; start.maxHp=70+start.energy*22; start.hp=start.maxHp; start.defT=0;
  for(let k=0;k<20;k++) spawnSeed(start,1);
  let stage=null,bd=1e9;
  for(const p of G.planets){ if(p===start||p.owner!==0) continue; const d=Math.hypot(p.x-start.x,p.y-start.y); if(d<bd){bd=d;stage=p;} }
  if(!stage){ for(const p of G.planets){ if(p===start) continue; stage=p; break; } }
  tutor={start,stage,phase:'plant',zoom:7,targetZoom:3.8,zoomT:0,dwell:0};
  camLocked=true; cam.zoom=7; cam.x=start.x-innerWidth/7/2; cam.y=start.y-innerHeight/7/2;
  setSub("你好，指挥官。我们降落到了一颗中立星球上。<br>现在请你点击星球，种植一颗繁殖树。");
}
function tickTutorial(dt){
  if(!tutor) return;
  const s=tutor.start, sw=innerWidth, sh=innerHeight;
  if(tutor.phase==='unlock'){
    tutor.zoomT+=dt; const t=Math.min(1,tutor.zoomT/3.4); cam.zoom=tutor.zoom+(tutor.targetZoom-tutor.zoom)*easeIO(t);
    cam.x=s.x-sw/cam.zoom/2; cam.y=s.y-sh/cam.zoom/2;
    if(t>=1){ camLocked=false; tutor=null; hideSub(); return; }
  } else {
    cam.zoom=tutor.zoom; cam.x=s.x-sw/cam.zoom/2; cam.y=s.y-sh/cam.zoom/2;
  }
  const ph=tutor.phase;
  if(ph==='plant'){ if(s.owner===1){ tutor.phase='grow'; setSub("已占领这颗中立星球！繁殖树正在生长…"); } }
  else if(ph==='grow'){ if(s.prod.length && s.prod.some(t=>t.revealed>=1)){ tutor.phase='spore'; tutor.dwell=0; setSub("繁殖树会为你提供袍子。<br>种植一颗繁殖树需要10个袍子。"); } }
  else if(ph==='spore'){ tutor.dwell+=dt; if(tutor.dwell>=4){ tutor.phase='enemy'; setSub("！！敌人来袭！！",true); spawnEnvaders(); } }
  else if(ph==='enemy'){ const battle=s.seedlings.some(x=>x.owner===2&&x.hp>0)||G.travel.some(x=>x.owner===2&&x.to===s);
    if(!battle){ tutor.phase='win'; tutor.dwell=0; setSub("我们首站告捷，现在请你独自完成征服这片星空的使命！"); } }
  else if(ph==='win'){ tutor.dwell+=dt; if(tutor.dwell>=5){ tutor.phase='unlock'; tutor.zoomT=0; } }
}
function update(dt){
  G.time+=dt; G.shake=Math.max(0, G.shake-dt*36);
  tickTutorial(dt);
  for(const p of G.planets){
    if(p.owner!==0 && p.prod.length>0 && !isContested(p)){ for(const t of p.prod){
    if(t.dead) continue;
    if(t.revealed < t.order.length){
      t.segT += dt;
      if(t.segT >= BAL.perSegmentTime){ t.segT=0; const seg=t.order[t.revealed]; // 每长好一根分叉→掉一颗雹子(脱落+飞)
        G.travel.push({x:seg.x2,y:seg.y2,owner:p.owner,to:p,speed:BAL.budFlySpeed}); t.revealed++; }
    } else {
      t.budT += dt/BAL.budTime;
      if(t.budT>=1){ const tip=t.tips[t.budTip%t.tips.length]; G.travel.push({x:tip.x,y:tip.y,owner:p.owner,to:p,speed:BAL.budFlySpeed}); t.budT=0; t.budTip=(t.budTip+1)%t.tips.length; }
    } } }
    if(p.owner!==0 && !isContested(p)){ for(const f of p.flowers){ f.seedT-=dt; if(f.seedT<=0){ spawnSeed(p,p.owner,f.px,f.py-4); f.seedT+=BAL.flowerInterval; } } }
    // 种子运动/收拢
    let allArr=true, cnt=0;
    for(const s of p.seedlings){
      if(s.mode==='converge'){ cnt++;
        const tA=Math.atan2(s.ty-p.y,s.tx-p.x), tR=Math.hypot(s.tx-p.x,s.ty-p.y);
        if(!s.landing){ let da=tA-s.ang; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
          s.ang+=Math.sign(da)*Math.min(Math.abs(da), s.spin*1.7*dt); s.rad=Math.max(s.rad,p.r+2);
          s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad; if(Math.abs(da)<0.09) s.landing=true; }
        else { s.ang=tA; s.rad-=BAL.convergeSpeed*dt; if(s.rad<=tR){ s.rad=tR; s.arr=true; } s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad; }
        if(!s.arr) allArr=false;
      } else if(s.mode==='orbit'){ s.ang+=s.spin*dt; s.rad=Math.max(p.r+5,s.rad); s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad; }
    }
    if(p.conv.active && cnt>=p.conv.total && allArr) applyPlant(p);
    // 防御树射"外来"飞行/绕行种子(附近)
    if(p.owner!==0 && p.def.length>0){ p.defT-=dt;
      if(p.defT<=0){ const near=G.travel.find(t=>t.owner!==p.owner&&Math.hypot(t.x-p.x,t.y-p.y)<=p.r+60);
        const invO=p.seedlings.find(s=>s.owner!==p.owner&&s.hp>0&&s.mode==='orbit'&&Math.hypot(s.x-p.x,s.y-p.y)<=p.r+60);
        if(invO){ invO.hp-=BAL.defDmg; if(cam.zoom>=7) G.lasers.push({x1:p.x,y1:p.y,x2:invO.x,y2:invO.y,life:0.11,owner:p.owner}); Sfx.hit(); p.defT=1/(BAL.defRate+p.strength*0.04); }
        else if(near){ G.travel.splice(G.travel.indexOf(near),1); Sfx.hit(); p.defT=1/(BAL.defRate+p.strength*0.04); } else p.defT=0.15; } }
    combatPlanet(p,dt);
  }
  // 飞行种子
  for(let i=G.travel.length-1;i>=0;i--){ const t=G.travel[i],to=t.to; if(!to){G.travel.splice(i,1);continue;}
    const dx=to.x-t.x,dy=to.y-t.y,d=Math.hypot(dx,dy);
    if(d<=to.r+9){ // 到达外圈轨道带即切换绕行，到达位置=轨道半径，无跳变
      const ang=Math.atan2(t.y-to.y,t.x-to.x), rad=Math.min(Math.max(Math.hypot(t.x-to.x,t.y-to.y),to.r+5),to.r+15);
      to.seedlings.push({x:t.x,y:t.y,ang,rad,spin:BAL.seedSpin*(0.7+rnd()*0.6)*(to.speed*0.06+0.7),owner:t.owner,mode:'orbit',tx:0,ty:0,arr:false,landing:false,energy:t.energy!==undefined?t.energy:to.energy,strength:t.strength!==undefined?t.strength:to.strength,spd:t.spd!==undefined?t.spd:to.speed,hp:t.hp!==undefined?t.hp:2*to.energy,attack:t.attack!==undefined?t.attack:to.strength,atkT:0});
      G.travel.splice(i,1);
    } else { t.x+=dx/d*t.speed*dt; t.y+=dy/d*t.speed*dt;
      // 飞行路径不穿透任何星球：进入某星球盘内则贴到其表面(顺势绕过)
      for(const pl of G.planets){ const px=t.x-pl.x, py=t.y-pl.y, pd=Math.hypot(px,py), minR=pl.r+3;
        if(pd<minR){ const nx=px/(pd||1), ny=py/(pd||1); t.x=pl.x+nx*minR; t.y=pl.y+ny*minR; } } }
  }
  for(let i=G.lasers.length-1;i>=0;i--){ G.lasers[i].life-=dt; if(G.lasers[i].life<=0) G.lasers.splice(i,1); }
  G.lastAI-=dt; if(G.lastAI<=0){if(!tutor)AI(); G.lastAI=2.4;}
  const mine=G.planets.filter(p=>p.owner===1).length, theirs=G.planets.filter(p=>p.owner===2).length;
  if(!tutor){ if(!mine) gameover(false); else if(!theirs) gameover(true); }
}
function AI(){ for(const p of G.planets.filter(q=>q.owner===2)){
  const own=present(p,2).length;
  if(own>28 && (p.prod.length+p.def.length)<BAL.maxTrees && !p.conv.active) startPlant(p,2,'prod');
  const targets=G.planets.filter(q=>q.owner!==2&&q.id!==p.id&&inRange(p,q));
  if(targets.length&&own>16){ const t=targets.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]; sendFleet(p,t,Math.floor(own*0.5)); Sfx.shoot(); }
  for(const t of targets){ if(t.owner!==2 && present(t,2).length>=BAL.flowerCost && !t.conv.active){ startPlant(t,2,'flower'); break; } }
}}
function gameover(won){ G.over=true; G.won=won; addShake(12); const ov=document.getElementById('over'); ov.style.display='grid';
  ov.innerHTML='<div class="box"><h1 style="color:'+(won?'#7fe0a0':'#e07f8a')+'">'+(won?'菌毯已吞噬整片星域':'菌群被吞噬殆尽')+'</h1><p>你占据 '+G.planets.filter(p=>p.owner===1).length+' / '+G.planets.length+' 颗星球</p><button id="again">再来一局</button></div>';
  document.getElementById('again').onclick=()=>{reset();}; if(won)Sfx.win(); else Sfx.lose();
}
function reset(){ genPlanets(); startTutorial(); document.getElementById('over').style.display='none'; }

function render(){ ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#f3f4f0'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(dpr*cam.zoom,0,0,dpr*cam.zoom,-cam.x*dpr*cam.zoom+dpr*(Math.random()*2-1)*G.shake,-cam.y*dpr*cam.zoom+dpr*(Math.random()*2-1)*G.shake);
  ctx.fillStyle='rgba(150,160,170,0.5)'; for(let i=0;i<160;i++){const x=(i*971)%U.W,y=(i*613)%U.H,r=(i%3)*0.4+0.3;ctx.globalAlpha=0.2+(i%5)*0.08;ctx.fillRect(x,y,r,r);} ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(120,140,150,0.12)'; for(let i=0;i<G.planets.length;i++)for(let j=i+1;j<G.planets.length;j++){const a=G.planets[i],b=G.planets[j];if(Math.hypot(a.x-b.x,a.y-b.y)<420){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
  // 飞行种子
  for(const t of G.travel){ ctx.fillStyle=OWNER[t.owner]; ctx.beginPath(); ctx.arc(t.x,t.y,2,0,7); ctx.fill(); }
  // 星球
  for(const p of G.planets) drawPlanet(p);
  // 派遣范围：选中星球 = 琥珀虚线大圈 + 内侧淡暖
  if(G.sel){ const R=dispatchRange(G.sel);
    ctx.setLineDash([14,10]); ctx.strokeStyle='rgba(212,150,40,0.62)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(G.sel.x,G.sel.y,R,0,7); ctx.stroke(); ctx.setLineDash([]);
    const ft=ctx.createRadialGradient(G.sel.x,G.sel.y,G.sel.r*1.1,G.sel.x,G.sel.y,R); ft.addColorStop(0,'rgba(212,150,40,0.06)'); ft.addColorStop(1,'rgba(212,150,40,0)'); ctx.fillStyle=ft; ctx.beginPath(); ctx.arc(G.sel.x,G.sel.y,R,0,7); ctx.fill();
  }
  // 可达性：可达=绿虚线环+柔光，不可达=灰点环（白底清晰）
  if(G.sel){ for(const q of G.planets){ if(q===G.sel) continue; const ok=inRange(G.sel,q);
    if(ok){ ctx.setLineDash([7,5]); ctx.strokeStyle='rgba(46,168,110,0.78)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.stroke(); ctx.setLineDash([]);
      const gt=ctx.createRadialGradient(q.x,q.y,q.r*0.9,q.x,q.y,q.r+21); gt.addColorStop(0,'rgba(46,168,110,0)'); gt.addColorStop(0.85,'rgba(46,168,110,0.09)'); gt.addColorStop(1,'rgba(46,168,110,0.04)'); ctx.fillStyle=gt; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.fill();
    } else { ctx.setLineDash([3,5]); ctx.strokeStyle='rgba(140,148,156,0.4)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.stroke(); ctx.setLineDash([]); }
  } }
  if(G.sel&&G.qty>0){ const p=G.sel; ctx.fillStyle='rgba(212,150,40,0.95)'; ctx.font='700 14px system-ui'; ctx.textAlign='center'; ctx.fillText('×'+G.qty+' → 右键目标星', p.x, p.y-p.r-28); ctx.textAlign='start'; }
  if(G.sel){ const p=G.sel;
    // 选中：种子带之外 柔和呼吸光晕 + 虚线环 + 星球本体亮边（不遮挡种子）
    const pulse=0.40+0.14*Math.sin(G.time*2.2);
    const halo=ctx.createRadialGradient(p.x,p.y,p.r+14,p.x,p.y,p.r+28);
    halo.addColorStop(0,'rgba(212,150,40,0)'); halo.addColorStop(0.55,'rgba(212,150,40,'+pulse+')'); halo.addColorStop(1,'rgba(212,150,40,0)');
    ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(p.x,p.y,p.r+28,0,7); ctx.fill();
    ctx.strokeStyle='rgba(212,150,40,'+(pulse+0.35)+')'; ctx.lineWidth=2; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(p.x,p.y,p.r+21,0,7); ctx.stroke(); ctx.setLineDash([]);
  }
  // 战斗激光：仅拉近(zoom≥7)绘制，按攻击方阵营着色
  if(cam.zoom>=7){ ctx.save(); ctx.lineCap='round'; ctx.lineWidth=0.6*(cam.zoom/8);
    for(const l of G.lasers){ ctx.strokeStyle=LASER[l.owner]||'#e0a038'; ctx.beginPath(); ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2); ctx.stroke(); } ctx.restore(); }
}
function drawPlanet(p){ const base=OWNER[p.owner];
  const g=ctx.createRadialGradient(p.x,p.y,p.r*0.2,p.x,p.y,p.r*2.2); g.addColorStop(0,p.owner===0?'rgba(90,100,110,0.35)':hexA(base,0.35)); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.2,0,7); ctx.fill();
  ctx.fillStyle=base; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.12)'; for(let k=0;k<6;k++){ const a=k/6*6.283; ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*p.r*0.5,p.y+Math.sin(a)*p.r*0.5,p.r*0.28,0,7); ctx.fill(); }
  for(const s of p.seedlings){ if(s.mode!=='orbit'&&s.mode!=='converge') continue; ctx.fillStyle=s.mode==='converge'?'#fff':OWNER[s.owner]; ctx.globalAlpha=s.owner===0?0.6:1; ctx.beginPath(); ctx.arc(s.x,s.y,1.7,0,7); ctx.fill(); ctx.globalAlpha=1; }
  for(const t of p.prod){ ctx.strokeStyle='#9fe0b0';
    for(let k=0;k<t.revealed;k++){ const s=t.order[k]; ctx.lineWidth=s.w; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke(); }
    if(t.revealed<t.order.length){ const s=t.order[t.revealed], frac=clamp(t.segT/BAL.perSegmentTime,0,1);
      if(frac>0){ const ex=s.x1+(s.x2-s.x1)*frac, ey=s.y1+(s.y2-s.y1)*frac; ctx.lineWidth=s.w; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(ex,ey); ctx.stroke(); }
      // 生长前端的雹子(与飞行雹子同款小点)，跟着枝干长
      const fx=s.x1+(s.x2-s.x1)*frac, fy=s.y1+(s.y2-s.y1)*frac; ctx.fillStyle=OWNER[p.owner]; ctx.beginPath(); ctx.arc(fx,fy,2,0,7); ctx.fill(); } }
  for(const t of p.def){ const grow=Math.min(1,(G.time-t.born)/0.4),a=t.ang; ctx.fillStyle='#cfe0ff'; ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*(p.r+8*grow),p.y+Math.sin(a)*(p.r+8*grow),4*grow+1,0,7); ctx.fill(); }
  for(const f of p.flowers){ ctx.fillStyle='#f0b0d0'; for(let k=0;k<5;k++){ const aa=k*1.25; ctx.beginPath(); ctx.ellipse(f.px+Math.cos(aa)*4,f.py+Math.sin(aa)*4,2.2,1.6,aa,0,7); ctx.fill(); } ctx.fillStyle='#fff8c0'; ctx.beginPath(); ctx.arc(f.px,f.py,2,0,7); ctx.fill(); }
  // 世界保持干净，信息都在底部面板
  ctx.textAlign='start';
}
function hexA(hex,a){ const h=hex.replace('#',''); const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16); return 'rgba('+r+','+g+','+b+','+a+')'; }

function worldFromScreen(mx,my){ return {x:cam.x+mx/cam.zoom,y:cam.y+my/cam.zoom}; }
function pointOnPlanet(wx,wy){ return G.planets.find(p=>Math.hypot(p.x-wx,p.y-wy)<=p.r+8)||null; }
function layout(){ const sw=innerWidth,sh=innerHeight; cv.width=sw*dpr;cv.height=sh*dpr;cv.style.width=sw+'px';cv.style.height=sh+'px'; cam.zoom=Math.min(sw/U.W,sh/U.H)*0.92; cam.x=(U.W-sw/cam.zoom)/2; cam.y=(U.H-sh/cam.zoom)/2; }
addEventListener('resize',layout);
let tutor=null, camLocked=false;
let drag=null, holdTimer=null, holdFired=false;
function addQty(){ if(G.sel&&G.sel.owner===1){ const av=present(G.sel,1).length; if(G.qty<av){ G.qty++; Sfx.click(); showPanel(G.sel); } } }
cv.addEventListener('pointerdown',e=>{ if(AC.state==='suspended')AC.resume(); if(e.button===0) e.preventDefault(); const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; const w=worldFromScreen(mx,my); const pl=pointOnPlanet(w.x,w.y); drag={mx,my,camx:cam.x,camy:cam.y,planet:pl,moved:false,button:e.button};
  if(e.button===0&&pl&&pl===G.sel&&pl.owner===1){ holdFired=false; holdTimer=setInterval(()=>{ holdFired=true; addQty(); },90); } });
window.addEventListener('pointermove',e=>{ if(!drag)return; const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; if(camLocked){ drag.moved=false; return; } if(Math.hypot(mx-drag.mx,my-drag.my)>6) drag.moved=true;
  if(drag.moved&&(drag.button===0||drag.button===1)&&!drag.planet){ cam.x=drag.camx-(mx-drag.mx)/cam.zoom; cam.y=drag.camy-(my-drag.my)/cam.zoom; } });
window.addEventListener('pointerup',e=>{ if(holdTimer){ clearInterval(holdTimer); holdTimer=null; } if(!drag)return;
  if(drag.button===0&&!drag.moved&&drag.planet&&!holdFired) handleClick(drag.planet);
  holdFired=false; drag=null; });
function handleClick(p){ if(p===G.sel&&p.owner===1){ addQty(); return; } G.sel=p; G.qty=0; if(p.owner===1) Sfx.select(); showPanel(p); }
window.addEventListener('contextmenu',e=>{ e.preventDefault(); const r=cv.getBoundingClientRect(); const w=worldFromScreen(e.clientX-r.left,e.clientY-r.top); const p=pointOnPlanet(w.x,w.y);
  if(G.sel&&G.sel.owner===1&&G.qty>0){ if(p&&inRange(G.sel,p)){ sendFleet(G.sel,p,G.qty); G.qty=0; Sfx.shoot(); showPanel(G.sel); } else Sfx.error(); }
  else { G.sel=null; G.qty=0; hidePanel(); } });
window.addEventListener('wheel',e=>{ if(camLocked) return; e.preventDefault(); const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; const b=worldFromScreen(mx,my); cam.zoom=Math.max(0.22,Math.min(8,cam.zoom*(e.deltaY<0?1.12:0.9))); const a=worldFromScreen(mx,my); cam.x+=b.x-a.x; cam.y+=b.y-a.y; },{passive:false});
function showPanel(p){ const el=document.getElementById('panel'); el.style.display='block';
  const my=present(p,1).length, orbit=p.seedlings.filter(s=>s.mode==='orbit').length;
  const hpF=Math.max(0,Math.min(1,p.hp/p.maxHp)); const hpCol=hpF>0.5?'#6fd06f':(hpF>0.25?'#f0c04a':'#e0574a');
  const attrs='<div class="p-attrs">'
    +'<span class="chip c-en">能量 <b>'+p.energy+'</b></span>'
    +'<span class="chip c-st">力量 <b>'+p.strength+'</b></span>'
    +'<span class="chip c-sp">速度 <b>'+p.speed+'</b></span></div>';
  const hp='<div class="p-hp"><span class="hp-l">生命</span><div class="hp-bar"><i style="width:'+(hpF*100)+'%;background:'+hpCol+'"></i></div><b class="hp-n">'+Math.ceil(p.hp)+'/'+p.maxHp+'</b></div>';
  const info='<div class="p-line">种子 <b>'+orbit+'</b> · 我方 <b>'+my+'</b></div>'
    +'<div class="p-line">繁殖树×'+p.prod.length+' 防御树×'+p.def.length+' / '+BAL.maxTrees+' · 花×'+p.flowers.length+' · 范围 '+Math.round(dispatchRange(p))+'px</div>';
  let btns='';
  if(p.owner===1){ btns='<div class="row"><button id="b_prod">建繁殖树 '+BAL.treeCost+'</button><button id="b_def">建防御树 '+BAL.treeCost+'</button><button id="b_flower">种花 '+BAL.flowerCost+'</button></div>'
    +'<div class="p-hint">派遣：点星球＋1 / 长按累加，再右键目标星球</div>'; }
  else if(p.owner===0 && my>=BAL.treeCost){ btns='<div class="row"><button id="b_prod">种繁殖树·占领 '+BAL.treeCost+'</button></div>'+'<div class="p-hint">你已派 '+my+' 颗种子在此，种繁殖树即可占领</div>'; }
  else if(p.owner===2 && my>=BAL.treeCost){ btns='<div class="p-hint">你已派 '+my+' 颗种子在此；清光守军、摧毁繁殖树并攻入核心即可占领</div>'; }
  el.innerHTML='<div class="p-top"><span class="p-dot" style="background:'+OWNER[p.owner]+'"></span><span class="p-name">'+OWNER_NAME[p.owner]+'星球</span></div>'
    +attrs+hp+info+btns;
  if(p.owner===1){
    el.querySelector('#b_prod').onclick=()=>{ startPlant(p,1,'prod'); showPanel(p); };
    el.querySelector('#b_def').onclick=()=>{ startPlant(p,1,'def'); showPanel(p); };
    el.querySelector('#b_flower').onclick=()=>{ startPlant(p,1,'flower'); showPanel(p); };
  } else if(p.owner===0){ const b=el.querySelector('#b_prod'); if(b) b.onclick=()=>{ startPlant(p,1,'prod'); showPanel(p); }; }
}
function hidePanel(){ document.getElementById('panel').style.display='none'; }
function drawStatus(){ const mine=G.planets.filter(p=>p.owner===1).length,theirs=G.planets.filter(p=>p.owner===2).length; document.getElementById('status').textContent='我方星球 '+mine+' ｜ 敌方 '+theirs+' ｜ 在途 '+G.travel.length; }
let last=performance.now();
function loop(now){ const dt=Math.min((now-last)/1000,0.05); last=now; if(!G.over) update(dt); render(); drawStatus(); requestAnimationFrame(loop); }
layout(); reseed(20240829); genPlanets(); startTutorial(); startAmbient(); requestAnimationFrame(loop);
