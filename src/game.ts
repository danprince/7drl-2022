import { Point, RNG } from "silmarils";
import { Glyph } from "./terminal";
import { Colors } from "./ui";

export class Game {
  level: Level = new Level(this, 0, 0);
  player: Player = new Player();

  constructor() {
  }
}

export class Level {
  game: Game;
  width: number;
  height: number;
  entities: Entity[] = [];
  tiles: (Tile | undefined)[] = [];

  constructor(game: Game, width: number, height: number) {
    this.game = game;
    this.width = width;
    this.height = height;
  }

  setTile(x: number, y: number, tile: Tile | undefined) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.tiles[x + y * this.width] = tile;
      if (tile) tile.level = this;
    }
  }

  getTile(x: number, y: number): Tile | undefined {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      return this.tiles[x + y * this.width];
    } else {
      return;
    }
  }

  addEntity(entity: Entity) {
    this.entities.push(entity);
    entity.level = this;
  }

  removeEntity(entity: Entity) {
    this.entities.splice(this.entities.indexOf(entity), 1);
  }

  getEntitiesAt(x: number, y: number) {
    return this.entities.filter(entity => {
      return entity.pos.x === x && entity.pos.y === y;
    });
  }
}

interface VariantGlyph {
  char: string[];
  fg: number[];
  bg?: number[];
}

function isVariantGlyph(glyph: Glyph | VariantGlyph): glyph is VariantGlyph {
  return Array.isArray(glyph.fg);
}

type TileTypeProps = {
  walkable: TileType["walkable"];
  glyph: TileType["glyph"];
  autotiling?: TileType["autotiling"];
}

export class TileType {
  glyph: Glyph | VariantGlyph;
  autotiling?: string[];
  walkable: boolean;

  constructor(props: TileTypeProps) {
    this.glyph = props.glyph;
    this.autotiling = props.autotiling;
    this.walkable = props.walkable;
  }

  assignGlyph() {
    if (isVariantGlyph(this.glyph)) {
      return {
        char: RNG.element(this.glyph.char),
        fg: RNG.element(this.glyph.fg),
        bg: this.glyph.bg ? RNG.element(this.glyph.bg) : undefined,
      };
    } else {
      return { ...this.glyph };
    }
  }
}

export class Tile {
  level: Level = null!;
  type: TileType;
  glyph: Glyph;

  constructor(type: TileType) {
    this.type = type;
    this.glyph = type.assignGlyph();
  }
}

export class Entity {
  level: Level = null!;
  pos: Point.Point = { x: 0, y: 0 };
  glyph: Glyph = { char: " ", fg: 0 };
}

export class Player extends Entity {
  glyph = { char: "\x10", fg: Colors.White };
}
