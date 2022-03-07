import { Direction } from "silmarils";
import { Glyph } from "./terminal";

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = err => reject(err);
  });
}

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function clamp(min: number, val: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

export function delayAnimationFrame(delay: number = 0) {
  let start = performance.now();

  return new Promise<void>((resolve, reject) => {
    function poll(now: number) {
      let elapsed = now - start;
      if (elapsed >= delay) {
        resolve();
      } else {
        requestAnimationFrame(poll);
      }
    }
    requestAnimationFrame(poll);
  });
}

export const DIRECTION_CHARS: {
  [K in Direction.Direction]: string
} = {
  [Direction.NORTH]: "\x0e",
  [Direction.SOUTH]: "\x0f",
  [Direction.WEST]: "\x0d",
  [Direction.EAST]: "\x0c",
  [Direction.NORTH_EAST]: "\x8b",
  [Direction.SOUTH_EAST]: "\x8d",
  [Direction.NORTH_WEST]: "\x8a",
  [Direction.SOUTH_WEST]: "\x8c",
};

export function getDirectionChar(direction: Direction.Direction): string {
  return DIRECTION_CHARS[direction];
}

export function directionToGridVector(direction: Direction.Direction) {
  let vec = Direction.toVector(direction);

  // Convert diagonal unit vectors to grid units
  vec[0] = Math.round(vec[0]);
  vec[1] = Math.round(vec[1]);

  return vec;
}

export function percentToString(num: number): string {
  return Math.floor(num * 100) + "%";
}

export function glyphToString(glyph: Glyph) {
  if (glyph.bg == null) {
    return `{${glyph.fg}}${glyph.char}{/}`;
  } else {
    return `{${glyph.fg}:${glyph.bg}}${glyph.char}{/}`;
  }
}
