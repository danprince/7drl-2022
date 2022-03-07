import { Point } from "silmarils";
import { Font, Inputs, Renderer, Terminal } from "./terminal";
import { Game } from "./game";

export const Colors = {
  // Base palette
  Black: 0,
  White: 1,
  Grey: 7,
  Orange: 11,
  Green: 15,
  Turquoise: 19,
  Blue: 23,
  Pink: 27,
  Red: 31,

  // Sets
  Greys: [4, 5, 6, 7],
  Oranges: [8, 9, 10, 11],
  Greens: [12, 13, 14, 15],
  Turquoises: [16, 17, 18, 19],
  Blues: [20, 21, 22, 23],
  Pinks: [24, 25, 26, 27],
  Reds: [28, 29, 30, 31],

  // Shades
  Grey1: 4,
  Grey2: 5,
  Grey3: 6,
  Grey4: 7,
  Orange1: 8,
  Orange2: 9,
  Orange3: 10,
  Orange4: 11,
  Green1: 12,
  Green2: 13,
  Green3: 14,
  Green4: 15,
  Turquoise1: 16,
  Turquoise2: 17,
  Turquoise3: 18,
  Turquoise4: 19,
  Blue1: 20,
  Blue2: 21,
  Blue3: 22,
  Blue4: 23,
  Pink1: 24,
  Pink2: 25,
  Pink3: 26,
  Pink4: 27,
  Red1: 28,
  Red2: 29,
  Red3: 30,
  Red4: 31,
};

export class UI {
  views: View[] = [];
  terminal: Terminal;
  inputs: Inputs;
  renderer: Renderer;
  game: Game;
  lastEvent: Event | undefined;

  constructor(game: Game, font: Font, palette: string[]) {
    this.game = game;
    this.inputs = new Inputs();
    this.renderer = new Renderer(font, palette);
    this.terminal = new Terminal(this.renderer, this.inputs);
    this.resize(42, 32);
    document.body.append(this.renderer.canvas);
    window.addEventListener("keydown", this.dispatch);
    window.addEventListener("pointermove", this.dispatch);
    window.addEventListener("pointerup", this.dispatch);
    window.addEventListener("pointerdown", this.dispatch);
  }

  resize(width: number, height: number) {
    this.renderer.resize(width, height);
    this.terminal.bounds.width = width;
    this.terminal.bounds.height = height;
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

  private onEvent(event: Event): boolean {
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

    this.onEvent(event);

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
}