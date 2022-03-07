import { Direction, Line, Point, Raster, Rectangle, RNG, Vector } from "silmarils";
import { Attack, Damage, DamageType, Effect, Entity, Speeds, Stat, StatusGlyphs, Substance, UpdateResult } from "./game";
import { assert } from "./helpers";
import { Glyph } from "./terminal";
import { Colors } from "./ui";
import * as Statuses from "./statuses";
import * as Substances from "./substances";
import * as Effects from "./effects";

export abstract class Snail extends Entity {
  speed = Speeds.Every2Turns;
  hp = { current: 1, max: 1 };

  abstract substanceType: { new(): Substance } | undefined;

  private direction: Direction.Direction = Direction.NORTH;

  takeTurn(): UpdateResult {
    let [dx, dy] = Direction.toVector(this.direction);

    let entities = this.level.getEntitiesAt(
      this.pos.x + dx,
      this.pos.y + dy
    );

    // Push existing entities out the way
    for (let entity of entities) {
      if (!entity.heavy) {
        entity.moveBy(dx, dy);
      }
    }

    if (!this.moveBy(dx, dy)) {
      this.direction = Direction.rotateRight90(this.direction);
    }

    return true;
  }

  moveTo(x: number, y: number): boolean {
    if (this.substanceType) {
      // Leave some substance behind
      let tile = this.getTile();
      tile?.setSubstance(new this.substanceType);
    }

    return super.moveTo(x, y);
  }
}

export class Mantleshell extends Snail {
  name = "Mantleshell";
  description = "";
  substanceType = Substances.Magma;
  glyph = Glyph("\x15", Colors.Orange3);
}

export class Slimeshell extends Snail {
  name = "Slimeshell";
  description = "";
  substanceType = Substances.Slime;
  glyph = Glyph("\x15", Colors.Green);
}

export class Stoneshell extends Snail {
  name = "Stoneshell";
  description = "";
  substanceType = undefined;
  glyph = Glyph("\x15", Colors.Grey3);
}

export class Boar extends Entity {
  name = "Boar";
  description = "";
  glyph = Glyph("\x18", Colors.Grey3);
  speed = Speeds.EveryTurn;
  hp = { current: 3, max: 3 };

  private status: "idle" | "hunting" | "stunned" | "charging" = "idle";
  private target?: Entity;
  private chargeDirection: Vector.Vector = [0, 0];

  moveInRandomDirection() {
    let dir = RNG.item(...Direction.CARDINAL_DIRECTIONS);
    let [dx, dy] = Direction.toVector(dir);
    return this.moveBy(dx, dy);
  }

  *charge(): Effect {
    let [sx, sy] = this.chargeDirection;

    while (true) {
      let x = this.pos.x + sx;
      let y = this.pos.y + sy;
      let entities = this.level.getEntitiesAt(x, y);

      if (entities.length) {
        for (let entity of entities) {
          this.attack(entity, {
            type: DamageType.Melee,
            amount: 1,
            direction: [sx, sy],
          });
        }

        yield 1;
        break;
      }

      let moved = this.moveBy(sx, sy);

      yield 1;

      if (moved === false) {
        break;
      }
    }

    this.status = "stunned";
    this.addStatus(new Statuses.Stunned(3));
  }

  takeTurn() {
    switch (this.status) {
      case "idle": {
        if (this.canSee(game.player) && !game.player.dead) {
          this.target = game.player;
          this.status = "hunting";
          return true;
        } else {
          this.moveInRandomDirection();
          return true;
        }
      }

      case "hunting": {
        assert(this.target, "target required");

        if (!this.canSee(this.target)) {
          this.status = "idle";
          return true;
        }

        let dx = this.target.pos.x - this.pos.x;
        let dy = this.target.pos.y - this.pos.y;
        let sx = Math.sign(dx);
        let sy = Math.sign(dy);
        let distance = Point.manhattan(this.pos, this.target.pos);
        let canCharge = (dx === 0 || dy === 0) && (distance <= 5);

        if (canCharge) {
          this.chargeDirection = [sx, sy];
          this.status = "charging";
          this.statusGlyph =
            sx < 0 ? StatusGlyphs.West :
            sx > 0 ? StatusGlyphs.East :
            sy > 0 ? StatusGlyphs.South :
            StatusGlyphs.North;
          return true;
        } else if (Math.abs(dx) < Math.abs(dy * 2)) {
          return this.moveBy(sx, 0);
        } else {
          return this.moveBy(0, sy);
        }
      }

      case "charging": {
        this.level.addEffect(this.charge());
        return true;
      }

      case "stunned": {
        if (!this.hasStatus(Statuses.Stunned)) {
          this.status = "idle";
        }
        return true;
      }
    }
  }
}

