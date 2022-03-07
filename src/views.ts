import { Direction, Point, Vector } from "silmarils";
import { DamageType, Entity, Game, PlayerAction, Status, Tile } from "./game";
import { delayAnimationFrame, directionToGridVector, getDirectionChar, glyphToString } from "./helpers";
import { Poisoned } from "./statuses";
import { Glyph, singleLineLength, Terminal, VirtualTerminal } from "./terminal";
import { View, Colors } from "./ui";

export class GameView extends View {
  viewport = new VirtualTerminal(0, 0, 0, 0);
  hud = new VirtualTerminal(0, 0, 0, 0);
  sidebar = new VirtualTerminal(0, 0, 0, 0);
  log = new VirtualTerminal(0, 0, 0, 0);
  fps = 40;
  paused = false;

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
        while (this.paused) {
          await this.delayFrames(0);
        }

        if (skipFrames > 0) {
          await this.delayFrames(skipFrames);
        }

        this.ui.update();
      }
    }
  }

  delayFrames(frames: number) {
    let ms = frames * 1000 / this.fps;
    return delayAnimationFrame(ms);
  }

  render(terminal: Terminal) {
    this.attach(terminal);
    this.drawViewport();
    this.drawHud();
    this.drawSidebar();
    this.drawLog();
  }

  attach(terminal: Terminal) {
    this.viewport.bounds.width = this.game.level.width;
    this.viewport.bounds.height = this.game.level.height;
    this.viewport.bounds.x =
      Math.floor(terminal.width / 2 - this.viewport.bounds.width / 2);
    this.viewport.bounds.y = 4;
    this.viewport.attach(terminal);

    this.hud.bounds.x = this.viewport.bounds.x;
    this.hud.bounds.y = this.viewport.bounds.y - 2;
    this.hud.bounds.width = this.game.level.width;
    this.hud.bounds.height = 1;
    this.hud.attach(terminal);

    this.sidebar.bounds.x = this.viewport.bounds.x - 2;
    this.sidebar.bounds.y = this.viewport.bounds.y;
    this.sidebar.bounds.width = 2;
    this.sidebar.bounds.height = this.viewport.bounds.height;
    this.sidebar.attach(terminal);

    this.log.bounds.x = this.viewport.bounds.x;
    this.log.bounds.y = this.viewport.bounds.y + this.viewport.bounds.height + 1;
    this.log.bounds.width = this.viewport.bounds.width;
    this.log.bounds.height = 5;
    this.log.attach(terminal);
  }

  drawLog() {
    let terminal = this.log;
    let ty = 0;
    let tx = 0;
    let after = () => {};

    for (let i = game.messages.length - 1; i >=0; i--) {
      let message = game.messages[i];
      let current = i === game.messages.length - 1;
      let color = current ? Colors.White : Colors.Grey4;

      for (const part of message) {
        // Keep a copy of this location for popups
        const px = tx;
        const py = ty;

        if (part instanceof Entity) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            if (part.dead) {
              this.viewport.put(part.pos.x, part.pos.y, "\xa3", Colors.White);
            } else {
              this.viewport.put(part.pos.x, part.pos.y - 1, "\x0F", Colors.White);
            }
          }
          tx += 1;
        } else if (part instanceof Tile) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            this.viewport.put(part.pos.x, part.pos.y - 1, "\x0F", Colors.White);
          }
          tx += 1;
        } else if (part instanceof Status) {
          terminal.putGlyph(tx, ty, part.glyph);

          if (terminal.isPointerOver(tx, ty)) {
            after = () => terminal.popup({
              x: px,
              y: py + 1,
              title: `${glyphToString(part.glyph)} ${part.name}`,
              text: part.description,
            });
          }

          tx += 1;
        } else if (part instanceof DamageType) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            after = () => terminal.popup({
              x: px + 2,
              y: py,
              title: part.name,
              text: part.description,
            });
          }
          tx += 1;
        } else {
          let text = part.toString();
          terminal.write(tx, ty, text, color);
          tx += singleLineLength(text);
        }

        tx += 1;
      }

      ty += 1;
      tx = 0;
      if (ty >= terminal.height) {
        break;
      }
    }

    after();
  }

  drawSidebar() {
    let terminal = this.sidebar;

    for (let i = 0; i < game.player.vestiges.length; i++) {
      let vestige = game.player.vestiges[i];
      terminal.putGlyph(0, i, vestige.glyph);

      if (terminal.isPointerOver(0, i)) {
        terminal.popup({
          x: 2,
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
      let x0 = this.hud.width - ability.name.length - 2;
      this.hud.put(x1, 0, ability.glyph.char, fg, bg);
      this.hud.print(x0, 0, ability.name, fg);

      if (this.hud.isPointerOver(x1, 0)) {
        this.hud.popup({
          x: x1,
          y: 1,
          align: "start",
          justify: "end",
          text: ability.description,
        });
      }
    }
  }

  drawViewport() {
    let { game, viewport } = this;

    viewport.frame(Colors.Grey1);

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
    let text = "";

    if (entity.hp) {
      text += `{31}\x03{1}${entity.hp.current}{/} `;
    }

    text += entity.name;

    if (entity.statuses.length) {
      text += " ";
    }

    for (let status of entity.statuses) {
      text += glyphToString(status.glyph);
    }

    this.viewport.popup({
      x: Math.floor(this.viewport.width / 2),
      y: this.viewport.height,
      text,
      textColor: Colors.Grey4,
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
      this.game.player.setNextAction(action);
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

const emptyGlyph = Glyph("\x00", 0, 0);

const cc = String.fromCharCode;

export class PaintingView extends View {
  static key = "painting-data";
  cc: number = 10;
  fg: number = Colors.White;
  bg: number = Colors.Black;
  width: number = 4;
  height: number = 4;
  buffer: (Glyph | undefined)[] = [];

  static load() {
    return localStorage.getItem("painting-data");
  }

  static save(data: string) {
    localStorage.setItem("painting-data", data);
  }

  constructor(data: string | null = PaintingView.load()) {
    super();

    if (data) {
      this.load(data);
    }

    window.addEventListener("beforeunload", () => {
      this.save();
    });
  }

  onKeyDown(event: KeyboardEvent): boolean | void {
    switch (event.key) {
      case "Escape":
      case "P":
        this.ui.close(this);
        break;
      case "x":
        [this.fg, this.bg] = [this.bg, this.fg];
        break;
      case "s":
        this.save();
        break;
      case ",":
        this.cc--;
        break;
      case ".":
        this.cc++;
        break;
    }

    return true;
  }

  save() {
    let data = this.serialize();
    PaintingView.save(data);
    window.console.log(`"${data}"`);
    navigator.clipboard.writeText(data);
  }

  load(data: string) {
    let img = this.deserialize(data);
    this.width = img.width;
    this.height = img.height;
    this.buffer = img.buffer;
  }

  deserialize(data: string) {
    let width = data.charCodeAt(0);
    let height = data.charCodeAt(1);
    data = data.slice(2);

    let buffer: Glyph[] = [];
    for (let y = 0; y < this.width; y++) {
      for (let x = 0; x < this.height; x++) {
        let i = (x + y * this.width);
        let j = i * 3;
        let ch = data.charAt(j);
        let fg = data.charCodeAt(j + 1);
        let bg = data.charCodeAt(j + 2);
        buffer[i] = Glyph(ch, fg, bg);
      }
    }

    return { width, height, buffer };
  }

  serialize() {
    let str = "";
    str += cc(this.width);
    str += cc(this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let g = this.buffer[x + y * this.width];
        if (g) {
          str += g.char[0] + cc(g.fg) + cc(g.bg || 0);
        } else {
          str += cc(0) + cc(0) + cc(0);
        }
      }
    }

    return str;
  }

  getCurrentGlyph(): Glyph {
    return {
      char: String.fromCharCode(this.cc),
      fg: this.fg,
      bg: this.bg,
    };
  }

  put(x: number, y: number) {
    if (this.inside(x, y)) {
      this.buffer[x + y * this.width] = this.getCurrentGlyph();
    }
  }

  erase(x: number, y: number) {
    if (this.inside(x, y)) {
      this.buffer[x + y * this.width] = undefined;
    }
  }

  sample(x: number, y: number) {
    if (this.inside(x, y)) {
      let glyph = this.buffer[x + y * this.width];
      if (glyph) {
        this.cc = glyph.char.charCodeAt(0);
        this.fg = glyph.fg;
        this.bg = glyph.bg || 0;
      }
    }
  }

  inside(x: number, y: number) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height
    );
  }

  render(root: Terminal): void {
    root.frame();

    let canvas = root.child(
      Math.floor(root.width / 2 - this.width / 2),
      Math.floor(root.height / 2 - this.height / 2),
      this.width,
      this.height
    );

    canvas.frame(Colors.Grey1);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let g = this.buffer[x + y * this.width];
        if (g) canvas.putGlyph(x, y, g);
      }
    }

    let pointer = canvas.getRelativePointerPosition();

    if (this.inside(pointer.x, pointer.y)) {
      if (canvas.isKeyDown("Alt")) {
        // Sampling
      } else if (canvas.isKeyDown("Shift")) {
        canvas.putGlyph(pointer.x, pointer.y, emptyGlyph);
      } else {
        canvas.putGlyph(pointer.x, pointer.y, this.getCurrentGlyph());
      }
    }

    if (canvas.isPointerDown()) {
      if (canvas.isKeyDown("Alt")) {
        this.sample(pointer.x, pointer.y);
      } else if (canvas.isKeyDown("Shift")) {
        this.erase(pointer.x, pointer.y);
      } else {
        this.put(pointer.x, pointer.y);
      }
    }

    let charPalette = root.child(1, 1, 12, 21);
    this.drawCharPalette(charPalette);

    let colorPalette = root.child(1, 24, 12, 3);
    this.drawColorPalette(colorPalette);
  }

  drawCharPalette(terminal: Terminal) {
    terminal.frame(Colors.Grey2);

    for (let i = 0; i <= 255; i++) {
      let x = i % terminal.width;
      let y = i / terminal.width | 0;
      let ch = String.fromCharCode(i);
      let hover = terminal.isPointerOver(x, y);
      let active = this.cc === i;

      let color =
        active ? Colors.White :
        hover ? Colors.Grey4 :
        Colors.Grey3;

      if (hover && terminal.isPointerDown()) {
        this.cc = i;
      }

      terminal.put(x, y, ch, color);
    }
  }

  drawColorPalette(terminal: Terminal) {
    terminal.frame(Colors.Grey2);

    for (let i = 0; i < this.ui.renderer.palette.length; i++) {
      let x = i % terminal.width;
      let y = i / terminal.width | 0;
      let hover = terminal.isPointerOver(x, y);
      let fgActive = i === this.fg || i === this.bg;
      let color = fgActive ? Colors.White : hover ? Colors.Grey4 : i;

      if (hover && terminal.isPointerDown()) {
        if (terminal.isKeyDown("Shift")) {
          this.bg = i;
        } else {
          this.fg = i;
        }
      }

      terminal.put(x, y, "\x7F", color, i);
    }
  }
}