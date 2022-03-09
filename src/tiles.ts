import { TileType } from "./game";
import { Molten } from "./statuses";
import { Colors } from "./ui";
import { Chars } from "./chars";
import { Glyph } from "./terminal";

export let Floor = new TileType({
  walkable: true,
  glyph: {
    char: Chars.Cobbles,
    fg: [Colors.Grey1],
  },
});

export let Wall = new TileType({
  walkable: false,
  diggable: true,
  glyph: {
    char: Chars.BoneWalls,
    fg: [Colors.Grey3],
  },
});

export let Block = new TileType({
  walkable: false,
  diggable: true,
  glyph: {
    char: Chars.Blocks,
    fg: [Colors.Grey2],
  },
});

export let IronBars = new TileType({
  walkable: false,
  diggable: false,
  glyph: Glyph(Chars.Bars, Colors.Grey4),
});

export let Bones = new TileType({
  walkable: false,
  glyph: {
    char: [Chars.Ribs, Chars.Bone],
    fg: [Colors.Grey4, Colors.Grey3],
  },
});

export let Doorway = new TileType({
  walkable: true,
  glyph: Glyph(Chars.Doorway, Colors.Grey4),
});

export let Fissure = new TileType({
  walkable: true,
  glyph: {
    char: ["."],
    fg: [Colors.Orange3, Colors.Orange2],
    bg: [Colors.Orange1],
  },
  onEnter(entity, tile) {
    if (entity === game.player) {
      if (!game.player.hasStatus(Molten)) {
        game.player.addStatus(new Molten);
      }
    }
  },
});