export class Ant extends Entity {
  name = "Ant";
  description = "";
  glyph = Glyph("\x11", Colors.Orange2);
  speed = Speeds.Every2Turns;
  hp = { current: 1, max: 1 };

  takeTurn(): UpdateResult {
    let direction = RNG.element(Direction.CARDINAL_DIRECTIONS);
    let [dx, dy] = Direction.toVector(direction);
    return this.moveBy(dx, dy);
  }
}

export class Lizard extends Entity {
  name = "Lizard";
  description = "";
  glyph = Glyph("\x12", Colors.Grey3);
  hp = Stat(2);
  speed = Speeds.Every2Turns;
  triggeringEntity: Entity | undefined;
  explosionTimer: number = 0;

  attacked(attack: Attack): void {
    super.attacked(attack);
    if (this.dead) return;
    this.triggeringEntity = attack.attacker;
    this.glyph.fg = Colors.Orange2;
    this.explosionTimer = 3;
  }

  update() {
    if (this.explosionTimer > 0) {
      this.explosionTimer -= 1;

      if (this.explosionTimer <= 0) {
        this.level.addEffect(this.explode());
      }
    }

    return super.update();
  }

  *explode(): Effect {
    yield* Effects.Explosion({
      pos: this.pos,
      size: 3,
      glyph: Glyph("\x90", Colors.Orange2, Colors.Orange1),
      attacker: this.triggeringEntity || this,
      getDamage: () => this.getExplosionDamage(),
    });

    this.die();
  }

  getExplosionDamage(): Damage {
    return {
      type: DamageType.Explosion,
      amount: 1,
      statuses: [new Statuses.Stunned(2)],
    };
  }

  takeTurn(): UpdateResult {
    let direction = RNG.element(Direction.CARDINAL_DIRECTIONS);
    let [dx, dy] = Direction.toVector(direction);
    return this.moveBy(dx, dy);
  }
}

export class Maguana extends Entity {
  name = "Maguana";
  description = "";
  glyph = Glyph("\x12", Colors.Orange3);
  hp = Stat(2);
  speed = Speeds.Every2Turns;
  triggeringEntity: Entity | undefined;

  attacked(attack: Attack): void {
    super.attacked(attack);
    if (this.dead) return;
    this.triggeringEntity = attack.attacker;
    let dx = this.pos.x - attack.attacker.pos.x;
    let dy = this.pos.y - attack.attacker.pos.y;
    let vec = Vector.from(Math.sign(dx), Math.sign(dy));
    this.level.addEffect(this.runAndExplode(vec));
  }

  *runAndExplode([dx, dy]: Vector.Vector): Effect {
    let moved = true;

    while (moved) {
      moved = this.moveBy(dx, dy);
      yield 1;
    }

    yield* Effects.Explosion({
      pos: this.pos,
      size: 3,
      glyph: Glyph("\x90", Colors.Orange2, Colors.Orange1),
      attacker: this.triggeringEntity || this,
      getDamage: () => this.getExplosionDamage(),
    });

    this.die();
  }

  getExplosionDamage(): Damage {
    return {
      type: DamageType.Explosion,
      amount: 1,
      statuses: [new Statuses.Stunned(2)],
    };
  }

  takeTurn(): UpdateResult {
    let direction = RNG.element(Direction.CARDINAL_DIRECTIONS);
    let [dx, dy] = Direction.toVector(direction);
    return this.moveBy(dx, dy);
  }
}

export class Frog extends Entity {
  name = "Frog";
  description = "";
  glyph = Glyph("\x14", Colors.Green);
  speed = Speeds.Every3Turns;
  hp = { current: 2, max: 2 };

  takeTurn(): UpdateResult {
    let direction = RNG.element(Direction.CARDINAL_DIRECTIONS);
    let [dx, dy] = Direction.toVector(direction);
    return this.moveBy(dx * 2, dy * 2);
  }
}

export class Imp extends Entity {
  name = "Imp";
  description = "";
  glyph = Glyph("\x17", Colors.Blue);
  speed = Speeds.EveryTurn;
  hp = { current: 2, max: 2 };
  status: "searching" | "attacking" = "searching";
  target: Entity | undefined;

  takeTurn(): UpdateResult {
    switch (this.status) {
      case "searching": {
        if (this.canSee(this.level.game.player)) {
          this.target = this.level.game.player;
          this.status = "attacking";
          this.moveTowards(this.target);
          return true;
        } else {
          let direction = RNG.element(Direction.CARDINAL_DIRECTIONS);
          let [dx, dy] = Direction.toVector(direction);
          return this.moveBy(dx, dy);
        }
      }

      case "attacking": {
        if (this.target == null || this.target.dead) {
          this.status = "searching";
          return true;
        }

        if (Point.distance(this.pos, this.target.pos) <= 1) {
          this.status = "attacking";
          this.attack(this.target, {
            type: DamageType.Melee,
            amount: 1
          });
          this.moveAway(this.target);
          return true;
        } else {
          return this.moveTowards(this.target);
        }
      }
    }
  }
}

