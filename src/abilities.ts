import { Direction, Point, Vector } from "silmarils";
import { Chars, Glyph } from "./common";
import { Ability, Damage, DamageType, Effect, Entity, TargetingMode, Tile } from "./game";
import { assert, directionToGridVector } from "./helpers";
import { Molten, Stunned } from "./statuses";
import { Colors } from "./common";

export class Blowpipe extends Ability {
  name = "Blowpipe";
  description = "Shoots darts";
  glyph = Glyph(Chars.Missile, Colors.Turquoise);
  targeting = TargetingMode.Directional;

  use(direction: Direction.Direction) {
    game.level.addEffect(this.shoot(direction));
    return true;
  }

  canUse(): boolean {
    return true;
  }

  onHitTile(tile: Tile, vec: Vector.Vector): boolean {
    return true;
  }

  onHitEntities(entities: Entity[], vec: Vector.Vector): boolean {
    for (let entity of entities) {
      game.player.attack(entity, {
        type: DamageType.Generic,
        amount: 1,
        direction: vec,
      });
    }

    return true;
  }

  getProjectileGlyph(direction: Direction.Direction) {
    switch (direction) {
      case Direction.NORTH:
      case Direction.SOUTH:
        return Glyph("|", Colors.Grey3);
      case Direction.EAST:
      case Direction.WEST:
        return Glyph("-", Colors.Grey3);
      case Direction.NORTH_EAST:
      case Direction.SOUTH_WEST:
        return Glyph("/", Colors.Grey3);
      case Direction.NORTH_WEST:
      case Direction.SOUTH_EAST:
        return Glyph("\\", Colors.Grey3);
      default:
        return Glyph("+", Colors.Grey3);
    }
  }

  *shoot(direction: Direction.Direction): Effect {
    let vec = directionToGridVector(direction);
    let pos = Point.clone(game.player.pos);
    let glyph = this.getProjectileGlyph(direction);

    let done = game.level.addFX(term => {
      term.putGlyph(pos.x, pos.y, glyph);
    });

    while (true) {
      Point.translate(pos, vec);

      yield 1;

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
    }

    done();
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

  use(direction: Direction.Direction) {
    game.level.addEffect(this.grapple(direction));
    return true;
  }

  getTarget(direction: Direction.Direction): Tile | Entity | undefined {
    let pos = Point.clone(game.player.pos);
    let vec = directionToGridVector(direction);

    while (true) {
      Point.translate(pos, vec);

      let tile = game.level.getTile(pos.x, pos.y);

      if (tile && !tile.type.flyable && !tile.type.walkable) {
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

  getDirectionalChar(direction: Direction.Direction) {
    switch (direction) {
      case Direction.NORTH:
      case Direction.SOUTH:
        return "|";
      case Direction.EAST:
      case Direction.WEST:
        return "-";
      case Direction.SOUTH_EAST:
      case Direction.NORTH_WEST:
        return "\\";
      case Direction.NORTH_EAST:
      case Direction.SOUTH_WEST:
        return "/";
      default:
        return "+";
    }
  }

  *grapple(direction: Direction.Direction): Effect {
    let vec = directionToGridVector(direction);
    let inv = Vector.multiplied(vec, [-1, -1]);
    const target = this.getTarget(direction);
    let pullTarget = true;
    let done = () => {};

    if (target) {
      done = game.level.addFX(terminal => {
        let pos = Point.translated(target.pos, inv);
        terminal.putGlyph(pos.x, pos.y, this.glyph)

        while (!Point.equals(pos, this.owner.pos)) {
          Point.translate(pos, inv);
          let char = this.getDirectionalChar(direction);
          terminal.put(pos.x, pos.y, char, Colors.Orange);
        }
      });
    }

    // Impossible to pull tiles
    if (target instanceof Tile && !target.type.walkable) pullTarget = false;

    // Impossible to pull heavy enemies
    if (target instanceof Entity && target.heavy) pullTarget = false;

    // There was no target to hit
    if (target === undefined) return;

    if (pullTarget) {
      assert(target instanceof Entity, "can only grapple entities");
      console.log("pull target", pullTarget)

      while (true) {
        target.moveBy(inv[0], inv[1], { forced: true });

        if (!target.didMove) {
          target.addStatus(new Stunned(2));
          break;
        }

        yield 1;
      }
    } else {
      while (true) {
        this.owner.moveBy(vec[0], vec[1], { forced: true });
        if (!this.owner.didMove) break;
        yield 1;
      }
    }

    done();
  }
}
