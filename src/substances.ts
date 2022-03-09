import { Entity, Substance } from "./game";
import { Colors } from "./ui";
import * as Statuses from "./statuses";

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
  fg = Colors.Blue3;
  bg = Colors.Blue2;
  onEnter(entity: Entity): void {
    entity.addStatus(new Statuses.Frozen());
    this.tile.removeSubstance();
  }
}