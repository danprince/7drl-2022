import { TileType } from "./game";
import { Colors } from "./ui";
import { Chars } from "./chars";
import { Glyph } from "./terminal";
import * as Substances from "./substances";

export let Floor = new TileType({
  walkable: true,
  glyph: {
    char: Chars.Cobbles,
    fg: [Colors.Grey1],
  },
});

export let Grass = new TileType({
  walkable: true,
  glyph: {
    char: ["\xc5"],
    fg: Colors.Greens,
  },
});

export let Wall = new TileType({
  diggable: true,
  glyph: {
    char: Chars.BoneWalls,
    fg: [Colors.Grey4],
  },
});

export let Block = new TileType({
  diggable: true,
  glyph: {
    char: Chars.Blocks,
    fg: [Colors.Grey2],
  },
});

export let Stalagmite = new TileType({
  diggable: true,
  glyph: {
    char: [Chars.Stalagmite],
    fg: [Colors.Grey2, Colors.Grey3],
  },
});

export let IronBars = new TileType({
  glyph: Glyph(Chars.Bars, Colors.Grey4),
});

export let Bones = new TileType({
  glyph: {
    char: [Chars.Ribs, Chars.Bone],
    fg: [Colors.Grey4, Colors.Grey3],
  },
});

export let Doorway = new TileType({
  walkable: true,
  glyph: Glyph(Chars.Doorway, Colors.Blue),
});

export let Fissure = new TileType({
  walkable: true,
  glyph: Glyph("+", Colors.Grey2),
  onCreate(tile) {
    tile.setSubstance(new Substances.Magma(Infinity));
  },
  onUpdate(tile) {
    if (game.turns % 20 === 0) {
      tile.setSubstance(new Substances.Magma(Infinity));
    }
  },
});

export let VolcanicFloor = new TileType({
  walkable: true,
  glyph: {
    char: Chars.Diagonals,
    fg: [Colors.Grey1],
  },
});

export let VolcanicWall = new TileType({
  diggable: true,
  glyph: {
    char: Chars.Walls,
    fg: [Colors.Grey3],
  },
});

export let Lava = new TileType({
  liquid: true,
  glyph: {
    char: [Chars.Ripples],
    fg: [Colors.Orange3],
  },
  onTileEnter({ entity, tile }) {
    game.log(entity, "burns in", tile);
    entity.die();
  },
});

export let Water = new TileType({
  liquid: true,
  glyph: {
    char: [Chars.Ripples],
    fg: [Colors.Turquoise2, Colors.Turquoise3],
  },
  onTileEnter({ entity, tile }) {
    game.log(entity, "drowns in", tile, "the");
    entity.die();
  },
});
