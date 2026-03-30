// ══════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════
const HIDDEN_WORD        = '';
const SEND_AWAY_MSG      = 'Va-t’en.';
const SIGN_TRIGGER_SCORE = 200;
const TEMPLE_RUN_SECS    = 32;
const GRACE_SECS         = 3;   // countdown text duration before GO!
const POST_TEXT_GRACE_SECS = 1; // extra no-obstacle buffer after text disappears
const CASTLE_TRANSITION_FRAMES = 140;

const INIT_SPEED = 6.5, MAX_SPEED = 16.5, ACCEL = 0.0010;
const GRAVITY = 0.8, JUMP_FORCE = -15.5, SCORE_TICK = 8;
const COYOTE_FRAMES = 6;
const JUMP_BUFFER_FRAMES = 8;

// ══════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 600, H = 150, GY = H - 16;

// Master phase: 'dino' | 'castle' | 'temple' | 'pause' | 'undertale' | 'death' | 'ending'
let phase = 'dino';

// ── Dino state ──
let dinoState = 'idle';
let displayScore=0, hiScore=0, frame=0, speed=INIT_SPEED;
let scoreTick=0, signSpawned=false, nextObstIn=80;
let jumpedOver=false, signChasing=false, toastTimer=0;
let castleTriggered=false, castleTimer=0;
let dinoCoyote=0, dinoJumpBuffer=0;

const DINO_W=44, DINO_H=52;
const dino={x:65, y:GY, vy:0, grounded:true, animFrame:0, animTick:0};
let cacti=[], signs=[];
let clouds=[{x:150,y:22,w:80},{x:380,y:14,w:60},{x:530,y:26,w:70}];
let gRow1=Array.from({length:12},(_,i)=>({x:i*52, type:Math.random()>.5?0:1}));
let gRow2=Array.from({length:8}, (_,i)=>({x:i*75+20, type:Math.random()>.5?0:1}));

// ── Temple state ──
const LANES=[H*0.22, H*0.5, H*0.78], LANE_H=28;
let trLane=1, trTargetY=LANES[1], trPlayerY=LANES[1];
let trObstacles=[], trFrame=0, trTimeLeft=TEMPLE_RUN_SECS*60;
let trSpeed=5, trNextObst=0, trScrollX=0, trLaneChangeCooldown=0;
let trGraceFrames=0;
let trDied=false;
let trEnding=false;
let trPlayerX=80, trTargetX=80;

// ── Undertale state ──
let utEnemyHp=30, utEnemyMaxHp=30;
let utPlayerHp=20, utPlayerMaxHp=20;
let utTyping=false;
let utTypingInterval=null, utTypingEl=null, utTypingText='', utTypingCb=null;
let utPhase='intro'; // 'intro' | 'battle'
let utIntroStep=0;
let utBtnsEnabled=false;
let utOutcome='spare'; // 'spare' | 'kill' | 'run'
let utHasFought=false;
let shakeFrames=0, shakeStrength=0;

// ══════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════
function handleDinoInput() {
  if(dinoState==='idle'||dinoState==='dead'){startDino();return;}
  if(dinoState==='running'){dinoJumpBuffer=JUMP_BUFFER_FRAMES;}
}

document.addEventListener('keydown', e=>{
  if(phase==='dino'){
    if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();handleDinoInput();}
  }
  if(phase==='temple'){
    if(e.code==='ArrowUp'||e.code==='KeyW'||e.code==='KeyZ'){e.preventDefault();trMoveUp();}
    if(e.code==='ArrowDown'||e.code==='KeyS'){e.preventDefault();trMoveDown();}
  }
  if(phase==='death'){
    if(e.code==='Space'){e.preventDefault();dismissDeathScreen();}
  }
  if(phase==='ending'){
    if(e.code==='Space'){e.preventDefault();return;}
  }
  if(phase==='castle'){
    if(e.code==='Space'){e.preventDefault();startTempleRun();}
  }
});
canvas.addEventListener('click',()=>{if(phase==='dino')handleDinoInput();});

function trMoveUp()  {if(trLane>0&&trLaneChangeCooldown<=0){trLane--;trLaneChangeCooldown=10;}}
function trMoveDown(){if(trLane<2&&trLaneChangeCooldown<=0){trLane++;trLaneChangeCooldown=10;}}

// ══════════════════════════════════════════════
//  DINO GAME
// ══════════════════════════════════════════════
function startDino(){
  document.body.classList.remove('offline');
  dinoState='running'; displayScore=0; frame=0; speed=INIT_SPEED;
  scoreTick=0; signSpawned=false; nextObstIn=80;
  jumpedOver=false; signChasing=false; toastTimer=0;
  castleTriggered=false; castleTimer=0;
  dinoCoyote=0; dinoJumpBuffer=0;
  cacti=[]; signs=[];
  dino.y=GY; dino.vy=0; dino.grounded=true; dino.animFrame=0;
  document.getElementById('hint').style.opacity='0';
  document.getElementById('jump-toast').classList.remove('show');
  canvas.focus();
}

