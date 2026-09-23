// ===== 真菌星域 v5 —— 派遣=单种子飞往他星 / 种花占领 / 派遣范围 / 血量选中显示 =====
"use strict";
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const dpr=Math.min(devicePixelRatio||1,2);
const U={ W:3400, H:2300 }, cam={ x:0, y:0, zoom:0.5 };
const OWNER={0:'#5a646e',1:'#5fbf8f',2:'#c95f8a',3:'#e08a3a',4:'#a06ae0'}, OWNER_NAME={0:'中立',1:'我方',2:'敌方A',3:'敌方B',4:'敌方C'};
const LASER={0:'#9aa4ac',1:'#2ec47a',2:'#ec5c9c',3:'#f0a24a',4:'#c98ae8'};
const BAL={ maxTrees:4, treeCost:10, prodInterval:1.8, budTime:20, perSegmentTime:10, treeDepth:5, treeSpread:0.42, treeLen0:20, treeShrink:0.6, budFlySpeed:90, flowerCost:10, flowerInterval:2.6,
  sendRatio:0.5, seedSpin:0.6, combatRange:40, atkCooldown:2.0, seedSpace:7, orbitSpeed:4, regenRate:0.333, treeHp:22, chaseAng:2.0, treeHit:0.6, convergeSpeed:95, fleetSpeedBase:55, fleetSpeedVar:9,
  defDmg:1.6, defRate:1.0, missileInterval:2, missileSpeed:120, defTreeGrow:8, dispatchBase:340, dispatchPerSpeed:42 };
const G={ planets:[], travel:[], lasers:[], missiles:[], sel:null, qty:0, shake:0, over:false, won:false, lastAI:0, time:0 };
let rngState=0;
function rnd(){ rngState=(rngState*1103515245+12345)&0x7fffffff; return rngState/0x7fffffff; }
function rr(a,b){ return a+(b-a)*rnd(); }
function reseed(s){ rngState=s; }
function newSeed(p,owner){ const ang=rnd()*6.283, band=Math.floor(rnd()*5), homeR=p.bands?p.bands[band]:p.r+9, spin=BAL.seedSpin*(0.7+rnd()*0.6)*(p.speed*0.06+0.7);
  return { x:p.x+Math.cos(ang)*homeR, y:p.y+Math.sin(ang)*homeR, ang, rad:homeR, band, homeR, spin, owner, mode:'orbit', tx:0,ty:0, arr:false, landing:false,
    energy:p.energy, strength:p.strength, spd:p.speed, hp:2*p.energy, attack:p.strength, atkT:0 }; }
function spawnSeed(p,owner,x,y){ const s=newSeed(p,owner); if(x!==undefined){s.x=x;s.y=y;} p.seedlings.push(s); }
function present(p,o){ return p.seedlings.filter(s=>s.owner===o&&s.mode==='orbit'); }
function dispatchRange(p){ return BAL.dispatchBase + p.speed*BAL.dispatchPerSpeed; }
function inRange(from,to){ return Math.hypot(from.x-to.x,from.y-to.y)<=dispatchRange(from); }

function genPlanets(){
  G.planets=[]; G.travel=[]; G.lasers=[]; G.missiles=[]; G.sel=null; G.qty=0; G.over=false; G.won=false; G.time=0;
  // 关卡式布局: 玩家区(左下) + 敌方A区(右上) + 敌方B区(右下) + 中立连接带
  const L=[[450,1150,1],[800,820,0],[850,1500,0],[500,500,0],[1150,1150,0],[800,1150,4],
    [2750,650,2],[3050,950,0],[2450,420,0],[2350,1000,0],
    [2750,1850,3],[3050,1600,0],[2450,2000,0],[2350,1450,0],
    [1450,1000,0],[1500,1600,0],[1750,1200,0],[1850,1600,0],[1200,1720,0]];
  for(let i=0;i<L.length;i++){ const x=L[i][0], y=L[i][1], owner=L[i][2];
    let energy=Math.round(rr(2,10)),strength=Math.round(rr(2,10)),speed=Math.round(rr(2,10)),maxHp=60+energy*18;
    if(owner===4){ energy=1; strength=1; speed=1; maxHp=50; }
    const p={ id:i,x,y,r:26+energy*3.4,owner,hp:maxHp,maxHp,energy,strength,speed,
      prod:[],def:[],flowers:[],seedlings:[],prodT:rr(0.3,1)*BAL.prodInterval,defT:0,coreT:0,conv:{active:false},bands:[26+energy*3.4+5,26+energy*3.4+9,26+energy*3.4+13,26+energy*3.4+17,26+energy*3.4+21] };
    G.planets.push(p);
  }
  // 连通性校正
  for(let pass=0; pass<80; pass++){ let moved=false;
    for(let i=0;i<G.planets.length;i++){ const p=G.planets[i]; let near=null, nd=1e9;
      for(let jj=0;jj<G.planets.length;jj++){ if(i===jj) continue; const d=Math.hypot(p.x-G.planets[jj].x,p.y-G.planets[jj].y); if(d<nd){nd=d;near=G.planets[jj];} }
      const R=dispatchRange(p);
      if(nd>R){ const dx=near.x-p.x, dy=near.y-p.y, d=Math.hypot(dx,dy)||1, target=R*0.85;
        let nx=p.x+dx/d*Math.max(0,d-target), ny=p.y+dy/d*Math.max(0,d-target);
        nx=Math.max(150,Math.min(U.W-150,nx)); ny=Math.max(150,Math.min(U.H-150,ny)); p.x=nx; p.y=ny; moved=true; } }
    if(!moved) break;
  }
  // 位置定稿后建树/守卫/种子
  for(const p of G.planets){ if(p.owner===0) continue;
    const _bt=buildTree(p,-0.7); p.prod.push({ang:-0.7,order:_bt.order,tips:_bt.tips,segT:0,revealed:0,budTip:0,budT:0,root:makeRoot(p,-0.7)}); }
  for(const p of G.planets){ if(p.owner>=2) p.def.push({ang:1.1,born:G.time,root:makeRoot(p,1.1)}); }
  for(const p of G.planets){ const own0= p.owner===1?16:(p.owner===2||p.owner===3?12:0); for(let k=0;k<own0;k++) spawnSeed(p,p.owner); }
  G.lastAI=0;
}
function addShake(a){ G.shake=Math.max(G.shake,a); }
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function makeRoot(p, ang){
  const bx=p.x+Math.cos(ang)*p.r, by=p.y+Math.sin(ang)*p.r, cx=p.x, cy=p.y;
  const dx=cx-bx, dy=cy-by, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, amp=(rnd()*0.4-0.2)*L;
  const qx=(bx+cx)/2+nx*amp, qy=(by+cy)/2+ny*amp; const pts=[];
  for(let k=0;k<=9;k++){ const t=k/9, mt=1-t; pts.push({x:mt*mt*bx+2*mt*t*qx+t*t*cx, y:mt*mt*by+2*mt*t*qy+t*t*cy}); }
  return pts;
}
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

