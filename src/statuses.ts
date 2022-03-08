import { Chars } from "./chars";
import { DealDamageEvent, TakeDamageEvent } from "./events";
import { DamageType, Status } from "./game";
import { assert } from "./helpers";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export class Molten extends Status {
  name = "Molten";
  description = "Deal/take {15}2x{/} damage";
  glyph = Glyph(Chars.Diamond, Colors.Orange3);
  turns = Infinity;

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
    return { ...glyph, bg: Colors.Green1 };
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