const CACTUS_TYPES=[
  {tw:11,th:34,arms:[{dx:-8,dy:10,w:8,h:8},{dx:11,dy:14,w:8,h:8}]},
  {tw:11,th:44,arms:[{dx:-9,dy:8,w:9,h:10},{dx:11,dy:12,w:9,h:10}]},
  {tw:24,th:36,arms:[{dx:-9,dy:10,w:9,h:8},{dx:24,dy:14,w:9,h:8}]},
  {tw:11,th:28,arms:[{dx:-7,dy:8,w:7,h:7},{dx:11,dy:12,w:7,h:7}]},
];
function spawnCactus(){
  const t=CACTUS_TYPES[Math.floor(Math.random()*CACTUS_TYPES.length)];
  cacti.push({x:W+20, y:GY-t.th, tw:t.tw, th:t.th, arms:t.arms});
  nextObstIn=Math.floor(Math.max(45,110-speed*5)+Math.random()*40);
}
function spawnSign(){signs.push({x:W+20, y:GY-70, w:92, h:62, hit:false});}

function updateDino(){
  if(dinoState!=='running') return;
  frame++;
  speed=Math.min(MAX_SPEED, INIT_SPEED+frame*ACCEL);
  // Slow down briefly while passing the stop sign.
  let signSlow=1;
  if(signs.length>0 && !castleTriggered){
    const s=signs[0];
    const dx=Math.abs((s.x+s.w/2)-dino.x);
    if(dx<160){ signSlow = 0.35 + (dx/160)*0.35; }
  }
  const effectiveSpeed = speed * signSlow;
  scoreTick++;
  if(scoreTick>=SCORE_TICK){scoreTick=0;displayScore++;if(displayScore>hiScore)hiScore=displayScore;updateScoreDOM();}

  dino.vy+=GRAVITY; dino.y+=dino.vy;
  if(dino.y>=GY){dino.y=GY;dino.vy=0;dino.grounded=true;}
  // Coyote time + jump buffer for tighter feel.
  if(dino.grounded){dinoCoyote=COYOTE_FRAMES;}
  else{dinoCoyote=Math.max(0,dinoCoyote-1);}
  if(dinoJumpBuffer>0){dinoJumpBuffer--;}
  if(dinoJumpBuffer>0&&(dino.grounded||dinoCoyote>0)){
    dino.vy=JUMP_FORCE; dino.grounded=false; dinoCoyote=0; dinoJumpBuffer=0;
  }
  if(dino.grounded){dino.animTick++;if(dino.animTick>=6){dino.animTick=0;dino.animFrame^=1;}}
  else dino.animFrame=0;

  clouds.forEach(c=>{c.x-=1.5;if(c.x<-100)c.x=W+60;});
  gRow1.forEach(g=>{g.x-=effectiveSpeed;if(g.x<-60)g.x+=12*52;});
  gRow2.forEach(g=>{g.x-=effectiveSpeed*0.9;if(g.x<-60)g.x+=8*75;});

  nextObstIn--;
  if(nextObstIn<=0&&!signSpawned)spawnCactus();
  if(displayScore>=SIGN_TRIGGER_SCORE&&!signSpawned){cacti=[];spawnSign();signSpawned=true;}

  cacti.forEach(c=>c.x-=effectiveSpeed);
  cacti=cacti.filter(c=>c.x>-80);
  signs.forEach(s=>{s.x-=effectiveSpeed;});

  for(const s of signs){
    if(!s.hit&&!castleTriggered&&s.x+s.w<dino.x-10){
      s.hit=true; castleTriggered=true;
      toastTimer=120;document.getElementById('jump-toast').classList.add('show');
      startCastleEntrance();
      return;
    }
  }
  if(toastTimer>0){toastTimer--;if(toastTimer===0)document.getElementById('jump-toast').classList.remove('show');}

  const DX1=dino.x+10, DX2=dino.x+DINO_W-8, DY1=dino.y-DINO_H+8, DY2=dino.y-4;
  for(const c of cacti){
    const CX1=c.x-4,CX2=c.x+c.tw+4,CY1=c.y,CY2=c.y+c.th;
    if(DX1<CX2&&DX2>CX1&&DY1<CY2&&DY2>CY1){dinoDie();return;}
  }
  // Sign is non-lethal; castle entrance is triggered when you pass it
}

function dinoDie(){
  dinoState='dead';
  triggerShake(12,2);
  if(displayScore>hiScore)hiScore=displayScore;
  updateScoreDOM();
}

// ══════════════════════════════════════════════
//  TEMPLE RUN
// ══════════════════════════════════════════════
function startTempleRun(){
  phase='temple'; trDied=false;
  trLane=1; trTargetY=LANES[1]; trPlayerY=LANES[1];
  trObstacles=[]; trFrame=0; trSpeed=3.6;
  trEnding=false;
  trPlayerX=80; trTargetX=80;
  trTimeLeft=TEMPLE_RUN_SECS*60;
  trGraceFrames=(GRACE_SECS+POST_TEXT_GRACE_SECS)*60;
  // First obstacle spawns well after grace ends
  trNextObst=(GRACE_SECS+POST_TEXT_GRACE_SECS)*60+40;
  trScrollX=0; trLaneChangeCooldown=0;
  // Timer bar hidden; no visual timer.
  document.getElementById('jump-toast').classList.remove('show');
  showControlsCountdown();
  canvas.focus();
}

function startCastleEntrance(){
  phase='castle';
  castleTimer=CASTLE_TRANSITION_FRAMES;
  document.getElementById('jump-toast').classList.remove('show');
}

function updateCastle(){
  // Wait for player to confirm
}