function ownedRoute(from,to){
  if(inRange(from,to)) return [from,to];
  const owned=G.planets.filter(p=>p.owner===1 && p!==from && p!==to);
  const prev={}; prev[from.id]=null;
  const q=[from];
  while(q.length){
    const cur=q.shift();
    if(inRange(cur,to)){ const seg=[]; let c=cur;
      while(c!==undefined && c!==null){ seg.unshift(c); if(c===from) break; c=prev[c.id]; }
      return seg.concat([to]); }
    for(const n of owned){ if(prev[n.id]!==undefined) continue; if(inRange(cur,n)){ prev[n.id]=cur; q.push(n); } }
  }
  return null;
}
function canReach(from,to){ return ownedRoute(from,to)!==null; }

function sendFleet(from,to,count){
  const c=present(from,from.owner); if(count<=0||count>c.length) return;
  const route=ownedRoute(from,to); if(!route||route.length<2) return;
  const rest=route.slice(1);
  const arr=[...c];
  for(let k=0;k<count;k++){ const idx=Math.floor(rnd()*arr.length); const s=arr.splice(idx,1)[0];
    from.seedlings.splice(from.seedlings.indexOf(s),1);
    G.travel.push({x:s.x,y:s.y,owner:from.owner,to:rest[0],rest:rest.slice(1),speed:BAL.fleetSpeedBase+s.spd*BAL.fleetSpeedVar,energy:s.energy,strength:s.strength,spd:s.spd,hp:s.hp,attack:s.attack}); }
  Sfx.spawn();
}
function startPlant(p,owner,kind){
  if(p.conv.active){ Sfx.error(); return; }
  const cost= kind==='flower'?BAL.flowerCost:BAL.treeCost;
  if(kind!=='flower' && p.owner===owner && (p.prod.length+p.def.length)>=BAL.maxTrees){ Sfx.error(); return; }
  const own=present(p,owner); if(own.length<cost){ Sfx.error(); return; }
  const ang= kind==='prod'? -0.7+p.prod.length*0.7 : kind==='def'? 1.1+p.def.length*0.8 : rnd()*6.283;
  const tx=p.x+Math.cos(ang)*p.r, ty=p.y+Math.sin(ang)*p.r;
  let marked=0; for(let k=0;k<p.seedlings.length&&marked<cost;k++){ const s=p.seedlings[k]; if(s.owner===owner&&s.mode==='orbit'){ s.mode='converge'; s.tx=tx;s.ty=ty;s.arr=false;s.landing=false; marked++; } }
  p.conv={ active:true, owner, kind, tx, ty, ang, total:cost }; Sfx.select();
}
function applyPlant(p){
  const c=p.conv;
  if(p.owner===0 && c.kind==='prod'){ // 中立星球种繁殖树=占领(柔和殖民反馈, 不像战斗攻核心)
    p.owner=c.owner; p.seedlings=p.seedlings.filter(s=>s.owner===c.owner); p.def=p.def.filter(()=>false); p.flowers=[]; Sfx.tree(); addShake(2);
  }
  if(c.kind==='prod'){ const _bt=buildTree(p,c.ang); p.prod.push({ang:c.ang,order:_bt.order,tips:_bt.tips,segT:0,revealed:0,budTip:0,budT:0,root:makeRoot(p,c.ang)}); Sfx.flower(); }
  else if(c.kind==='def') p.def.push({ang:c.ang,born:G.time,root:makeRoot(p,c.ang)});
  p.seedlings=p.seedlings.filter(s=>!(s.mode==='converge'&&s.owner===c.owner)); p.conv={active:false}; if(G.sel===p) showPanel(p);
}

function isContested(p){ for(const s of p.seedlings){ if(s.mode==='orbit'&&s.hp>0&&s.owner!==p.owner) return true; } return false; }

function moveOrbitSeed(s,p,dt,tgt){
  const lin=Math.max(2,(s.spd||4))*BAL.orbitSpeed; // 恒定线速度(px/s)
  if(tgt){
    const dx=tgt.ax-s.x, dy=tgt.ay-s.y, d=Math.hypot(dx,dy)||1;
    const ta=Math.atan2(tgt.cy-p.y,tgt.cx-p.x);
    let da=ta-s.ang; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
    const tr=Math.min(p.r+21, Math.max(p.r+5, Math.hypot(tgt.cy-p.y,tgt.cx-p.x))); // 目标半径(钳在带内)
    if(d>BAL.combatRange){ // 目标在攻击范围外: 沿轨道绕向目标(轨迹优先, 不穿星球), 径向朝目标带收敛
      s.weaveT=0;
      const vr=Math.max(-lin*0.6, Math.min(lin*0.6, (tr-s.rad)*2.0));
      const vt=Math.sqrt(Math.max(0.01, lin*lin-vr*vr));
      s.ang += Math.sign(da)*Math.min(Math.abs(da), (vt/Math.max(1,s.rad))*dt);
      s.rad += vr*dt;
    } else { // 已进入攻击范围: 绕目标横向穿插保持移动(永不停)
      s.weaveT=(s.weaveT||0)-dt; if(s.weaveT<=0){ s.weaveDir=-(s.weaveDir||1); s.weaveT=1.1; }
      const wd=s.weaveDir||1;
      const nx=s.x+(-dy/d*wd)*lin*dt, ny=s.y+(dx/d*wd)*lin*dt;
      let px=nx-p.x,py=ny-p.y,rr=Math.hypot(px,py),aa=Math.atan2(py,px);
      rr=Math.max(p.r+5,Math.min(p.r+21,rr));
      s.ang=aa; s.rad=rr; s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad;
      return;
    }
  } else { // 空闲: 沿本带公转(恒速), 径向缓慢回到本带
    const nx=s.x+(-Math.sin(s.ang))*lin*dt, ny=s.y+Math.cos(s.ang)*lin*dt;
    let px=nx-p.x,py=ny-p.y,rr=Math.hypot(px,py),aa=Math.atan2(py,px);
    rr=Math.max(p.r+5,Math.min(p.r+21,rr));
    const hr=s.homeR!==undefined?s.homeR:rr; rr=Math.max(p.r+5,Math.min(p.r+21, rr+(hr-rr)*Math.min(1,dt*1.5)));
    s.ang=aa; s.rad=rr; s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad;
  }
  s.rad=Math.max(p.r+5,Math.min(p.r+21,s.rad));
  s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad;
}
function treeAlive(p,t){ if(t.dead) return false; if(t.hp===undefined) t.hp=2*p.maxHp; return t.hp>0; }

