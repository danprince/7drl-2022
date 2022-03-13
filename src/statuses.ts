import { Glyph, Chars, Colors } from "./common";
import { DealDamageEvent, TakeDamageEvent } from "./events";
import { DamageType, Status } from "./engine";
import { assert } from "./helpers";
import { Fire } from "./substances";

export class Molten extends Status {
  name = "Molten";
  description = "Deal/take {10}2x{/} damage";
  glyph = Glyph(Chars.Diamond, Colors.Orange3);
  turns = 3;

  modifyGlyph(glyph: Glyph): Glyph {
    return { ...glyph, fg: Colors.Orange3 };
  }

  onDealDamage({ damage }: DealDamageEvent): void {
    damage.amount *= 2;
  }

  onTakeDamage({ damage }: TakeDamageEvent): void {
    damage.amount *= 2;
  }
}

export class Burning extends Status {
  name = "Burning";
  description = "Take {10}2{/} damage per turn";
  glyph = Glyph(Chars.Fire, Colors.Orange3);
  turns = 3;

  modifyGlyph(glyph: Glyph): Glyph {
    return { ...glyph, fg: Colors.Orange3, bg: Colors.Red2 };
  }

  update(): void {
    let tile = this.entity.getTile();

    if (tile && tile.type.flammable && !tile.substance) {
      tile.setSubstance(new Fire());
    }

    super.update();

    if (this.entity.hp) {
      this.entity.applyDamage({
        type: DamageType.Fire,
        amount: 2,
      });
    }
  }
}

export class Frozen extends Status {
  name = "Frozen";
  description = "";
  glyph = Glyph(Chars.Snowflake, Colors.Blue);
  turns = 3;

  modifyGlyph(glyph: Glyph): Glyph {
    return { ...glyph, fg: Colors.Blue, bg: Colors.Blue1 };
  }
}

export class Stunned extends Status {
  name = "Stunned";
  glyph = Glyph(Chars.Stun, Colors.Grey3);
  description = "Miss a turn";

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  modifyGlyph(glyph: Glyph): Glyph {
    return { ...glyph, bg: Colors.Blue1 };
  }

  update(): void {
    super.update();
    this.entity.skipNextTurn = true;
  }
}

export class Poisoned extends Status {
  name = "Poisoned";
  glyph = Glyph(Chars.Droplet, Colors.Green);
  description = "Take {15}1{/} damage";

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  modifyGlyph(glyph: Glyph): Glyph {
    return { ...glyph, fg: Colors.Green, bg: Colors.Green1 };
  }

  update(): void {
    assert(this.entity.hp, "hp required");
    super.update();

    // Poison can't kill
    if (this.entity.hp.current > 1) {
      this.entity.applyDamage({
        type: DamageType.Poison,
        amount: 1,
      });
    }
  }
}
