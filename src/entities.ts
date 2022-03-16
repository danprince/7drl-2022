import { Direction, Line, Point, Raster, RNG, Vector } from "silmarils";
import { InteractEvent, PushEvent, StatusAddedEvent } from "./events";
import { Attack, Damage, DamageType, Effect, Entity, Speeds, Stat, Substance, UpdateResult } from "./engine";
import { Glyph, Chars, Colors, getDirectionChar } from "./common";
import { assert, getDirectionBetween } from "./helpers";
import * as Statuses from "./statuses";
import * as Effects from "./effects";
import * as Substances from "./substances";
export * from "./traps";

export class Chest extends Entity {
  name = "Chest";
  description = "";
  interactive = true;
  glyph = Glyph(Chars.Chest, Colors.Grey3);
  mimicChance = 0.05;
  loot = (entity: Entity) => {};

  onInteract(event: InteractEvent): void {
    if (RNG.chance(this.mimicChance)) {
      let mimic = new Mimic();
      mimic.target = event.entity;
      mimic.pos = this.pos;
      mimic.onDeath = () => this.loot(event.entity);
      game.level.addEntity(mimic);
    } else {
      this.loot(event.entity);
    }

    this.despawn();
  }
}

export class Mimic extends Entity {
  name = "Mimic";
  description = "";
  glyph = Glyph(Chars.Mimic, Colors.Grey3);
  hp = Stat(10);
  speed = Speeds.Every2Turns;
  target: Entity | undefined;

  takeTurn(): UpdateResult {
    if (this.target && this.canSee(this.target)) {
      return this.moveTowards(this.target);
    } else {
      return this.moveIn(RNG.element(Direction.INTERCARDINAL_DIRECTIONS));
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Generic,
      amount: 3,
    };
  }
}

export class Maguana extends Entity {
  name = "Maguana";
  description = "";
  glyph = Glyph(Chars.Lizard, Colors.Orange3);
  hp = Stat(4);
  speed = 24;
  triggeringEntity: Entity | undefined;

  takeTurn(): UpdateResult {
    let dir = RNG.element(Direction.CARDINAL_DIRECTIONS);
    let vec = Direction.toVector(dir);
    return this.moveBy(vec);
  }

  attacked(attack: Attack): void {
    super.attacked(attack);
    if (this.dead) return;
    this.triggeringEntity = attack.attacker;
    let dx = this.pos.x - attack.attacker.pos.x;
    let dy = this.pos.y - attack.attacker.pos.y;
    let vec = Vector.from(Math.sign(dx), Math.sign(dy));
    this.level.addEffect(this.runAndExplode(vec));
  }

