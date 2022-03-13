import { Decoration, LevelCharacteristics, TileType } from "./game";
import * as Tiles from "./tiles";

interface Legend {
  [char: string]:
    | (TileType | undefined)
    | ((ctx: LevelCharacteristics) => TileType | undefined)
}

const defaultLegend: Legend = {
  "*": ctx => undefined,
  "#": ctx => ctx.defaultWallTile,
  ".": ctx => ctx.defaultFloorTile,
  "~": ctx => ctx.defaultLiquidTile,
};

function createDecoration(
  before: string,
  after: string,
  legend: Legend = {}
): Decoration {
  let parsedBefore = before.replace(/\s+/g, "");
  let parsedAfter = after.replace(/\s+/g, "");
  let beforeChars = Array.from(parsedBefore);
  let afterChars = Array.from(parsedAfter);

  return ctx => {
    function lookup(ch: string) {
      let entry = legend[ch] || defaultLegend[ch];
      if (entry === undefined || entry instanceof TileType) {
        return entry;
      } else {
        return entry(ctx);
      }
    }

    let src = beforeChars.map(lookup);
    let dst = afterChars.map(lookup);
    return [src, dst];
  };
}
export const SepulchreTorch = createDecoration(`
  *#*
  *#*
  *.*
`, `
  *^*
  *'*
  ***
`, {
  "^": Tiles.SepulchreTorchFlame,
  "'": Tiles.SepulchreTorchHolder,
});

export const SepulchreLamp = createDecoration(`
  *#*
  .#.
  *.*
`, `
  *^*
  *I*
  ***
`, {
  "^": Tiles.SepulchreLampLight,
  "I": Tiles.SepulchreLamp,
});