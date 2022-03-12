import { Point } from "silmarils";
import { Font, Inputs, Renderer, Terminal } from "./terminal";
import { Game } from "./game";
import { EventHandler, GameEvent } from "./events";


type PopupOptions = Parameters<Terminal["drawPopup"]>[0];

interface QueuedPopup {
  terminal: Terminal;
  options: PopupOptions;
}

export class UI extends EventHandler {
  views: View[] = [];
  terminal: Terminal;
  inputs: Inputs;
  renderer: Renderer;
  game: Game;
  lastEvent: Event | undefined;
  popups: QueuedPopup[] = [];

  constructor(game: Game, font: Font, palette: string[]) {
    super();
    this.game = game;
    this.game.globalEventHandlers.push(this);
    this.inputs = new Inputs();
    this.renderer = new Renderer(font, palette);
    this.terminal = new Terminal(this.renderer, this.inputs);
    this.resize(27, 32);
    document.body.append(this.renderer.canvas);
    window.addEventListener("keydown", this.dispatch);
    window.addEventListener("pointermove", this.dispatch);
    window.addEventListener("pointerup", this.dispatch);
    window.addEventListener("pointerdown", this.dispatch);
  }

  popup(terminal: Terminal, options: PopupOptions) {
    this.popups.push({ terminal, options });
  }

  resize(width: number, height: number) {
    this.renderer.resize(width, height);
    this.terminal.bounds.width = width;
    this.terminal.bounds.height = height;
  }

  onEvent(event: GameEvent): void {
    for (let view of this.views) {
      view.onGameEvent(event);
    }
  }

  private onKeyDown(event: KeyboardEvent): boolean {
    for (let i = this.views.length - 1; i >= 0; i--) {
      let view = this.views[i];
      if (view.onKeyDown(event) === true) {
        return true;
      }
    }

    return false;
  }

  private onDomEvent(event: Event): boolean {
    for (let i = this.views.length - 1; i >= 0; i--) {
      let view = this.views[i];
      if (view.onEvent(event) === true) {
        return true;
      }
    }

    return false;
  }

  private _pointer: Point.Point = { x: -1, y: - 1};

  private shouldUpdate(event: Event) {
    if (event instanceof PointerEvent && event.type === "pointermove") {
      let pos = this.renderer.screenToGrid({ x: event.clientX, y: event.clientY });

      if (pos.x === this._pointer.x && pos.y === this._pointer.y) {
        return false; // Pointer didn't move, don't update
      } else {
        this._pointer = pos;
      }
    }

    return true;
  }

  dispatch = (event: Event) => {
    this.lastEvent = event;
    this.inputs.dispatch(event);

    this.onDomEvent(event);

    if (event.type === "keydown") {
      this.onKeyDown(event as KeyboardEvent);
    }

    if (this.shouldUpdate(event)) {
      this.update();
    }

    this.lastEvent = undefined;
  }

  update() {
    this.terminal.clear();

    for (let view of this.views) {
      view.render(this.terminal);

      // Render popups last, so they are always above their view
      for (let popup of this.popups) {
        popup.terminal.drawPopup(popup.options);
      }

      this.popups = [];
    }
  }

  open(view: View) {
    this.views.push(view);
    view.ui = this;
    this.update();
  }

  close(view: View) {
    this.views.splice(this.views.indexOf(view), 1);
    view.ui = undefined!;
    this.update();
  }
}

export class View {
  ui: UI = undefined!;
  render(terminal: Terminal) {}
  onKeyDown(event: KeyboardEvent): void | boolean {}
  onEvent(event: Event): void | boolean {}
  onGameEvent(event: GameEvent): void | boolean {}
}