function defBall(p,d){ const by=p.r+14; return {x:p.x+Math.cos(d.ang)*by, y:p.y+Math.sin(d.ang)*by}; }
function defAlive(p,d){ if(d.dead) return false; if(d.hp===undefined) d.hp=Math.round(p.maxHp*0.8); return d.hp>0; }
function seekHostile(p,s,orbit){
  let best=null, bd=1e9;
  for(const b of orbit){ if(b===s||b.owner===s.owner||b.hp<=0) continue; const d=Math.hypot(b.x-s.x,b.y-s.y); if(d<bd){ bd=d; best={kind:'seed',ref:b,cx:b.x,cy:b.y,ax:b.x,ay:b.y}; } }
  if(!best && p.owner!==s.owner){ for(const d of p.def){ if(!defAlive(p,d)) continue; const b=defBall(p,d); const dd=Math.hypot(b.x-s.x,b.y-s.y); if(dd<bd){ bd=dd; best={kind:'deftree',ref:d,cx:b.x,cy:b.y,ax:b.x,ay:b.y}; } } }
  if(!best && p.owner!==s.owner){ for(const t of p.prod){ if(t.dead||!treeAlive(p,t)) continue;
    for(let k=0;k<t.revealed;k++){ const seg=t.order[k]; if(seg.d===0) continue; const d=Math.hypot(seg.x2-s.x,seg.y2-s.y); if(d<bd){ bd=d; best={kind:'branch',ref:t,bref:seg,cx:seg.x2,cy:seg.y2,ax:seg.x2,ay:seg.y2}; } } } }
  return best;
}


function combatPlanet(p,dt){
  const orbit=p.seedlings.filter(s=>s.mode==='orbit');
  for(const s of orbit){ if(s.hp<=0) continue;
    const tgt=seekHostile(p,s,orbit);
    moveOrbitSeed(s,p,dt,tgt); // 恒定线速度: 追击(战斗) 或 公转(空闲)
    if(tgt){ s.atkT-=dt;
      if(s.atkT<=0 && Math.hypot(tgt.ax-s.x,tgt.ay-s.y)<=BAL.combatRange){
        if(tgt.kind==='seed') tgt.ref.hp-=s.attack;
        else if(tgt.kind==='deftree'){ tgt.ref.hp-=s.attack; if(tgt.ref.hp<=0&&!tgt.ref.dead){ tgt.ref.dead=true; Sfx.hit(); } }
        else { tgt.ref.hp-=s.attack*BAL.treeHit; if(tgt.ref.hp<=0&&!tgt.ref.dead){ tgt.ref.dead=true; tgt.ref.bx=tgt.bref.x2; tgt.ref.by=tgt.bref.y2; Sfx.hit(); } }
        s.atkT=BAL.atkCooldown;
        if(cam.zoom>=5) G.lasers.push({x1:s.x,y1:s.y,x2:tgt.ax,y2:tgt.ay,life:0.11,owner:s.owner});
      }
    }
  }
  p.seedlings=p.seedlings.filter(s=>(s.mode!=='orbit')||s.hp>0);
  const own=p.seedlings.filter(s=>s.mode==='orbit'&&s.hp>0&&s.owner===p.owner);
  const inv=p.seedlings.filter(s=>s.mode==='orbit'&&s.hp>0&&s.owner!==p.owner);
  // 清光守军且繁殖树皆破 → 核心排队: 每秒一个最近入侵者进入(其余正常公转)
  let openRoot=null; // 树根入口: 有防御树→全部消灭才开; 无防御树→破繁殖树才开
  if(p.def.length>0){ if(p.def.every(d=>!defAlive(p,d))) openRoot=p.def.find(d=>d.dead&&d.root)||null; }
  else { openRoot=p.prod.find(t=>t.dead&&t.root)||null; }
  if(p.owner!==0 && inv.length>0 && own.length===0 && openRoot){
    p.coreT=(p.coreT===undefined?0:p.coreT)-dt;
    if(p.coreT<=0){ let near=null,nd=1e9; for(const s of inv){ const d=Math.hypot(s.x-p.x,s.y-p.y); if(d<nd){nd=d;near=s;} }
      if(near){ const root=openRoot.root;
        if(root){ near.mode='enter'; near.enter={root,idx:0,phase:'approach'}; }
        else { near.mode='converge'; near.landing=true; near.tx=p.x; near.ty=p.y; near.arr=false; }
        near.core=true; p.coreT=1.0; } }
  }
  // 核心入口: 收拢到中心的进入者被销毁, 伤害=其HP (去花哨光束/闪光); 仅非中立星可触发
  for(const s of p.seedlings){ if(p.owner!==0 && s.core&&(s.mode==='converge'||s.mode==='enter')&&s.arr&&Math.hypot(p.x-s.x,p.y-s.y)<7){
    p.hp-=s.hp; s.dead2=true; Sfx.hit(); addShake(4);
    if(p.hp<=0){ capturePlanet(p,s.owner); return; } } }
  p.seedlings=p.seedlings.filter(s=>!s.dead2&&((s.mode!=='orbit')||s.hp>0));
}


