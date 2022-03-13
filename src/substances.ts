import { RNG } from "silmarils";
import { Entity, Substance, Tile } from "./game";
import { Colors } from "./common";
import * as Statuses from "./statuses";
import * as Tiles from "./tiles";
import { Chars } from "./common";

export class Slime extends Substance {
  fg = Colors.Green2;
  bg = Colors.Green1;

  applyTo(entity: Entity): void {
    entity.addStatus(new Statuses.Poisoned(2));
  }
}

export class Magma extends Substance {
  fg = Colors.Orange2;
  bg = Colors.Red1;

  applyTo(entity: Entity) {
    entity.addStatus(new Statuses.Molten());
  }
}

export class Ice extends Substance {
  fg = Colors.Blue4;
  bg = Colors.Blue2;

  applyTo(entity: Entity) {
    entity.addStatus(new Statuses.Frozen());
  }
}

export class Fire extends Substance {
  char = Chars.Fire;
  fg = Colors.Orange;
  bg = Colors.Red1;

  applyTo(entity: Entity) {
    entity.addStatus(new Statuses.Burning());
  }

  onUpdate(): void {
    // Spread to surrounding tiles if they are flammable
    game.level.addEffect(this.spread());
  }

  *spread() {
    for (let tile of this.tile.neighbours()) {
      if (tile.type.flammable && !tile.substance) {
        if (RNG.chance(0.3)) {
          tile.setSubstance(new Fire());
        }
      }
    }
  }

  onRemove() {
    let tile = new Tile(Tiles.ScorchedEarth);
    game.level.setTile(this.tile.pos.x, this.tile.pos.y, tile);
  }
}
