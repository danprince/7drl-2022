import { Point, RNG } from "silmarils";
import { Damage, DamageType, Tile, Vestige } from "./game";
import { Poisoned, Stunned } from "./statuses";
import { Glyph } from "./terminal";
import { Colors } from "./ui";
import { assert, percentToString } from "./helpers";
import * as Tiles from "./tiles";
import * as Substances from "./substances";
import * as Statuses from "./statuses";
import * as Effects from "./effects";
import * as Events from "./events";

const MELEE = `{1}\xA1{/}`;
const POISON = `{15}\x07{/}`;
const STUN = `{23}\x09{/}`;
const KILL = `{1}\xa3{/}`;
const KNOCKBACK = `{22}\x0c{/}`;
const FISSURE = `{10:8}\x94{/}`;
const HP = `{31}\x03{/}`;
const RESET = `{/}`;
const GOOD = `{15}`;

export class Bores extends Vestige {
  name = "Bores";
  description = "Dig through walls";
  glyph = Glyph("\xa0", Colors.Grey3);

  onTileBump({ tile }: Events.TileBumpEvent): void {
    if (tile.type === Tiles.Block) {
      // TODO: Need to make sure takeTurn actually succeeds now
      let floor = new Tile(Tiles.Floor);
      game.level.setTile(tile.pos.x, tile.pos.y, floor);
    }
  }
}

export class PoisonKnuckles extends Vestige {
  name = "Poison Knuckles";
  glyph = Glyph("\xa1", Colors.Green);
  chance = 0.1;
  turns = 3;

  get description() {
    return `${GOOD}${percentToString(this.chance)}${RESET} chance to ${POISON} with ${MELEE}`;
  }

  onMeleeDamage(damage: Damage): void {
    if (RNG.chance(this.chance)) {
      damage.statuses = damage.statuses || [];
      damage.statuses.push(new Poisoned(this.turns));
    }
  }
}

export class OnyxKnuckles extends Vestige {
  name = "Onyx Knuckles";
  glyph = Glyph("\xa1", Colors.Blue2);
  chance = 0.1;
  turns = 3;

  get description() {
    return `${GOOD}${percentToString(this.chance)}${RESET} chance to ${STUN} with ${MELEE}`;
  }

  onMeleeDamage(damage: Damage): void {
    if (RNG.chance(this.chance)) { damage.statuses = damage.statuses || [];
      damage.statuses.push(new Stunned(this.turns));
    }
  }
}

export class StoneKnuckles extends Vestige {
  name = "Stone Knuckles";
  description = `${MELEE} attacks cause ${KNOCKBACK}`;
  glyph = Glyph("\xa1", Colors.Grey3);
  chance = 0.1;
  turns = 3;

  onMeleeDamage(damage: Damage): void {
    damage.knockback = true;
  }
}

export class Tectonic extends Vestige {
  name = "Tectonic";
  glyph = Glyph("\x0b", Colors.Blue);
  description = `Attacks cause ${KNOCKBACK}`;
  chance = 0.1;
  turns = 3;

  onDealDamage({ damage }: Events.DealDamageEvent): void {
    damage.knockback = true;
  }
}

export class Pyroclastic extends Vestige {
  name = "Pyroclastic";
  glyph = Glyph("\x96", Colors.Orange3, Colors.Orange1);
  chance = 0.1;
  description = `${percentToString(this.chance)} chance for ${MELEE} to create {10}magma`;

  onMeleeDamage(damage: Damage): void {
    if (RNG.chance(this.chance)) {
      let tile = this.owner.getTile();

      if (tile) {
        tile.setSubstance(new Substances.Magma());
      }
    }
  }
}

export class Cyclical extends Vestige {
  readonly turnsPerCharge = 10;

  name = "Cyclical";
  glyph = Glyph("\xa2", Colors.Red);
  description = `Regain {30}\x03{/} each ${this.turnsPerCharge} turns`;
  timer = 0;