function capturePlanet(p,newOwner){
  p.owner=newOwner; p.hp=Math.max(1,Math.round(p.maxHp*0.4)); // 攻克后起始 40% 血, 缓慢回血
  p.seedlings=p.seedlings.filter(s=>s.owner===newOwner&&s.mode!=='converge');
  for(const s of p.seedlings){ if(s.core||s.mode==='enter'){ s.mode='orbit'; s.core=false; s.enter=null; s.arr=false; } } // 易主后袍子停止入核, 转回正常公转
    for(const t of p.prod){ if(t.dead){ t.dead=false; t.hp=2*p.maxHp; t.revealed=0; t.segT=0; t.budT=0; t.budTip=0; delete t.bx; delete t.by; } } // 存活繁殖树保留原样; 被摧毁的从树根重生长
  for(const d of p.def){ if(d.dead){ d.dead=false; d.hp=Math.round(p.maxHp*0.8); d.grow=0; } } // 防御树保留/重生长
  p.coreT=0; Sfx.capture(); G.shake=Math.max(G.shake,8); if(G.sel===p) showPanel(p);
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
  start.energy=6; start.strength=6; start.speed=6; start.maxHp=60+start.energy*18; start.hp=start.maxHp; start.defT=0;
  for(let k=0;k<30;k++) spawnSeed(start,1); // 初始种子 30
  // 隔壁中立星球保持中立(新手教程不再安排弱敌星)

  let stage=null,bd=1e9;
  for(const p of G.planets){ if(p===start||p.owner!==0) continue; const d=Math.hypot(p.x-start.x,p.y-start.y); if(d<bd){bd=d;stage=p;} }
  if(!stage){ for(const p of G.planets){ if(p===start) continue; stage=p; break; } }
  tutor={start,stage,phase:'plant',zoom:5,targetZoom:0.8,zoomT:0,dwell:0};
  camLocked=true; cam.zoom=5; cam.x=start.x-innerWidth/5/2; cam.y=start.y-innerHeight/5/2;
  setSub("你好，指挥官。我们降落到了一颗中立星球上。<br>现在请你点击星球，种植一颗繁殖树。");
}
function tickTutorial(dt){
  if(!tutor) return;
  const s=tutor.start, sw=innerWidth, sh=innerHeight;
  if(tutor.phase==='unlock'){
    tutor.zoomT+=dt; const t=Math.min(1,tutor.zoomT/3.6); cam.zoom=tutor.zoom+(tutor.targetZoom-tutor.zoom)*easeIO(t); // 慢慢拉远
    cam.x=s.x-sw/cam.zoom/2; cam.y=s.y-sh/cam.zoom/2; // 保持以母星为中心(不拉到全星域)
    if(t>=1){ tutor.postT=(tutor.postT||0)+dt; if(tutor.postT>=1.6){ camLocked=false; tutor=null; hideSub(); return; } }
  } else {
    cam.zoom=tutor.zoom; cam.x=s.x-sw/cam.zoom/2; cam.y=s.y-sh/cam.zoom/2;
  }
  const ph=tutor.phase;
  if(ph==='plant'){ if(s.owner===1){ tutor.phase='wait'; tutor.dwell=0; setSub("已占领这颗中立星球！繁殖树正在生长…"); } } // 种完树
  else if(ph==='wait'){ tutor.dwell+=dt; if(tutor.dwell>=5){ tutor.phase='enemy'; spawnEnvaders(); setSub("！！敌人来袭！！",true); } } // 5 秒后来袭
  else if(ph==='enemy'){ const battle=s.seedlings.some(x=>x.owner===2&&x.hp>0)||G.travel.some(x=>x.owner===2&&x.to===s);
    if(!battle){ tutor.phase='won'; tutor.dwell=0; setSub("首战告捷，指挥官！这片星域，等你征服。<br>（鼠标滚轮缩放就可以看到啦！）"); } } // 消灭敌人 → 先弹字幕
  else if(ph==='won'){ tutor.dwell+=dt; if(tutor.dwell>=2.0){ tutor.phase='unlock'; tutor.zoomT=0; tutor.targetZoom=0.8; } } // 字幕读过 → 才慢慢拉远(结束档位 0.8)
}
function separateSeeds(p){
  const o=p.seedlings.filter(s=>s.mode==='orbit');
  for(let pass=0; pass<6; pass++){ for(let i=0;i<o.length;i++){ for(let j=i+1;j<o.length;j++){
    const a=o[i], b=o[j]; let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
    if(d<BAL.seedSpace){
      const push=(BAL.seedSpace-d)*0.5;
      let nx, ny; if(d>1e-4){ nx=dx/d; ny=dy/d; } else { const oa=a.ang+1.6; nx=Math.cos(oa); ny=Math.sin(oa); }
      const ax=a.x-nx*push, ay=a.y-ny*push, bx=b.x+nx*push, by=b.y+ny*push;
      a.ang=Math.atan2(ay-p.y,ax-p.x); a.rad=Math.min(Math.max(Math.hypot(ax-p.x,ay-p.y),p.r+5),p.r+21); a.x=p.x+Math.cos(a.ang)*a.rad; a.y=p.y+Math.sin(a.ang)*a.rad;
      b.ang=Math.atan2(by-p.y,bx-p.x); b.rad=Math.min(Math.max(Math.hypot(bx-p.x,by-p.y),p.r+5),p.r+21); b.x=p.x+Math.cos(b.ang)*b.rad; b.y=p.y+Math.sin(b.ang)*b.rad;
    }
  }}}
}