function showControlsCountdown(){
  const overlay=document.getElementById('controls-overlay');
  const countEl=document.getElementById('co-countdown');
  const goEl=document.getElementById('co-go');
  overlay.classList.add('show');
  goEl.textContent='';
  let count=GRACE_SECS;
  countEl.textContent=count;
  countEl.style.color='#33ff33';

  const tick=setInterval(()=>{
    count--;
    if(count>0){
      countEl.textContent=count;
      countEl.style.transform='scale(1.4)';
      setTimeout(()=>{countEl.style.transform='scale(1)';},120);
    } else {
      clearInterval(tick);
      countEl.textContent='GO!';
      countEl.style.color='#fff';
      countEl.style.textShadow='0 0 20px #fff';
      goEl.textContent='bonne chance, humain';
      // Hide overlay AFTER the GO! flash — grace period still ticking in game logic
      setTimeout(()=>{
        overlay.classList.remove('show');
        countEl.style.color='#33ff33';
        countEl.style.textShadow='0 0 20px #33ff33';
      }, 700);
    }
  }, 1000);
}

const TR_OBSTACLE_TYPES=[
  {lanes:[0]},{lanes:[2]},{lanes:[1]},
  {lanes:[0,2]},{lanes:[0,1]},{lanes:[1,2]},
];

function updateTemple(){
  trFrame++;
  trTimeLeft--;
  trSpeed=Math.min(8.7, 3.3+trFrame*0.0009);
  trScrollX-=trSpeed;

  trTargetY=LANES[trLane];
  trPlayerY+=(trTargetY-trPlayerY)*0.18;
  if(trLaneChangeCooldown>0)trLaneChangeCooldown--;

  // Grace period: scroll bg, allow movement, but NO obstacles and NO collision
  if(trGraceFrames>0){trGraceFrames--;return;}

  // Stop spawning obstacles near the end and clear the lane.
  const endClearFrames = Math.floor(4.5*60);
  if(trTimeLeft<=endClearFrames){
    trEnding=true;
    trObstacles=[];
    trTargetX=W-120;
  } else {
    trNextObst--;
    if(trNextObst<=0){
      const t=TR_OBSTACLE_TYPES[Math.floor(Math.random()*TR_OBSTACLE_TYPES.length)];
      trObstacles.push({x:W+30, lanes:t.lanes});
      trNextObst=Math.floor(Math.max(35,95-trSpeed*5)+Math.random()*30);
    }
  }

  // During the end approach, stop environment movement and slide player right.
  if(trEnding){
    trSpeed=0;
    trPlayerX+=(trTargetX-trPlayerX)*0.08;
  }

  trObstacles.forEach(o=>o.x-=trSpeed);
  trObstacles=trObstacles.filter(o=>o.x>-60);

  // Timer runs in background without UI.

  const playerLane=trLane;
  const PX1=trPlayerX-10, PX2=trPlayerX+10, PY1=trPlayerY-12, PY2=trPlayerY+12;
  for(const o of trObstacles){
    if(!o.lanes.includes(playerLane)) continue;
    const OX1=o.x, OX2=o.x+40;
    const OY1=LANES[playerLane]-LANE_H+4, OY2=LANES[playerLane]+LANE_H-4;
    if(PX1<OX2&&PX2>OX1&&PY1<OY2&&PY2>OY1){
      trDied=true; triggerShake(10,2); triggerTempleEnd(); return;
    }
  }
  if(trTimeLeft<=0){trDied=false;triggerTempleEnd();}
}

function triggerTempleEnd(){
  phase='pause';
  // Timer bar hidden; no visual timer.
  document.getElementById('controls-overlay').classList.remove('show');
  if(trDied){
    showDeathScreen();
  } else {
    document.getElementById('boss-overlay').classList.add('show');
    setTimeout(()=>{
      document.getElementById('boss-overlay').classList.remove('show');
      startUndertaleScreen();
    }, 2200);
  }
}

// ══════════════════════════════════════════════
//  DEATH SCREEN (died in temple run)
// ══════════════════════════════════════════════
const deathMessages=[
  "Oh... donc tu sors par la mort.\nJ’avais tellement de choses prévues\npour nous, tu sais :(",
];

function showDeathScreen(){
  phase='death';
  const screen=document.getElementById('death-screen');
  screen.classList.add('show');
  const msg=deathMessages[Math.floor(Math.random()*deathMessages.length)];
  const el=document.getElementById('ds-text');
  el.textContent='';
  document.getElementById('ds-word').textContent='';
  typewriterEffect(el, msg, 20, ()=>{
    setTimeout(()=>{
      document.getElementById('ds-word').textContent=SEND_AWAY_MSG;
    }, 400);
  });
}

function dismissDeathScreen(){
  document.getElementById('death-screen').classList.remove('show');
  resetToDino();
}

// ══════════════════════════════════════════════
//  UNDERTALE BATTLE (survived temple run)
// ══════════════════════════════════════════════
const utIntroLines=[
  'Howdy !\nJe suis FLOWEY. FLOWEY la fleur.',
  'Tu as survécu jusqu’ici.\nPas mal... pour un humain.',
  'Dans ce monde, c’est TUER ou ÊTRE TUÉ.\nAlors je vais te donner un choix.',
  'Fais ton choix.\nTu n’as que toi à blâmer.',
];

