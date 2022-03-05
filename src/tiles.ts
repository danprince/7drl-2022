import { TileType } from "./game";
import { Colors } from "./ui";

export let Floor = new TileType({
  walkable: true,
  glyph: {
    char: ["."],
    fg: [Colors.Grey1],
  },
});

export let Fissure = new TileType({
  walkable: true,
  glyph: {
    char: ["."],
    fg: [Colors.Orange3, Colors.Orange2],
    bg: [Colors.Orange1],
  },
});

export let Block = new TileType({
  walkable: false,
  glyph: {
    char: ["\x80", "\x81", "\x82"],
    fg: [Colors.Grey2, Colors.Grey3],
  },
});