  *runAndExplode(vec: Vector.Vector): Effect {
    while (true) {
      this.moveBy(vec);
      yield 1;
      if (!this.didMove) break;
    }

    yield* Effects.Explosion({
      pos: this.pos,
      size: 3,
      attacker: this.triggeringEntity || this,
      getGlyph: () => RNG.item(
        Glyph(Chars.Fire, Colors.Orange3, Colors.Black),
        Glyph(Chars.Fire, Colors.Orange3, Colors.Black),
        Glyph(Chars.Fire, Colors.Orange4, Colors.Black),
      ),
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
}

export class Boulder extends Entity {
  name = "Boulder";
  description = "";
  pushable = true;
  glyph = Glyph(Chars.Boulder, Colors.Grey3);
  heavy = true;

  hasBeenPushed = false;
  rollDirection: Direction.Direction | undefined;
  pushedBy: Entity | undefined;

  onPush(event: PushEvent): void {
    let vec = Vector.fromPoints(event.entity.pos, this.pos);
    let dir = Direction.fromVector(vec);
    this.pushedBy = event.entity;
    this.push(dir);
  }

  push(dir: Direction.Direction) {
    game.log(this, "starts to roll...");
    this.rollDirection = dir;
    this.hasBeenPushed = true;
  }

  update() {
    if (this.rollDirection) {
      let vec = Direction.toVector(this.rollDirection);
      let moved = this.moveBy(vec, { forced: true });
      if (moved === false && !this.didMove) {
        this.rollDirection = undefined;
      }
    }

    return super.update();
  }

  getMeleeDamage(): Damage | null {
    return {
      type: DamageType.Trap,
      vector: Direction.toVector(this.rollDirection!),
      knockback: true,
      amount: 10,
    };
  }
}

enum FrogStatus {
  Resting,
  Hopping,
}

export class Frog extends Entity {
  name = "Frog";
  description = "";
  glyph = Glyph(Chars.Frog, Colors.Green);
  speed = Speeds.EveryTurn;
  hp = Stat(2);
  status = FrogStatus.Resting;
  nextHopDirection: Direction.Direction = Direction.NORTH;

  takeTurn(): UpdateResult {
    switch (this.status) {
      case FrogStatus.Hopping:
        this.hop();
        this.status = FrogStatus.Resting;
        return true;
      case FrogStatus.Resting:
        this.status = FrogStatus.Hopping;
        this.nextHopDirection = this.canSee(game.player)
          ? getDirectionBetween(this.pos, game.player.pos)
          : RNG.element(Direction.CARDINAL_DIRECTIONS);
        return true;
    }
  }

  getIntentGlyph(): Glyph | undefined {
    if (this.status === FrogStatus.Hopping) {
      let char = getDirectionChar(this.nextHopDirection);
      return Glyph(char, Colors.Red);
    } else {
      return;
    }
  }

  hop() {
    let directionVector = Direction.toVector(this.nextHopDirection);
    let hopVector = Vector.scaled(directionVector, 2);
    return this.moveBy(hopVector);
  }

  getMeleeDamage(): Damage | null {
    return {
      type: DamageType.Generic,
      amount: 1,
    };
  }
}

export abstract class Snail extends Entity {
  speed = Speeds.Every2Turns;
  hp = Stat(1);

  abstract substanceType: { new(): Substance } | undefined;

  private direction: Direction.Direction = Direction.NORTH;

  takeTurn(): UpdateResult {
    let vec = Direction.toVector(this.direction);
    let pos = Point.translated(this.pos, vec);
    let entities = this.level.getEntitiesAtPoint(pos);

    // Push existing entities out the way
    for (let entity of entities) {
      if (!entity.heavy) {
        entity.moveBy(vec);
      }
    }

    if (!this.moveBy(vec)) {
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
  immunities = [Statuses.Molten];
  glyph = Glyph(Chars.Snail, Colors.Orange3);
}

export class Slimeshell extends Snail {
  name = "Slimeshell";
  description = "";
  substanceType = Substances.Slime;
  immunities = [Statuses.Poisoned];
  glyph = Glyph(Chars.Snail, Colors.Green);
}

export class Stoneshell extends Snail {
  name = "Stoneshell";
  description = "";
  substanceType = undefined;
  glyph = Glyph(Chars.Snail, Colors.Grey3);
}

export class Changeling extends Entity {
  glyph: Glyph;
  description = "";
  name = "changeling";

  constructor() {
    super();
    this.glyph = Glyph(String.fromCharCode(RNG.int(0x80, 0xA5)), RNG.int(0, 32));
  }
}

export class Worm extends Entity {
  name = "Worm";
  description = "";
  glyph = Glyph(Chars.Worm, Colors.Turquoise);
  speed = Speeds.Every2Turns;
  hp = Stat(2);
  status: "idle" | "chasing" = "idle";
  target: Entity | undefined;

  private spitCooldown = 0;
  private spitDistance = 3;

  canSpit() {
    return this.spitCooldown <= 0;
  }

  onUpdate(): void {
    this.spitCooldown -= 1;
  }

  takeTurn(): UpdateResult {
    // TODO: Implement boring/burrowing

    switch (this.status) {
      case "idle": {
        if (this.canSee(game.player)) {
          this.target = game.player;
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

        if (this.distanceTo(this.target) <= this.spitDistance && this.canSpit()) {
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
    this.spitCooldown = 5;

    let line = Line.fromPoints(this.pos, this.target.pos);
    let path = Raster.strokeLine(line);
    let projectile = Point.clone(this.pos);

    let done = this.level.addFX(terminal => {
      terminal.put(projectile.x, projectile.y, "*", Colors.Green);
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
      type: DamageType.Generic,
      amount: 0,
      statuses: [new Statuses.Poisoned(3)],
    };
  }
}

export class Bat extends Entity {
  name = "Bat";
  description = "";
  glyph = Glyph(Chars.Bat, Colors.Pink);
  speed = Speeds.EveryTurn;
  flying = true;
  hp = Stat(2);

  takeTurn(): UpdateResult {
    if (this.canSee(game.player)) {
      return this.moveTowardsWithDiagonals(game.player);
    } else {
      return this.moveIn(RNG.element(Direction.DIRECTIONS));
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Generic,
      amount: 2,
    };
  }
}

export class Spider extends Entity {
  readonly spinWebChance = 0.5;

  name = "Spider";
  description = "";
  glyph = Glyph(Chars.Spider, Colors.Orange2);
  speed = Speeds.Every2Turns;
  hp = Stat(4);
  immunities = [Statuses.Tangled];

  takeTurn(): UpdateResult {
    if (RNG.chance(this.spinWebChance)) {
      this.getTile().setSubstance(new Substances.SpiderWeb());
      return true;
    } else if (this.canSee(game.player)) {
      return this.moveTowards(game.player);
    } else {
      return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
    }
  }

  getMeleeDamage(): Damage {
    return {
      type: DamageType.Generic,
      amount: 1,
    };
  }
}


export class Stonetusk extends Entity {
  name = "Stonetusk";
  description = "";
  glyph = Glyph(Chars.Boar, Colors.Grey3);
  speed = Speeds.EveryTurn;
  hp = Stat(4);
  status: "hunting" | "rearing" | "charging" = "hunting";
  chargeDirection: Direction.CardinalDirection | undefined;

  getIntentGlyph(): Glyph | undefined {
    if (this.status === "rearing" && this.chargeDirection) {
      return Glyph(getDirectionChar(this.chargeDirection), Colors.Red);
    } else {
      return;
    }
  }

  takeTurn(): UpdateResult {
    let target = game.player;
    let canSeeTarget = this.canSee(target);

    if (this.status === "hunting") {
      if (!canSeeTarget) {
        return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
      }

      let vec = Vector.fromPoints(this.pos, target.pos)
      let [dx, dy] = vec;

      if (dx === 0 || dy === 0) {
        this.chargeDirection = Direction.cardinalFromVector(vec);
        this.status = "rearing";
        return true;
      }

      if (dx < dy) {
        return this.moveBy([Math.sign(dx), 0]);
      } else {
        return this.moveBy([0, Math.sign(dy)]);
      }
    }

    if (this.status === "rearing") {
      game.level.addEffect(this.charge());
    }

    return true;
  }

  *charge() {
    assert(this.chargeDirection, "direction required to charge");
    assert(this.status === "rearing", "trying to charge without rearing");
    this.status = "charging";

    while (true) {
      yield 1;
      this.moveIn(this.chargeDirection, { forced: true });
      if (!this.didMove) break;
      if (this.dead) break;
    }

    this.addStatus(new Statuses.Stunned(3));
    this.status = "hunting";
  }

  getMeleeDamage(): Damage | null {
    return {
      type: DamageType.Generic,
      amount: 3,
      knockback: true,
    };
  }
}

export class Magman extends Entity {
  name = "Magman";
  description = "";
  glyph = Glyph(Chars.Man, Colors.Orange2);
  speed = Speeds.EveryTurn;
  hp = Stat(10);
  eruptionTimer = -1;
  eruptionSize = 0;

  getStatusGlyph(): Glyph {
    let glyph = { ...super.getStatusGlyph() }; 

    if (this.eruptionTimer > 0) {
      glyph.char = Chars.ManArmsUp;
    }

    if (this.eruptionTimer > 1) {
      glyph.fg = Colors.Orange3;
    }

    return glyph;
  }

  onStatusAdded(event: StatusAddedEvent): void {
    if (event.status instanceof Statuses.Molten) {
      this.erupt();
    }
  }

  takeTurn(): UpdateResult {
    if (this.eruptionTimer > 0) {
      this.eruptionTimer -= 1;
    }

    // If there's still time left on the timer it means we're doing the
    // big eruption and we shouldn't move this turn.
    if (this.eruptionTimer >= 1) {
      return true;
    }

    // If the timer hit zero, it's time to erupt.
    if (this.eruptionTimer === 0) {
      this.erupt();
      return true;
    }

    // If we're in eruption range of the player then we'll either do a small
    // (timer 1, radius 1) or large (timer 2, radius 2) eruption.
    if (Point.manhattan(this.pos, game.player.pos) === 1) {
      this.eruptionTimer = this.eruptionSize = RNG.int(1, 3);
      return true;
    }

    if (this.canSee(game.player)) {
      return this.moveTowards(game.player)
    } else {
      return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS))
    }
  }

  erupt() {
    game.level.addEffect(Effects.Explosion({
      pos: this.pos,
      size: this.eruptionSize,
      attacker: this,
      canTarget: entity => entity !== this,
      getGlyph: () => Glyph("*", Colors.Orange3),
      getDamage: () => ({ type: DamageType.Explosion, amount: 4 }),
    }));
  }
}