const utFightTaunts=[
  'Aïe ! Ça chatouille à peine.',
  'Tu appelles ça un coup ?!',
  'Hahaha ! Tu peux pas me battre !',
  'Mon âme ne s’en va pas si facilement !',
  '...Tu commences à m’énerver.',
  'Encore. Allez. Je m’ennuie.',
];
const utActLines=[
  '* Tu fais semblant de sentir les fleurs.\n  FLOWEY est confus.',
  '* Tu dis bonjour.\n  FLOWEY ne sait pas comment réagir.',
  '* Tu applaudis.\n  FLOWEY est... flatté ?',
  '* Tu regardes FLOWEY dans les yeux.\n  Il y a quelque chose de vide là‑dedans.',
  '* Tu fais une révérence.\n  FLOWEY hésite, puis ricane.',
];

function startUndertaleScreen(){
  phase='undertale';
  utEnemyHp=30; utEnemyMaxHp=30;
  utPlayerHp=20; utPlayerMaxHp=20;
  utTyping=false; utPhase='intro'; utIntroStep=0; utBtnsEnabled=false; utOutcome='spare';
  utHasFought=false;

  document.getElementById('ut-spare-fx').textContent='';
  updateUtEnemyHpBar();
  updateUtPlayerHpBar();
  setBtnsEnabled(false);

  document.getElementById('undertale-screen').classList.add('show');

  // Wire up buttons
  document.getElementById('btn-fight').onclick=onFight;
  document.getElementById('btn-act').onclick=onAct;
  document.getElementById('btn-spare').onclick=onSpare;

  // Start intro dialogue
  runUtIntro();
}

function runUtIntro(){
  if(utIntroStep>=utIntroLines.length){
    // Intro done — enable battle
    utPhase='battle';
    document.getElementById('btn-spare').textContent='♡ ÉPARGNER';
    setBtnsEnabled(true);
    return;
  }
  setBtnsEnabled(false);
  typewriterEffect(
    document.getElementById('ut-text'),
    utIntroLines[utIntroStep],
    30,
    ()=>{
      utIntroStep++;
      // Allow clicking/space to advance
      waitForAdvance(runUtIntro);
    }
  );
}

function waitForAdvance(cb){
  const advance=e=>{
    if(e.type==='keydown'&&e.code!=='Space')return;
    document.removeEventListener('keydown',advance);
    document.removeEventListener('click',advance);
    cb();
  };
  document.addEventListener('keydown',advance,{once:false});
  document.addEventListener('click',advance,{once:false});
  // clean up listeners once called
  const origCb=cb;
  cb=()=>{
    document.removeEventListener('keydown',advance);
    document.removeEventListener('click',advance);
    origCb();
  };
}

function onFight(){
  if(utTyping){ skipTypewriter(); return; }
  if(!utBtnsEnabled)return;
  setBtnsEnabled(false);
  utHasFought=true;
  document.getElementById('btn-spare').textContent='♡ COURIR';
  // Deal damage to Flowey
  const dmg=Math.floor(Math.random()*6)+4; // 4-9
  utEnemyHp=Math.max(0,utEnemyHp-dmg);
  updateUtEnemyHpBar();

  if(utEnemyHp<=0){
    utOutcome='kill';
    typewriterEffect(document.getElementById('ut-text'),
      '... QUOI ?!\nImpossible... je suis FLOWEY !\n\n* FLOWEY vacille. Le silence tombe.', 30,
      ()=>{ setTimeout(resolveUndertale, 1800); }
    );
    return;
  }

  // Flowey counter-attacks
  const taunt=utFightTaunts[Math.floor(Math.random()*utFightTaunts.length)];
  const playerDmg=Math.floor(Math.random()*4)+2; // 2-5
  utPlayerHp=Math.max(0,utPlayerHp-playerDmg);
  updateUtPlayerHpBar();
  if(playerDmg>0) triggerShake(8,2);

  typewriterEffect(document.getElementById('ut-text'), taunt, 30, ()=>{
    if(utPlayerHp<=0){
      setTimeout(()=>{
        typewriterEffect(document.getElementById('ut-text'),
          'Hahaha !\nFin de partie pour toi.', 30, ()=>{ setTimeout(resolveUndertale,1500); }
        );
      },600);
    } else {
      setBtnsEnabled(true);
    }
  });
}

function onAct(){
  if(utTyping){ skipTypewriter(); return; }
  if(!utBtnsEnabled)return;
  setBtnsEnabled(false);
  let line=utActLines[Math.floor(Math.random()*utActLines.length)];
  if(utPlayerHp>0&&utPlayerHp<utPlayerMaxHp&&Math.random()<0.3){
    utPlayerHp=Math.min(utPlayerMaxHp, utPlayerHp+2);
    updateUtPlayerHpBar();
    line+='\n* Tu récupères 2 HP.';
  }
  typewriterEffect(document.getElementById('ut-text'), line, 30, ()=>{
    setBtnsEnabled(true);
  });
}

function onSpare(){
  if(utTyping){ skipTypewriter(); return; }
  if(!utBtnsEnabled)return;
  setBtnsEnabled(false);
  if(utHasFought){
    utOutcome='run';
    typewriterEffect(document.getElementById('ut-text'),
      '...\nTu fuis.\nSans même essayer jusqu’au bout.', 30,
      ()=>{
        const fx=document.getElementById('ut-spare-fx');
        fx.textContent='✦  ✦  ✦';
        fx.classList.add('show');
        setTimeout(resolveUndertale, 1200);
      }
    );
  } else {
    utOutcome='spare';
    typewriterEffect(document.getElementById('ut-text'),
      '...\nVraiment ?\nTu m’épargnes ?\n\nJe n’avais pas prévu ça.', 30,
      ()=>{
        const fx=document.getElementById('ut-spare-fx');
        fx.textContent='✦ ✧ ✦ ✧ ✦';
        fx.classList.add('show');
        setTimeout(resolveUndertale, 1200);
      }
    );
  }
}

