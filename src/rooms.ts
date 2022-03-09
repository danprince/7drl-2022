import { RNG } from "silmarils";
import { RoomBuilder } from "./builders";
import { Chars } from "./chars";
import { getDirectionBetween } from "./helpers";
import { Colors } from "./ui";
import * as Entities from "./entities";
import * as Tiles from "./tiles";
import * as Levels from "./levels";
import * as Substances from "./substances";

export let RollingBoulder = new RoomBuilder(`
.O.
.@.
.@.
.@.
.L.
`, {
  "O": {
    spawn: () => new Entities.Boulder,
    tile: Tiles.Floor,
  },
  "@": {
    tile: Tiles.Floor,
  },
  "L": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
    spawn: () => new Entities.Lever(),
  },
}, {
  levelTypes: [Levels.PrimordialCaverns],
  rotates: true,
  afterBuild(ctx) {
    let lever = ctx.findEntity<Entities.Lever>("L");
    let boulder = ctx.findEntity<Entities.Boulder>("O");
    lever.triggers = () => {
      // Prevent triggering boulder twice
      lever.triggers = () => {};
      let dir = getDirectionBetween(boulder.pos, lever.pos);
      boulder.push(dir);
    };
  }
});

export let JailCell = new RoomBuilder(`
*%%%*
#...#
#...#
##=##
**-**
`, {
  "=": {
    tile: Tiles.IronBars,
    constraint: tile => tile.type.walkable,
  },
  "#": {
    tile: Tiles.Wall,
  },
  "%": {
    tile: Tiles.Wall,
    constraint: tile => tile.type === Tiles.Wall,
  },
  ".": {
    tile: Tiles.Floor,
  },
  "-": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
  },
});

export let MountedBallista = new RoomBuilder(`
...
.B.
...
`, {
  ".": {
    constraint: tile => tile.type.walkable,
  },
  "B": {
    spawn: () => new Entities.Ballista(),
  },
});

export let SealedTreasureVault = new RoomBuilder(`
.###.
##$##
.###.
`, {
  "#": {
    tile: Tiles.Wall,
  },
  "$": {
    tile: Tiles.Floor,
    spawn: () => new Entities.Chest(),
  },
});

export let GuardRoom = new RoomBuilder(`
#########
#....%..#
#.%.....#
+....%..+
#.%.....#
#%%....%#
####+####
`, {
  "#": {
    tile: Tiles.Wall,
  },
  ".": {
    tile: Tiles.Floor,
  },
  "%": {
    spawn: () => {
      let entity = new Entities.Chest();
      entity.glyph.char = RNG.element(Chars.WoodenStuff);
      entity.glyph.fg = RNG.element(Colors.Oranges);
      return entity;
    },
  },
  "+": {
    tile: Tiles.Floor,
    constraint: tile => tile.type.walkable,
  },
});

export let PoisonPit = new RoomBuilder(`
.........
.#%%.%#..
#%%s%%%#.
#%%%$%s%.
.#%s%%%#.
.#%%.%#s.
..#......
`, {
  "$": {
    tile: Tiles.Floor,
    spawn: () => new Entities.Chest(),
  },
  "#": {
    tile: Tiles.Wall,
    constraint: tile => tile.type === Tiles.Wall,
  },
  "%": {
    tile: Tiles.Floor,
    substance: () => new Substances.Slime(Infinity),
  },
  "s": {
    tile: Tiles.Floor,
    substance: () => new Substances.Slime(Infinity),
    spawn: () => new Entities.Snake(),
  },
});