function update(dt){
  G.time+=dt; G.shake=Math.max(0, G.shake-dt*36);
  if(holdActive) holdDur+=dt;
  tickTutorial(dt);
  for(const p of G.planets){
    if(p.owner!==0 && p.prod.length>0){ for(const t of p.prod){
    if(t.dead){ if(!isContested(p)){ t.dead=false; t.revealed=0; t.segT=0; t.budT=0; t.budTip=0; t.hp=2*p.maxHp; } continue; } // 被破树根: 无敌对才恢复
    if(t.revealed < t.order.length){
      t.segT += dt;
      if(t.segT >= BAL.perSegmentTime){ t.segT=0; const seg=t.order[t.revealed]; t.revealed++;
        G.travel.push({x:seg.x2,y:seg.y2,owner:p.owner,to:p,speed:BAL.budFlySpeed}); }
    } else {
      t.budT += dt/BAL.budTime;
      if(t.budT>=1){ const tip=t.tips[t.budTip%t.tips.length]; G.travel.push({x:tip.x,y:tip.y,owner:p.owner,to:p,speed:BAL.budFlySpeed}); t.budT=0; t.budTip=(t.budTip+1)%t.tips.length; }
    } } }
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
      } else if(s.mode==='orbit'){ /* 运动在 combatPlanet(moveOrbitSeed) */ }
      else if(s.mode==='enter'){ const e=s.enter, lin=Math.max(2,(s.spd||4))*BAL.orbitSpeed;
        if(e && e.root && e.root.length>1){
          if(e.phase==='approach'){ const b=e.root[0], ba=Math.atan2(b.y-p.y,b.x-p.x); let da=ba-s.ang; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
            const bandR=(s.homeR!==undefined?s.homeR:p.r+9);
            s.ang+=Math.sign(da)*Math.min(Math.abs(da), (lin/Math.max(1,s.rad))*dt);
            s.rad+=(bandR-s.rad)*Math.min(1,dt*2); s.rad=Math.max(p.r+5,Math.min(p.r+21,s.rad));
            s.x=p.x+Math.cos(s.ang)*s.rad; s.y=p.y+Math.sin(s.ang)*s.rad;
            if(Math.abs(da)<0.6){ e.phase='enter'; e.idx=0; } }
          else { const tg=e.root[Math.min(e.idx,e.root.length-1)],dx=tg.x-s.x,dy=tg.y-s.y,d=Math.hypot(dx,dy)||1;
            if(d<5){ e.idx++; if(e.idx>=e.root.length){ s.arr=true; s.rad=0; s.ang=0; s.x=p.x; s.y=p.y; } } else { s.x+=dx/d*lin*dt; s.y+=dy/d*lin*dt; } }
          const px=s.x-p.x,py=s.y-p.y,rr=Math.hypot(px,py); s.rad=Math.max(0.1,rr); s.ang=Math.atan2(py,px); s.core=true;
        } else { s.mode='converge'; s.landing=true; s.tx=p.x; s.ty=p.y; s.arr=false; s.core=true; } }
    }
    if(p.conv.active && cnt>=p.conv.total && allArr) applyPlant(p);
    // 防御树: 每棵每 missileInterval 秒发射一枚追踪导弹(全星球找最近敌人, 单体伤害=星球攻击*1.5)
    if(p.owner!==0 && p.def.length>0){ for(const d of p.def){ if(d.dead){ if(!isContested(p)){ d.dead=false; d.hp=Math.round(p.maxHp*0.8); d.grow=0; } continue; }
      d.grow=(d.grow===undefined?0:d.grow)+dt/BAL.defTreeGrow; d.grow=Math.min(1,d.grow);
      d.missileT=(d.missileT===undefined?1:d.missileT)-dt;
      if(d.missileT<=0){ const b=defBall(p,d); let ene=null,ed=1e9;
        for(const s of p.seedlings){ if(s.owner===p.owner||s.hp<=0||s.mode!=='orbit') continue; const dd=Math.hypot(s.x-b.x,s.y-b.y); if(dd<ed){ed=dd;ene=s;} }
        if(ene){ const ma=Math.atan2(b.y-p.y,b.x-p.x), mr=Math.hypot(b.x-p.x,b.y-p.y); G.missiles.push({x:b.x,y:b.y,ang:ma,rad:mr,homeR:Math.max(p.r+5,Math.min(p.r+21,mr)),spin:0,spd:3,owner:p.owner,p,target:ene,dmg:Math.max(1,p.strength*1.5),life:10}); d.missileT=BAL.missileInterval; Sfx.shoot(); }
        else d.missileT=0.3; } } }
    combatPlanet(p,dt);
    separateSeeds(p);
    if(p.owner!==0 && p.hp<p.maxHp) p.hp=Math.min(p.maxHp, p.hp+BAL.regenRate*dt); // 已占领星球缓慢回血
  }
  // 飞行种子
  for(let i=G.travel.length-1;i>=0;i--){ const t=G.travel[i],to=t.to; if(!to){G.travel.splice(i,1);continue;}
    const dx=to.x-t.x,dy=to.y-t.y,d=Math.hypot(dx,dy);
    if(d<=to.r+9){ // 到达
      if(t.rest && t.rest.length){ t.to=t.rest.shift(); }
      else {
        const ang=Math.atan2(t.y-to.y,t.x-to.x), rad=Math.min(Math.max(Math.hypot(t.x-to.x,t.y-to.y),to.r+5),to.r+15);
        const eband=Math.floor(rnd()*5), ehome=to.bands?to.bands[eband]:to.r+9;
        to.seedlings.push({x:t.x,y:t.y,ang,rad,spin:BAL.seedSpin*(0.7+rnd()*0.6)*((t.spd!==undefined?t.spd:to.speed)*0.06+0.7),owner:t.owner,mode:'orbit',tx:0,ty:0,arr:false,landing:false,energy:t.energy!==undefined?t.energy:to.energy,strength:t.strength!==undefined?t.strength:to.strength,spd:t.spd!==undefined?t.spd:to.speed,hp:t.hp!==undefined?t.hp:2*to.energy,attack:t.attack!==undefined?t.attack:to.strength,atkT:0,band:eband,homeR:ehome});
        G.travel.splice(i,1);
      }
    } else { t.x+=dx/d*t.speed*dt; t.y+=dy/d*t.speed*dt;
      // 飞行路径不穿透任何星球：进入某星球盘内则贴到其表面(顺势绕过)
      for(const pl of G.planets){ const px=t.x-pl.x, py=t.y-pl.y, pd=Math.hypot(px,py), minR=pl.r+3;
        if(pd<minR){ const nx=px/(pd||1), ny=py/(pd||1); t.x=pl.x+nx*minR; t.y=pl.y+ny*minR; } } }
  }
  // 追踪导弹: 类袍子, 沿轨道移动(不穿透星球), 速度缓慢, 靠近命中
  for(let i=G.missiles.length-1;i>=0;i--){ const m=G.missiles[i], tgt=m.target;
    if(!tgt||tgt.hp<=0||tgt.mode==='converge'||tgt.mode==='enter'){ G.missiles.splice(i,1); continue; }
    moveOrbitSeed(m, m.p, dt, {cx:tgt.x,cy:tgt.y,ax:tgt.x,ay:tgt.y});
    const d=Math.hypot(tgt.x-m.x, tgt.y-m.y);
    if(d<=7){ tgt.hp-=m.dmg; Sfx.hit(); if(cam.zoom>=5) G.lasers.push({x1:m.x,y1:m.y,x2:tgt.x,y2:tgt.y,life:0.09,owner:m.owner}); G.missiles.splice(i,1); continue; }
    m.life-=dt; if(m.life<=0) G.missiles.splice(i,1);
  }
  for(let i=G.lasers.length-1;i>=0;i--){ G.lasers[i].life-=dt; if(G.lasers[i].life<=0) G.lasers.splice(i,1); }
  G.lastAI-=dt; if(G.lastAI<=0){if(!tutor)AI(); G.lastAI=2.4;}
  const mine=G.planets.filter(p=>p.owner===1).length, theirs=G.planets.filter(p=>p.owner>=2).length;
  if(!tutor){ if(!mine) gameover(false); else if(!theirs) gameover(true); }
}
function AI(){
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  for(const fac of [2,3,4]){
    for(const q of G.planets){ if(q.owner!==0) continue; const n=present(q,fac).length;
      if(n>=BAL.treeCost && !q.conv.active){ startPlant(q,fac,'prod'); } }
    for(const p of G.planets){ if(p.owner!==fac) continue; const own=present(p,fac).length;
      if(own>120){ const _n=G.planets.filter(q=>q!==p&&q.owner===0&&inRange(p,q)).sort((a,b)=>dist(p,a)-dist(p,b)); const _e=G.planets.filter(q=>q!==p&&(q.owner===1||(q.owner!==fac&&q.owner!==0))&&inRange(p,q)).sort((a,b)=>dist(p,a)-dist(p,b)); const _t=_n[0]||_e[0]; if(_t){ sendFleet(p,_t,Math.floor(own*0.5)); continue; } } // 超过120颗→派一半去中立/敌方(泄洪)
      const treeSlot=(p.prod.length+p.def.length)<BAL.maxTrees;
      const neut=G.planets.filter(q=>q!==p&&q.owner===0&&inRange(p,q)).sort((a,b)=>dist(p,a)-dist(p,b));
      const ene=G.planets.filter(q=>q!==p&&(q.owner===1||(q.owner!==fac&&q.owner!==0))&&inRange(p,q)).sort((a,b)=>dist(p,a)-dist(p,b));
      const reachable=neut[0]||ene[0];
      // 扩张优先: 有可占目标就派一部分兵; 否则种子富裕就建树
      if(own>=BAL.treeCost && reachable){
        sendFleet(p, reachable, Math.min(Math.floor(own*0.4), BAL.treeCost+3));
      } else if(treeSlot && own>BAL.treeCost*2.5 && !p.conv.active){
        startPlant(p,fac, (p.def.length===0 && own>BAL.treeCost*4)?'def':'prod');
      }
    }
  }
}
function gameover(won){ G.over=true; G.won=won; addShake(12); const ov=document.getElementById('over'); ov.style.display='grid';
  ov.innerHTML='<div class="box"><h1 style="color:'+(won?'#7fe0a0':'#e07f8a')+'">'+(won?'菌毯已吞噬整片星域':'菌群被吞噬殆尽')+'</h1><p>你占据 '+G.planets.filter(p=>p.owner===1).length+' / '+G.planets.length+' 颗星球</p><button id="again">再来一局</button></div>';
  document.getElementById('again').onclick=()=>{reset();}; if(won)Sfx.win(); else Sfx.lose();
}
function reset(){ holdActive=false; holdDur=0; aiming=false; clearAim(); genPlanets(); startTutorial(); document.getElementById('over').style.display='none'; }