function setBtnsEnabled(on){
  utBtnsEnabled=on;
  ['btn-fight','btn-act','btn-spare'].forEach(id=>{
    document.getElementById(id).disabled=!on;
  });
}

function updateUtEnemyHpBar(){
  const pct=(utEnemyHp/utEnemyMaxHp)*100;
  const inner=document.getElementById('ut-enemy-hp-inner');
  inner.style.width=pct+'%';
  inner.style.background=pct>50?'#ff0':pct>25?'#fa0':'#f00';
  document.getElementById('ut-enemy-hp-val').textContent=`${utEnemyHp} / ${utEnemyMaxHp}`;
}

function updateUtPlayerHpBar(){
  const pct=(utPlayerHp/utPlayerMaxHp)*100;
  const inner=document.getElementById('ut-player-hp-inner');
  inner.style.width=pct+'%';
  inner.style.background=pct>50?'#ff0':pct>25?'#fa0':'#f00';
  document.getElementById('ut-player-hp-val').textContent=`${utPlayerHp} / ${utPlayerMaxHp}`;
}

function resolveUndertale(){
  document.getElementById('ut-spare-fx').classList.remove('show');
  document.getElementById('undertale-screen').classList.remove('show');
  showEndingScreen();
}

// ══════════════════════════════════════════════
//  END SEQUENCE
// ══════════════════════════════════════════════

function showEndingScreen(){
  phase='ending';
  const msg = utOutcome==='kill'
    ? "Tu as choisi la cruauté.\nFLOWEY n’était pas un défi, c’était un test.\nUn nouvel e‑mail t’attend."
    : utOutcome==='run'
    ? "Tu as commencé, puis tu as lâché.\nSans conviction, sans courage, sans fin.\n\nJe suis déçu. Le maître du jeu attendait mieux.\nUn nouvel e‑mail t’attend."
    : "Je n’attendais pas tant de douceur.\nTu as épargné FLOWEY.\nUn nouvel e‑mail t’attend.";
  document.getElementById('es-msg').textContent=msg;
  document.getElementById('ending-screen').classList.add('show');
}

function dismissEndingScreen(){
  // Intentionally disabled: end screens are terminal.
}

function resetToDino(){
  phase='dino';
  dinoState='idle';
  document.body.classList.add('offline');
  cacti=[]; signs=[];
  signChasing=false; jumpedOver=false; toastTimer=0;
  castleTriggered=false; castleTimer=0;
  document.getElementById('boss-overlay').classList.remove('show');
  document.getElementById('hint').style.opacity='1';
}

// ══════════════════════════════════════════════
//  TYPEWRITER UTIL
// ══════════════════════════════════════════════
function typewriterEffect(el, text, speed, cb){
  utTyping=true;
  utTypingEl=el; utTypingText=text; utTypingCb=cb;
  el.textContent='';
  let i=0;
  const iv=setInterval(()=>{
    if(i<text.length){el.textContent+=text[i];i++;}
    else{
      clearInterval(iv);
      utTypingInterval=null;
      utTyping=false;
      if(cb)cb();
    }
  }, speed);
  utTypingInterval=iv;
}

function skipTypewriter(){
  if(!utTyping) return;
  if(utTypingInterval){ clearInterval(utTypingInterval); utTypingInterval=null; }
  if(utTypingEl){ utTypingEl.textContent=utTypingText; }
  utTyping=false;
  const cb=utTypingCb; utTypingCb=null;
  if(cb)cb();
}

function triggerShake(frames, strength){
  shakeFrames=frames;
  shakeStrength=strength;
}

// ══════════════════════════════════════════════
//  SCORE
// ══════════════════════════════════════════════
function updateScoreDOM(){
  document.getElementById('score-display').textContent=
    `HI ${String(hiScore).padStart(5,'0')}\u00a0\u00a0${String(displayScore).padStart(5,'0')}`;
}

// ══════════════════════════════════════════════
//  DRAW
// ══════════════════════════════════════════════
function draw(){
  let ox=0, oy=0;
  if(shakeFrames>0){
    ox=(Math.random()*2-1)*shakeStrength;
    oy=(Math.random()*2-1)*shakeStrength;
    shakeFrames--;
  }
  ctx.save();
  ctx.translate(ox,oy);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  if(phase==='dino'||phase==='pause') drawDinoPhase();
  if(phase==='castle') drawCastlePhase();
  if(phase==='temple') drawTemplePhase();
  ctx.restore();
}

