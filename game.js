(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);
  const els = {
    hud: byId("hud"), menu: byId("menu"), upgrades: byId("upgrade-panel"), pause: byId("pause-panel"),
    result: byId("result-panel"), upgradeOptions: byId("upgrade-options"), upgradeStrip: byId("upgrade-strip"),
    toast: byId("toast"), hp: byId("hud-hp"), base: byId("hud-base"), level: byId("hud-level"),
    wave: byId("hud-wave"), enemies: byId("hud-enemies"), score: byId("hud-score"), combo: byId("hud-combo"), help: byId("help-dialog")
  };

  const STORAGE_KEY = "color-tank-squad-v1";
  const DEFAULT_SAVE = { bestScore: 0, bestTime: null, sound: true, shake: true, run: null, tips: {} };
  function loadSave() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULT_SAVE, ...(value && typeof value === "object" ? value : {}) };
    } catch { return { ...DEFAULT_SAVE }; }
  }
  let save = loadSave();
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
    updateRecords();
    updateContinueButton();
  }

  const DIRS = {
    up: { x: 0, y: -1, angle: 0 }, right: { x: 1, y: 0, angle: Math.PI / 2 },
    down: { x: 0, y: 1, angle: Math.PI }, left: { x: -1, y: 0, angle: -Math.PI / 2 }
  };
  const ENEMY_TYPES = {
    scout: { name: "侦察", hp: 1, speed: 104, fire: 1.55, color: "#34d399", score: 110, shape: "diamond" },
    heavy: { name: "强装甲", hp: 4, speed: 48, fire: 1.8, color: "#f59e0b", score: 280, shape: "square" },
    breaker: { name: "疾击", hp: 2, speed: 70, fire: 1.35, bulletSpeed: 390, armorPiercing: true, steelDamage: 1, color: "#f43f5e", score: 280, shape: "stripe" },
    runner: { name: "急行", hp: 1, speed: 166, fire: 1.9, color: "#2dd4bf", score: 210, shape: "chevron" },
    sniper: { name: "远射", hp: 2, speed: 54, fire: 2.1, bulletSpeed: 330, color: "#a78bfa", score: 230, shape: "cross" },
    boss1: { name: "翡翠重装兽", hp: 12, speed: 52, fire: 1.05, color: "#34d399", score: 1600, shape: "bossCharge", size: 52, isBoss: true },
    boss2: { name: "沙暴破城者", hp: 16, speed: 68, fire: .95, bulletSpeed: 360, armorPiercing: true, steelDamage: 1, color: "#fb923c", score: 2100, shape: "bossBreaker", size: 52, isBoss: true },
    boss3: { name: "极光指挥舰", hp: 20, speed: 48, fire: .82, bulletSpeed: 260, color: "#22d3ee", score: 2800, shape: "bossAurora", size: 56, isBoss: true }
  };

  const TERRAIN = {
    brick: { color: "#f97368", dark: "#be3d50", blocks: true },
    steel: { color: "#91a1c7", dark: "#4b587b", blocks: true },
    water: { color: "#38bdf8", dark: "#12649a", blocks: true },
    bush: { color: "#34d399", dark: "#12745b", blocks: false },
    ice: { color: "#b8f3ff", dark: "#58b9dc", blocks: false },
    barrel: { color: "#fbbf24", dark: "#b45309", blocks: true },
    crystal: { color: "#c084fc", dark: "#6d28d9", blocks: true }
  };

  const squad = names => names.trim().split(/\s+/);
  const BASE_FORT = [["brick",340,520,80,40],["brick",540,520,80,40],["brick",420,560,40,60],["brick",500,560,40,60]];

  // Nine data-driven scenes: 12, 12, 15, 15, 15, 15, 20, 20, 20 enemies.
  const LEVELS = [
    {
      chapter:"翡翠篇",name:"翡翠前线",tip:"方形标记是强装甲，前三次攻击只能削弱它",targetActive:3,spawnDelay:.65,sky:"#0d2c39",ground:"#123b3f",grid:"#1a4b4d",accent:"#34d399",
      terrain: [
        ["brick",120,140,200,40],["brick",640,140,200,40],["steel",440,140,80,40],
        ["bush",60,220,200,60],["brick",320,240,120,40],["brick",520,240,120,40],["bush",700,220,200,60],
        ["brick",120,360,160,40],["steel",360,360,80,40],["steel",520,360,80,40],["brick",680,360,160,40],
        ["bush",240,440,160,60],["bush",560,440,160,60],...BASE_FORT
      ],
      waves:[squad("scout scout heavy runner breaker runner"),squad("scout heavy heavy runner breaker scout")]
    },
    {
      chapter:"翡翠篇",name:"密林水道",tip:"十字标记的远射坦克会主动瞄准玩家和基地",targetActive:3,spawnDelay:.65,sky:"#103546",ground:"#16464a",grid:"#20595b",accent:"#2dd4bf",
      terrain: [
        ["water",200,100,120,240],["water",640,100,120,240],["brick",80,160,80,40],["brick",800,160,80,40],
        ["bush",40,300,120,100],["steel",360,280,80,40],["brick",440,240,80,120],["steel",520,280,80,40],["bush",800,300,120,100],
        ["brick",160,420,160,40],["brick",640,420,160,40],["bush",360,420,240,70],...BASE_FORT
      ],
      waves:[squad("scout runner runner breaker sniper heavy"),squad("runner breaker breaker sniper heavy scout")]
    },
    {
      chapter:"翡翠篇",name:"远古钢铁门",targetActive:4,spawnDelay:.5,sky:"#173526",ground:"#234a36",grid:"#315d44",accent:"#84cc16",
      terrain: [
        ["steel",80,120,40,240],["steel",840,120,40,240],["steel",200,120,200,40],["steel",560,120,200,40],
        ["brick",240,220,120,40],["steel",440,200,80,160],["brick",600,220,120,40],
        ["steel",160,360,160,40],["brick",360,400,80,40],["brick",520,400,80,40],["steel",640,360,160,40],
        ["bush",80,440,160,60],["bush",720,440,160,60],...BASE_FORT
      ],
      waves:[squad("scout heavy heavy runner breaker sniper runner"),squad("breaker heavy runner sniper breaker runner boss1 heavy")]
    },
    {
      chapter:"沙暴篇",name:"夕阳沙丘",targetActive:4,spawnDelay:.5,sky:"#3b1835",ground:"#512543",grid:"#6d3151",accent:"#f59e0b",
      terrain:[
        ["brick",80,120,200,40],["steel",360,120,80,40],["brick",520,120,200,40],["steel",800,120,80,40],
        ["brick",200,220,200,40],["brick",560,220,200,40],["steel",80,280,80,40],["steel",800,280,80,40],
        ["brick",80,380,200,40],["steel",360,360,80,40],["steel",520,360,80,40],["brick",680,380,200,40],
        ["bush",240,440,160,60],["bush",560,440,160,60],...BASE_FORT
      ],
      waves:[squad("scout heavy runner runner breaker sniper heavy"),squad("scout heavy heavy runner runner breaker breaker sniper")]
    },
    {
      chapter:"沙暴篇",name:"幻光燃料站",tip:"黄色油桶会伤害附近所有单位，也能炸开砖墙",targetActive:4,spawnDelay:.4,sky:"#442032",ground:"#5a2b38",grid:"#743747",accent:"#fbbf24",
      terrain:[
        ["steel",120,120,40,160],["steel",800,120,40,160],["brick",240,120,200,40],["brick",520,120,200,40],
        ["barrel",320,220,30,30],["barrel",610,220,30,30],["brick",400,220,160,40],
        ["brick",80,320,200,40],["barrel",300,340,30,30],["barrel",630,340,30,30],["brick",680,320,200,40],
        ["steel",240,420,80,40],["bush",360,400,240,70],["steel",640,420,80,40],["barrel",180,470,30,30],["barrel",750,470,30,30],...BASE_FORT
      ],
      waves:[squad("scout runner runner breaker sniper heavy breaker"),squad("heavy runner breaker sniper sniper heavy runner breaker")]
    },
    {
      chapter:"沙暴篇",name:"沙暴要塞",targetActive:4,spawnDelay:.4,sky:"#4a2430",ground:"#673239",grid:"#824344",accent:"#fb923c",
      terrain:[
        ["steel",80,120,120,40],["steel",760,120,120,40],["brick",280,120,160,40],["brick",520,120,160,40],
        ["steel",200,200,40,160],["steel",720,200,40,160],["brick",320,220,320,40],
        ["brick",80,360,200,40],["steel",360,340,80,80],["steel",520,340,80,80],["brick",680,360,200,40],
        ["bush",200,440,160,60],["bush",600,440,160,60],...BASE_FORT
      ],
      waves:[squad("heavy breaker sniper runner breaker heavy runner"),squad("sniper breaker heavy runner breaker sniper boss2 heavy")]
    },
    {
      chapter:"极光篇",name:"极光冻河",targetActive:4,spawnDelay:.3,sky:"#111c51",ground:"#173660",grid:"#27517b",accent:"#22d3ee",
      terrain:[
        ["ice",40,100,280,100],["ice",640,100,280,100],["steel",400,120,160,40],
        ["water",80,240,200,60],["brick",320,240,120,40],["brick",520,240,120,40],["water",680,240,200,60],
        ["steel",160,340,120,40],["ice",340,320,280,100],["steel",680,340,120,40],
        ["brick",80,440,200,40],["brick",680,440,200,40],["ice",280,460,120,50],["ice",560,460,120,50],...BASE_FORT
      ],
      waves:[squad("runner runner breaker sniper heavy runner breaker sniper heavy scout"),squad("runner breaker heavy sniper runner breaker heavy sniper runner breaker")]
    },
    {
      chapter:"极光篇",name:"水晶迷宫",tip:"紫色水晶墙会反射双方炮弹，最多连续反射三次",targetActive:4,spawnDelay:.3,sky:"#241650",ground:"#253a66",grid:"#365482",accent:"#c084fc",
      terrain:[
        ["crystal",120,120,40,200],["crystal",800,120,40,200],["steel",240,120,160,40],["steel",560,120,160,40],
        ["brick",240,220,120,40],["crystal",440,200,80,160],["brick",600,220,120,40],
        ["crystal",80,360,160,40],["steel",320,360,80,40],["steel",560,360,80,40],["crystal",720,360,160,40],
        ["ice",160,420,160,70],["ice",640,420,160,70],["brick",360,440,80,40],["brick",520,440,80,40],...BASE_FORT
      ],
      waves:[squad("sniper breaker runner heavy sniper breaker runner heavy breaker runner"),squad("heavy sniper breaker runner runner sniper heavy breaker runner sniper")]
    },
    {
      chapter:"极光篇",name:"极地核心",targetActive:4,spawnDelay:.3,sky:"#161846",ground:"#1b315b",grid:"#294a75",accent:"#67e8f9",
      terrain:[
        ["ice",40,100,200,80],["crystal",280,120,80,40],["steel",400,120,160,40],["crystal",600,120,80,40],["ice",720,100,200,80],
        ["water",80,240,160,60],["brick",280,240,120,40],["brick",560,240,120,40],["water",720,240,160,60],
        ["steel",160,340,80,40],["crystal",320,320,80,80],["crystal",560,320,80,80],["steel",720,340,80,40],
        ["barrel",260,420,30,30],["brick",320,440,120,40],["brick",520,440,120,40],["barrel",670,420,30,30],
        ["ice",80,460,160,50],["ice",720,460,160,50],...BASE_FORT
      ],
      waves:[squad("runner breaker sniper heavy runner breaker sniper heavy runner breaker"),squad("heavy sniper breaker runner heavy sniper breaker runner runner boss3")]
    }
  ];
  const ACTIVE_ENEMY_MIN = 3;
  const ACTIVE_ENEMY_MAX = 4;

  const UPGRADE_DEFS = [
    {id:"double",category:"attack",name:"并行双发",desc:"每次射击发出两枚平行炮弹。",max:1,color:"#f43f5e",apply:g=>g.upgrades.double=1},
    {id:"bounce",category:"attack",name:"弹射炮弹",desc:"己方炮弹可从钢墙反弹。",max:2,color:"#22d3ee",apply:g=>g.upgrades.bounce++},
    {id:"pierce",category:"attack",name:"穿甲弹头",desc:"炮弹可额外穿透一个敌人。",max:2,color:"#facc15",apply:g=>g.upgrades.pierce++},
    {id:"fireRate",category:"attack",name:"快速装填",desc:"射击间隔缩短18%。",max:3,color:"#f97316",apply:g=>g.upgrades.fireRate++},
    {id:"speed",category:"mobility",name:"涡轮履带",desc:"移动速度提高12%。",max:3,color:"#34d399",apply:g=>g.upgrades.speed++},
    {id:"shield",category:"defense",name:"强化护盾",desc:"最大和当前装甲增加1。",max:2,color:"#a78bfa",apply:g=>{g.upgrades.shield++;g.player.maxHp++;g.player.hp++}},
    {id:"heal",category:"defense",name:"战地维修",desc:"每击毁四辆敌军恢复1点装甲。",max:1,color:"#10b981",apply:g=>g.upgrades.heal=1},
    {id:"shockwave",category:"attack",name:"爆裂核心",desc:"击毁敌人时伤害附近敌军。",max:2,color:"#fb7185",apply:g=>g.upgrades.shockwave++},
    {id:"baseRepair",category:"defense",name:"基地抢修",desc:"立即恢复2点基地能量。",max:2,color:"#60a5fa",apply:g=>{g.upgrades.baseRepair++;g.base.hp=Math.min(g.base.maxHp,g.base.hp+2)}},
    {id:"overload",category:"attack",name:"过载炮弹",desc:"每第5次射击产生范围爆炸。",max:2,color:"#f97316",apply:g=>g.upgrades.overload++},
    {id:"frost",category:"attack",name:"冰冻弹头",desc:"命中后降低敌军移动和射击速度。",max:2,color:"#38bdf8",apply:g=>g.upgrades.frost++},
    {id:"sideCannon",category:"attack",name:"侧翼火炮",desc:"周期性向左右额外发射炮弹。",max:2,color:"#e879f9",apply:g=>g.upgrades.sideCannon++},
    {id:"comboBoost",category:"mobility",name:"连击增压",desc:"连击达到5时提升速度和射速。",max:2,color:"#facc15",apply:g=>g.upgrades.comboBoost++},
    {id:"reactiveArmor",category:"defense",name:"反应装甲",desc:"每关抵挡第一次破甲攻击。",max:1,color:"#94a3b8",apply:g=>g.upgrades.reactiveArmor=1},
    {id:"barrier",category:"defense",name:"充能屏障",desc:"周期性自动抵挡一枚敌军炮弹。",max:2,color:"#8b5cf6",apply:g=>{g.upgrades.barrier++;g.barrierReady=true}},
    {id:"emergencyRepair",category:"defense",name:"紧急维修",desc:"每关一次，危急时自动恢复2点装甲。",max:1,color:"#22c55e",apply:g=>g.upgrades.emergencyRepair=1},
    {id:"baseShield",category:"defense",name:"基地护盾",desc:"每关抵挡1至2次基地伤害。",max:2,color:"#0ea5e9",apply:g=>{g.upgrades.baseShield++;g.baseShieldCharges++}},
    {id:"supplyMagnet",category:"mobility",name:"补给磁铁",desc:"扩大补给拾取范围并强化效果。",max:2,color:"#14b8a6",apply:g=>g.upgrades.supplyMagnet++}
  ];

  let game = null;
  let lastTime = performance.now();
  let keys = new Set();
  const touchCapable = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
  let mobileDirection = null, mobileFire = false, stickPointer = null, firePointer = null;
  let audioCtx = null;
  let toastTimer = 0;
  document.documentElement.classList.toggle("touch-capable",touchCapable);

  function newGame() {
    return {
      state:"battle", levelIndex:0, waveIndex:0, levelKills:0, score:0, combo:1, maxCombo:1, comboTimer:0,
      elapsed:0, kills:0, shake:0, flash:0, nextWavePending:false,currentSpawnSide:null,nextSpawnSide:Math.random()<.5?"left":"right",
      base:{ x:460,y:584,w:40,h:40,hp:6,maxHp:6 }, player:null, enemies:[], bullets:[], particles:[], tiles:[], crate:null,
      spawnQueue:[], spawnTimer:0, waveActive:false,shotCount:0,reactiveUsed:false,emergencyUsed:false,
      barrierReady:false,barrierTimer:0,baseShieldCharges:0,cores:{emerald:false,sand:false},
      upgrades:{double:0,bounce:0,pierce:0,fireRate:0,speed:0,shield:0,heal:0,shockwave:0,baseRepair:0,overload:0,frost:0,sideCannon:0,comboBoost:0,reactiveArmor:0,barrier:0,emergencyRepair:0,baseShield:0,supplyMagnet:0}
    };
  }

  function makePlayer(previous,side) {
    const maxHp = previous ? previous.maxHp : 3 + (game?.upgrades.shield || 0);
    return {x:side==="left"?372:554,y:574,w:34,h:34,dir:"up",hp:previous?Math.max(1,previous.hp):maxHp,maxHp,speed:150,fireCooldown:.4,invulnerable:1.2,armorBreak:0,iceVX:0,iceVY:0,color:"#facc15"};
  }

  function startGame() {
    initAudio();
    save.run=null;
    game = newGame();
    loadLevel(0);
    showGameUI();
    playSound("start");
  }

  function continueGame() {
    const run=save.run;
    if(!run||!Number.isInteger(run.levelIndex)||run.levelIndex<0||run.levelIndex>=LEVELS.length){save.run=null;persist();startGame();return}
    initAudio();game=newGame();
    game.score=Number(run.score)||0;game.elapsed=Number(run.elapsed)||0;game.kills=Number(run.kills)||0;
    game.base.hp=clamp(Number(run.baseHp)||1,1,game.base.maxHp);game.currentSpawnSide=run.spawnSide==="right"?"right":"left";game.nextSpawnSide=run.nextSpawnSide==="right"?"right":"left";
    game.upgrades={...game.upgrades,...(run.upgrades||{})};game.cores={...game.cores,...(run.cores||{})};game.shotCount=Number(run.shotCount)||0;
    game.player={hp:clamp(Number(run.playerHp)||1,1,Number(run.playerMaxHp)||3),maxHp:Number(run.playerMaxHp)||3};
    loadLevel(run.levelIndex,true);showGameUI();announce(`继续第 ${run.levelIndex+1} 关`);playSound("start");
  }

  function loadLevel(index,restoring=false) {
    game.levelIndex = index;
    game.waveIndex = 0;
    game.levelKills = 0;
    game.enemies.length = 0; game.bullets.length = 0; game.particles.length = 0;
    game.tiles = createTiles(LEVELS[index].terrain);
    const side=restoring&&game.currentSpawnSide?game.currentSpawnSide:game.nextSpawnSide;game.currentSpawnSide=side;game.nextSpawnSide=side==="left"?"right":"left";
    game.player = makePlayer(game.player,side);
    if(!restoring&&index>0&&game.cores.emerald){game.player.hp=Math.min(game.player.maxHp,game.player.hp+1);game.base.hp=Math.min(game.base.maxHp,game.base.hp+1)}
    game.reactiveUsed=false;game.emergencyUsed=false;game.baseShieldCharges=game.upgrades.baseShield;
    game.barrierReady=game.upgrades.barrier>0;game.barrierTimer=0;
    beginWave();
    announce(`${LEVELS[index].chapter} · 第 ${index+1} 关 ${LEVELS[index].name} · ${side==="left"?"左侧":"右侧"}入场`);
    saveRun();
    const tip=LEVELS[index].tip,tipKey=`level-${index}`;
    if(tip&&!save.tips?.[tipKey]){save.tips??={};save.tips[tipKey]=true;persist();const currentGame=game;setTimeout(()=>{if(game===currentGame&&game.levelIndex===index&&game.state==="battle")announce(tip)},1950)}
  }

  function saveRun(){
    if(!game||game.state==="victory")return;
    save.run={levelIndex:game.levelIndex,score:game.score,elapsed:Math.floor(game.elapsed),kills:game.kills,baseHp:game.base.hp,playerHp:game.player.hp,playerMaxHp:game.player.maxHp,upgrades:{...game.upgrades},cores:{...game.cores},shotCount:game.shotCount,spawnSide:game.currentSpawnSide,nextSpawnSide:game.nextSpawnSide};
    persist();
  }

  function createTiles(terrain) {
    const tiles=[];
    for (const [type,x,y,w,h] of terrain) {
      if (["brick","steel","crystal"].includes(type)) {
        for (let ty=y;ty<y+h;ty+=40) for (let tx=x;tx<x+w;tx+=40) {
          const hp=type==="steel"?3:type==="brick"?1:Infinity;
          tiles.push({type,x:tx,y:ty,w:Math.min(40,x+w-tx),h:Math.min(40,y+h-ty),hp,maxHp:hp});
        }
      } else tiles.push({type,x,y,w,h,hp:Infinity,maxHp:Infinity});
    }
    return tiles;
  }

  function beginWave() {
    game.waveActive = true;
    game.nextWavePending = false;
    game.spawnQueue = [...LEVELS[game.levelIndex].waves[game.waveIndex]];
    while(game.enemies.length<ACTIVE_ENEMY_MIN&&game.spawnQueue.length)spawnEnemy(game.spawnQueue.shift());
    game.spawnTimer = LEVELS[game.levelIndex].spawnDelay;
    const spots = [{x:450,y:240},{x:90,y:250},{x:820,y:250},{x:450,y:430},{x:310,y:430},{x:620,y:430}];
    const start = (game.levelIndex * 2 + game.waveIndex) % spots.length;
    let spot = spots[start];
    for (let i=0;i<spots.length;i++) {
      const candidate=spots[(start+i)%spots.length];
      const box={...candidate,w:28,h:28};
      if(!game.tiles.some(t=>TERRAIN[t.type].blocks&&rectsOverlap(box,t))&&!rectsOverlap(box,game.base)){spot=candidate;break}
    }
    game.crate = { ...spot,w:28,h:28,pulse:0 };
    announce(`第 ${game.waveIndex + 1} 波 · 守住基地`);
    updateHud();
  }

  function spawnEnemy(typeName) {
    const type = ENEMY_TYPES[typeName];
    const size = type.size || 34;
    const spawnY=type.isBoss?58:70;
    const spawnPoints = [{x:54,y:spawnY},{x:463,y:spawnY},{x:872,y:spawnY},{x:245,y:spawnY},{x:680,y:spawnY}];
    let pos = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];
    for (const candidate of spawnPoints) {
      if (!game.enemies.some(e=>distance(candidate.x,candidate.y,e.x,e.y)<70)) { pos=candidate; break; }
    }
    game.enemies.push({
      type:typeName, x:pos.x,y:pos.y,w:size,h:size,dir:"down",hp:type.hp,maxHp:type.hp,
      speed:type.speed,fireTimer:.7+Math.random()*1.2,moveTimer:.5+Math.random()*1.2,spawn:0.55,hit:0,phase:1,slowTimer:0,
      specialTimer:2.8+Math.random()*1.4,chargeTimer:0,dashTimer:0,stunTimer:0,shielded:false,shieldTimer:3
    });
    if(type.isBoss)announce(`${type.name} 进入战场`);
    playSound("spawn");
  }

  function update(dt) {
    if (!game || game.state !== "battle") return;
    game.elapsed += dt;
    game.flash = Math.max(0,game.flash-dt);
    game.shake = Math.max(0,game.shake-dt*22);
    if(game.upgrades.barrier&&!game.barrierReady){game.barrierTimer-=dt;if(game.barrierTimer<=0){game.barrierReady=true;announce("充能屏障已恢复")}}
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) { game.combo=1; updateHud(); }
    }
    updatePlayer(dt);
    updateSpawning(dt);
    for (const enemy of [...game.enemies]) updateEnemy(enemy,dt);
    updateBullets(dt);
    updateParticles(dt);
    updateCrate(dt);
    checkWaveComplete();
    updateHud();
  }

  function updateSpawning(dt) {
    if (!game.spawnQueue.length) return;
    const level=LEVELS[game.levelIndex];
    game.spawnTimer -= dt;
    while (game.enemies.length < ACTIVE_ENEMY_MIN && game.spawnQueue.length) {
      spawnEnemy(game.spawnQueue.shift());
      game.spawnTimer = level.spawnDelay;
    }
    if (game.spawnTimer <= 0 && game.enemies.length < Math.min(ACTIVE_ENEMY_MAX,level.targetActive) && game.spawnQueue.length) {
      spawnEnemy(game.spawnQueue.shift());
      game.spawnTimer = level.spawnDelay;
    }
  }

  function updatePlayer(dt) {
    const p=game.player;
    p.fireCooldown=Math.max(0,p.fireCooldown-dt); p.invulnerable=Math.max(0,p.invulnerable-dt);p.armorBreak=Math.max(0,p.armorBreak-dt);
    let dir=mobileDirection;
    if(keys.has("arrowup")||keys.has("w"))dir="up";
    else if(keys.has("arrowdown")||keys.has("s"))dir="down";
    else if(keys.has("arrowleft")||keys.has("a"))dir="left";
    else if(keys.has("arrowright")||keys.has("d"))dir="right";
    const onIce=touchesTile(p,"ice");
    if(dir){
      p.dir=dir;const d=DIRS[dir];const comboBonus=game.combo>=5?1+game.upgrades.comboBoost*.1:1;const speed=p.speed*(1+game.upgrades.speed*.12)*comboBonus;
      p.iceVX=d.x*speed;p.iceVY=d.y*speed;moveTank(p,d.x*speed*dt,d.y*speed*dt,true);
    }else if(onIce && (Math.abs(p.iceVX)+Math.abs(p.iceVY)>8)){
      moveTank(p,p.iceVX*dt,p.iceVY*dt,true);p.iceVX*=Math.pow(.18,dt);p.iceVY*=Math.pow(.18,dt);
    }else{p.iceVX=0;p.iceVY=0}
    if(keys.has(" ")||mobileFire) firePlayer();
  }

  function updateEnemy(e,dt) {
    if(e.spawn>0){e.spawn-=dt;return}
    e.hit=Math.max(0,e.hit-dt);e.slowTimer=Math.max(0,e.slowTimer-dt);e.moveTimer-=dt;e.fireTimer-=dt*(e.slowTimer>0?.62:1);e.specialTimer-=dt;
    e.chargeTimer=Math.max(0,e.chargeTimer-dt);e.dashTimer=Math.max(0,e.dashTimer-dt);e.stunTimer=Math.max(0,e.stunTimer-dt);
    const type=ENEMY_TYPES[e.type];
    if(e.type==="boss3" && e.hp<=e.maxHp/2 && e.phase===1){e.phase=2;e.speed*=1.25;e.fireTimer=.1;announce("极光指挥舰进入弹幕阶段");game.flash=.25}
    if(e.type==="boss3"){
      e.shieldTimer-=dt;
      if(e.shieldTimer<=0){e.shielded=!e.shielded;e.shieldTimer=e.shielded?2.1:3.2;announce(e.shielded?"极光护盾开启":"极光护盾出现缺口")}
    }
    if(e.type==="boss1"&&e.specialTimer<=0){aimEnemy(e);e.chargeTimer=.9;e.specialTimer=4.2;announce("翡翠重装兽准备冲锋")}
    if(e.type==="boss2"&&e.specialTimer<=0){aimEnemy(e);e.dashTimer=.65;e.specialTimer=3.4;announce("沙暴破城者高速转移")}
    if(e.stunTimer>0)return;
    if(e.moveTimer<=0&&e.chargeTimer<=0&&e.dashTimer<=0){
      const towardBase=Math.random()<(e.type==="runner"?.84:.55);
      if(towardBase)e.dir=Math.abs(game.base.x-e.x)>150?(game.base.x>e.x?"right":"left"):"down";
      else e.dir=["up","right","down","left"][Math.floor(Math.random()*4)];
      e.moveTimer=e.type==="runner"?.28+Math.random()*.55:.55+Math.random()*1.2;
    }
    const d=DIRS[e.dir];
    const speedBoost=(e.chargeTimer>0?3.2:e.dashTimer>0?2.15:1)*(e.slowTimer>0?.62:1);
    if(!moveTank(e,d.x*e.speed*speedBoost*dt,d.y*e.speed*speedBoost*dt,false)){
      e.moveTimer=0;
      if(e.type==="boss1"&&e.chargeTimer>0){e.chargeTimer=0;e.stunTimer=1.35;announce("重装兽撞墙眩晕：现在攻击！")}
    }
    if(e.fireTimer<=0){
      if(["sniper","breaker","boss2"].includes(e.type)&&Math.random()<.72)aimEnemy(e);
      else if(e.type==="boss3"&&e.phase===2)aimEnemy(e);
      fireEnemy(e);
      e.fireTimer=type.fire*(.82+Math.random()*.38)*(e.phase===2?.62:1);
    }
  }

  function aimEnemy(e){
    const target=Math.random()<.72?game.player:game.base;
    const dx=target.x-e.x,dy=target.y-e.y;
    e.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up");
  }

  function moveTank(tank,dx,dy,isPlayer){
    const oldX=tank.x,oldY=tank.y;
    tank.x=clamp(tank.x+dx,8,W-tank.w-8);
    if(collidesTank(tank,isPlayer))tank.x=oldX;
    tank.y=clamp(tank.y+dy,56,H-tank.h-8);
    if(collidesTank(tank,isPlayer))tank.y=oldY;
    return tank.x!==oldX||tank.y!==oldY;
  }

  function collidesTank(tank,isPlayer){
    if(game.tiles.some(t=>TERRAIN[t.type].blocks&&rectsOverlap(tank,t)))return true;
    if(rectsOverlap(tank,game.base))return true;
    if(isPlayer)return game.enemies.some(e=>e.spawn<=0&&rectsOverlap(tank,e));
    return rectsOverlap(tank,game.player)||game.enemies.some(e=>e!==tank&&e.spawn<=0&&rectsOverlap(tank,e));
  }

  function firePlayer(){
    const p=game.player;if(p.fireCooldown>0)return;
    game.shotCount++;
    const comboRate=game.combo>=5?Math.pow(.86,game.upgrades.comboBoost):1;
    const rate=.34*Math.pow(.82,game.upgrades.fireRate)*comboRate;p.fireCooldown=rate;
    const overload=game.upgrades.overload>0&&game.shotCount%5===0;
    const coreShot=game.cores.sand&&game.shotCount%10===0;
    const offsets=game.upgrades.double?[-7,7]:[0];
    for(const offset of offsets)spawnBullet(p,true,offset,360,{overload,coreShot});
    const sideEvery=game.upgrades.sideCannon===2?2:3;
    if(game.upgrades.sideCannon&&game.shotCount%sideEvery===0){
      const original=p.dir,names=["up","right","down","left"],index=names.indexOf(original);
      p.dir=names[(index+1)%4];spawnBullet(p,true,0,330,{overload:false,coreShot});
      p.dir=names[(index+3)%4];spawnBullet(p,true,0,330,{overload:false,coreShot});p.dir=original;
    }
    playSound("shoot");
  }

  function fireEnemy(e){
    const type=ENEMY_TYPES[e.type],original=e.dir,names=["up","right","down","left"];
    spawnBullet(e,false,0,type.bulletSpeed||220);
    if(e.type==="boss2"&&e.hp<=e.maxHp*.66){
      e.dir=names[(names.indexOf(original)+1)%4];spawnBullet(e,false,0,type.bulletSpeed);e.dir=original;
    }
    if(e.type==="boss3"){
      const count=e.phase===2?4:2;
      for(let i=1;i<count;i++){e.dir=names[(names.indexOf(original)+i*(count===2?2:1))%4];spawnBullet(e,false,0,type.bulletSpeed)}
      e.dir=original;
    }
    playSound("enemyShot");
  }

  function spawnBullet(owner,friendly,offset,speed,mods={}){
    const d=DIRS[owner.dir];const sideX=d.y,sideY=-d.x;
    const enemyType=friendly?null:ENEMY_TYPES[owner.type];
    const bullet={
      x:owner.x+owner.w/2+d.x*(owner.w/2+5)+sideX*offset-4,
      y:owner.y+owner.h/2+d.y*(owner.h/2+5)+sideY*offset-4,
      w:8,h:8,vx:d.x*speed,vy:d.y*speed,friendly,
      bounces:friendly?game.upgrades.bounce:0,pierce:friendly?game.upgrades.pierce:0,
      armorPiercing:!!enemyType?.armorPiercing,steelDamage:mods.coreShot?1:enemyType?.steelDamage||0,
      frost:friendly?game.upgrades.frost:0,overload:!!mods.overload,detonated:false,reflects:0,coreShot:!!mods.coreShot,
      dead:false,color:mods.coreShot?"#fff7ae":friendly?"#facc15":enemyType?.armorPiercing?"#f43f5e":"#fb7185"
    };game.bullets.push(bullet);return bullet;
  }

  function updateBullets(dt){
    for(const b of game.bullets){
      const distanceToMove=Math.hypot(b.vx*dt,b.vy*dt);const steps=Math.max(1,Math.ceil(distanceToMove/5));
      for(let i=0;i<steps&&!b.dead;i++){
        b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;
        if(b.x<0||b.x>W-b.w||b.y<48||b.y>H-b.h){if(b.overload)detonateBullet(b);b.dead=true;break}
        hitTerrain(b);
        if(b.dead)break;
        if(b.friendly){
          for(const e of [...game.enemies])if(e.spawn<=0&&rectsOverlap(b,e)){damageEnemy(e,1,b);if(b.overload)detonateBullet(b,e);if(b.pierce>0)b.pierce--;else b.dead=true;break}
        }else{
          if(rectsOverlap(b,game.player)){damagePlayer(1,b.armorPiercing);b.dead=true}
          else if(rectsOverlap(b,game.base)){damageBase(1);b.dead=true}
        }
      }
    }
    // Opposing bullets cancel each other for readable, fair play.
    for(let i=0;i<game.bullets.length;i++)for(let j=i+1;j<game.bullets.length;j++){
      const a=game.bullets[i],b=game.bullets[j];if(!a.dead&&!b.dead&&a.friendly!==b.friendly&&rectsOverlap(a,b)){a.dead=b.dead=true;burst(a.x,a.y,"#ffffff",4)}
    }
    game.bullets=game.bullets.filter(b=>!b.dead);
  }

  function hitTerrain(b){
    for(let i=game.tiles.length-1;i>=0;i--){
      const t=game.tiles[i];if(!rectsOverlap(b,t)||["water","bush","ice"].includes(t.type))continue;
      if(t.type==="barrel"){
        if(b.overload)detonateBullet(b);explodeBarrel(t,i);b.dead=true;return;
      }
      if(t.type==="crystal"){
        if(b.overload)detonateBullet(b);
        if(b.reflects>=3){b.dead=true;return}
        const prevX=b.x-b.vx*.012,prevY=b.y-b.vy*.012;
        if(prevX+b.w<=t.x||prevX>=t.x+t.w)b.vx*=-1;else b.vy*=-1;
        b.reflects++;b.x+=b.vx*.018;b.y+=b.vy*.018;burst(b.x,b.y,TERRAIN.crystal.color,7);playSound("steel");return;
      }
      if(t.type==="brick"){
        t.hp--;burst(b.x,b.y,TERRAIN.brick.color,7);if(t.hp<=0)game.tiles.splice(i,1);if(b.overload)detonateBullet(b);b.dead=true;playSound("brick");return;
      }
      if(t.type==="steel"){
        if(b.overload)detonateBullet(b);
        if(b.steelDamage>0){
          t.hp-=b.steelDamage;burst(b.x,b.y,"#f43f5e",9);b.dead=true;
          if(t.hp<=0){game.tiles.splice(i,1);game.shake=Math.max(game.shake,7);announce("疾击炮弹击穿了钢铁掩体")}
          playSound("steel");return;
        }
        if(b.bounces>0){
          const prevX=b.x-b.vx*.012,prevY=b.y-b.vy*.012;
          if(prevX+b.w<=t.x||prevX>=t.x+t.w)b.vx*=-1;else b.vy*=-1;
          b.bounces--;b.x+=b.vx*.018;b.y+=b.vy*.018;burst(b.x,b.y,"#b8c5e5",5);
        }else b.dead=true;
        playSound("steel");return;
      }
    }
  }

  function detonateBullet(b,excluded=null){
    if(b.detonated)return;b.detonated=true;
    const radius=62+game.upgrades.overload*18,x=b.x+b.w/2,y=b.y+b.h/2;
    for(const enemy of [...game.enemies])if(enemy!==excluded&&enemy.spawn<=0&&distance(x,y,enemy.x+enemy.w/2,enemy.y+enemy.h/2)<radius)damageEnemy(enemy,1,null,true);
    ring(x,y,"#f97316",radius);burst(x,y,"#facc15",14);game.shake=Math.max(game.shake,6);
  }

  function explodeBarrel(t,index){
    game.tiles.splice(index,1);const x=t.x+t.w/2,y=t.y+t.h/2,radius=78;
    for(const enemy of [...game.enemies])if(distance(x,y,enemy.x+enemy.w/2,enemy.y+enemy.h/2)<radius)damageEnemy(enemy,2,null,true);
    if(distance(x,y,game.player.x+17,game.player.y+17)<radius)damagePlayer(1,false);
    if(distance(x,y,game.base.x+20,game.base.y+20)<radius)damageBase(1);
    ring(x,y,"#fbbf24",radius);burst(x,y,"#fb7185",24);game.shake=Math.max(game.shake,10);playSound("destroy");
  }

  function damageEnemy(e,amount,source,chain=false){
    if(!game.enemies.includes(e))return;
    const type=ENEMY_TYPES[e.type];
    if(e.type==="boss3"&&e.shielded){burst(e.x+e.w/2,e.y+e.h/2,"#67e8f9",9);playSound("steel");return}
    const facing=DIRS[e.dir];
    const frontHit=source&&source.friendly&&source.vx*facing.x+source.vy*facing.y<-10;
    if(e.type==="boss1"&&e.stunTimer<=0&&frontHit){burst(e.x+e.w/2,e.y+e.h/2,"#facc15",8);playSound("steel");return}
    if(source?.frost)e.slowTimer=Math.max(e.slowTimer,1.4+source.frost*.8);
    e.hp-=amount;e.hit=.12;burst(e.x+e.w/2,e.y+e.h/2,ENEMY_TYPES[e.type].color,5);
    if(e.hp<=0){
      game.enemies.splice(game.enemies.indexOf(e),1);
      game.combo=game.comboTimer>0?Math.min(9,game.combo+1):1;game.comboTimer=3.8;game.maxCombo=Math.max(game.maxCombo,game.combo);
      game.score+=type.score*game.combo;game.kills++;game.levelKills++;
      burst(e.x+e.w/2,e.y+e.h/2,type.color,type.isBoss?36:18);
      if(game.upgrades.heal&&game.kills%4===0)game.player.hp=Math.min(game.player.maxHp,game.player.hp+1);
      if(game.upgrades.shockwave&&!chain){
        const radius=82+game.upgrades.shockwave*22;
        for(const other of [...game.enemies])if(distance(e.x,e.y,other.x,other.y)<radius)damageEnemy(other,1,null,true);
        ring(e.x+e.w/2,e.y+e.h/2,"#fb7185",radius);
      }
      game.shake=Math.max(game.shake,type.isBoss?12:5);playSound(type.isBoss?"boss":"destroy");updateHud();
    }else playSound("hit");
  }

  function damagePlayer(amount,armorPiercing=false){
    const p=game.player;if(p.invulnerable>0)return;
    if(game.barrierReady){game.barrierReady=false;game.barrierTimer=game.upgrades.barrier>=2?14:18;announce("充能屏障抵挡了炮弹");playSound("steel");return}
    if(armorPiercing&&game.upgrades.reactiveArmor&&!game.reactiveUsed){game.reactiveUsed=true;announce("反应装甲抵挡了破甲攻击");playSound("steel");return}
    if(armorPiercing){
      if(p.armorBreak>0)amount+=1;
      else{p.armorBreak=3.2;announce("警告：装甲破裂 3 秒")}
    }
    p.hp-=amount;p.invulnerable=1.25;game.combo=1;game.comboTimer=0;game.shake=10;game.flash=.16;
    burst(p.x+p.w/2,p.y+p.h/2,"#facc15",16);playSound("hurt");
    if(p.hp===1&&game.upgrades.emergencyRepair&&!game.emergencyUsed){game.emergencyUsed=true;p.hp=Math.min(p.maxHp,p.hp+2);announce("紧急维修启动：恢复2点装甲");playSound("pickup")}
    if(p.hp<=0)finish(false,"装甲耗尽");
  }
  function damageBase(amount){
    if(game.baseShieldCharges>0){game.baseShieldCharges--;announce(`基地护盾抵挡攻击 · 剩余 ${game.baseShieldCharges}`);playSound("steel");return}
    game.base.hp-=amount;game.combo=1;game.comboTimer=0;game.shake=12;game.flash=.2;
    burst(game.base.x+20,game.base.y+20,"#22d3ee",18);playSound("base");
    if(game.base.hp<=0)finish(false,"能量基地被摧毁");
  }

  function updateCrate(dt){
    const c=game.crate;if(!c)return;c.pulse+=dt;
    const magnet=game.upgrades.supplyMagnet*34;
    if(rectsOverlap(c,{x:game.player.x-magnet,y:game.player.y-magnet,w:game.player.w+magnet*2,h:game.player.h+magnet*2})){
      const roll=Math.random();
      const boost=game.upgrades.supplyMagnet>=2?2:1;
      if(roll<.42){game.player.hp=Math.min(game.player.maxHp,game.player.hp+boost);announce(`补给箱：装甲恢复 ${boost}`)}
      else if(roll<.75){game.base.hp=Math.min(game.base.maxHp,game.base.hp+boost);announce(`补给箱：基地修复 ${boost}`)}
      else{game.score+=500*boost;announce(`补给箱：额外 ${500*boost} 分`)}
      burst(c.x+14,c.y+14,"#facc15",16);game.crate=null;playSound("pickup");
    }
  }

  function checkWaveComplete(){
    if(!game.waveActive||game.spawnQueue.length||game.enemies.length)return;
    game.waveActive=false;
    const isFinal=game.levelIndex===LEVELS.length-1&&game.waveIndex===1;
    const currentGame=game;
    if(isFinal){setTimeout(()=>game===currentGame&&game.state==="battle"&&finish(true),700);return}
    if(game.waveIndex===0){
      setTimeout(()=>{if(game===currentGame&&game.state==="battle"&&!game.waveActive){game.waveIndex=1;beginWave()}},650);
    }else{
      setTimeout(()=>{if(game===currentGame&&game.state==="battle"&&!game.waveActive)showUpgradeChoices()},650);
    }
  }

  function showUpgradeChoices(){
    game.state="upgrade";keys.clear();setMobileControlsVisible(false);els.upgrades.hidden=false;
    byId("upgrade-kicker").textContent=`第 ${game.levelIndex+1} 关完成`;
    byId("upgrade-title").textContent="选择一项战术升级";
    byId("upgrade-subtitle").textContent=[2,5].includes(game.levelIndex)?"选择技能后还将获得本章Boss核心。":"升级会保留到本次九关战役结束。";
    const available=UPGRADE_DEFS.filter(u=>game.upgrades[u.id]<u.max),chosen=[];
    const takeFrom=filter=>{const pool=available.filter(u=>!chosen.includes(u)&&filter(u));if(pool.length)chosen.push(pool[Math.floor(Math.random()*pool.length)])};
    takeFrom(u=>u.category==="attack");takeFrom(u=>u.category!=="attack");takeFrom(()=>true);
    els.upgradeOptions.innerHTML="";
    for(const upgrade of chosen){
      const button=document.createElement("button");button.className="upgrade-card";button.type="button";
      const category={attack:"火力",defense:"防御",mobility:"机动"}[upgrade.category];
      button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" style="background:${upgrade.color}"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg><small>${category} · ${game.upgrades[upgrade.id]}/${upgrade.max}</small><strong>${upgrade.name}</strong><p>${upgrade.desc}</p>`;
      button.addEventListener("click",()=>chooseUpgrade(upgrade));els.upgradeOptions.append(button);
    }
    els.upgradeOptions.querySelector("button")?.focus();playSound("upgradeOpen");
  }

  function chooseUpgrade(upgrade){
    upgrade.apply(game);els.upgrades.hidden=true;game.state="battle";renderUpgradeStrip();playSound("pickup");
    let coreMessage="";
    if(game.levelIndex===2&&!game.cores.emerald){game.cores.emerald=true;coreMessage="获得翡翠守护核心：每关恢复玩家和基地1点生命"}
    if(game.levelIndex===5&&!game.cores.sand){game.cores.sand=true;coreMessage="获得沙暴破城核心：每第10次射击可破坏钢墙"}
    if(game.levelIndex<LEVELS.length-1){loadLevel(game.levelIndex+1);if(coreMessage)setTimeout(()=>game&&game.state==="battle"&&announce(coreMessage),350)}
  }

  function finish(won,reason=""){
    if(!game||["victory","defeat"].includes(game.state))return;
    game.state=won?"victory":"defeat";keys.clear();setMobileControlsVisible(false);els.result.hidden=false;
    const time=Math.floor(game.elapsed),baseRatio=Math.max(0,game.base.hp/game.base.maxHp);
    const rank=won?(baseRatio>=.8&&game.maxCombo>=5?"S":baseRatio>=.5?"A":"B"):"C";
    byId("result-kicker").textContent=won?"任务完成":reason;
    byId("result-title").textContent=won?"九片战场全部守住！":"基地需要新的指挥官";
    byId("result-badge").textContent=rank;byId("result-score").textContent=game.score.toLocaleString("zh-CN");
    byId("result-time").textContent=formatTime(time);byId("result-combo").textContent=`×${game.maxCombo}`;
    byId("result-base").textContent=`${Math.max(0,game.base.hp)}/${game.base.maxHp}`;
    save.bestScore=Math.max(save.bestScore,game.score);
    if(won&&(save.bestTime===null||time<save.bestTime))save.bestTime=time;
    if(won)save.run=null;
    persist();
    playSound(won?"victory":"defeat");
  }

  function togglePause(force){
    if(!game||!["battle","paused"].includes(game.state))return;
    const pause=force??game.state==="battle";game.state=pause?"paused":"battle";els.pause.hidden=!pause;keys.clear();
    setMobileControlsVisible(!pause);
    if(pause)byId("resume-button").focus();
  }

  function goMenu(){
    game=null;keys.clear();setMobileControlsVisible(false);els.menu.hidden=false;els.hud.hidden=true;els.upgradeStrip.hidden=true;
    els.pause.hidden=els.result.hidden=els.upgrades.hidden=true;drawMenuBackdrop();updateRecords();updateContinueButton();
  }

  function showGameUI(){
    els.menu.hidden=true;els.result.hidden=true;els.pause.hidden=true;els.upgrades.hidden=true;
    els.hud.hidden=false;els.upgradeStrip.hidden=false;setMobileControlsVisible(true);renderUpgradeStrip();updateHud();
  }

  function renderUpgradeStrip(){
    els.upgradeStrip.innerHTML="";
    for(const def of UPGRADE_DEFS){const level=game.upgrades[def.id];if(!level)continue;const chip=document.createElement("span");chip.className="upgrade-chip";chip.innerHTML=`${def.name} <b>×${level}</b>`;els.upgradeStrip.append(chip)}
    if(game.cores.emerald){const chip=document.createElement("span");chip.className="upgrade-chip";chip.innerHTML=`翡翠核心 <b>◆</b>`;els.upgradeStrip.append(chip)}
    if(game.cores.sand){const chip=document.createElement("span");chip.className="upgrade-chip";chip.innerHTML=`沙暴核心 <b>◆</b>`;els.upgradeStrip.append(chip)}
  }

  function updateHud(){
    if(!game)return;const p=game.player;const level=LEVELS[game.levelIndex];
    els.hp.textContent=`${Math.max(0,p.hp)}/${p.maxHp}`;els.base.textContent=`${Math.max(0,game.base.hp)}/${game.base.maxHp}`;
    els.hp.parentElement.classList.toggle("danger",p.armorBreak>0);els.hp.previousElementSibling.textContent=p.armorBreak>0?`破甲 ${p.armorBreak.toFixed(1)}秒`:game.barrierReady?"装甲 · 屏障就绪":"装甲";
    els.base.previousElementSibling.textContent=game.baseShieldCharges?`基地 · 护盾 ${game.baseShieldCharges}`:"基地";
    els.level.textContent=`${level.chapter} · ${game.levelIndex+1}/9`;els.wave.textContent=`${level.name} · ${game.waveIndex+1}/2`;
    const total=level.waves.reduce((sum,wave)=>sum+wave.length,0);els.enemies.textContent=`${game.enemies.length} / ${Math.max(0,total-game.levelKills)}`;
    els.score.textContent=String(game.score).padStart(6,"0");els.combo.textContent=`×${game.combo}`;
  }

  function render(){
    if(!game){drawMenuBackdrop();return}
    const level=LEVELS[game.levelIndex];ctx.save();
    const canShake=save.shake&&!matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(canShake&&game.shake>0)ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);
    drawArena(level);
    for(const t of game.tiles)if(t.type!=="bush")drawTile(t);
    drawBase(game.base);
    if(game.crate)drawCrate(game.crate);
    drawTank(game.player,true);
    for(const e of game.enemies)drawTank(e,false);
    for(const b of game.bullets)drawBullet(b);
    for(const t of game.tiles)if(t.type==="bush")drawTile(t);
    drawParticles();ctx.restore();
    if(game.flash>0){ctx.fillStyle=`rgba(255,255,255,${game.flash*.65})`;ctx.fillRect(0,0,W,H)}
  }

  function drawArena(level){
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,level.sky);grad.addColorStop(1,level.ground);ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=level.grid;ctx.lineWidth=1;ctx.globalAlpha=.62;
    for(let x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,52);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=52;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.globalAlpha=1;
    for(let i=0;i<24;i++){const x=(i*137+game.levelIndex*83)%W,y=70+(i*83)%520;ctx.fillStyle=level.accent+"18";ctx.fillRect(x,y,4,4)}
  }

  function drawTile(t){
    const style=TERRAIN[t.type];ctx.save();ctx.translate(t.x,t.y);
    if(t.type==="water"){
      ctx.fillStyle=style.dark;ctx.fillRect(0,0,t.w,t.h);ctx.strokeStyle=style.color;ctx.lineWidth=4;
      for(let y=10;y<t.h;y+=16){ctx.beginPath();for(let x=0;x<t.w;x+=16){ctx.moveTo(x,y);ctx.quadraticCurveTo(x+4,y-4,x+8,y);ctx.quadraticCurveTo(x+12,y+4,x+16,y)}ctx.stroke()}
    }else if(t.type==="bush"){
      ctx.globalAlpha=.82;ctx.fillStyle=style.dark;ctx.fillRect(0,5,t.w,t.h-5);
      ctx.fillStyle=style.color;for(let x=7;x<t.w;x+=18)for(let y=8;y<t.h;y+=18){ctx.beginPath();ctx.arc(x+(y%7),y,9,0,Math.PI*2);ctx.fill()}
    }else if(t.type==="ice"){
      ctx.globalAlpha=.68;ctx.fillStyle=style.color;ctx.fillRect(0,0,t.w,t.h);ctx.strokeStyle="#e9fdff";ctx.lineWidth=2;
      for(let x=14;x<t.w;x+=45){ctx.beginPath();ctx.moveTo(x,8);ctx.lineTo(x+22,t.h-8);ctx.stroke()}
    }else if(t.type==="barrel"){
      ctx.shadowColor=style.color;ctx.shadowBlur=8;ctx.fillStyle=style.dark;ctx.fillRect(2,0,t.w-4,t.h);ctx.fillStyle=style.color;ctx.fillRect(0,5,t.w,t.h-10);ctx.fillStyle="#fff3";ctx.fillRect(5,7,5,t.h-14);ctx.fillStyle="#7c2d12";ctx.fillRect(0,4,t.w,4);ctx.fillRect(0,t.h-8,t.w,4);
    }else if(t.type==="crystal"){
      ctx.shadowColor=style.color;ctx.shadowBlur=10;ctx.fillStyle=style.dark;ctx.fillRect(0,0,t.w,t.h);ctx.fillStyle=style.color;ctx.beginPath();ctx.moveTo(t.w/2,3);ctx.lineTo(t.w-4,t.h/2);ctx.lineTo(t.w/2,t.h-3);ctx.lineTo(4,t.h/2);ctx.closePath();ctx.fill();ctx.strokeStyle="#f5d0fe";ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(t.w/2,4);ctx.lineTo(t.w/2,t.h-4);ctx.stroke();
    }else{
      ctx.fillStyle=style.dark;ctx.fillRect(0,0,t.w,t.h);const size=20;
      for(let y=2;y<t.h;y+=size)for(let x=2;x<t.w;x+=size){ctx.fillStyle=style.color;ctx.fillRect(x,y,Math.min(size-4,t.w-x-2),Math.min(size-4,t.h-y-2));ctx.fillStyle="#ffffff2c";ctx.fillRect(x+2,y+2,Math.min(size-8,t.w-x-6),3)}
      if(t.type==="steel"&&t.hp<t.maxHp){ctx.strokeStyle="#f43f5e";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(5,4);ctx.lineTo(t.w*.55,t.h*.48);ctx.lineTo(t.w*.35,t.h-4);ctx.stroke()}
    }
    ctx.restore();
  }

  function drawTank(t,isPlayer){
    if(!isPlayer&&t.spawn>0&&Math.floor(t.spawn*12)%2===0)return;
    if(isPlayer&&t.invulnerable>0&&Math.floor(t.invulnerable*12)%2===0)return;
    const type=isPlayer?null:ENEMY_TYPES[t.type],color=isPlayer?t.color:type.color;
    ctx.save();ctx.translate(t.x+t.w/2,t.y+t.h/2);ctx.rotate(DIRS[t.dir].angle);
    if(t.hit>0)ctx.filter="brightness(2.4)";
    ctx.fillStyle="#11162d";ctx.fillRect(-t.w/2,-t.h/2,t.w*.24,t.h);ctx.fillRect(t.w*.26,-t.h/2,t.w*.24,t.h);
    ctx.fillStyle=color;ctx.fillRect(-t.w*.24,-t.h*.42,t.w*.48,t.h*.78);
    ctx.fillStyle=shade(color,-28);ctx.fillRect(-t.w*.18,t.h*.15,t.w*.36,t.h*.16);
    ctx.fillStyle="#e9f2ff";ctx.fillRect(-3,-t.h*.46,6,-t.h*.38);
    ctx.fillStyle=isPlayer?"#7c3aed":"#0f172a";ctx.beginPath();ctx.arc(0,0,t.w*.19,0,Math.PI*2);ctx.fill();
    if(!isPlayer){
      ctx.strokeStyle="#fff";ctx.lineWidth=2;
      if(type.shape==="diamond"){ctx.rotate(Math.PI/4);ctx.strokeRect(-5,-5,10,10)}
      if(type.shape==="square")ctx.strokeRect(-6,-6,12,12);
      if(type.shape==="stripe"){ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(7,5);ctx.stroke()}
      if(type.shape==="chevron"){ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(0,3);ctx.lineTo(7,-5);ctx.stroke()}
      if(type.shape==="cross"){ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke()}
      if(type.shape==="bossCharge"){ctx.strokeStyle="#facc15";ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(11,9);ctx.lineTo(-11,9);ctx.closePath();ctx.stroke()}
      if(type.shape==="bossBreaker"){ctx.strokeStyle="#facc15";ctx.beginPath();ctx.moveTo(-10,-10);ctx.lineTo(10,10);ctx.moveTo(10,-10);ctx.lineTo(-10,10);ctx.stroke()}
      if(type.shape==="bossAurora"){ctx.strokeStyle="#facc15";ctx.strokeRect(-11,-11,22,22);ctx.strokeRect(-6,-6,12,12)}
    }
    ctx.restore();
    if(isPlayer&&t.armorBreak>0){ctx.strokeStyle="#f43f5e";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(t.x+6,t.y+5);ctx.lineTo(t.x+18,t.y+17);ctx.lineTo(t.x+12,t.y+29);ctx.moveTo(t.x+28,t.y+7);ctx.lineTo(t.x+20,t.y+15);ctx.stroke()}
    if(isPlayer&&game.barrierReady){ctx.strokeStyle="#a78bfa";ctx.lineWidth=3;ctx.shadowColor="#8b5cf6";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(t.x+t.w/2,t.y+t.h/2,t.w*.7,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
    if(!isPlayer&&type.isBoss){
      ctx.fillStyle="#090d21";ctx.fillRect(t.x,t.y-10,t.w,5);ctx.fillStyle="#f43f5e";ctx.fillRect(t.x,t.y-10,t.w*(t.hp/t.maxHp),5);
      if(t.shielded){ctx.strokeStyle="#67e8f9";ctx.lineWidth=4;ctx.shadowColor="#22d3ee";ctx.shadowBlur=12;ctx.beginPath();ctx.arc(t.x+t.w/2,t.y+t.h/2,t.w*.72,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
      if(t.stunTimer>0){ctx.fillStyle="#facc15";ctx.fillRect(t.x+t.w*.25,t.y-18,5,5);ctx.fillRect(t.x+t.w*.65,t.y-20,5,5)}
    }
  }

  function drawBullet(b){
    ctx.save();ctx.shadowColor=b.color;ctx.shadowBlur=b.overload||b.coreShot?20:12;ctx.fillStyle=b.color;const pad=b.overload?2:0;ctx.fillRect(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2);ctx.fillStyle="#fff";ctx.fillRect(b.x+2,b.y+2,4,4);ctx.restore();
  }

  function drawBase(base){
    ctx.save();ctx.translate(base.x,base.y);ctx.fillStyle="#17204a";ctx.fillRect(0,0,40,40);ctx.strokeStyle="#22d3ee";ctx.lineWidth=4;ctx.strokeRect(2,2,36,36);
    ctx.shadowColor="#22d3ee";ctx.shadowBlur=15;ctx.fillStyle=base.hp>0?"#facc15":"#64748b";ctx.beginPath();ctx.moveTo(20,6);ctx.lineTo(32,20);ctx.lineTo(20,34);ctx.lineTo(8,20);ctx.closePath();ctx.fill();
    if(game.baseShieldCharges>0){ctx.strokeStyle="#60a5fa";ctx.lineWidth=3;ctx.beginPath();ctx.arc(20,20,28,0,Math.PI*2);ctx.stroke()}ctx.restore();
  }

  function drawCrate(c){
    const scale=1+Math.sin(c.pulse*5)*.05;ctx.save();ctx.translate(c.x+14,c.y+14);ctx.scale(scale,scale);ctx.shadowColor="#facc15";ctx.shadowBlur=16;ctx.fillStyle="#facc15";ctx.fillRect(-14,-14,28,28);ctx.fillStyle="#9a5c0b";ctx.fillRect(-3,-14,6,28);ctx.fillRect(-14,-3,28,6);ctx.restore();
  }

  function burst(x,y,color,count){
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*150;game.particles.push({kind:"dot",x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.45,max:.75,color,size:2+Math.random()*5})}
  }
  function ring(x,y,color,radius){game.particles.push({kind:"ring",x,y,life:.35,max:.35,color,radius})}
  function updateParticles(dt){
    for(const p of game.particles){p.life-=dt;if(p.kind==="dot"){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.08,dt);p.vy*=Math.pow(.08,dt)}}
    game.particles=game.particles.filter(p=>p.life>0);
  }
  function drawParticles(){
    for(const p of game.particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.strokeStyle=ctx.fillStyle=p.color;
      if(p.kind==="dot")ctx.fillRect(p.x,p.y,p.size,p.size);else{ctx.lineWidth=5;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*(1-p.life/p.max),0,Math.PI*2);ctx.stroke()}ctx.restore()}
  }

  function drawMenuBackdrop(){
    ctx.fillStyle="#0c1129";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#28315a";ctx.lineWidth=1;
    for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  }

  function announce(text){
    els.toast.textContent=text;els.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>els.toast.classList.remove("show"),1800);
  }

  function initAudio(){
    if(!save.sound)return;
    try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume()}catch{/* no audio */}
  }
  function playSound(name){
    if(!save.sound)return;initAudio();if(!audioCtx)return;
    const presets={shoot:[280,.045,"square"],enemyShot:[150,.035,"square"],hit:[95,.05,"sawtooth"],destroy:[70,.16,"sawtooth"],boss:[55,.35,"sawtooth"],pickup:[720,.12,"sine"],brick:[130,.04,"square"],steel:[920,.035,"square"],hurt:[85,.2,"sawtooth"],base:[60,.3,"square"],spawn:[220,.07,"sine"],start:[420,.18,"triangle"],upgradeOpen:[520,.13,"sine"],victory:[660,.35,"triangle"],defeat:[80,.5,"sawtooth"]};
    const [freq,duration,type]=presets[name]||presets.hit;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*(name==="victory"?1.6:.72)),audioCtx.currentTime+duration);gain.gain.setValueAtTime(.045,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
  }

  function toggleSound(){save.sound=!save.sound;persist();updateSettingsUI();if(save.sound){initAudio();playSound("pickup")}}
  function updateSettingsUI(){
    byId("sound-button").classList.toggle("muted",!save.sound);byId("sound-button").setAttribute("aria-label",save.sound?"关闭声音":"开启声音");byId("shake-toggle").checked=save.shake;
  }
  function updateRecords(){byId("best-score").textContent=save.bestScore.toLocaleString("zh-CN");byId("best-time").textContent=save.bestTime===null?"--:--":formatTime(save.bestTime)}
  function updateContinueButton(){
    const button=byId("continue-button"),valid=save.run&&Number.isInteger(save.run.levelIndex)&&save.run.levelIndex>=0&&save.run.levelIndex<LEVELS.length;
    button.hidden=!valid;if(valid)button.textContent=`继续第 ${save.run.levelIndex+1} 关`;
  }
  function requestNewGame(){if(save.run&&!confirm("开始新游戏会覆盖当前九关进度，确定吗？"))return;startGame()}
  function restartCheckpoint(){if(save.run)continueGame();else startGame()}

  function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function touchesTile(rect,type){return game.tiles.some(t=>t.type===type&&rectsOverlap(rect,t))}
  function distance(x1,y1,x2,y2){return Math.hypot(x2-x1,y2-y1)}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
  function shade(hex,amount){const n=parseInt(hex.slice(1),16),r=clamp((n>>16)+amount,0,255),g=clamp(((n>>8)&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return`rgb(${r},${g},${b})`}
  function formatTime(seconds){return`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}

  function resetMobileInput(){
    mobileDirection=null;mobileFire=false;stickPointer=null;firePointer=null;
    const knob=byId("move-knob"),fire=byId("fire-button");
    if(knob)knob.style.transform="translate(-50%,-50%)";
    fire?.classList.remove("active");
  }

  function setMobileControlsVisible(visible){
    const controls=byId("mobile-controls");
    controls.hidden=!(touchCapable&&visible&&game?.state==="battle");
    if(controls.hidden)resetMobileInput();
  }

  function updateMobileStick(event){
    if(event.pointerId!==stickPointer||game?.state!=="battle")return;
    const stick=byId("move-stick"),knob=byId("move-knob"),rect=stick.getBoundingClientRect();
    const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);
    const distanceFromCenter=Math.hypot(dx,dy),limit=rect.width*.28,scale=distanceFromCenter>limit?limit/distanceFromCenter:1;
    knob.style.transform=`translate(calc(-50% + ${dx*scale}px),calc(-50% + ${dy*scale}px))`;
    if(distanceFromCenter<rect.width*.1){mobileDirection=null;return}
    mobileDirection=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
  }

  const moveStick=byId("move-stick"),fireButton=byId("fire-button");
  moveStick.addEventListener("pointerdown",event=>{
    if(game?.state!=="battle"||stickPointer!==null)return;
    event.preventDefault();initAudio();stickPointer=event.pointerId;
    try{moveStick.setPointerCapture(event.pointerId)}catch{/* pointer capture unavailable */}
    updateMobileStick(event);
  });
  moveStick.addEventListener("pointermove",event=>{event.preventDefault();updateMobileStick(event)});
  const releaseStick=event=>{if(event.pointerId!==stickPointer)return;stickPointer=null;mobileDirection=null;byId("move-knob").style.transform="translate(-50%,-50%)"};
  moveStick.addEventListener("pointerup",releaseStick);moveStick.addEventListener("pointercancel",releaseStick);moveStick.addEventListener("lostpointercapture",releaseStick);

  fireButton.addEventListener("pointerdown",event=>{
    if(game?.state!=="battle"||firePointer!==null)return;
    event.preventDefault();initAudio();firePointer=event.pointerId;mobileFire=true;fireButton.classList.add("active");
    try{fireButton.setPointerCapture(event.pointerId)}catch{/* pointer capture unavailable */}
    firePlayer();
  });
  const releaseFire=event=>{if(event.pointerId!==firePointer)return;firePointer=null;mobileFire=false;fireButton.classList.remove("active")};
  fireButton.addEventListener("pointerup",releaseFire);fireButton.addEventListener("pointercancel",releaseFire);fireButton.addEventListener("lostpointercapture",releaseFire);
  byId("mobile-pause").addEventListener("click",event=>{event.preventDefault();togglePause()});
  byId("mobile-controls").addEventListener("contextmenu",event=>event.preventDefault());

  document.addEventListener("keydown",(event)=>{
    const key=event.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key))event.preventDefault();
    if((key==="p"||key==="escape")&&game&&["battle","paused"].includes(game.state)){togglePause();return}
    if(key==="r"&&game&&["battle","paused"].includes(game.state)){restartCheckpoint();return}
    keys.add(key);
  });
  document.addEventListener("keyup",event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur",()=>{keys.clear();resetMobileInput();if(game?.state==="battle")togglePause(true)});
  window.addEventListener("orientationchange",resetMobileInput);
  document.addEventListener("visibilitychange",()=>{if(document.hidden){resetMobileInput();if(game?.state==="battle")togglePause(true)}});

  byId("start-button").addEventListener("click",requestNewGame);
  byId("continue-button").addEventListener("click",continueGame);
  byId("again-button").addEventListener("click",()=>game?.state==="defeat"?restartCheckpoint():startGame());
  byId("resume-button").addEventListener("click",()=>togglePause(false));
  byId("restart-button").addEventListener("click",restartCheckpoint);
  byId("menu-button").addEventListener("click",goMenu);
  byId("result-menu-button").addEventListener("click",goMenu);
  byId("sound-button").addEventListener("click",toggleSound);
  byId("help-button").addEventListener("click",()=>els.help.showModal());
  byId("shake-toggle").addEventListener("change",event=>{save.shake=event.target.checked;persist()});
  $(".brand").addEventListener("click",event=>{event.preventDefault();if(!game||confirm("返回首页会结束当前战斗，确定吗？"))goMenu()});

  function frame(time){const dt=Math.min(.033,(time-lastTime)/1000);lastTime=time;update(dt);render();requestAnimationFrame(frame)}
  updateRecords();updateContinueButton();updateSettingsUI();drawMenuBackdrop();requestAnimationFrame(frame);
})();
