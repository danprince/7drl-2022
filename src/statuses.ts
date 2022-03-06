import { Damage, Player, Status } from "./game";
import { assert } from "./helpers";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export class Molten extends Status {
  name = "Molten";
  description = "Deal/take {15}2x{/} damage";
  glyph = Glyph("\x04", Colors.Orange3);
  turns = Infinity;

  onAdded(): void {
    this.entity.statusGlyph = { ...this.entity.glyph, fg: Colors.Orange3 };
  }

  onRemoved(): void {
    delete this.entity.statusGlyph;
  }

  onDealDamage(damage: Damage): void {
    damage.amount *= 2;
  }

  onTakeDamage(damage: Damage): void {
    damage.amount *= 2;
  }
}

export class Stunned extends Status {
  name = "Stunned";
  glyph = Glyph("\x09", Colors.Grey3);
  description = "Stunned";

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  onAdded(): void {
    this.entity.statusGlyph = { ...this.entity.glyph, bg: Colors.Blue1 };
  }

  onRemoved(): void {
    delete this.entity.statusGlyph;
  }

  update(): void {
    super.update();
    this.entity.skipNextTurn = true;
  }
}

export class Poisoned extends Status {
  name = "Poisoned";
  glyph = Glyph("\x07", Colors.Green);
  description = "Take {15}1{/} damage";

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  onAdded(): void {
    this.entity.statusGlyph = { ...this.entity.glyph, bg: Colors.Green1 };
  }

  onRemoved(): void {
    delete this.entity.statusGlyph;
  }

  update(): void {
    assert(this.entity.hp, "hp required");
    super.update();

    // Poison can't kill
    if (this.entity.hp.current > 1) {
      this.entity.applyDamage({ amount: 1 });

      if (this.entity instanceof Player) {
        console.log("apply poison")
      }
    }
  }
}

export class Hardened extends Status {
  name = "Hardened";
  description = "Reflect damage";
  glyph = Glyph("\x81", Colors.Grey3, Colors.Grey1);

  constructor(turns: number) {
    super();
    this.turns = turns;
  }

  onAdded(): void {
    this.entity.statusGlyph = this.glyph;
  }

  onRemoved(): void {
    delete this.entity.statusGlyph;
  }

  onTakeDamage(damage: Damage): void {
    if (damage.dealer) {
      let dmg = { ...damage };
      damage.dealer.attack(damage.dealer, dmg);
    }

    // Neutralise incoming damage
    damage.amount = 0;
  }
}