function drawDinoPhase(){
  clouds.forEach(drawCloud); drawGround();
  cacti.forEach(drawCactus); signs.forEach(drawSign);
  drawDino(dinoState==='dead');
  if(dinoState==='idle') drawIdlePrompt();
  if(dinoState==='dead') drawGameOver();
  // Subtle vignette for focus
  const v=ctx.createRadialGradient(W/2,H/2,30,W/2,H/2,260);
  v.addColorStop(0,'rgba(0,0,0,0)');
  v.addColorStop(1,'rgba(0,0,0,0.06)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
}

function drawCloud(c){
  ctx.fillStyle='#535353';
  const x=Math.round(c.x),y=Math.round(c.y),w=c.w;
  ctx.fillRect(x,y+8,w,4); ctx.fillRect(x+w*.1,y+4,w*.55,4);
  ctx.fillRect(x+w*.35,y,w*.35,4); ctx.fillRect(x+w*.7,y+4,w*.25,4);
}

function drawGround(){
  ctx.fillStyle='#535353'; ctx.fillRect(0,GY,W,2);
  gRow1.forEach(g=>{
    const x=Math.round(g.x);
    if(g.type===0) ctx.fillRect(x,GY+3,10,3);
    else{ctx.fillRect(x,GY+3,6,2);ctx.fillRect(x+8,GY+3,4,3);}
  });
  ctx.fillStyle='#cacaca';
  gRow2.forEach(g=>ctx.fillRect(Math.round(g.x),GY+7,8,2));
}

function drawDino(dead){
  const px=Math.round(dino.x), py=Math.round(dino.y-DINO_H);
  const C='#535353'; ctx.fillStyle=C;
  const R=(dx,dy,w,h)=>ctx.fillRect(px+dx,py+dy,w,h);
  R(0,28,6,6);R(4,34,4,4);R(6,36,4,2);
  R(12,22,30,20);R(26,10,14,14);R(22,0,22,14);R(36,10,10,6);
  ctx.fillStyle='#fff';R(32,2,8,6);
  ctx.fillStyle=C;R(36,4,4,4);
  if(dead){R(30,1,3,9);R(35,1,3,9);R(29,4,9,3);ctx.fillStyle='#fff';R(32,2,8,6);ctx.fillStyle=C;R(30,1,3,9);R(35,1,3,9);R(29,4,9,3);}
  ctx.fillStyle=C;
  R(26,-6,4,8);R(32,-9,4,10);R(38,-5,4,7);R(20,30,10,4);
  const lf=dino.grounded?dino.animFrame:0;
  if(dead){R(14,42,10,10);R(28,42,10,10);}
  else if(dino.grounded){
    if(lf===0){R(14,42,10,14);R(28,42,10,8);R(10,54,16,4);}
    else{R(14,42,10,8);R(28,42,10,14);R(26,54,16,4);}
  }else{R(14,42,10,10);R(28,42,10,10);R(10,50,16,4);}
}

function drawCactus(c){
  ctx.fillStyle='#535353';
  const x=Math.round(c.x),y=Math.round(c.y);
  ctx.fillRect(x,y,c.tw,c.th);
  c.arms.forEach(a=>{ctx.fillRect(x+a.dx,y+a.dy,a.w,a.h);ctx.fillRect(x+a.dx,y+a.dy-4,a.w,4);});
}

function drawSign(s){
  const x=Math.round(s.x),y=Math.round(s.y);
  const cx=x+s.w/2, cy=y+24, r=20;
  const oct=(ctx,cx,cy,r)=>{
    ctx.beginPath();
    for(let i=0;i<8;i++){
      const a=(Math.PI/8)+i*(Math.PI/4);
      const px=cx+Math.cos(a)*r, py=cy+Math.sin(a)*r;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath();
  };
  // pole
  ctx.fillStyle='#888';ctx.fillRect(cx-2,cy+r,4,24);
  // sign
  oct(ctx,cx,cy,r+2);ctx.fillStyle='#fff';ctx.fill();
  oct(ctx,cx,cy,r-1);ctx.fillStyle='#c0392b';ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';
  ctx.fillText('STOP',cx,cy+4);
}

function drawGameOver(){
  ctx.fillStyle='#535353';ctx.font='bold 13px "Courier New",monospace';
  ctx.textAlign='center';ctx.letterSpacing='3px';
  ctx.fillText('F I N  D E  P A R T I E',W/2,H/2-6);
  ctx.letterSpacing='0px';ctx.font='11px Arial';ctx.fillStyle='#888';
  ctx.fillText('Appuyez sur ESPACE pour rejouer',W/2,H/2+12);
}

function drawIdlePrompt(){
  ctx.fillStyle='#535353';ctx.font='bold 13px "Courier New",monospace';
  ctx.textAlign='center';ctx.letterSpacing='2px';
  ctx.fillText('APPUYEZ SUR ESPACE POUR DÉMARRER',W/2,H/2+8);
  ctx.letterSpacing='0px';
}

function drawTemplePhase(){
  // Base darkness
  ctx.fillStyle='#0b0b0e';ctx.fillRect(0,0,W,H);

  // Slow moving fog layer
  const fogX = (trFrame*0.6) % W;
  const fog = ctx.createLinearGradient(0,0,W,0);
  fog.addColorStop(0,'rgba(20,20,24,0)');
  fog.addColorStop(0.4,'rgba(20,20,24,0.18)');
  fog.addColorStop(0.8,'rgba(20,20,24,0)');
  ctx.fillStyle=fog;
  ctx.fillRect(-fogX,0,W,H);
  ctx.fillRect(W-fogX,0,W,H);

  // Parallax stone walls
  const wallG=ctx.createLinearGradient(0,0,0,H);
  wallG.addColorStop(0,'#121318'); wallG.addColorStop(1,'#0c0d11');
  ctx.fillStyle=wallG; ctx.fillRect(0,0,90,H); ctx.fillRect(W-90,0,90,H);
  ctx.fillStyle='rgba(255,255,255,0.03)';
  for(let y=0;y<H;y+=18){ ctx.fillRect(0,y,90,1); ctx.fillRect(W-90,y,90,1); }
  // Wall cracks
  ctx.strokeStyle='rgba(255,255,255,0.05)';
  ctx.lineWidth=1;
  for(let i=0;i<6;i++){
    const x=10+(i*12)%60, y=10+i*22;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+20,y+8); ctx.lineTo(x+10,y+20); ctx.stroke();
    const xr=W-80+(i*11)%60, yr=18+i*20;
    ctx.beginPath(); ctx.moveTo(xr,yr); ctx.lineTo(xr+18,yr+10); ctx.lineTo(xr+8,yr+22); ctx.stroke();
  }

  // Floor tiles with perspective
  ctx.fillStyle='#0f0f13'; ctx.fillRect(90,H-30,W-180,30);
  for(let i=0;i<18;i++){
    const x=90+i*(W-180)/18;
    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.fillRect(x,H-30,1,30);
  }
  for(let y=H-30;y<H;y+=6){
    ctx.fillStyle='rgba(255,255,255,0.025)';
    ctx.fillRect(90,y,W-180,1);
  }
  // Floor sheen
  const sheen=ctx.createLinearGradient(90,H-30,W-90,H);
  sheen.addColorStop(0,'rgba(255,255,255,0)');
  sheen.addColorStop(0.5,'rgba(255,255,255,0.05)');
  sheen.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sheen; ctx.fillRect(90,H-30,W-180,30);

  // Depth tunnel glow
  const tunnel=ctx.createRadialGradient(W*0.6,H*0.6,10,W*0.6,H*0.6,260);
  tunnel.addColorStop(0,'rgba(255,240,200,0.06)');
  tunnel.addColorStop(0.5,'rgba(255,180,120,0.04)');
  tunnel.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=tunnel;ctx.fillRect(0,0,W,H);

  // Torch columns
  for(let i=0;i<4;i++){
    const bx=110+i*120, by=30+(i%2)*12;
    ctx.fillStyle='#15161b'; ctx.fillRect(bx,by,24,90);
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(bx+2,by+8,2,70);
    const flame=ctx.createRadialGradient(bx+12,by-4,2,bx+12,by-4,22);
    flame.addColorStop(0,'rgba(255,220,150,0.9)');
    flame.addColorStop(0.5,'rgba(255,140,60,0.6)');
    flame.addColorStop(1,'rgba(255,100,40,0)');
    ctx.fillStyle=flame; ctx.fillRect(bx-18,by-30,60,60);
  }
  for(let i=0;i<4;i++){
    const bx=W-134-i*120, by=36+(i%2)*12;
    ctx.fillStyle='#15161b'; ctx.fillRect(bx,by,24,90);
    ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(bx+20,by+8,2,70);
    const flame=ctx.createRadialGradient(bx+12,by-4,2,bx+12,by-4,22);
    flame.addColorStop(0,'rgba(255,220,150,0.9)');
    flame.addColorStop(0.5,'rgba(255,140,60,0.6)');
    flame.addColorStop(1,'rgba(255,100,40,0)');
    ctx.fillStyle=flame; ctx.fillRect(bx-18,by-30,60,60);
  }

  // Light beams from torches
  ctx.globalAlpha=0.18;
  for(let i=0;i<4;i++){
    const bx=110+i*120, by=30+(i%2)*12;
    ctx.beginPath();
    ctx.moveTo(bx+12,by+4);
    ctx.lineTo(bx-20,by+80);
    ctx.lineTo(bx+44,by+80);
    ctx.closePath();
    ctx.fillStyle='rgba(255,180,90,0.25)';
    ctx.fill();
  }
  for(let i=0;i<4;i++){
    const bx=W-134-i*120, by=36+(i%2)*12;
    ctx.beginPath();
    ctx.moveTo(bx+12,by+4);
    ctx.lineTo(bx-20,by+80);
    ctx.lineTo(bx+44,by+80);
    ctx.closePath();
    ctx.fillStyle='rgba(255,180,90,0.25)';
    ctx.fill();
  }
  ctx.globalAlpha=1;

  // Lane guides as faint glyphs
  LANES.forEach(ly=>{
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.setLineDash([14,10]);
    ctx.beginPath();ctx.moveTo(90,ly-LANE_H);ctx.lineTo(W-90,ly-LANE_H);ctx.stroke();
    ctx.setLineDash([]);
  });

  // Floating dust motes
  for(let i=0;i<22;i++){
    const x=(i*28 + trFrame*0.8)%W;
    const y=(i*17 + trFrame*0.4)%H;
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.fillRect(x,y,2,2);
  }

  // No visible timer; time runs in the background.

  // End-of-tunnel glow and entry as time runs out
  const endStart = Math.floor(TEMPLE_RUN_SECS*60*0.45);
  if(trTimeLeft<=endStart){
    const t = Math.max(0, Math.min(1, 1-(trTimeLeft/endStart)));
    const gx = W-30, gy = H*0.55;
    const glow = ctx.createRadialGradient(gx, gy, 8, gx, gy, 180);
    glow.addColorStop(0, `rgba(255,245,210,${0.85*t})`);
    glow.addColorStop(0.35, `rgba(255,214,120,${0.55*t})`);
    glow.addColorStop(0.7, `rgba(255,200,90,${0.22*t})`);
    glow.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(0,0,W,H);
    // Bright tunnel entrance
    ctx.fillStyle=`rgba(255,255,255,${0.38*t})`;
    ctx.fillRect(W-70, H*0.18, 64, H*0.64);
    // Darken the edges to emphasize entering the tunnel
    const vignette = ctx.createRadialGradient(W*0.6, H*0.55, 60, W*0.6, H*0.55, 260);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${0.35*t})`);
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,W,H);
  }

  // Grace period hint on canvas
  // Grace hint hidden.

  trObstacles.forEach(o=>{
    o.lanes.forEach(ln=>{
      const ly=LANES[ln],x=Math.round(o.x);
      ctx.fillStyle='#6b6b6b';ctx.fillRect(x,ly-LANE_H,36,LANE_H*2);
      ctx.fillStyle='#1b1b1b';ctx.fillRect(x+3,ly-LANE_H+4,30,LANE_H*2-8);
      ctx.strokeStyle='#bbb';ctx.lineWidth=1.5;
      const cx=x+18,cy=ly;
      ctx.beginPath();ctx.moveTo(cx-8,cy-8);ctx.lineTo(cx+8,cy+8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx+8,cy-8);ctx.lineTo(cx-8,cy+8);ctx.stroke();
      ctx.fillStyle='rgba(255,80,60,0.2)'; ctx.fillRect(x,ly-LANE_H,36,LANE_H*2);
    });
  });

  const py=Math.round(trPlayerY),px=Math.round(trPlayerX);
  // Player shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(px,py+16,12,4,0,0,Math.PI*2); ctx.fill();
  ctx.shadowColor='#ffcc66';ctx.shadowBlur=10;
  ctx.fillStyle='#ffcc66';ctx.fillRect(px-12,py-14,24,28);ctx.shadowBlur=0;
  ctx.fillStyle='#0a0a0a';ctx.fillRect(px-8,py-10,16,20);
  ctx.fillStyle='#ffcc66';ctx.fillRect(px-6,py-7,5,4);ctx.fillRect(px+1,py-7,5,4);

  if(trFrame<90&&trGraceFrames<=0){
    const alpha=Math.max(0,(90-trFrame)/90);
    ctx.fillStyle=`rgba(255,255,255,${alpha*0.7})`;
    ctx.font='bold 18px "Courier New",monospace';ctx.textAlign='center';ctx.letterSpacing='4px';
    ctx.fillText('SURVIVE',W/2,H/2+6);ctx.letterSpacing='0px';
  }
  // Inner tunnel vignette
  const tv=ctx.createRadialGradient(W*0.6,H*0.6,40,W*0.6,H*0.6,260);
  tv.addColorStop(0,'rgba(0,0,0,0)');
  tv.addColorStop(1,'rgba(0,0,0,0.22)');
  ctx.fillStyle=tv; ctx.fillRect(0,0,W,H);
}

function drawCastlePhase(){
  ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,W,H);
  // tunnel gradient
  const g=ctx.createRadialGradient(W/2,H*0.6,10,W/2,H*0.6,220);
  g.addColorStop(0,'rgba(255,255,255,0.08)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  // castle gate
  ctx.fillStyle='#1b1b1b';ctx.fillRect(W/2-80,H-90,160,80);
  ctx.fillStyle='#111';ctx.fillRect(W/2-70,H-80,140,70);
  ctx.fillStyle='#1b1b1b';
  ctx.beginPath();
  ctx.arc(W/2,H-80,70,Math.PI,0);
  ctx.fill();

  // torches
  ctx.fillStyle='#3a3a3a';ctx.fillRect(W/2-120,H-70,6,30);
  ctx.fillStyle='#f39c12';ctx.fillRect(W/2-121,H-78,8,10);
  ctx.fillStyle='#3a3a3a';ctx.fillRect(W/2+114,H-70,6,30);
  ctx.fillStyle='#f39c12';ctx.fillRect(W/2+113,H-78,8,10);

  // text
  ctx.fillStyle='#bbb';ctx.font='bold 12px "Courier New",monospace';ctx.textAlign='center';
  ctx.fillText('ENTRÉE DU CHÂTEAU',W/2,30);
  ctx.fillStyle='#777';ctx.font='11px "Courier New",monospace';
  ctx.fillText('APPUYEZ SUR ESPACE POUR CONTINUER',W/2,H-14);
}

// ══════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════
function update(){
  if(phase==='dino')   updateDino();
  if(phase==='castle') updateCastle();
  if(phase==='temple') updateTemple();
}

function loop(){update();draw();requestAnimationFrame(loop);}
function bootSequence(){
  // Fake page load, then show offline screen.
  const domain=document.getElementById('url-domain');
  const path=document.getElementById('url-path');
  const chip=document.getElementById('url-chip');
  if(domain&&path&&chip){
    domain.textContent='www.youtube.com/';
    path.textContent='@markiplier';
    chip.textContent='Sécurisé';
  }
  setTimeout(()=>{
    document.body.classList.remove('loading');
    document.body.classList.add('offline');
    if(domain&&path&&chip){
      domain.textContent='quiz.game/';
      path.textContent='mailbox/email-3';
      chip.textContent='Non sécurisé';
    }
  }, 3000);
}

updateScoreDOM();
loop();
bootSequence();
canvas.focus();