function render(){ ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#f3f4f0'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(dpr*cam.zoom,0,0,dpr*cam.zoom,-cam.x*dpr*cam.zoom+dpr*(Math.random()*2-1)*G.shake,-cam.y*dpr*cam.zoom+dpr*(Math.random()*2-1)*G.shake);
  ctx.fillStyle='rgba(150,160,170,0.5)'; for(let i=0;i<160;i++){const x=(i*971)%U.W,y=(i*613)%U.H,r=(i%3)*0.4+0.3;ctx.globalAlpha=0.2+(i%5)*0.08;ctx.fillRect(x,y,r,r);} ctx.globalAlpha=1;

  // 飞行种子
  for(const t of G.travel){ ctx.fillStyle=OWNER[t.owner]; ctx.beginPath(); ctx.arc(t.x,t.y,2,0,7); ctx.fill(); }
  // 追踪导弹
  for(const m of G.missiles){ ctx.fillStyle=OWNER[m.owner]; ctx.beginPath(); ctx.arc(m.x,m.y,2.4,0,7); ctx.fill(); ctx.strokeStyle='rgba(255,200,90,0.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(m.x,m.y,3.6,0,7); ctx.stroke(); }
  // 星球
  for(const p of G.planets) drawPlanet(p);
  // 派遣范围：选中星球 = 琥珀虚线大圈 + 内侧淡暖
  if(G.sel){ const R=dispatchRange(G.sel);
    ctx.setLineDash([14,10]); ctx.strokeStyle='rgba(212,150,40,0.62)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(G.sel.x,G.sel.y,R,0,7); ctx.stroke(); ctx.setLineDash([]);
    const ft=ctx.createRadialGradient(G.sel.x,G.sel.y,G.sel.r*1.1,G.sel.x,G.sel.y,R); ft.addColorStop(0,'rgba(212,150,40,0.06)'); ft.addColorStop(1,'rgba(212,150,40,0)'); ctx.fillStyle=ft; ctx.beginPath(); ctx.arc(G.sel.x,G.sel.y,R,0,7); ctx.fill();
  }
  // 可达性：可达=绿虚线环+柔光，不可达=灰点环（白底清晰）
  if(G.sel){ for(const q of G.planets){ if(q===G.sel) continue; const ok=canReach(G.sel,q);
    if(ok){ ctx.setLineDash([7,5]); ctx.strokeStyle='rgba(46,168,110,0.78)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.stroke(); ctx.setLineDash([]);
      const gt=ctx.createRadialGradient(q.x,q.y,q.r*0.9,q.x,q.y,q.r+21); gt.addColorStop(0,'rgba(46,168,110,0)'); gt.addColorStop(0.85,'rgba(46,168,110,0.09)'); gt.addColorStop(1,'rgba(46,168,110,0.04)'); ctx.fillStyle=gt; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.fill();
    } else { ctx.setLineDash([3,5]); ctx.strokeStyle='rgba(140,148,156,0.4)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(q.x,q.y,q.r+21,0,7); ctx.stroke(); ctx.setLineDash([]); }
  } }
  if(G.sel&&G.qty>0){ const p=G.sel; ctx.fillStyle='rgba(212,150,40,0.95)'; ctx.font='700 14px system-ui'; ctx.textAlign='center'; ctx.fillText('×'+G.qty+((isTouch||aiming)?' → 点目标星球派遣':' → 右键目标星'), p.x, p.y-p.r-28); ctx.textAlign='start'; }
  if(G.sel){ const p=G.sel;
    // 选中：种子带之外 柔和呼吸光晕 + 虚线环 + 星球本体亮边（不遮挡种子）
    const pulse=0.40+0.14*Math.sin(G.time*2.2);
    const halo=ctx.createRadialGradient(p.x,p.y,p.r+14,p.x,p.y,p.r+28);
    halo.addColorStop(0,'rgba(212,150,40,0)'); halo.addColorStop(0.55,'rgba(212,150,40,'+pulse+')'); halo.addColorStop(1,'rgba(212,150,40,0)');
    ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(p.x,p.y,p.r+28,0,7); ctx.fill();
    ctx.strokeStyle='rgba(212,150,40,'+(pulse+0.35)+')'; ctx.lineWidth=2; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.arc(p.x,p.y,p.r+21,0,7); ctx.stroke(); ctx.setLineDash([]);
  }
  // 战斗激光：仅拉近(zoom≥7)绘制，按攻击方阵营着色
  if(cam.zoom>=5){ ctx.save(); ctx.lineCap='round'; ctx.lineWidth=0.6*(cam.zoom/8);
    for(const l of G.lasers){ ctx.strokeStyle=LASER[l.owner]||'#e0a038'; ctx.beginPath(); ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2); ctx.stroke(); } ctx.restore(); }
}
function drawPlanet(p){ const base=OWNER[p.owner];
  const g=ctx.createRadialGradient(p.x,p.y,p.r*0.2,p.x,p.y,p.r*2.2); g.addColorStop(0,p.owner===0?'rgba(90,100,110,0.35)':hexA(base,0.35)); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.2,0,7); ctx.fill();
  ctx.fillStyle=base; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.12)'; for(let k=0;k<6;k++){ const a=k/6*6.283; ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*p.r*0.5,p.y+Math.sin(a)*p.r*0.5,p.r*0.28,0,7); ctx.fill(); }
  for(const s of p.seedlings){ if(s.mode!=='orbit'&&s.mode!=='converge'&&s.mode!=='enter') continue; ctx.fillStyle=s.mode==='converge'?'#fff':OWNER[s.owner]; ctx.globalAlpha=s.owner===0?0.6:1; ctx.beginPath(); ctx.arc(s.x,s.y,1.7,0,7); ctx.fill(); ctx.globalAlpha=1; }
  for(const t of p.prod){ if(t.dead) continue; ctx.strokeStyle='#9fe0b0';
    for(let k=0;k<t.revealed;k++){ const s=t.order[k]; ctx.lineWidth=s.w; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke(); }
    if(t.revealed<t.order.length){ const s=t.order[t.revealed], frac=clamp(t.segT/BAL.perSegmentTime,0,1);
      if(frac>0){ const ex=s.x1+(s.x2-s.x1)*frac, ey=s.y1+(s.y2-s.y1)*frac; ctx.lineWidth=s.w; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(ex,ey); ctx.stroke(); }
      // 生长前端的雹子(与飞行雹子同款小点)，跟着枝干长
      const fx=s.x1+(s.x2-s.x1)*frac, fy=s.y1+(s.y2-s.y1)*frac; ctx.fillStyle=OWNER[p.owner]; ctx.beginPath(); ctx.arc(fx,fy,2,0,7); ctx.fill(); } }
  const drawRoot=(R)=>{ if(!R||R.length<2) return; for(let k=1;k<R.length;k++){ const f=k/(R.length-1); ctx.strokeStyle='rgba(255,255,255,'+(0.85-0.5*f)+')'; ctx.lineWidth=Math.max(0.4, 2.6*(1-f)+0.5); ctx.beginPath(); ctx.moveTo(R[k-1].x,R[k-1].y); ctx.lineTo(R[k].x,R[k].y); ctx.stroke(); } };
  for(const t of p.prod) drawRoot(t.root);
  for(const d of p.def) drawRoot(d.root);
  for(const d of p.def){ if(d.dead) continue; const g=Math.min(1, d.grow===undefined?0:d.grow); const bx=p.x+Math.cos(d.ang)*p.r, by=p.y+Math.sin(d.ang)*p.r; const tx=p.x+Math.cos(d.ang)*(p.r+14*g), ty=p.y+Math.sin(d.ang)*(p.r+14*g);
    ctx.strokeStyle='#9fc6ef'; ctx.lineWidth=3*g+1; ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(tx,ty); ctx.stroke();
    ctx.fillStyle='#bcd8ff'; ctx.beginPath(); ctx.arc(tx,ty,5*g+1,0,7); ctx.fill(); ctx.strokeStyle='#8fb8e8'; ctx.lineWidth=1.4; ctx.stroke(); }
  
  // 世界保持干净，信息都在底部面板
  ctx.textAlign='start';
}
function hexA(hex,a){ const h=hex.replace('#',''); const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16); return 'rgba('+r+','+g+','+b+','+a+')'; }

