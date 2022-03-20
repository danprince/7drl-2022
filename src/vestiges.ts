import { Direction, Point, RNG } from "silmarils";
import { DamageType, Rarity, Tile, Vestige } from "./engine";
import { Glyph, Colors, Chars, Glyphs } from "./common";
import { fmt } from "./terminal";
import * as Substances from "./substances";
import * as Statuses from "./statuses";
import * as Effects from "./effects";
import * as Events from "./events";

export class Prolong extends Vestige {
  name = "Prolong";
  glyph = Glyph(Chars.Time, Colors.Blue);
  rarity = Rarity.Common;
  description =
    fmt("Statuses last ")
      .color(Colors.Blue).text("2x").reset()
      .text("longer")
      .toString();

  onStatusAdded(event: Events.StatusAddedEvent): void {
    event.status.turns *= 2;
  }
}

export class Bores extends Vestige {
  name = "Bores";
  description = "Dig through walls";
  glyph = Glyph(Chars.Spade, Colors.Grey3);
  rarity = Rarity.Rare;

  onTileBump(event: Events.TileBumpEvent): void {
    let { tile } = event;
    if (tile.type.diggable) {
      let floor = new Tile(game.level.type.characteristics.defaultFloorTile);
      game.level.setTile(tile.pos.x, tile.pos.y, floor);
      new Events.TileDigEvent(event.entity, tile).dispatch();
      event.succeeded = true;
    }
  }
}

export class Tectonic extends Vestige {
  name = "Tectonic";
  rarity = Rarity.Uncommon;
  glyph = Glyph(Chars.NorthEast, Colors.Blue);
  description = fmt()
    .glyph(Glyphs.Melee)
    .text(" causes ")
    .glyph(Glyphs.Knockback)
    .toString();

  onDealDamage({ damage }: Events.DealDamageEvent): void {
    damage.knockback = true;
  }
}

export class Cyclical extends Vestige {
  readonly turnsPerCharge = 10;

  name = "Cyclical";
  rarity = Rarity.Rare;
  glyph = Glyph(Chars.Loop, Colors.Red);
  timer = 0;

  description = fmt()
    .text("Gain ")
    .glyph(Glyphs.HP)
    .text(" every ")
    .text(this.turnsPerCharge)
    .glyph(Glyphs.Turns)
    .toString();

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
  glyph = Glyph(Chars.Skull, Colors.White);
  description = "Prevent death itself";
  rarity = Rarity.Uncommon;
  used = false;

  onDeath(): void {
    if (!this.used) {
      this.owner.dead = false;
      this.owner.hp!.current = 1;
      this.used = true;
    }
  }
}

export class Wrath extends Vestige {
  name = "Wrath";
  rarity = Rarity.Uncommon;
  glyph = Glyph(Chars.Fire, Colors.Orange, Colors.Red1);
  description = fmt("Explode when ").glyph(Glyphs.Molten).text(" runs out").toString();

  onStatusRemoved(event: Events.StatusRemovedEvent): void {
    if (event.status instanceof Statuses.Molten) {
      // Check whether the status was removed before it ran out
      if (event.status.turns !== 0) return;

      game.level.addEffect(Effects.Explosion({
        pos: this.owner.pos,
        size: 2,
        attacker: this.owner,
        getGlyph: () => RNG.item(
          Glyph(Chars.Fire, Colors.Orange2, Colors.Black),
          Glyph(Chars.Fire, Colors.Orange3, Colors.Black),
          Glyph("^", Colors.Orange3, Colors.Black),
          Glyph(".", Colors.Orange2, Colors.Black)
        ),
        getDamage: () => ({
          type: DamageType.Explosion,
          amount: 1,
        }),
        canTarget: entity => entity !== this.owner,
      }));
    }
  }
}

export class Urgency extends Vestige {
  name = "Urgency";
  rarity = Rarity.Rare;
  glyph = Glyph(Chars.NorthEast, Colors.Orange3);
  description = fmt("Dash when ").glyph(Glyphs.Molten).toString();

  onMove(event: Events.MoveEvent): void {
    // TODO: Prompt for direction using the targeting view.
    // Need some kind of StartMove event that we can cancel.
    if (this.owner.hasStatus(Statuses.Molten)) {
      let dir = event.direction;
      game.level.addEffect(this.dash(dir));
    }
  }

  *dash(dir: Direction.Direction) {
    while (true) {
      this.owner.moveIn(dir);
      yield 1;
      if (!this.owner.didMove) {
        break;
      }
    }
  }
}

export class Flow extends Vestige {
  name = "Flow";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.NorthEast, Colors.Orange3);
  description = fmt("Dash across magma").toString();

  private active = false;
  private substanceType = Substances.Magma;

  onMove(event: Events.MoveEvent): void {
    if (this.active) return;
    let tile = game.level.getTile(event.endPoint.x, event.endPoint.y);
    if (tile?.substance instanceof this.substanceType) {
      let dir = event.direction;
      game.level.addEffect(this.dash(dir));
    }
  }

  *dash(dir: Direction.Direction) {
    while (true) {
      this.owner.moveIn(dir);
      yield 1;

      let tile = this.owner.getTile();

      if (this.owner.didMove && tile?.substance instanceof this.substanceType) {
        continue;
      } else {
        break;
      }
    }
  }
}

