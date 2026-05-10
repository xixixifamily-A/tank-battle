(() => {
  "use strict";

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const UI = {
    level: document.getElementById("ui-level"),
    lives: document.getElementById("ui-lives"),
    enemies: document.getElementById("ui-enemies"),
    score: document.getElementById("ui-score"),
    tip: document.getElementById("ui-tip"),
  };

  const W = canvas.width;
  const H = canvas.height;

  const TILE = 32;
  const GRID_W = Math.floor(W / TILE); // 30
  const GRID_H = Math.floor(H / TILE); // 20

  const TileType = {
    Empty: 0,
    Steel: 1,
    Brick: 2,
  };

  const Dir = /** @type {const} */ ({
    Up: "up",
    Down: "down",
    Left: "left",
    Right: "right",
  });

  const DIRS = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function dirToVec(dir) {
    switch (dir) {
      case Dir.Up:
        return { x: 0, y: -1 };
      case Dir.Down:
        return { x: 0, y: 1 };
      case Dir.Left:
        return { x: -1, y: 0 };
      case Dir.Right:
        return { x: 1, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }

  function dirToAngle(dir) {
    switch (dir) {
      case Dir.Up:
        return -Math.PI / 2;
      case Dir.Down:
        return Math.PI / 2;
      case Dir.Left:
        return Math.PI;
      case Dir.Right:
        return 0;
      default:
        return 0;
    }
  }

  // 关卡地图：'.' 空地，'#' 钢墙（不可摧毁），'B' 砖墙（可摧毁）
  const LEVELS = [
    {
      name: "新手关",
      playerSpawn: { x: 2, y: GRID_H - 3 },
      aiSpawns: [
        { x: GRID_W - 3, y: 2 },
        { x: GRID_W - 8, y: 2 },
      ],
      map: [
        "##############################",
        "#............BB..............#",
        "#............BB..............#",
        "#............................#",
        "#..BBBB..............BBBB....#",
        "#..BBBB..............BBBB....#",
        "#............##..............#",
        "#............##..............#",
        "#............................#",
        "#........BBBB......BBBB......#",
        "#........BBBB......BBBB......#",
        "#............................#",
        "#............##..............#",
        "#............##..............#",
        "#..BBBB..............BBBB....#",
        "#..BBBB..............BBBB....#",
        "#............................#",
        "#............BB..............#",
        "#............BB..............#",
        "##############################",
      ],
    },
    {
      name: "迷宫关",
      playerSpawn: { x: 2, y: GRID_H - 3 },
      aiSpawns: [
        { x: GRID_W - 3, y: 2 },
        { x: GRID_W - 3, y: GRID_H - 3 },
        { x: Math.floor(GRID_W / 2), y: 2 },
      ],
      map: [
        "##############################",
        "#..BBBB....##....BBBB....##..#",
        "#..B..B....##....B..B....##..#",
        "#..B..B..........B..B........#",
        "#..BBBB....####..BBBB....#####",
        "#..........#..#..............#",
        "#..####....#..#....####....###",
        "#..#..#....#..#....#..#......#",
        "#..#..#..........#..#........#",
        "#..####....####....####....###",
        "#............................#",
        "###....####....####....####..#",
        "#......#..#....#..#....#..#..#",
        "#..##..#..#....#..#....#..#..#",
        "#..##..####....####....####..#",
        "#............................#",
        "#..BBBB....##....BBBB....##..#",
        "#..B..B....##....B..B....##..#",
        "#..BBBB....##....BBBB....##..#",
        "##############################",
      ],
    },
    {
      name: "火力关",
      playerSpawn: { x: 2, y: GRID_H - 3 },
      aiSpawns: [
        { x: GRID_W - 3, y: 2 },
        { x: GRID_W - 8, y: 2 },
        { x: GRID_W - 13, y: 2 },
        { x: GRID_W - 3, y: GRID_H - 3 },
      ],
      map: [
        "##############################",
        "#..BBBB..BBBB..BBBB..BBBB....#",
        "#..B..B..B..B..B..B..B..B....#",
        "#..BBBB..BBBB..BBBB..BBBB....#",
        "#............................#",
        "#..##..##..##..##..##..##..###",
        "#..##..##..##..##..##..##....#",
        "#............................#",
        "#..BBBB..........BBBB........#",
        "#..BBBB..######..BBBB..#######",
        "#........#....#........#....##",
        "######...#....#...######....##",
        "#........#....#.............##",
        "#..######..######..######...##",
        "#............................#",
        "#....BBBB..BBBB..BBBB..BBBB..#",
        "#....B..B..B..B..B..B..B..B..#",
        "#....BBBB..BBBB..BBBB..BBBB..#",
        "#............................#",
        "##############################",
      ],
    },
  ];

  function parseMap(lines) {
    /** @type {number[][]} */
    const grid = [];
    for (let y = 0; y < GRID_H; y++) {
      const row = (lines[y] || "").padEnd(GRID_W, ".").slice(0, GRID_W);
      const out = [];
      for (let x = 0; x < GRID_W; x++) {
        const c = row[x];
        if (c === "#") out.push(TileType.Steel);
        else if (c === "B") out.push(TileType.Brick);
        else out.push(TileType.Empty);
      }
      grid.push(out);
    }
    return grid;
  }

  function tileIsSolid(t) {
    return t === TileType.Steel || t === TileType.Brick;
  }

  function rectIntersectsRect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function circleIntersectsRect(cx, cy, r, rect) {
    const closestX = clamp(cx, rect.x, rect.x + rect.w);
    const closestY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  class Bullet {
    constructor(x, y, dir, owner) {
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.owner = owner;
      this.r = 4;
      this.speed = 420;
      this.alive = true;
    }
    update(dt, game) {
      const v = dirToVec(this.dir);
      this.x += v.x * this.speed * dt;
      this.y += v.y * this.speed * dt;

      if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
        this.alive = false;
        return;
      }

      // tile collision
      const tx = Math.floor(this.x / TILE);
      const ty = Math.floor(this.y / TILE);
      if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) {
        const t = game.map[ty][tx];
        if (t === TileType.Steel) {
          this.alive = false;
          return;
        }
        if (t === TileType.Brick) {
          game.map[ty][tx] = TileType.Empty;
          this.alive = false;
          return;
        }
      }

      // tank collision
      for (const tank of game.getAllTanks()) {
        if (!tank.alive) continue;
        if (tank === this.owner) continue;
        if (tank.faction === this.owner.faction) continue;
        if (
          circleIntersectsRect(this.x, this.y, this.r, {
            x: tank.x,
            y: tank.y,
            w: tank.w,
            h: tank.h,
          })
        ) {
          this.alive = false;
          tank.takeHit(game, this.owner);
          return;
        }
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = "#f6f1d1";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Tank {
    constructor(x, y, faction) {
      this.x = x;
      this.y = y;
      this.w = 28;
      this.h = 28;
      this.dir = Dir.Up;
      this.faction = faction; // "player" | "enemy"
      this.alive = true;
      this.speed = faction === "player" ? 150 : 120;
      this.fireCooldown = 0;
      this.fireInterval = faction === "player" ? 0.35 : 0.85;

      // AI state
      this.aiTurnTimer = randInt(300, 900) / 1000;
      this.aiShootTimer = randInt(300, 900) / 1000;
    }

    center() {
      return { cx: this.x + this.w / 2, cy: this.y + this.h / 2 };
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    canFire() {
      return this.fireCooldown <= 0;
    }

    shoot(game) {
      if (!this.canFire()) return;
      this.fireCooldown = this.fireInterval;
      const { cx, cy } = this.center();
      const v = dirToVec(this.dir);
      // 子弹从炮口出来一点
      const bx = cx + v.x * (this.w / 2 + 6);
      const by = cy + v.y * (this.h / 2 + 6);
      game.bullets.push(new Bullet(bx, by, this.dir, this));
    }

    takeHit(game) {
      this.alive = false;
      game.spawnExplosion(this.center().cx, this.center().cy);
      if (this.faction === "enemy") {
        game.score += 100;
      } else {
        game.lives -= 1;
        if (game.lives > 0) {
          game.respawnPlayer();
        } else {
          game.state = "gameover";
          game.tip("游戏结束：按 R 重新开始");
        }
      }
    }

    update(dt, game) {
      this.fireCooldown -= dt;
      if (this.faction === "player") {
        this.updatePlayer(dt, game);
      } else {
        this.updateAI(dt, game);
      }
    }

    updatePlayer(dt, game) {
      const keys = game.keys;
      let vx = 0;
      let vy = 0;
      if (keys.ArrowUp) {
        vy -= 1;
        this.dir = Dir.Up;
      } else if (keys.ArrowDown) {
        vy += 1;
        this.dir = Dir.Down;
      } else if (keys.ArrowLeft) {
        vx -= 1;
        this.dir = Dir.Left;
      } else if (keys.ArrowRight) {
        vx += 1;
        this.dir = Dir.Right;
      }

      if (vx !== 0 || vy !== 0) {
        const dx = vx * this.speed * dt;
        const dy = vy * this.speed * dt;
        game.moveTankWithCollisions(this, dx, dy);
      }

      if (keys.Space) {
        this.shoot(game);
      }
    }

    updateAI(dt, game) {
      this.aiTurnTimer -= dt;
      this.aiShootTimer -= dt;

      const seen = game.getLineOfSightToPlayer(this);
      if (seen) {
        // 有视线：面向玩家、尽量射击
        this.dir = seen.dir;
        if (this.aiShootTimer <= 0) {
          this.aiShootTimer = randInt(450, 1100) / 1000;
          this.shoot(game);
        }
        // 少量推进，保持压迫感
        const v = dirToVec(this.dir);
        game.moveTankWithCollisions(
          this,
          v.x * this.speed * dt * 0.6,
          v.y * this.speed * dt * 0.6
        );
        return;
      }

      // 无视线：随机巡航 + 避障
      if (this.aiTurnTimer <= 0) {
        this.aiTurnTimer = randInt(450, 1200) / 1000;
        this.dir = choice(DIRS);
      }

      // 偶尔盲射
      if (this.aiShootTimer <= 0) {
        this.aiShootTimer = randInt(900, 1600) / 1000;
        if (Math.random() < 0.55) this.shoot(game);
      }

      const v = dirToVec(this.dir);
      const oldX = this.x;
      const oldY = this.y;
      game.moveTankWithCollisions(this, v.x * this.speed * dt, v.y * this.speed * dt);
      const stuck = Math.abs(this.x - oldX) < 0.01 && Math.abs(this.y - oldY) < 0.01;
      if (stuck) {
        // 卡住就立刻换方向
        this.aiTurnTimer = randInt(150, 450) / 1000;
        this.dir = choice(DIRS);
      }
    }

    draw(ctx) {
      const { cx, cy } = this.center();
      const angle = dirToAngle(this.dir);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const bodyColor = this.faction === "player" ? "#4aa3ff" : "#ff5b5b";
      const stroke =
        this.faction === "player" ? "rgba(180,220,255,0.9)" : "rgba(255,200,200,0.9)";

      // body
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 6);
      ctx.fill();
      ctx.stroke();

      // turret
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.w / 2 + 10, 0);
      ctx.stroke();

      // center detail
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  class Game {
    constructor() {
      this.levelIndex = 0;
      this.map = parseMap(LEVELS[0].map);
      this.player = null;
      this.enemies = [];
      this.bullets = [];
      this.fx = []; // simple explosions
      this.score = 0;
      this.lives = 3;
      this.state = "playing"; // playing | paused | levelcomplete | win | gameover
      this.keys = {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        Space: false,
      };
      this._levelJustLoaded = false;
    }

    tip(text) {
      UI.tip.textContent = text;
    }

    loadLevel(idx) {
      this.levelIndex = idx;
      const level = LEVELS[this.levelIndex];
      this.map = parseMap(level.map);
      this.bullets = [];
      this.fx = [];

      const px = level.playerSpawn.x * TILE + (TILE - 28) / 2;
      const py = level.playerSpawn.y * TILE + (TILE - 28) / 2;
      this.player = new Tank(px, py, "player");
      this.player.dir = Dir.Up;

      this.enemies = [];
      // 每一关增加敌方数量：在原 aiSpawns 基础上，额外 + (关卡序号 + 1) 个
      // 例如：第 1 关（index=0）+1，第 2 关 +2，第 3 关 +3 ...
      const baseSpawns = level.aiSpawns?.length ? level.aiSpawns : [{ x: GRID_W - 3, y: 2 }];
      // 每一关再多增加一人：在上一版基础上整体 +1
      const enemyCount = baseSpawns.length + (this.levelIndex + 2);

      const tryFindSpawnNear = (baseTileX, baseTileY) => {
        const tankW = 28;
        const tankH = 28;
        const toPixel = (tx, ty) => ({
          x: tx * TILE + (TILE - tankW) / 2,
          y: ty * TILE + (TILE - tankH) / 2,
        });

        // 从目标出生点开始，向外圈扩散，找最近可用的空地（避免刷在墙里/重叠）
        for (let r = 0; r <= 6; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // 只扫外圈
              const tx = baseTileX + dx;
              const ty = baseTileY + dy;
              if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) continue;
              if (tileIsSolid(this.map[ty][tx])) continue;

              const p = toPixel(tx, ty);
              const rect = { x: p.x, y: p.y, w: tankW, h: tankH };
              if (this.rectHitsSolidTile(rect)) continue;
              if (this.rectHitsAnyTank(rect, null)) continue;
              return p;
            }
          }
        }
        return null;
      };

      for (let i = 0; i < enemyCount; i++) {
        const sp = baseSpawns[i % baseSpawns.length];
        const pos = tryFindSpawnNear(sp.x, sp.y);
        if (!pos) continue;

        const t = new Tank(pos.x, pos.y, "enemy");
        t.dir = choice(DIRS);
        // 随关卡提升一点进攻性
        t.fireInterval = clamp(0.95 - this.levelIndex * 0.12, 0.55, 1.0);
        t.speed = 120 + this.levelIndex * 10;
        this.enemies.push(t);
      }

      this.state = "playing";
      this._levelJustLoaded = true;
      this.tip(
        `关卡 ${this.levelIndex + 1}：${level.name}（敌人 x${this.enemies.filter((e) => e.alive).length}，清空过关）`
      );
      this.updateUI();
    }

    respawnPlayer() {
      const level = LEVELS[this.levelIndex];
      const px = level.playerSpawn.x * TILE + (TILE - 28) / 2;
      const py = level.playerSpawn.y * TILE + (TILE - 28) / 2;
      this.player = new Tank(px, py, "player");
      this.player.dir = Dir.Up;
      this.bullets = this.bullets.filter((b) => b.owner && b.owner.faction !== "enemy"); // 清理部分子弹
      this.tip(`你被击中！剩余生命：${this.lives}（继续战斗）`);
      this.updateUI();
    }

    getAllTanks() {
      const arr = [];
      if (this.player && this.player.alive) arr.push(this.player);
      for (const e of this.enemies) if (e.alive) arr.push(e);
      return arr;
    }

    spawnExplosion(x, y) {
      this.fx.push({ x, y, t: 0, life: 0.35 });
    }

    updateUI() {
      UI.level.textContent = String(this.levelIndex + 1);
      UI.lives.textContent = String(this.lives);
      UI.enemies.textContent = String(this.enemies.filter((e) => e.alive).length);
      UI.score.textContent = String(this.score);
    }

    resetGame() {
      this.score = 0;
      this.lives = 3;
      this.loadLevel(0);
      this.tip("新游戏开始：方向键移动，空格射击");
    }

    // 碰撞：坦克 vs tile + 坦克 vs 坦克（简化）
    rectHitsSolidTile(rect) {
      const minTx = Math.floor(rect.x / TILE);
      const minTy = Math.floor(rect.y / TILE);
      const maxTx = Math.floor((rect.x + rect.w) / TILE);
      const maxTy = Math.floor((rect.y + rect.h) / TILE);
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return true;
          if (tileIsSolid(this.map[ty][tx])) return true;
        }
      }
      return false;
    }

    rectHitsAnyTank(rect, exceptTank) {
      for (const t of this.getAllTanks()) {
        if (t === exceptTank) continue;
        if (rectIntersectsRect(rect, t.rect())) return true;
      }
      return false;
    }

    moveTankWithCollisions(tank, dx, dy) {
      if (!dx && !dy) return;
      // X axis
      if (dx !== 0) {
        const nx = tank.x + dx;
        const rect = { x: nx, y: tank.y, w: tank.w, h: tank.h };
        if (!this.rectHitsSolidTile(rect) && !this.rectHitsAnyTank(rect, tank)) {
          tank.x = nx;
        }
      }
      // Y axis
      if (dy !== 0) {
        const ny = tank.y + dy;
        const rect = { x: tank.x, y: ny, w: tank.w, h: tank.h };
        if (!this.rectHitsSolidTile(rect) && !this.rectHitsAnyTank(rect, tank)) {
          tank.y = ny;
        }
      }
      tank.x = clamp(tank.x, 2, W - tank.w - 2);
      tank.y = clamp(tank.y, 2, H - tank.h - 2);
    }

    // 判断敌方坦克是否与玩家坦克同行/同列且无墙阻挡（直线视野）
    getLineOfSightToPlayer(enemy) {
      if (!this.player || !this.player.alive) return null;
      const pc = this.player.center();
      const ec = enemy.center();

      const eTx = Math.floor(ec.cx / TILE);
      const eTy = Math.floor(ec.cy / TILE);
      const pTx = Math.floor(pc.cx / TILE);
      const pTy = Math.floor(pc.cy / TILE);

      // 同列
      if (eTx === pTx) {
        const step = eTy < pTy ? 1 : -1;
        for (let ty = eTy + step; ty !== pTy; ty += step) {
          if (tileIsSolid(this.map[ty][eTx])) return null;
        }
        return { dir: eTy < pTy ? Dir.Down : Dir.Up };
      }
      // 同行
      if (eTy === pTy) {
        const step = eTx < pTx ? 1 : -1;
        for (let tx = eTx + step; tx !== pTx; tx += step) {
          if (tileIsSolid(this.map[eTy][tx])) return null;
        }
        return { dir: eTx < pTx ? Dir.Right : Dir.Left };
      }
      return null;
    }

    update(dt) {
      if (this.state !== "playing") return;

      if (this._levelJustLoaded) {
        // 避免加载瞬间按住空格直接开火
        this.keys.Space = false;
        this._levelJustLoaded = false;
      }

      if (this.player && this.player.alive) this.player.update(dt, this);
      for (const e of this.enemies) if (e.alive) e.update(dt, this);

      for (const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter((b) => b.alive);

      // fx
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < f.life);

      const aliveEnemies = this.enemies.filter((e) => e.alive).length;
      if (aliveEnemies === 0) {
        if (this.levelIndex < LEVELS.length - 1) {
          this.state = "levelcomplete";
          this.tip("过关！按 Enter 进入下一关");
        } else {
          this.state = "win";
          this.tip("恭喜通关！按 R 重新开始");
        }
      }

      this.updateUI();
    }

    draw() {
      // background
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a0f16";
      ctx.fillRect(0, 0, W, H);

      // subtle grid
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#2a3b52";
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += TILE) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += TILE) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      this.drawTiles();

      // entities
      for (const b of this.bullets) b.draw(ctx);
      for (const e of this.enemies) if (e.alive) e.draw(ctx);
      if (this.player && this.player.alive) this.player.draw(ctx);

      this.drawFX();

      // overlay
      this.drawOverlay();
    }

    drawTiles() {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const t = this.map[y][x];
          if (t === TileType.Empty) continue;
          const px = x * TILE;
          const py = y * TILE;
          if (t === TileType.Steel) {
            ctx.fillStyle = "#3b5168";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          } else if (t === TileType.Brick) {
            ctx.fillStyle = "#8c4d3a";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
            // brick texture
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = "#2b1410";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + 4, py + TILE / 2);
            ctx.lineTo(px + TILE - 4, py + TILE / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px + TILE / 2, py + 4);
            ctx.lineTo(px + TILE / 2, py + TILE - 4);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    drawFX() {
      for (const f of this.fx) {
        const p = clamp(f.t / f.life, 0, 1);
        const r = 6 + p * 18;
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.8;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, "rgba(255,220,120,1)");
        g.addColorStop(0.5, "rgba(255,120,80,0.9)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawOverlay() {
      let text = "";
      if (this.state === "paused") text = "暂停中（按 P 继续）";
      else if (this.state === "gameover") text = "游戏结束（按 R 重开）";
      else if (this.state === "levelcomplete") text = "过关！（按 Enter 下一关）";
      else if (this.state === "win") text = "通关！（按 R 重开）";
      if (!text) return;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font =
        "700 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, W / 2, H / 2 - 12);

      ctx.font = "14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const sub = "砖墙可摧毁，钢墙不可摧毁；清空敌人进入下一关。";
      ctx.fillText(sub, W / 2, H / 2 + 26);
      ctx.restore();
    }
  }

  const game = new Game();
  game.resetGame();

  // input
  const preventKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);
  window.addEventListener("keydown", (e) => {
    if (preventKeys.has(e.key)) e.preventDefault();
    if (e.key === " " || e.code === "Space") game.keys.Space = true;
    else if (e.key in game.keys) game.keys[e.key] = true;

    if (e.key === "p" || e.key === "P") {
      if (game.state === "playing") {
        game.state = "paused";
        game.tip("已暂停（按 P 继续）");
      } else if (game.state === "paused") {
        game.state = "playing";
        game.tip("继续战斗！");
      }
    }
    if (e.key === "r" || e.key === "R") {
      game.resetGame();
    }
    if (e.key === "Enter") {
      if (game.state === "levelcomplete") {
        game.loadLevel(game.levelIndex + 1);
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " " || e.code === "Space") game.keys.Space = false;
    else if (e.key in game.keys) game.keys[e.key] = false;
  });
  window.addEventListener("blur", () => {
    if (game.state === "playing") {
      game.state = "paused";
      game.tip("窗口失焦已自动暂停（按 P 继续）");
    }
  });

  // main loop
  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 1 / 20);
    last = now;
    if (game.state === "playing") game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

