import { Direction, RNG } from "silmarils";
import { Chars } from "./chars";
import { InteractEvent } from "./events";
import { Damage, DamageType, Entity, Speeds, Stat, UpdateResult } from "./game";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export class Slime extends Entity {
  name = "Slime";
  description = "";
  glyph = Glyph(Chars.Slime, Colors.Green);
  speed = Speeds.Every3Turns;
  hp = Stat(3);

  takeTurn(): UpdateResult {
    return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
  }
}

export class UncommonSlime extends Entity {
  name = "Slime";
  description = "";
  glyph = Glyph(Chars.Slime, Colors.Blue);
  speed = Speeds.Every3Turns;
  hp = Stat(3);

  takeTurn(): UpdateResult {
    return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
  }
}

export class RareSlime extends Entity {
  name = "Slime";
  description = "";
  glyph = Glyph(Chars.Slime, Colors.Pink);
  speed = Speeds.Every3Turns;
  hp = Stat(3);

  takeTurn(): UpdateResult {
    return this.moveIn(RNG.element(Direction.CARDINAL_DIRECTIONS));
  }
}

export class Mimic extends Entity {
  name = "Mimic";
  description = "";
  glyph = Glyph(Chars.Mimic, Colors.Orange);
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
      type: DamageType.Melee,
      amount: 3,
    };
  }
}

export class Chest extends Entity {
  name = "Chest";
  description = "";
  interactive = true;
  glyph = Glyph(Chars.Chest, Colors.Orange);
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
