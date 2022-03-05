import { Point, Rectangle } from "silmarils";

export class Terminal {
  private renderer: Renderer;
  private inputs: Inputs;
  bounds: Rectangle.Rectangle;

  constructor(renderer: Renderer, inputs: Inputs) {
    this.renderer = renderer;
    this.inputs = inputs;
    this.bounds = Rectangle.from(0, 0, this.renderer.width, this.renderer.height);
  }

  get width() {
    return this.bounds.width;
  }

  get height() {
    return this.bounds.height;
  }

  dispatch(event: Event) {
    this.inputs.dispatch(event);
  }

  getRelativePointerPosition() {
    let pointer = this.renderer.screenToGrid(this.inputs.pointer);
    return {
      x: pointer.x - this.bounds.x,
      y: pointer.y - this.bounds.y,
    };
  }

  isPointerDown() {
    return this.inputs.pointer.down;
  }

  isPointerOver(x: number, y: number, w: number = 1, h: number = 1): boolean {
    let pointer = this.renderer.screenToGrid(this.inputs.pointer);

    return (
      pointer.x >= this.bounds.x + x &&
      pointer.y >= this.bounds.y + y &&
      pointer.x <= this.bounds.x + x + w &&
      pointer.y <= this.bounds.y + y + h
    );
  }

  child(x: number, y: number, width: number, height: number): Terminal {
    let term = new Terminal(this.renderer, this.inputs);
    term.bounds = { x: this.bounds.x + x, y: this.bounds.y + y, width, height };
    return term;
  }

  put(x: number, y: number, char: string, fg: number, bg?: number) {
    this.renderer.put(this.bounds.x + x, this.bounds.y + y, char, fg, bg);
  }

  putGlyph(x: number, y: number, glyph: Glyph) {
    this.put(x, y, glyph.char, glyph.fg, glyph.bg);
  }

  print(x: number, y: number, text: string, fg: number, bg?: number) {
    for (let i = 0; i < text.length; i++) {
      this.put(x + i, y, text[i], fg, bg);
    }
  }

  write(x: number, y: number, text: string) {
    let fg = 1;
    let bg = 0;

    let tx = x;
    let ty = y;

    let lines = textToLines(text, this.bounds.width - x);

    for (let line of lines) {
      for (let part of line.parts) {
        if (part[0] === "{") {
          if (part[1] == "/") {
            fg = 1;
            bg = 0;
          } else {
            let colors = part.slice(1, -1).split(":");
            fg = parseInt(colors[0]) || 1;
            bg = parseInt(colors[1]) || 0;
          }
        } else {
          for (let i = 0; i < part.length; i++) {
            let char = part[i];
            this.put(tx, ty, char, fg, bg);
            tx += 1;
          }
        }
      }

      ty += 1;
      tx = x;
    }
  }

  box(x: number, y: number, w: number, h: number, fg: number = 1) {
    this.clear(x, y, w, h);

    let x0 = x;
    let x1 = x + w - 1;
    let y0 = y;
    let y1 = y + h - 1;

    for (let x = x0 + 1; x < x1; x++) {
      this.put(x, y0, "\xb5", fg);
      this.put(x, y1, "\xb5", fg);
    }

    for (let y = y0 + 1; y < y1; y++) {
      this.put(x0, y, "\xba", fg);
      this.put(x1, y, "\xba", fg);
    }

    this.put(x0, y0, "\xbc", fg);
    this.put(x1, y0, "\xb9", fg);
    this.put(x0, y1, "\xb6", fg);
    this.put(x1, y1, "\xb3", fg);
  }

  frame(color: number = 1) {
    this.box(-1, -1, this.width + 2, this.height + 2, color);
  }

  clear(x: number = 0, y: number = 0, w: number = this.bounds.width, h: number = this.bounds.height) {
    this.renderer.clear(this.bounds.x + x, this.bounds.y + y, w, h);
  }
}

export interface Glyph {
  char: string;
  fg: number;
  bg?: number;
}

export interface Font {
  image: HTMLImageElement;
  charWidth: number;
  charHeight: number;
  fontRows: number;
  fontCols: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: string[] = [];
  readonly font: Font;
  private fontTintCache: HTMLCanvasElement[] = [];
  width: number = 0;
  height: number = 0;
  scale: number = 3;

