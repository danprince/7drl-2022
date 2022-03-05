import { loadFont } from "./terminal";
import { UI } from "./ui";
import { GameView } from "./views";
import fontUrl from "../font.png";

async function init() {
  let palette = ["#000000", "#ffffff", "#000000", "#000000", "#181c2d", "#353b56", "#6877a7", "#9ea5c3", "#260f00", "#992400", "#ed6000", "#ffae40", "#031e08", "#0b3b14", "#4b7630", "#83c959", "#07242d", "#0f3845", "#256467", "#44b9bf", "#051028", "#111e3b", "#2e366c", "#4455bf", "#180319", "#431245", "#7b1f6a", "#d336b6", "#1c0000", "#570000", "#930707", "#e6000c"];
  let font = await loadFont(fontUrl);
  let ui = new UI(font, palette);
  return ui;
}

function start(ui: UI) {
  ui.open(new GameView);
}

init().then(start);
