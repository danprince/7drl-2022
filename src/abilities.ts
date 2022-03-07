import { Direction, Point, Vector } from "silmarils";
import { Chars } from "./chars";
import { MagmaBomb } from "./entities";
import { Ability, Damage, DamageType, Effect, Entity, TargetingMode, Tile } from "./game";
import { assert, directionToGridVector } from "./helpers";
import { Hardened, Molten, Poisoned, Stunned } from "./statuses";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export abstract class Throwable extends Ability {
  targeting = TargetingMode.Directional;
  abstract projectileGlyph: Glyph;

  use(direction: Direction.Direction) {
    game.level.addEffect(this.hurl(direction));
    return true;
  }

  abstract onHitTile(tile: Tile, vec: Vector.Vector): boolean;
  abstract onHitEntities(entities: Entity[], vec: Vector.Vector): boolean;

  *hurl(direction: Direction.Direction): Effect {
    let vec = directionToGridVector(direction);
    let pos = Point.clone(game.player.pos);

    let done = game.level.addFX(term => {
      term.putGlyph(pos.x, pos.y, this.projectileGlyph);
    });

    while (true) {
      Point.translate(pos, vec);

      // Check whether the projectile is stopped by a tile
      let tile = game.level.getTile(pos.x, pos.y);

      if (tile == null) break;

      if (!tile.type.walkable) {
        if (this.onHitTile(tile, vec)) {
          break;
        }
      }

      // Check whether it hit any entities
      let entities = game.level.getEntitiesAt(pos.x, pos.y);

      if (entities.length) {
        if (this.onHitEntities(entities, vec)) {
          break;
        }
      }

      // Otherwise just keep moving
      yield 1;
    }

    done();
  }
}

export class Erupt extends Throwable {
  name = "Erupt";
  description = "Throw some magma";
  glyph = Glyph(Chars.Missile, Colors.Orange, Colors.Orange1);
  projectileGlyph = Glyph(Chars.Block1, Colors.Orange);
  targeting = TargetingMode.Directional;

  canUse(): boolean {
    return game.player.hasStatus(Molten);
  }

  use(direction: Direction.Direction) {
    game.level.addEffect(this.hurl(direction));
    game.player.removeStatusType(Molten);
    return true;
  }

  onHitTile(): boolean {
    return true;
  }

  onHitEntities(entities: Entity[], vec: Vector.Vector): boolean {
    for (let entity of entities) {
      game.player.attack(entity, {
        type: DamageType.Explosion,
        amount: 2,
        direction: vec,
      });
    }

    return true;
  }
}

export class Dash extends Ability {
  name = "Dash";
  description = "Do a dash";
  glyph = Glyph(Chars.Boots, Colors.Orange, Colors.Orange1);
  targeting = TargetingMode.Directional;

  canUse(): boolean {
    return game.player.hasStatus(Molten);
  }

  use(direction: Direction.Direction) {
    game.level.addEffect(this.dash(direction));
    game.player.removeStatusType(Molten);
    return true;
  }

  *dash(direction: Direction.Direction): Effect {
    let vec = directionToGridVector(direction);

    while (true) {
      let pos = Point.translated(game.player.pos, vec);
      let entities = game.level.getEntitiesAt(pos.x, pos.y);

      if (entities.length > 0) {
        for (let entity of entities) {
          let dmg = this.getCollisionDamage(vec);
          game.player.attack(entity, dmg);
        }

        break;
      }

      let moved = game.player.moveTo(pos.x, pos.y);
      if (!moved) break;

      yield 1;
    }
  }

  getCollisionDamage(vec: Vector.Vector): Damage {
    return {
      type: DamageType.Melee,
      amount: 1,
      direction: Vector.clone(vec),
    };
  }
}

export class Grapple extends Ability {
  name = "Grapple";
  description = "Pull towards you";
  glyph = Glyph(Chars.Grapple, Colors.Blue, Colors.Blue1);
  targeting = TargetingMode.Directional;

  canUse(): boolean {
    return game.player.hasStatus(Molten);
  }

  use(direction: Direction.Direction) {
    game.level.addEffect(this.grapple(direction));
    game.player.removeStatusType(Molten);
    return true;
  }

  getTarget(direction: Direction.Direction): Tile | Entity | undefined {
    let pos = Point.clone(game.player.pos);
    let vec = directionToGridVector(direction);

    while (true) {
      Point.translate(pos, vec);

      let tile = game.level.getTile(pos.x, pos.y);
      if (tile && tile.type.walkable === false) {
        return tile;
      }

      let entities = game.level.getEntitiesAt(pos.x, pos.y);
      if (entities.length) {
        return entities[0];
      }

      if (!game.level.isInBounds(pos.x, pos.y)) {
        return undefined;
      }
    }
  }

  *grapple(direction: Direction.Direction): Effect {
    let vec = directionToGridVector(direction);
    let inv = Vector.multiplied(vec, [-1, -1]);
    let target = this.getTarget(direction);
    let pullTarget = true;

    // Impossible to pull tiles
    if (target instanceof Tile && !target.type.walkable) pullTarget = false;

    // Impossible to pull heavy enemies
    if (target instanceof Entity && target.heavy) pullTarget = false;

    // There was no target to hit
    if (target === undefined) return;

    if (pullTarget) {
      assert(target instanceof Entity, "can only grapple entities");

      while (true) {
        let moved = target.moveBy(inv[0], inv[1]);

        if (!moved) {
          target.addStatus(new Stunned(2));
          break;
        }

        yield 1;
      }
    } else {
      while (true) {
        let moved = game.player.moveBy(vec[0], vec[1]);
        if (!moved) break;
        yield 1;
      }
    }
  }
}

export class Sling extends Throwable {
  name = "Sling";
  description = "Throw a stone";
  glyph = Glyph(Chars.Missile, Colors.Grey4, Colors.Grey2);
  projectileGlyph = Glyph("*", Colors.Grey3);

  canUse(): boolean {
    return true;
  }

  onHitTile(tile: Tile, vec: Vector.Vector): boolean {
    return true;
  }

  onHitEntities(entities: Entity[], vec: Vector.Vector): boolean {
    for (let entity of entities) {
      let dmg = this.getStoneDamage();
      game.player.attack(entity, dmg);
    }
    return true;
  }

  getStoneDamage(): Damage {
    return {
      type: DamageType.Stone,
      amount: 1
    };
  }
}

export class Dart extends Throwable {
  name = "Dart";
  description = "Poison dart";
  glyph = Glyph(">", Colors.Green, Colors.Green1);
  projectileGlyph = Glyph(">", Colors.Green);
  turnsOfPoison = 3;

  canUse(): boolean {
    return true;
  }

  onHitTile(tile: Tile, vec: Vector.Vector): boolean {
    return true;
  }

  onHitEntities(entities: Entity[], vec: Vector.Vector): boolean {
    for (let entity of entities) {
      game.player.attack(entity, {
        type: DamageType.Misc,
        amount: 1,
        direction: vec,
        statuses: [new Poisoned(this.turnsOfPoison)],
      });
    }
    return true;
  }
}

export class MagmaCharge extends Ability {
  name = "Charge";
  description = "";
  targeting = TargetingMode.None;
  glyph = Glyph(Chars.CircleOutline, Colors.Orange, Colors.Orange2);

  canUse(): boolean {
    return game.player.hasStatus(Molten);
  }

  use() {
    game.player.removeStatusType(Molten);
    let bomb = new MagmaBomb();
    bomb.pos = Point.clone(game.player.pos);
    game.level.addEntity(bomb);
    game.log(this.owner, "plants the charge");
    return true;
  }
}
