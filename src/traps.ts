import { Direction, Point } from "silmarils";
import { Glyph, Chars, Colors } from "./common";
import { Entity, Speeds, StatusGlyphs, DamageType, Stat, Damage } from "./engine";
import { directionToGridVector } from "./helpers";

export abstract class DirectionalTriggerTrap<DirectionType extends Direction.Direction> extends Entity {
  abstract directions: DirectionType[];
  abstract detectionRange: number;
  abstract trigger(direction: DirectionType): void;
  direction: DirectionType | undefined;
  speed = Speeds.EveryTurn;

  getIntentGlyph() {
    switch (this.direction) {
      case Direction.NORTH: return StatusGlyphs.North;
      case Direction.EAST: return StatusGlyphs.East;
      case Direction.WEST: return StatusGlyphs.West;
      case Direction.SOUTH: return StatusGlyphs.South;
      case Direction.SOUTH_EAST: return StatusGlyphs.SouthEast;
      case Direction.SOUTH_WEST: return StatusGlyphs.SouthWest;
      case Direction.NORTH_WEST: return StatusGlyphs.NorthWest;
      case Direction.NORTH_EAST: return StatusGlyphs.NorthEast;
      default: return;
    }
  }

  takeTurn() {
    if (this.direction) {
      this.trigger(this.direction);
      this.direction = undefined;
      return true;
    }

    for (let dir of this.directions) {
      if (this.willTrigger(dir)) {
        this.direction = dir;
      }
    }

    return true;
  }

  willTrigger(dir: DirectionType): boolean {
    let vec = Direction.toVector(dir);
    let pos = Point.clone(this.pos);

    for (let i = 0; i < this.detectionRange; i++) {
      Point.translate(pos, vec);
      let tile = game.level.getTile(pos.x, pos.y);
      if (tile == null || tile.type.walkable == false) return false;
      let entities = game.level.getEntitiesAt(pos.x, pos.y);
      let triggers = entities.filter(entity => this.entityWillTrigger(entity));
      if (entities.length > 0) return triggers.length > 0;
    }

    return false;
  }

  entityWillTrigger(entity: Entity) {
    return entity.didMove;
  }
}

export class ArrowTrap extends DirectionalTriggerTrap<Direction.CardinalDirection> {
  name = "Arrow Trap";
  description = "";
  glyph = Glyph("\xac", Colors.Grey4);
  directions = Direction.CARDINAL_DIRECTIONS;
  detectionRange = 3;

  getArrowGlyph(direction: Direction.CardinalDirection): Glyph {
    switch (direction) {
      case Direction.NORTH:
      case Direction.SOUTH:
        return Glyph("|", Colors.Orange);
      default:
        return Glyph("-", Colors.Orange);
    }
  }

  trigger(dir: Direction.CardinalDirection) {
    game.level.addEffect(this.shoot(dir));
  }

  *shoot(dir: Direction.CardinalDirection) {
    let vec = Direction.toVector(dir);
    let pos = Point.clone(this.pos);
    let done = game.level.addFX(terminal => {
      terminal.putGlyph(pos.x, pos.y, this.getArrowGlyph(dir));
    });

    while (true) {
      Point.translate(pos, vec);
      yield 1;
      let tile = game.level.getTile(pos.x, pos.y);
      if (tile == null || !tile.type.walkable) break;
      let entities = game.level.getEntitiesAt(pos.x, pos.y);
      for (let entity of entities) this.hit(entity);
      if (entities.length) break;
    }

    done();
  }

  hit(entity: Entity) {
    entity.applyDamage({
      type: DamageType.Trap,
      amount: 3,
    });
  }
}

export class Thwomp extends DirectionalTriggerTrap<Direction.CardinalDirection> {
  name = "Thwomp";
  description = "Goes thwomp";
  glyph = Glyph(Chars.Thwomp, Colors.Grey4);
  hp = Stat(1);
  detectionRange = 5;
  directions = Direction.CARDINAL_DIRECTIONS;

  trigger(direction: Direction.CardinalDirection): void {
    game.level.addEffect(this.thwomp(direction));
  }

  *thwomp(dir: Direction.CardinalDirection) {
    this.intentGlyph = undefined;

    while (true) {
      let vec = directionToGridVector(dir);
      let pos = Point.translated(this.pos, vec);
      this.moveTo(pos.x, pos.y);
      if (!this.didMove) break;
      yield 1;
    }
  }

  getMeleeDamage(): Damage | null {
    return {
      type: DamageType.Trap,
      knockback: true,
      amount: 3,
    };
  }

  entityWillTrigger(entity: Entity): boolean {
    return entity.didMove && !(entity instanceof Thwomp);
  }
}