export class FossilKnight extends Entity {
  name = "Fossil Knight";
  description = `{31}\x8f\x8f\x8f\n\x8f{1}\x0b{31}\x8f\n\x8f\x8f\x8f`;
  glyph = Glyph("\x19", Colors.Grey3);
  hitMarkerGlyph = Glyph("\x94", Colors.Red);
  speed = Speeds.Every4Turns;
  hp = { current: 10, max: 10 };
  heavy = true;
  status: "idle" | "chasing" | "attacking" = "idle";
  target: Entity | undefined;
  clearHitMarkers = () => {}

  takeTurn(): UpdateResult {
    switch (this.status) {
      case "idle": {
        if (this.canSee(this.level.game.player)) {
          this.target = this.level.game.player;
          this.status = "chasing";
          this.moveTowards(this.target);
        }

        return true;
      }

      case "chasing": {
        if (this.target == null || this.target.dead || !this.canSee(this.target)) {
          this.status = "idle";
          return true;
        }

        this.moveTowards(this.target);

        if (Point.distance(this.pos, this.target.pos) <= 1) {
          this.status = "attacking";
          this.energy = 12;
          this.clearHitMarkers = game.level.addFX(term => {
            for (let { x, y } of Point.mooreNeighbours(this.pos)) {
              term.putGlyph(x, y, this.hitMarkerGlyph);
            }
          });
        }

        return true;
      }

      case "attacking": {
        this.clearHitMarkers();

        if (this.target == null || this.target.dead) {
          this.status = "idle";
          return true;
        }

        let areaOfEffect = Rectangle.from(this.pos.x, this.pos.y, 3, 3);
        let targets = this.level.getEntitiesInRect(areaOfEffect);

        for (let target of targets) {
          if (target !== this) {
            this.attack(target, this.getMeleeDamage());
          }
        }

        this.status = "chasing";
        return true;
      }
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Melee,
      amount: 3,
    };
  }
}

export class Snake extends Entity {
  name = "Snake";
  description = "";
  glyph = Glyph("\x16", Colors.Green);
  speed = Speeds.Every2Turns;
  hp = { current: 2, max: 2 };
  status: "idle" | "chasing" = "idle";
  target: Entity | undefined;

  takeTurn(): UpdateResult {
    switch (this.status) {
      case "idle": {
        if (this.canSee(this.level.game.player)) {
          this.target = this.level.game.player;
          this.status = "chasing";
        }

        return true;
      }

      case "chasing": {
        if (this.target == null || this.target.dead || !this.canSee(this.target)) {
          this.status = "idle";
          return true;
        }

        this.moveTowardsWithDiagonals(this.target);
        return true;
      }
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Melee,
      amount: 1,
      statuses: [new Statuses.Poisoned(3)],
    };
  }
}

export class Worm extends Entity {
  name = "Worm";
  description = "";
  glyph = Glyph("\x13", Colors.Turquoise);
  speed = Speeds.Every2Turns;
  hp = { current: 2, max: 2 };
  status: "idle" | "chasing" = "idle";
  target: Entity | undefined;

  takeTurn(): UpdateResult {
    // TODO: Implement boring/burrowing

    switch (this.status) {
      case "idle": {
        if (this.canSee(this.level.game.player)) {
          this.target = this.level.game.player;
          this.status = "chasing";
        } else {
          this.moveIn(RNG.element(Direction.DIRECTIONS));
        }

        return true;
      }

      case "chasing": {
        if (this.target == null || this.target.dead || !this.canSee(this.target)) {
          this.status = "idle";
          return true;
        }

        if (Point.distance(this.pos, this.target.pos) < 5) {
          this.level.addEffect(this.spit());
        } else {
          this.moveTowardsWithDiagonals(this.target);
        }

        return true;
      }
    }
  }

  *spit(): Effect {
    assert(this.target, "target required");

    let line = Line.fromPoints(this.pos, this.target.pos);
    let path = Raster.strokeLine(line);
    let projectile = Point.clone(this.pos);

    let done = this.level.addFX(terminal => {
      terminal.put(projectile.x, projectile.y, "\x94", Colors.Green);
    });

    for (let { x, y } of path) {
      let tile = this.level.getTile(x, y);
      if (tile == null || tile.type.walkable === false) break;
      let targets = this.level.getEntitiesAt(x, y).filter(entity => entity !== this);

      for (let entity of targets) {
        let damage = this.createSpitDamage();
        this.attack(entity, damage);
      }

      projectile.x = x;
      projectile.y = y;

      if (targets.length > 0) {
        break;
      }

      yield 1;
    }

    done();
  }

