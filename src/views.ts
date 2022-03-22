import { Direction, Point, Vector } from "silmarils";
import { Chars, Colors, getDirectionChar } from "./common";
import { ExitLevelEvent, GameEvent } from "./events";
import { PlayerAction } from "./game";
import { delayAnimationFrame, directionToGridVector } from "./helpers";
import { MessagesPanel, SidebarPanel, TopBarPanel, ViewportPanel } from "./panels";
import { RewardsView } from "./rewards";
import { Terminal } from "./terminal";
import { View } from "./ui";
import { PaintingView } from "./painting";
import { DEFAULT_LEVEL_HEIGHT, DEFAULT_LEVEL_WIDTH } from "./config";

export class GameView extends View {
  fps = 60;

  viewport = new ViewportPanel(3, 2, DEFAULT_LEVEL_WIDTH, DEFAULT_LEVEL_HEIGHT);
  messages = new MessagesPanel(this.viewport, 3, this.viewport.height + 3, this.viewport.width, 10);
  topBar = new TopBarPanel(3, 0, this.viewport.width, 1);
  sideBar = new SidebarPanel(1, 2, 1, this.viewport.height);

  constructor() {
    super();
    this.start();
  }

  start() {
    this.loop();
  }

  async loop() {
    while (true) {
      let turnIterator = game.update();

      for await (let frames of turnIterator) {
        this.ui.update();

        if (frames > 0) {
          await this.delayFrames(frames);
        }
      }
    }
  }

  delayFrames(frames: number) {
    let ms = frames * 1000 / this.fps;
    return delayAnimationFrame(ms);
  }

  render(terminal: Terminal) {
    this.viewport.render(terminal);
    this.messages.render(terminal);
    this.sideBar.render(terminal);
    this.topBar.render(terminal);
  }

  onGameEvent(event: GameEvent): boolean | void {
    if (event.is(ExitLevelEvent)) {
      this.ui.open(new RewardsView());
    }
  }

  onKeyDown(event: KeyboardEvent) {
    let action: PlayerAction | undefined;

    switch (event.key) {
      case ".":
        action = { type: "rest" };
        break;
      case "h":
      case "ArrowLeft":
        action = { type: "move", x: -1, y: 0 };
        break;
      case "l":
      case "ArrowRight":
        action = { type: "move", x: 1, y: 0 };
        break;
      case "k":
      case "ArrowUp":
        action = { type: "move", x: 0, y: -1 };
        break;
      case "j":
      case "ArrowDown":
        action = { type: "move", x: 0, y: 1 };
        break;
      case " ":
        this.tryUseAbility();
        break;
      case "D":
        this.viewport.dijkstraMapsEnabled = !this.viewport.dijkstraMapsEnabled;
        break;
      case "G":
        this.ui.open(new GlyphPickerView());
        break;
      case "P":
        this.ui.open(new PaintingView());
        break;
      case "-":
      case "_":
        this.fps = Math.max(this.fps - 5, 1);
        break;
      case "+":
      case "=":
        this.fps = Math.min(this.fps + 5, 100);
        break;
      default:
        return false;
    }

    if (action) {
      game.player.setNextAction(action);
    }

    return true;
  }

  tryUseAbility() {
    let { ability } = game.player;
    if (ability == null) return;

    if (ability.canUse() === false) {
      game.log(`Can't do that now`);
      return;
    }

    switch (ability.targetingMode.type) {
      case "none":
        game.player.setNextAction({ type: "use", target: undefined });
        break;
      case "directional":
        this.useDirectionalAbility(ability.targetingMode.range, direction => {
          game.player.setNextAction({ type: "use", target: direction });
        });
        break;
    }
  }

  useDirectionalAbility(range: number, callback: (direction: Direction.Direction) => void) {
    this.ui.open(
      new DirectionTargetingView(this.viewport, range, callback)
    );
  }
}

export class GlyphPickerView extends View {
  activeColor = Colors.White;
  activeChar = "\x00"

