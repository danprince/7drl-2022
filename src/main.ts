import { Point, RNG } from "silmarils";
import { Game, Level, Player, Tile } from "./game";
import { UI } from "./ui";
import { createFont } from "./terminal";
import { GameView } from "./views";
import fontUrl from "../font.png";
import { loadImage } from "./helpers";
import * as Tiles from "./tiles";
import * as Entities from "./entities";
import * as Abilities from "./abilities";
import * as Vestiges from "./vestiges";
import * as Statuses from "./statuses";
import { MessageLogHandler } from "./handlers";

declare global {
  const game: Game;

  interface Window {
    game: Game;
  }
}

window.game = new Game();

async function preload() {
  let palette = ["#000000", "#ffffff", "#000000", "#000000", "#181c2d", "#353b56", "#6877a7", "#9ea5c3", "#260f00", "#992400", "#ed6000", "#ffae40", "#031e08", "#0b3b14", "#4b7630", "#83c959", "#07242d", "#0f3845", "#256467", "#44b9bf", "#051028", "#111e3b", "#2e366c", "#4455bf", "#180319", "#431245", "#7b1f6a", "#d336b6", "#1c0000", "#570000", "#930707", "#e6000c"];
  let fontImage = await loadImage(fontUrl);
  return { palette, fontImage };
}

async function start() {
  let level = game.level = new Level(game, 20, 20);

  let player = game.player = new Player();
  player.setAbility(new Abilities.MagmaCharge());
  player.hp.current = 3;
  //player.addVestige(new Vestiges.Bores());
  //player.addVestige(new Vestiges.PoisonKnuckles());
  //player.addVestige(new Vestiges.OnyxKnuckles());
  //player.addVestige(new Vestiges.StoneKnuckles());
  //player.addVestige(new Vestiges.Tectonic());
  //player.addVestige(new Vestiges.Pyroclastic());
  //player.addVestige(new Vestiges.Cyclical());
  //player.addVestige(new Vestiges.Vessel());
  //player.addVestige(new Vestiges.Incendiary());
  player.addVestige(new Vestiges.MoloksEye());
  player.addVestige(new Vestiges.MoloksFist());
  player.addVestige(new Vestiges.Siphon());
  player.addVestige(new Vestiges.Alchemical());
  player.addVestige(new Vestiges.Hyperaware());
  player.addVestige(new Vestiges.Leech());
  player.addStatus(new Statuses.Molten());
  level.addEntity(player);

  for (let x = 0; x < level.width; x++) {
    for (let y = 0; y < level.height; y++) {
      let type = RNG.weighted([
        { weight: 5, value: Tiles.Block },
        { weight: 1, value: Tiles.PressurePlate },
        { weight: 30, value: Tiles.Floor },
      ]);

      let tile = new Tile(type);
      level.setTile(x, y, tile);
    }
  }

  let unit = new Entities.Maguana();
  unit.pos = { x: 5, y: 5 };
  level.addEntity(unit);

  for (let i = 0; i < 10; i++) {
    let entity = RNG.item(
      new Entities.Mantleshell(),
      new Entities.Slimeshell(),
      new Entities.Stoneshell(),
      new Entities.Boar(),
      new Entities.FossilKnight(),
      new Entities.Imp(),
      new Entities.Maguana(),
      new Entities.Snake(),
      new Entities.Cultist(),
      new Entities.Worm(),
      new Entities.Krokodil(),
    );

    entity.pos = Point.from(
      RNG.int(0, level.width),
      RNG.int(0, level.height),
    );

    level.addEntity(entity);
  }

  game.handlers.push(new MessageLogHandler);

  // Setup the UI
  let assets = await preload();
  let font = createFont(assets.fontImage);
  let ui = new UI(game, font, assets.palette);
  let view = new GameView(game);
  ui.open(view);
}

start().catch(console.error);
