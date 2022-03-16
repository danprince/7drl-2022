import { TileType } from "./engine";
import { Glyph, Colors, Chars } from "./common";
import * as Substances from "./substances";

export let ScorchedEarth = new TileType({
  walkable: true,
  flyable: true,
  glyph: {
    char: ["\xc4"],
    fg: [Colors.Orange1, Colors.Red1],
  },
});

export let Cobblestone = new TileType({
  walkable: true,
  flyable: true,
  glyph: {
    char: Chars.Cobbles,
    fg: [Colors.Blue1],
  },
});

export let Grass = new TileType({
  walkable: true,
  flammable: true,
  flyable: true,
  glyph: {
    char: [Chars.Ribs],
    fg: [Colors.Green2, Colors.Green3, Colors.Turquoise2, Colors.Turquoise3],
  },
});

export let BoneWall = new TileType({
  diggable: true,
  glyph: {
    char: Chars.BoneWalls,
    fg: [Colors.Blue3],
  },
});

export let JungleWall = new TileType({
  diggable: true,
  glyph: {
    char: Chars.JungleWalls,
    fg: [Colors.Green3, Colors.Grey2],
  },
});

export let JungleFloor = new TileType({
  walkable: true,
  flyable: true,
  glyph: {
    char: [`"`, "'", "`", "\xc4", "\xc5", "\x9a"],
    fg: [Colors.Green1],
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
  flyable: true,
  glyph: Glyph(Chars.Bars, Colors.Grey4),
});

export let Bones = new TileType({
  flyable: true,
  glyph: {
    char: [Chars.Ribs, Chars.Bone],
    fg: [Colors.Grey4, Colors.Grey3],
  },
});

export let Doorway = new TileType({
  walkable: true,
  glyph: Glyph(Chars.Doorway, Colors.Blue),
});

export let Upstairs = new TileType({
  glyph: Glyph(Chars.Upstairs, Colors.Blue),
});

export let Downstairs = new TileType({
  flyable: true,
  glyph: Glyph(Chars.Downstairs, Colors.Grey3),
});

export let Fissure = new TileType({
  walkable: true,
  flyable: true,
  glyph: Glyph(Chars.Dot, Colors.Grey2),
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
  flyable: true,
  glyph: {
    char: Chars.Diagonals,
    fg: [Colors.Red1, Colors.Orange1],
  },
});

export let VolcanicWall = new TileType({
  diggable: true,
  glyph: {
    char: Chars.Walls,
    fg: [Colors.Red3, Colors.Orange3],
  },
});

export let Lava = new TileType({
  liquid: true,
  flyable: true,
  glyph: {
    char: [Chars.Ripples],
    fg: [Colors.Orange3],
    bg: [Colors.Orange2],
  },
  onTileEnter({ entity, tile }) {
    if (!entity.flying) {
      game.log(entity, "burns in", tile);
      entity.die();
    }
  },
});

export let Water = new TileType({
  liquid: true,
  flyable: true,
  glyph: {
    char: [Chars.Ripples],
    fg: [Colors.Turquoise3],
    bg: [Colors.Turquoise2],
  },
  onTileEnter({ entity, tile }) {
    if (!entity.flying) {
      game.log(entity, "drowns in", tile, "the");
      entity.die();
    }
  },
});

export let SpikedFloor = new TileType({
  glyph: {
    char: ["'"],
    fg: [Colors.Grey3],
  },
});

export let SepulchreTorchHolder = new TileType({
  glyph: {
    char: ["'"],
    fg: [Colors.Grey3],
  },
});

export let SepulchreLamp = new TileType({
  glyph: {
    char: ["I"],
    fg: [Colors.Grey3],
  },
});

export let SepulchreLampLight = new TileType({
  glyph: {
    char: [Chars.Skull],
    fg: [Colors.Green],
  },
});

export let SepulchreTorchFlame = new TileType({
  glyph: {
    char: [Chars.Fire],
    fg: [Colors.Green],
  },
});

export let SepulchreWall = new TileType({
  diggable: true,
  autotiling: Chars.BrickWalls,
  glyph: {
    char: Chars.BrickWalls,
    fg: [Colors.Turquoise1, Colors.Turquoise2],
  },
});

export let SepulchreFloor = new TileType({
  walkable: true,
  flyable: true,
  glyph: {
    char: [...Chars.Cobbles, " "],
    fg: [Colors.Blue1],
  },
});
