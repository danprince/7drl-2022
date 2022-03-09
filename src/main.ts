import { Game, Player } from "./game";
import { UI } from "./ui";
import { createFont } from "./terminal";
import { GameView } from "./views";
import { loadImage } from "./helpers";
import { LevelBuilder, registerRoomBuilders } from "./builders";
import fontUrl from "../font.png";
import * as Levels from "./levels";
import * as Handlers from "./handlers";
import * as Abilities from "./abilities";
import * as Rooms from "./rooms";

// TODO: Unsure about this still

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
  registerRoomBuilders(Rooms);
  let level = LevelBuilder.build(Levels.PrimordialCaverns);
  let player = new Player();
  game.setPlayer(player);
  game.setLevel(level);

  game.player.setAbility(new Abilities.Dart());

  // Setup global handlers
  game.handlers.push(new Handlers.MessageLogHandler);

  // Setup the UI
  let assets = await preload();
  let font = createFont(assets.fontImage);
  let ui = new UI(game, font, assets.palette);
  let view = new GameView(game);
  ui.open(view);
}

start().catch(console.error);
