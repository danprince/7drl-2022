import { Glyph, Colors, Chars } from "./common";
import { Terminal } from "./terminal";
import { View } from "./ui";

const emptyGlyph = Glyph("\x00", 0, 0);

const cc = String.fromCharCode;

export class PaintingView extends View {
  static key = "painting-data";
  cc: number = 10;
  fg: number = Colors.White;
  bg: number = Colors.Black;
  width: number = 5;
  height: number = 5;
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

  reset() {
    this.width = 5;
    this.height = 5;
    this.buffer = [];
  }

  onKeyDown(event: KeyboardEvent): boolean | void {
    if (event.metaKey && event.key === "c") {
      this.copyToClipboard();
      event.preventDefault();
      return true;
    }

    if (event.metaKey && event.key === "v") {
      this.pasteFromClipboard();
      event.preventDefault();
      return true;
    }

    if (event.shiftKey && event.key === "N") {
      console.log("new")
      event.preventDefault();
      this.reset();
    }

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
  }

  copyToClipboard() {
    let data = this.serialize();
    navigator.clipboard.writeText(data);
  }

  async pasteFromClipboard() {
    let data = await navigator.clipboard.readText();
    this.load(data);
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
      20,
      10,
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

      terminal.put(x, y, Chars.Box, color, i);
    }
  }
}