function worldFromScreen(mx,my){ return {x:cam.x+mx/cam.zoom,y:cam.y+my/cam.zoom}; }
function pointOnPlanet(wx,wy){ return G.planets.find(p=>Math.hypot(p.x-wx,p.y-wy)<=p.r+8)||null; }
function layout(){ const sw=innerWidth,sh=innerHeight; cv.width=sw*dpr;cv.height=sh*dpr;cv.style.width=sw+'px';cv.style.height=sh+'px'; cam.zoom=Math.min(sw/U.W,sh/U.H)*0.92; cam.x=(U.W-sw/cam.zoom)/2; cam.y=(U.H-sh/cam.zoom)/2; }
addEventListener('resize',layout);
let tutor=null, camLocked=false;
let drag=null, holdTimer=null, holdFired=false, holdActive=false, holdDur=0;
const ptrs=new Map(); let pinch=null; // 移动端: 多指追踪 + 双指缩放状态
function stopHold(){ if(holdTimer){ clearInterval(holdTimer); holdTimer=null; } holdActive=false; holdDur=0; }
function endPointer(e){ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null;
  if(ptrs.size===1&&drag){ const p=[...ptrs.values()][0]; drag.mx=p.x; drag.my=p.y; drag.camx=cam.x; drag.camy=cam.y; drag.moved=true; } }
let isTouch=false, aiming=false, aimTimer=null; // 移动端: 触屏标记 / 面板"派遣"瞄准态 / 长按派遣计时
function clearAim(){ if(aimTimer){ clearTimeout(aimTimer); aimTimer=null; } }
function tryDispatch(target){ // 便捷派遣: 把我方选中星的当前数量派往目标
  if(!(target&&G.sel&&G.sel.owner===1&&G.qty>0)){ Sfx.error(); return false; }
  if(!canReach(G.sel,target)){ Sfx.error(); return false; }
  const n=Math.min(G.qty,present(G.sel,1).length); // 期间可能被建树等消耗, 按实际可用派遣
  if(n<=0){ Sfx.error(); return false; }
  sendFleet(G.sel,target,n); G.qty=0; aiming=false; Sfx.shoot(); showPanel(G.sel); return true; }
function addQtyN(n){ if(G.sel&&G.sel.owner===1){ const av=present(G.sel,1).length; if(G.qty<av){ const add=Math.min(n, av-G.qty); G.qty+=add; Sfx.click(); showPanel(G.sel); } } }
function addQty(){ addQtyN(1); }
cv.addEventListener('pointerdown',e=>{ if(AC.state==='suspended')AC.resume(); if(e.button===0) e.preventDefault(); const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top;
  if(e.pointerType==='touch') isTouch=true;
  ptrs.set(e.pointerId,{x:mx,y:my});
  if(ptrs.size>1){ stopHold(); clearAim(); if(drag) drag.moved=true; pinch=null; return; } // 第二指按下 → 转双指手势
  const w=worldFromScreen(mx,my); const pl=pointOnPlanet(w.x,w.y); drag={mx,my,camx:cam.x,camy:cam.y,planet:pl,moved:false,button:e.button,touch:e.pointerType==='touch'};
  if(e.button===0&&pl&&pl===G.sel&&pl.owner===1){ holdActive=true; holdDur=0; holdFired=false; holdTimer=setInterval(()=>{ holdFired=true; addQtyN(Math.max(1,Math.round(1+holdDur*1.6))); },90); }
  else if(e.pointerType==='touch'&&e.button===0&&pl&&G.sel&&G.sel.owner===1&&G.qty>0&&pl!==G.sel){ clearAim(); aimTimer=setTimeout(()=>{ aimTimer=null; holdFired=true; tryDispatch(pl); },400); } }); // C · 触屏长按目标星球即派遣