  render(root: Terminal) {
    let terminal = root.child(5, 5, 24, 24);
    this.drawGlyphPalette(terminal.child(0, 0, 16, 16));
    this.drawColorPalette(terminal.child(18, 0, 4, 8));
    this.drawGlyphPreview(terminal.child(18, 10, 1, 1));
    this.drawTilePreview(terminal.child(18, 13, 3, 3));
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
      case "G":
        this.ui.close(this);
        return true;
      default:
        return true;
    }
  }

  drawGlyphPalette(terminal: Terminal) {
    let selectedChar = this.activeChar;

    terminal.frame(Colors.Grey2);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        let active  = terminal.isPointerOver(x, y);
        let index = x + y * 16;
        let char = String.fromCharCode(index);
        let fg = active ? Colors.White : Colors.Grey3;
        let bg = Colors.Black;
        terminal.put(x, y, char, fg, bg);

        if (active && terminal.isPointerDown()) {
          selectedChar = this.activeChar = char;
        } else if (active) {
          selectedChar = char;
        }
      }
    }

    let hex = selectedChar.charCodeAt(0).toString(16).padStart(2, "0");
    terminal.print(0, -1, hex, Colors.Grey4, 0);
  }

  drawColorPalette(terminal: Terminal) {
    let selectedColor = this.activeColor;

    terminal.frame(Colors.Grey2);

    for (let color = 0; color < 32; color++) {
      let x = color % terminal.width;
      let y = color / terminal.width | 0;
      let active = terminal.isPointerOver(x, y);

      if (active && terminal.isPointerDown()) {
        selectedColor = this.activeColor = color;
      } else if (active) {
        selectedColor = color;
      }

      let char = selectedColor === color ? "\x7f" : " ";
      terminal.put(x, y, " ", Colors.Black, color);
      terminal.put(x, y, char, Colors.White);
    }

    let colorIndex = selectedColor.toString().padStart(2, "0");
    terminal.print(0, -1, colorIndex, Colors.White, 0);
  }

  drawGlyphPreview(terminal: Terminal) {
    terminal.frame(Colors.Grey2);
    terminal.put(0, 0, this.activeChar, this.activeColor);
  }

  drawTilePreview(terminal: Terminal) {
    terminal.frame(Colors.Grey2);
    for (let i = 0; i < terminal.width; i++) {
      for (let j = 0; j < terminal.height; j++) {
        terminal.put(i, j, this.activeChar, this.activeColor);
      }
    }
  }
}

export class DirectionTargetingView extends View {
  static previousDirection: Direction.Direction = Direction.NORTH;

  direction: Direction.Direction = DirectionTargetingView.previousDirection;

  constructor(
    private viewport: ViewportPanel,
    private range: number,
    private callback: (direction: Direction.Direction) => void
  ) {
    super();
  }

  isBlocked(x: number, y: number) {
    let tile = game.level.getTile(x, y);
    if (tile == null) return true;
    if (!tile.type.flyable) return true;
    let entities = game.level.getEntitiesAt(x, y);
    if (entities.length) return true;
    return false;
  }

  render(terminal: Terminal): void {
    let cell = Point.translated(
      game.player.pos,
      Direction.toVector(this.direction),
    );

    let vec = directionToGridVector(this.direction);
    let pos = Point.clone(game.player.pos);
    let blocked = false;

    // Render projectile path
    for (let i = 0; i < this.range; i++) {
      Point.translate(pos, vec);
      let inside = game.level.isInBounds(pos.x, pos.y);
      if (!inside) break;
      if (!blocked) blocked = this.isBlocked(pos.x, pos.y);
      let color = blocked ? Colors.Red2 : Colors.White;
      this.viewport.put(terminal, pos.x, pos.y, Chars.Dot, color);
    }

    // Show arrow 
    let char = getDirectionChar(this.direction);
    this.viewport.put(terminal, cell.x, cell.y, char, Colors.White);

    if (this.ui.lastEvent instanceof PointerEvent) {
      let pointer = terminal.getRelativePointerPosition(this.viewport.bounds);
      let vec = Vector.fromPoints(game.player.pos, pointer);
      this.direction = Direction.fromVector(vec);
    }

    // Use mouse position if pointer is down
    if (terminal.isPointerDown()) {
      this.confirm();
    }
  }

  confirm() {
    this.callback(this.direction);
    this.ui.close(this);
    DirectionTargetingView.previousDirection = this.direction;
  }

  cancel() {
    this.ui.close(this);
    DirectionTargetingView.previousDirection = this.direction;
  }

  onKeyDown(event: KeyboardEvent): boolean | void {
    let direction = this.direction;

    switch (event.key) {
      case "Escape":
        this.cancel();
        return true;

      case " ":
        this.confirm();
        return true;

      case "y":
        direction = Direction.NORTH_WEST;
        break;

      case "u":
        direction = Direction.NORTH_EAST;
        break;

      case "b":
        direction = Direction.SOUTH_WEST;
        break;

      case "n":
        direction = Direction.SOUTH_EAST;
        break;

      case "h":
      case "ArrowLeft":
        direction = Direction.WEST;
        break;

      case "l":
      case "ArrowRight":
        direction = Direction.EAST;
        break;

      case "k":
      case "ArrowUp":
        direction = Direction.NORTH;
        break;

      case "j":
      case "ArrowDown":
        direction = Direction.SOUTH;
        break;
    }

    if (direction === this.direction) {
      this.confirm();
    } else {
      this.direction = direction;
    }

    return true;
  }
}
