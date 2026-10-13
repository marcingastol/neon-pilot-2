// Deterministic game rules. Time is measured in seconds of active play.
export const WORLD = Object.freeze({width: 1000, height: 640, duration: 60});
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class Shield {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.until = -1;
    this.readyAt = 0;
    this.held = false;
    this.activations = 0;
  }
  input(pressed, now) {
    const rising = pressed && !this.held;
    this.held = pressed;
    if (!this.enabled || !rising || now < this.readyAt) return false;
    this.until = now + 3;
    this.readyAt = now + 10;
    this.activations++;
    return true;
  }
  active(now) { return this.enabled && now < this.until; }
  cooldown(now) { return this.enabled ? Math.max(0, this.readyAt - now) : 0; }
}

export class GestureLatch {
  constructor() { this.open = false; this.candidate = false; this.since = 0; }
  update(label, confidence, now) {
    const wanted = label === 'Open_Palm' && confidence >= .6;
    if (wanted !== this.candidate) { this.candidate = wanted; this.since = now; }
    if (now - this.since >= (wanted ? 160 : 220)) this.open = wanted;
    return this.open;
  }
  reset() { this.open = false; this.candidate = false; this.since = 0; }
}

export function seededRandom(seed = 12345) {
  let n = seed >>> 0;
  return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; };
}

export class Game {
  constructor({shield = true, random = Math.random} = {}) {
    this.random = random;
    this.shield = new Shield(shield);
    this.time = 0;
    this.player = {x: 500, y: 545, r: 17};
    this.lives = 3;
    this.coins = 0;
    this.blocks = 0;
    this.invulnerableUntil = 0;
    this.obstacles = [];
    this.pickups = [];
    this.nextRock = 1.6;
    this.nextCoin = .7;
    this.ended = false;
    this.won = false;
    this.events = [];
  }
  get score() { return Math.floor(this.time) * 10 + this.coins * 100 + this.blocks * 25; }
  update(delta, {axis = 0, target = null, shield = false} = {}) {
    this.events = [];
    if (this.ended) return this.events;
    const dt = clamp(delta, 0, .05);
    this.time = Math.min(WORLD.duration, this.time + dt);
    if (Number.isFinite(target)) {
      const desired = clamp(target, .04, .96) * WORLD.width;
      this.player.x += (desired - this.player.x) * (1 - Math.exp(-13 * dt));
    } else this.player.x += clamp(axis, -1, 1) * 680 * dt;
    this.player.x = clamp(this.player.x, 35, WORLD.width - 35);
    if (this.shield.input(shield, this.time)) this.events.push({type:'shield', x:this.player.x, y:this.player.y});
    const level = this.time / WORLD.duration;
    if (this.time >= this.nextRock) {
      this.obstacles.push({x: 50 + this.random() * 900, y: -55, r: 21 + this.random() * 19,
        speed: 190 + level * 110 + this.random() * 45, angle: this.random() * Math.PI * 2,
        spin: this.random() * 1.5 - .75, seed: this.random()});
      this.nextRock = this.time + .84 - .3 * level;
    }
    if (this.time >= this.nextCoin) {
      this.pickups.push({x: 55 + this.random() * 890, y: -35, r: 15, speed: 175 + level * 55});
      this.nextCoin = this.time + 1.2;
    }
    const near = (item, extra = 0) => Math.hypot(item.x - this.player.x, item.y - this.player.y) < item.r + this.player.r + extra;
    for (const rock of this.obstacles) {
      rock.y += rock.speed * dt;
      rock.angle += rock.spin * dt;
      if (near(rock, this.shield.active(this.time) ? 24 : -3)) {
        if (this.shield.active(this.time)) {
          rock.dead = true; this.blocks++;
          this.events.push({type:'block',x:rock.x,y:rock.y});
        } else if (this.time >= this.invulnerableUntil) {
          rock.dead = true; this.lives--; this.invulnerableUntil = this.time + 1.5;
          this.events.push({type:'hit',x:rock.x,y:rock.y});
        }
      }
    }
    for (const coin of this.pickups) {
      coin.y += coin.speed * dt;
      if (near(coin, 9)) { coin.dead = true; this.coins++; this.events.push({type:'coin',x:coin.x,y:coin.y}); }
    }
    this.obstacles = this.obstacles.filter(x => !x.dead && x.y < 700);
    this.pickups = this.pickups.filter(x => !x.dead && x.y < 700);
    if (this.lives <= 0 || this.time >= WORLD.duration) {
      this.ended = true;
      this.won = this.lives > 0;
      this.events.push({type:'end'});
    }
    return this.events;
  }
}
