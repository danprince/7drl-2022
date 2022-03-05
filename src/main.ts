import { createFont } from "./terminal";
import { UI } from "./ui";
import { GameView } from "./views";
import fontUrl from "../font.png";
import { loadImage } from "./helpers";
import { Game, Level, Tile } from "./game";
import { RNG } from "silmarils";
import * as Tiles from "./tiles";

async function preload() {
  let palette = ["#000000", "#ffffff", "#000000", "#000000", "#181c2d", "#353b56", "#6877a7", "#9ea5c3", "#260f00", "#992400", "#ed6000", "#ffae40", "#031e08", "#0b3b14", "#4b7630", "#83c959", "#07242d", "#0f3845", "#256467", "#44b9bf", "#051028", "#111e3b", "#2e366c", "#4455bf", "#180319", "#431245", "#7b1f6a", "#d336b6", "#1c0000", "#570000", "#930707", "#e6000c"];
  let fontImage = await loadImage(fontUrl);
  return { palette, fontImage };
}

async function start() {
  let game = new Game();
  let level = game.level = new Level(game, 10, 10);

  for (let x = 0; x < level.width; x++) {
    for (let y = 0; y < level.height; y++) {
      let type = RNG.weighted([
        { weight: 1, value: Tiles.Block },
        { weight: 1, value: Tiles.Fissure },
        { weight: 10, value: Tiles.Floor },
      ]);

      let tile = new Tile(type);
      level.setTile(x, y, tile);
    }
  }

  game.level.addEntity(game.player);

  // Setup the UI
  let assets = await preload();
  let font = createFont(assets.fontImage);
  let ui = new UI(game, font, assets.palette);
  let view = new GameView(game);
  ui.open(view);
}

start().catch(console.error);