  constructor(font: Font, palette: string[]) {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this.font = font;
    this.palette = palette;
    this.fontTintCache = this.palette.map(color => {
      return tint(this.font.image, color);
    });

    this.canvas.style.imageRendering = "pixelated";
  }

  clear(x: number, y: number, w: number, h: number) {
    this.ctx.clearRect(x, y, w, h);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = this.width * this.font.charWidth;
    this.canvas.height = this.height * this.font.charHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.scale(this.font.charWidth, this.font.charHeight);
    this.canvas.style.width = this.canvas.width * this.scale + "px";
    this.canvas.style.height = this.canvas.height * this.scale + "px";
  }

  screenToGrid(point: Point.Point): Point.Point {
    let rect = this.canvas.getBoundingClientRect();
    let x = (point.x - rect.x) / this.font.charWidth / this.scale;
    let y = (point.y - rect.y) / this.font.charHeight / this.scale;
    return { x, y };
  }

  put(x: number, y: number, char: string, fg: number, bg?: number) {
    if (bg != null) {
      this.ctx.fillStyle = this.palette[bg];
      this.ctx.fillRect(x, y, 1, 1);
    }

    let code = char.charCodeAt(0);
    let sx = (code % this.font.fontCols) * this.font.charWidth;
    let sy = Math.floor(code / this.font.fontCols) * this.font.charHeight;
    let sw = this.font.charWidth;
    let sh = this.font.charHeight;
    let image = this.fontTintCache[fg];
    this.ctx.drawImage(image, sx, sy, sw, sh, x, y, 1, 1);
  }
}

interface Pointer extends Point.Point {
  down: boolean;
}

export class Inputs {
  pointer: Pointer = { x: -1, y: -1, down: false };

  dispatch(event: Event) {
    if (event instanceof PointerEvent) {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      if (event.type === "pointerdown") {
        this.pointer.down = true;
      } else if (event.type === "pointerup") {
        this.pointer.down = false;
      }
    }
  }
}

function tint(image: HTMLImageElement, color: string): HTMLCanvasElement {
  let canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.style.imageRendering = "pixelated";

  let ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);

  // Simple colors
  //ctx.globalCompositeOperation = "source-atop";
  //ctx.fillStyle = color;
  //ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Shaded colors
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let [r, g, b] = colorToRGB(color);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let i = (x + y * canvas.width) * 4;
      if (imageData.data[i] === 255) {
        imageData.data[i + 0] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
      } else {
        let d = imageData.data[i] / 255;
        imageData.data[i + 0] = r * d;
        imageData.data[i + 1] = g * d;
        imageData.data[i + 2] = b * d;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

function colorToRGB(color: string): [number, number, number] {
  let canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  let ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(-1, -1, 2, 2);
  let imageData = ctx.getImageData(0, 0, 1, 1);
  let [r, g, b] = imageData.data;
  return [r, g, b];
}

export function loadFont(url: string, fontCols = 16, fontRows = 16) {
  return new Promise<Font>((resolve, reject) => {
    let image = new Image();
    image.src = url;

    image.onload = () => resolve({
      image,
      fontCols,
      fontRows,
      charWidth: image.width / fontCols,
      charHeight: image.height / fontRows,
    });

    image.onerror = err => reject(err);
  });
}

export interface Line {
  parts: string[];
  length: number;
}

export function textToLines(text: string, maxLineLength: number) {
  let lines: Line[] = [];
  let parts: string[] = [];
  let length = 0;
  let chunks = text.split(/(\s|\{\d+\}|\{\d+:\d+\}|\{\/\})/g);

  for (let chunk of chunks) {
    if (chunk === "") continue;
    if (chunk[0] === "{") {
      parts.push(chunk);
    } else if (chunk === "\n") {
      lines.push({ parts, length });
      parts = [];
      length = 0;
    } else {
      if (length + chunk.length > maxLineLength) {
        lines.push({ parts, length });
        parts = [];
        length = 0;
      }

      if (parts.length === 0) {
        chunk = chunk.trim();
      }

      if (chunk) {
        parts.push(chunk);
        length += chunk.length;
      }
    }
  }

  lines.push({ parts, length });
  return lines;
}