  onUpdate(): void {
    this.timer += 1;

    if (this.timer >= this.turnsPerCharge) {
      let { hp } = this.owner;

      if (hp && hp.current < hp.max) {
        hp.current += 1;
      }

      this.timer = 0;
    }
  }
}

export class Vessel extends Vestige {
  name = "Vessel";
  glyph = Glyph("\xa3", Colors.White);
  description = `Prevent death itself`;
  used = false;

  onDeath(): void {
    if (!this.used) {
      this.owner.dead = false;
      this.owner.hp!.current = 1;
      this.used = true;
    }
  }
}

export class Incendiary extends Vestige {
  name = "Incendiary";
  glyph = Glyph("\xa5", Colors.Orange, Colors.Red1);
  description = `Explode when you become molten`;

  onStatusAdded({ status }: Events.StatusAddedEvent): void {
    if (status instanceof Statuses.Molten) {
      game.level.addEffect(Effects.Explosion({
        pos: this.owner.pos,
        size: 1,
        glyph: Glyph("\x90", Colors.Orange2, Colors.Orange1),
        attacker: this.owner,
        getDamage: () => ({
          type: DamageType.Explosion,
          amount: 1,
        }),
        canTarget: entity => entity !== this.owner,
      }));
    }
  }
}

export class MoloksEye extends Vestige {
  multiplier = 2;
  name = "Molok's Eye";
  glyph = Glyph("\xa6", Colors.Red);
  description = `${GOOD}${this.multiplier}x${RESET} ${MELEE} when ${HP} is ${GOOD}full`;

  onMeleeDamage(damage: Damage): void {
    assert(this.owner.hp, "hp required");
    if (this.owner.hp.current === this.owner.hp.max) {
      damage.amount *= this.multiplier;
    }
  }
}

export class MoloksFist extends Vestige {
  multiplier = 2;
  name = "Molok's Fist";
  glyph = Glyph("\xa1", Colors.Red);
  description = `${GOOD}${this.multiplier}x${RESET} ${MELEE} when ${HP} is {1}1`;

  onMeleeDamage(damage: Damage): void {
    assert(this.owner.hp, "hp required");
    if (this.owner.hp.current === 1) {
      damage.amount *= this.multiplier;
    }
  }
}

export class Siphon extends Vestige {
  name = "Siphon";
  glyph = Glyph("\x7e", Colors.Turquoise);
  description = `Draw from adjacent ${FISSURE}`;

  onTileEnter({ tile }: Events.TileEnterEvent): void {
    for (let { x, y } of Point.mooreNeighbours(tile.pos)) {
      let neighbour = game.level.getTile(x, y);

      if (neighbour && neighbour.type === Tiles.Fissure) {
        neighbour.type.onEnter(this.owner, neighbour);
      }
    }
  }
}

export class Alchemical extends Vestige {
  name = "Alchemical";
  glyph = Glyph("\xa3", Colors.Green);
  description = `Immune to ${POISON}`;

  onStatusAdded({ status }: Events.StatusAddedEvent): void {
    if (status instanceof Statuses.Poisoned) {
      this.owner.removeStatus(status);
    }
  }
}

export class Hyperaware extends Vestige {
  name = "Hyperaware";
  glyph = Glyph("\xa3", Colors.Blue3);
  description = `Immune to ${STUN}`;

  onStatusAdded({ status }: Events.StatusAddedEvent): void {
    if (status instanceof Statuses.Stunned) {
      this.owner.removeStatus(status);
    }
  }
}

export class Leech extends Vestige {
  name = "Leech";
  glyph = Glyph("\x13", Colors.Red3);
  description = `Gain ${HP} on ${KILL}`;

  onKill({ entity }: Events.KillEvent): void {
    assert(this.owner.hp, "hp required");
    this.owner.hp.current = Math.min(this.owner.hp.current + 1, this.owner.hp.max);
  }
}