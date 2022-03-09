import { RNG } from "silmarils";
import { TileType } from "./game";
import { Molten } from "./statuses";
import { Colors } from "./ui";
import { Chars } from "./chars";
import { Glyph } from "./terminal";
import * as Vestiges from "./vestiges";
import * as Abilities from "./abilities";
import * as Levels from "./levels";
import { LevelBuilder } from "./builders";

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

// TODO: Move this logic out of tiles.ts
function getAllRewards() {
  return [
    new Vestiges.Alchemical,
    new Vestiges.Bores,
    new Vestiges.Cyclical,
    new Vestiges.Hyperaware,
    new Vestiges.Incendiary,
    new Vestiges.Leech,
    new Vestiges.MoloksEye,
    new Vestiges.MoloksFist,
    new Vestiges.OnyxKnuckles,
    new Vestiges.Pyroclastic,
    new Vestiges.Siphon,
    new Vestiges.StoneKnuckles,
    new Vestiges.Tectonic,
    new Vestiges.Vessel,
  ];
}

function getRandomAbility() {
  return RNG.element([
    new Abilities.Dart(),
    new Abilities.Dash(),
    new Abilities.Erupt(),
    new Abilities.Grapple(),
    new Abilities.Charge(),
    new Abilities.Sling(),
  ]);
}

function getPossibleRewards() {
  return getAllRewards().filter(reward => {
    return game.player.vestiges.every(vestige => {
      return vestige.constructor !== reward.constructor;
    })
  });
}

Doorway.onTileEnter = event => {
  if (event.entity === game.player) {
    let level = LevelBuilder.build(Levels.PrimordialCaverns);

    // Pick a random ability for the next level
    let ability = getRandomAbility();
    game.player.setAbility(ability);

    // Add a permanent vestige
    let rewards = getPossibleRewards();
    let reward = RNG.element(rewards);
    if (reward) game.player.addVestige(reward);

    game.setLevel(level);
  }
};

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