export class Precipice extends Vestige {
  name = "Precipice";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.Fire, Colors.Orange, Colors.Red1);
  description = fmt().glyph(Glyphs.Melee).text(" deal 2x dmg when on 1").glyph(Glyphs.HP).toString();

  onDealDamage(event: Events.DealDamageEvent): void {
    if (this.owner.hp.current === 1 && event.damage.type === DamageType.Fist) {
      event.damage.amount *= 2;
    }
  }
}

export class Rupture extends Vestige {
  name = "Rupture";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.Fire, Colors.Orange, Colors.Red1);
  description = fmt().glyph(Glyphs.Melee).text(" deal 2x dmg when on 1").glyph(Glyphs.HP).toString();

  onDealDamage(event: Events.DealDamageEvent): void {
    if (this.owner.hp.current === 1 && event.damage.type === DamageType.Fist) {
      event.damage.amount *= 2;
    }
  }
}

export class Siphon extends Vestige {
  name = "Siphon";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.Magic, Colors.Orange3);
  description = "Affected by adjacent substances";

  onTileEnter({ tile }: Events.TileEnterEvent): void {
    for (let point of Point.mooreNeighbours(tile.pos)) {
      let neighbour = game.level.getTile(point.x, point.y);
      if (neighbour && neighbour.substance) {
        neighbour.substance.enter(this.owner);
      }
    }
  }
}

export class Alchemical extends Vestige {
  name = "Alchemical";
  rarity = Rarity.Uncommon;
  glyph = Glyph(Chars.Skull, Colors.Green);
  description = fmt("Immunity to ").glyph(Glyphs.Poison).toString();

  onStatusAdded({ status }: Events.StatusAddedEvent): void {
    if (status instanceof Statuses.Poisoned) {
      this.owner.removeStatus(status);
    }
  }
}

export class Leech extends Vestige {
  name = "Leech";
  rarity = Rarity.Uncommon;
  glyph = Glyph(Chars.Worm, Colors.Red3);
  description = fmt("Gain").glyph(Glyphs.HP).text(" on kill").toString();

  onKill(events: Events.KillEvent): void {
    this.owner.applyDamage({ type: DamageType.Healing, amount: -1 });
  }
}

export class Bloodknuckles extends Vestige {
  name = "Bloodknuckles";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.Fist, Colors.Red3);
  description = fmt("Gain").glyph(Glyphs.HP).text(" on kill with ").glyph(Glyphs.Melee).toString();

  onKill(event: Events.KillEvent): void {
    if (event.damage && event.damage.type === DamageType.Fist) {
      this.owner.applyDamage({ type: DamageType.Healing, amount: -1 });
    }
  }
}

export class Climber extends Vestige {
  name = "Climber";
  glyph = Glyph(Chars.Upstairs, Colors.Red3);
  rarity = Rarity.Common;
  description = fmt().glyph(Glyphs.HP).text(" when leaving a level").toString();

  onExitLevel(event: Events.ExitLevelEvent): void {
    this.owner.applyDamage({ type: DamageType.Healing, amount: -1 });
  }
}

export class Ignition extends Vestige {
  name = "Ignition";
  glyph = Glyph(Chars.Diamond, Colors.Orange3);
  rarity = Rarity.Common;
  description = fmt("Become").glyph(Glyphs.Molten).text(" after kill with ").glyph(Glyphs.Melee).toString();

  onKill(event: Events.KillEvent): void {
    if (event.damage && event.damage.type === DamageType.Fist) {
      this.owner.addStatus(new Statuses.Molten());
    }
  }
}

export class Doubles extends Vestige {
  name = "Doubles";
  glyph = Glyph(Chars.Fist, Colors.Pink);
  rarity = Rarity.Rare;
  description = fmt("Fists hit twice").toString();

  private hits = 0;

  onUpdate(): void {
    this.hits = 0;
  }

  onDealDamage(event: Events.DealDamageEvent): void {
    this.hits += 1;

    if (this.hits <= 2)  {
      event.entity.attack(event.target, event.damage);
    }
  }
}

export class Initiative extends Vestige {
  name = "Ignition";
  rarity = Rarity.Common;
  glyph = Glyph(Chars.Diamond, Colors.Orange3);
  description = fmt("Deal ")
    .color(Colors.Green)
    .text("extra damage on your first attack")
    .toString();

  private used = false;

  onEnterLevel(event: Events.EnterLevelEvent): void {
    this.used = false;
  }

  onDealDamage(event: Events.DealDamageEvent): void {
    if (this.used) return;
    event.damage.amount += 5;
  }
}
