import { RNG } from "silmarils";
import { Entity, Substance, Tile } from "./game";
import { Colors } from "./common";
import * as Statuses from "./statuses";
import * as Tiles from "./tiles";
import { Chars } from "./common";

export class Slime extends Substance {
  defaultTimer = 5;
  fg = Colors.Green2;
  bg = Colors.Green1;
  onEnter(entity: Entity): void {
    entity.addStatus(new Statuses.Poisoned(2));
    this.tile.removeSubstance();
  }
}

export class Magma extends Substance {
  defaultTimer = 5;
  fg = Colors.Orange2;
  bg = Colors.Red1;
  onEnter(entity: Entity): void {
    entity.addStatus(new Statuses.Molten());
    this.tile.removeSubstance();
  }
}

export class Ice extends Substance {
  defaultTimer = 5;
  fg = Colors.Blue4;
  bg = Colors.Blue2;
  onEnter(entity: Entity): void {
    entity.addStatus(new Statuses.Frozen());
    this.tile.removeSubstance();
  }
}

export class Fire extends Substance {
  defaultTimer = 5;
  char = Chars.Fire;
  fg = Colors.Orange;
  bg = Colors.Red1;

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

  onEnter(entity: Entity): void {
    entity.addStatus(new Statuses.Burning());
    this.tile.removeSubstance();
  }
}
