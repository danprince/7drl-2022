import { Direction, Point, Vector } from "silmarils";
import { Entity, Game, PlayerAction } from "./game";
import { delayAnimationFrame, directionToGridVector, getDirectionChar } from "./helpers";
import { Poisoned } from "./statuses";
import { Terminal, VirtualTerminal } from "./terminal";
import { View, Colors } from "./ui";

export class GameView extends View {
  viewport = new VirtualTerminal(0, 0, 0, 0);
  hud = new VirtualTerminal(0, 0, 0, 0);
  sidebar = new VirtualTerminal(0, 0, 0, 0);
  framerate = 1000 / 40;

  constructor(private game: Game) {
    super();
    game.ui = this.ui;
    this.start();
  }

  start() {
    this.loop();
  }

  async loop() {
    while (true) {
      let turnIterator = this.game.update();

      for await (let skipFrames of turnIterator) {
        if (skipFrames > 0) {
          await this.delayFrames(skipFrames);
        }

        this.ui.update();
      }
    }
  }

  delayFrames(frames: number) {
    let ms = frames * this.framerate;
    return delayAnimationFrame(ms);
  }

  render(terminal: Terminal) {
    this.attach(terminal);
    this.drawViewport();
    this.drawHud();
    this.drawSidebar();
  }

  attach(terminal: Terminal) {
    this.viewport.bounds.width = this.game.level.width;
    this.viewport.bounds.height = this.game.level.height;
    this.viewport.bounds.x =
      Math.floor(terminal.width / 2 - this.viewport.bounds.width / 2);
    this.viewport.bounds.y =
      Math.floor(terminal.height / 2 - this.viewport.bounds.height / 2);
    this.viewport.attach(terminal);

    this.hud.bounds.x = this.viewport.bounds.x;
    this.hud.bounds.y = this.viewport.bounds.y - 1;
    this.hud.bounds.width = this.game.level.width;
    this.hud.bounds.height = 1;
    this.hud.attach(terminal);

    this.sidebar.bounds.x = this.viewport.bounds.x - 2;
    this.sidebar.bounds.y = this.viewport.bounds.y;
    this.sidebar.bounds.width = 2;
    this.sidebar.bounds.height = this.viewport.bounds.height;
    this.sidebar.attach(terminal);
  }

  drawSidebar() {
    let terminal = this.sidebar;
    terminal.vline(1, 0, terminal.height);

    for (let i = 0; i < game.player.vestiges.length; i++) {
      let vestige = game.player.vestiges[i];
      terminal.putGlyph(0, i, vestige.glyph);

      if (terminal.isPointerOver(0, i)) {
        terminal.popup({
          x: 1,
          y: i,
          title: vestige.name,
          text: vestige.description,
          textColor: Colors.Grey3,
        });
      }
    }
  }

  drawHud() {
    let { hp, ability } = game.player;

    let color = game.player.hasStatus(Poisoned) ? Colors.Green : Colors.Red;
    this.hud.put(0, 0, "\x03", color);
    this.hud.print(1, 0, hp.current.toString(), Colors.White);

    if (ability) {
      let usable = ability.canUse();
      let fg = usable ? ability.glyph.fg : Colors.Grey2;
      let bg = usable ? ability.glyph.bg : Colors.Grey1;
      let x1 = this.hud.width - 1;
      let x0 = x1 - ability.name.length - 1;

      this.hud.put(x1, 0, ability.glyph.char, fg, bg);
      this.hud.print(x0, 0, ability.name, fg);

      if (this.hud.isPointerOver(x1, 0)) {
        this.hud.popup({
          x: x1,
          y: 1,
          align: "start",
          justify: "end",
          title: ability.name,
          text: ability.description,
        });
      }
    }
  }