  createSpitDamage(): Damage {
    return {
      type: DamageType.Misc,
      amount: 0,
      statuses: [new Statuses.Poisoned(3)],
    };
  }
}

export class Cultist extends Entity {
  name = "Cultist";
  description = "";
  glyph = Glyph("\x1b", Colors.Red);
  hp = Stat(2);
  speed = Speeds.Every2Turns;

  status: "idle" | "summoning" | "retreating" = "idle";
  portal: CultistPortal | undefined;
  summoningTimer = 10;
  retreatingTimer = 0;

  attacked(attack: Attack): void {
    super.attacked(attack);

    if (this.status === "summoning") {
      this.status = "retreating";
      this.retreatingTimer = 10;
    }
  }

  takeTurn(): UpdateResult {
    switch (this.status) {
      case "idle": {
        if (this.canSee(game.player)) {
          return this.startSummoning();
        } else {
          return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
        }
      }

      case "summoning": {
        this.summoningTimer -= 1;
        let done = this.portal?.updateSummoning();
        if (done) {
          this.status = "idle";
          this.portal = undefined;
        }
        return true;
      }

      case "retreating": {
        this.retreatingTimer -= 1;

        if (this.retreatingTimer <= 0) {
          this.status = "idle";
          return true;
        } else {
          return this.moveAway(game.player);
        }
      }
    }
  }

  startSummoning() {
    let position = Point
      .mooreNeighbours(this.pos)
      .find(pos => this.level.isEmpty(pos.x, pos.y));

    if (position == null) {
      this.status = "idle";
      return false;
    }

    // Clean up old portals
    if (this.portal) {
      this.level.removeEntity(this.portal);
    }

    game.log(this, "starts chanting...");

    this.status = "summoning";
    this.portal = new CultistPortal();
    this.portal.pos = position;
    this.level.addEntity(this.portal);
    return true;
  }
}

export class CultistPortal extends Entity {
  name = "Cultist";
  description = "";
  glyph = Glyph("\xad", Colors.Red);
  speed = Speeds.Never;
  age = 0;
  chars = ["\xad", "\xae", "\xaf"];

  updateSummoning() {
    this.age += 1;
    this.glyph.char = this.chars[this.age];

    // TODO: If there are multiple cultists in range, summon a demon, otherwise, summon
    // an imp
    if (this.age >= 3) {
      let demon = new Demon();
      demon.pos = Point.clone(this.pos);
      this.level.addEntity(demon);
      this.level.removeEntity(this);
      return true;
    }

    return false;
  }
}

export class Demon extends Entity {
  name = "Demon";
  description = "";
  glyph = Glyph("\x1c", Colors.Red);
  hp = Stat(10);
  speed = Speeds.EveryTurn;

  takeTurn() {
    return this.moveTowards(this.level.game.player);
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Melee,
      amount: 3,
    };
  }
}

export class Krokodil extends Entity {
  name = "Krokodil";
  description = "";
  glyph = Glyph("\x1a", Colors.Green);
  hp = Stat(3);
  speed = Speeds.Every2Turns;

  takeTurn() {
    return this.moveTowards(this.level.game.player);
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Melee,
      amount: 2,
    };
  }
}

export class PunchingBag extends Entity {
  name = "Punching Bag";
  description = "Has no chance!";
  glyph = Glyph("\xac", Colors.Orange4);
  hp = Stat(99);
  speed = Speeds.Never;
}

export class Golem extends Entity {
  name = "Golem";
  description = "";
  glyph = Glyph("\x1d", Colors.Grey3);
  speed = Speeds.Every3Turns;

  takeTurn() {
    if (this.canSee(game.player)) {
      return this.moveTowards(this.level.game.player);
    } else {
      return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Melee,
      amount: 1,
      knockback: true,
    };
  }
}

export class MagmaBomb extends Entity {
  name = "Bomb";
  description = "";
  glyph = Glyph("\x8f", Colors.Orange, Colors.Orange2);
  timer: number = 5;
  blastRadius: number = 3;
  owner: Entity | undefined;

  update() {
    this.timer -= 1;
    this.glyph.char = this.timer.toString();

    if (this.timer <= 0) {
      game.level.addEffect(Effects.Explosion({
        pos: this.pos,
        size: 3,
        glyph: Glyph("\x90", Colors.Orange2, Colors.Orange1),
        attacker: this.owner,
        getDamage: () => ({
          type: DamageType.Explosion,
          amount: 3,
        }),
      }));

      game.level.removeEntity(this);
    }

    return super.update();
  }
}