window.addEventListener('pointermove',e=>{ const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top;
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:mx,y:my});
  if(ptrs.size>=2){ // 移动端 · 双指：缩放 + 拖动
    if(camLocked) return; const a=[...ptrs.values()], p1=a[0], p2=a[1];
    const d=Math.hypot(p1.x-p2.x,p1.y-p2.y)||1, mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};
    if(pinch){ const b=worldFromScreen(pinch.mid.x,pinch.mid.y); cam.zoom=clamp(cam.zoom*(d/pinch.dist),0.22,8); const a2=worldFromScreen(pinch.mid.x,pinch.mid.y);
      cam.x+=b.x-a2.x; cam.y+=b.y-a2.y; cam.x-=(mid.x-pinch.mid.x)/cam.zoom; cam.y-=(mid.y-pinch.mid.y)/cam.zoom; }
    pinch={dist:d,mid}; if(drag) drag.moved=true; return; }
  pinch=null;
  if(!drag)return; if(camLocked){ drag.moved=false; return; } if(Math.hypot(mx-drag.mx,my-drag.my)>6) drag.moved=true;
  if(drag.moved){ clearAim(); if(drag.touch) stopHold(); } // 滑动即取消长按派遣 / 触屏放弃长按累加
  if(drag.moved&&(drag.button===0||drag.button===1)&&(!drag.planet||drag.touch)){ cam.x=drag.camx-(mx-drag.mx)/cam.zoom; cam.y=drag.camy-(my-drag.my)/cam.zoom; } });
window.addEventListener('pointerup',e=>{ endPointer(e); stopHold(); clearAim();
  if(ptrs.size>0){ holdFired=false; return; } // 还有手指按住 → 保留 drag 以便继续拖动
  if(!drag)return;
  if(drag.button===0&&!drag.moved&&!holdFired){
    if(drag.planet) handleClick(drag.planet);
    else if(drag.touch){ G.sel=null; G.qty=0; aiming=false; hidePanel(); } // 移动端: 点空白 = 取消选中
  }
  holdFired=false; drag=null; });
window.addEventListener('pointercancel',e=>{ endPointer(e); stopHold(); if(ptrs.size===0){ holdFired=false; drag=null; } }); // 触屏被系统打断(来电/手势)时清理
function handleClick(p){
  if(p===G.sel&&p.owner===1){ addQty(); return; } // 点已选中的我方星球: 派遣数量 +1
  const armed=G.sel&&G.sel.owner===1&&G.qty>0;
  if(armed&&(aiming||(isTouch&&canReach(G.sel,p)))){ if(tryDispatch(p)) return; aiming=false; return; } // A · 触屏点目标即派 / B · 瞄准态派遣(两端)
  aiming=false; G.sel=p; G.qty=0; if(p.owner===1) Sfx.select(); showPanel(p); }
window.addEventListener('contextmenu',e=>{ e.preventDefault(); const r=cv.getBoundingClientRect(); const w=worldFromScreen(e.clientX-r.left,e.clientY-r.top); const p=pointOnPlanet(w.x,w.y);
  if(G.sel&&G.sel.owner===1&&G.qty>0){ const n=Math.min(G.qty,present(G.sel,1).length); if(p&&canReach(G.sel,p)&&n>0){ sendFleet(G.sel,p,n); G.qty=0; Sfx.shoot(); showPanel(G.sel); } else Sfx.error(); }
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
    +'<div class="p-line">繁殖树×'+p.prod.length+' 防御树×'+p.def.length+' / '+BAL.maxTrees+' · 范围 '+Math.round(dispatchRange(p))+'px</div>';
  let btns='';
  if(p.owner===1){ btns='<div class="row"><button id="b_prod">建繁殖树 '+BAL.treeCost+'</button><button id="b_def">建防御树 '+BAL.treeCost+'</button>'
      +'<button id="b_send"'+(G.qty>0?'':' disabled')+'>'+(G.qty>0?(aiming?'取消派遣':'派遣 ×'+G.qty+' →'):'派遣（先选数量）')+'</button></div>'
    +'<div class="p-hint">'+((isTouch||aiming)?'派遣：点星球＋1 / 长按累加数量 → 点（或长按）目标星球即派':'派遣：点星球＋1 / 长按累加，再右键目标星球')+'</div>'; }
  else if(p.owner===0 && my>=BAL.treeCost){ btns='<div class="row"><button id="b_prod">种繁殖树·占领 '+BAL.treeCost+'</button></div>'+'<div class="p-hint">你已派 '+my+' 颗种子在此，种繁殖树即可占领</div>'; }
  else if(p.owner===2 && my>=BAL.treeCost){ btns='<div class="p-hint">你已派 '+my+' 颗种子在此；清光守军、摧毁繁殖树并攻入核心即可占领</div>'; }
  el.innerHTML='<div class="p-top"><span class="p-dot" style="background:'+OWNER[p.owner]+'"></span><span class="p-name">'+OWNER_NAME[p.owner]+'星球</span></div>'
    +attrs+hp+info+btns;
  if(p.owner===1){
    el.querySelector('#b_prod').onclick=()=>{ startPlant(p,1,'prod'); showPanel(p); };
    el.querySelector('#b_def').onclick=()=>{ startPlant(p,1,'def'); showPanel(p); };
    const bs=el.querySelector('#b_send'); if(bs) bs.onclick=()=>{ if(G.qty>0){ aiming=!aiming; showPanel(p); } else Sfx.error(); }; // B · 面板「派遣」= 进入/退出瞄准态
  } else if(p.owner===0){ const b=el.querySelector('#b_prod'); if(b) b.onclick=()=>{ startPlant(p,1,'prod'); showPanel(p); }; }
}
function hidePanel(){ document.getElementById('panel').style.display='none'; }
function drawStatus(){ const mine=G.planets.filter(p=>p.owner===1).length, a=G.planets.filter(p=>p.owner===2).length, b=G.planets.filter(p=>p.owner===3).length; document.getElementById('status').textContent='我方 '+mine+' ｜ 敌方A '+a+' ｜ 敌方B '+b+' ｜ 在途 '+G.travel.length; }
let last=performance.now();
function loop(now){ const dt=Math.min((now-last)/1000,0.05); last=now; if(!G.over) update(dt); render(); drawStatus(); requestAnimationFrame(loop); }
layout(); reseed(20240829); genPlanets(); startTutorial(); startAmbient(); requestAnimationFrame(loop);