  drawViewport() {
    let { game, viewport } = this;

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let tile = game.level.getTile(x, y);
        if (tile == null) continue;
        let substance = tile.substance;
        let { char, fg, bg } = tile.glyph;

        if (substance) {
          fg = substance.fg;
          bg = substance.bg;
        }

        viewport.put(x, y, char, fg, bg);
      }
    }

    let focusedEntity: Entity | undefined;

    for (let entity of game.level.entities) {
      let glyph = entity.statusGlyph || entity.glyph;
      viewport.put(entity.pos.x, entity.pos.y, glyph.char, glyph.fg, Colors.Black);

      if (viewport.isPointerOver(entity.pos.x, entity.pos.y)) {
        focusedEntity = entity;
      }
    }

    for (let fx of game.level.fx) {
      fx(viewport);
    }

    if (focusedEntity) {
      this.drawEntityPopup(focusedEntity);
    }
  }

  drawEntityPopup(entity: Entity) {
    let text: string[] = [];

    if (entity.description) {
      text.push(entity.description, "");
    }

    if (entity.statuses.length > 0) {
      text.push(...this.getStatusDescriptions(entity));
    }

    this.viewport.popup({
      x: this.viewport.width / 2,
      y: this.viewport.height,
      title: `${this.renderHitpoints(entity)} ${entity.name}`,
      text: text.join("\n"),
      textColor: Colors.Grey3,
      align: "end",
      justify: "center",
    });
  }

  getStatusDescriptions(entity: Entity) {
    return entity.statuses.map(status => {
      let glyph = `{${status.glyph.fg}}${status.glyph.char}{/}`;
      let name = `{1}${status.name}{/}`;
      let description = `{6}${status.description}`;
      let turns = status.turns !== Infinity ? `for {5}${status.turns}{6} turns` : ``;
      return `${glyph}${name}\n${description} ${turns}`;
    });
  }

  renderHitpoints(entity: Entity) {
    if (entity.hp) {
      return `{31}\x03{1}${entity.hp.current}{/}`;
    } else {
      return "";
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
      case "G":
        this.ui.open(new GlyphPickerView());
        break;
      default:
        return false;
    }

    if (action) {
      this.game.player.setNextAction(action);
    }

    return true;
  }

  tryUseAbility() {
    let { ability } = game.player;

    if (ability && ability.canUse()) {
      switch (ability.targeting) {
        case "none":
          this.game.player.setNextAction({ type: "use", target: undefined });
          break;
        case "directional":
          this.ui.open(new DirectionTargetingView(this.viewport, target => {
            this.game.player.setNextAction({ type: "use", target });
          }));
          break;
      }
    }
  }
}

export class GlyphPickerView extends View {
  activeColor = Colors.White;
  activeChar = "\x00"
  terminal = new VirtualTerminal(5, 5, 24, 24);

  render(root: Terminal) {
    this.terminal.attach(root);
    this.drawGlyphPalette(this.terminal.child(0, 0, 16, 16));
    this.drawColorPalette(this.terminal.child(18, 0, 4, 8));
    this.drawGlyphPreview(this.terminal.child(18, 10, 1, 1));
    this.drawTilePreview(this.terminal.child(18, 13, 3, 3));
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
    private viewport: VirtualTerminal,
    private callback: (direction: Direction.Direction) => void
  ) {
    super();
  }

  render(): void {
    let terminal = this.viewport;

    let cell = Point.translated(
      game.player.pos,
      Direction.toVector(this.direction),
    );

    let vec = directionToGridVector(this.direction);
    let pos = Point.clone(game.player.pos);
    let blocked = false;

    // Render projectile path
    while (true) {
      Point.translate(pos, vec);
      let inside = game.level.isInBounds(pos.x, pos.y);
      if (!inside) break;
      let empty = game.level.isEmpty(pos.x, pos.y);
      if (empty === false) blocked = true;
      let color = blocked ? Colors.Grey2 : Colors.White;
      terminal.put(pos.x, pos.y, "\x94", color);
    }

    // Show arrow 
    let char = getDirectionChar(this.direction);
    terminal.put(cell.x, cell.y, char, Colors.White);
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

  onEvent(event: Event): boolean | void {
    if (event instanceof PointerEvent) {
      let terminal = this.viewport;
      let pointer = terminal.getRelativePointerPosition();
      let vec = Vector.fromPoints(game.player.pos, pointer);

      this.direction = Direction.fromVector(vec);

      if (terminal.isPointerDown()) {
        this.confirm();
      }
    }
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