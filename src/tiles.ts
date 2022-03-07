import { TileType } from "./game";
import { Molten } from "./statuses";
import { Glyph } from "./terminal";
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
  onEnter(entity, tile) {
    if (entity === game.player) {
      if (!game.player.hasStatus(Molten)) {
        game.player.addStatus(new Molten);
      }
    }
  },
});

export let Block = new TileType({
  walkable: false,
  glyph: {
    char: ["\x80", "\x81", "\x82"],
    fg: [Colors.Grey2],
  },
});

export let PressurePlate = new TileType({
  walkable: true,
  glyph: Glyph("\x85", Colors.Grey1),
});
