import { Array2D } from "silmarils";
import { Chars } from "./chars";
import { Ability, DamageType, Entity, Stat, Status, Tile } from "./game";
import { glyphToString } from "./helpers";
import { Panel, putDebugDigit, singleLineLength, Terminal } from "./terminal";
import { Colors, View } from "./ui";

type DebuggingRenderer = (terminal: Terminal) => any;

export class ViewportPanel extends Panel {
  static debuggingRenderers: DebuggingRenderer[] = [];

  static addDebuggingRenderer(renderer: DebuggingRenderer) {
    this.debuggingRenderers.push(renderer);
  }

  dijkstraMapsEnabled = false;

  put(terminal: Terminal, x: number, y: number, ch: string, fg: number, bg?: number) {
    terminal.put(
      x + this.bounds.x - terminal.bounds.x,
      y + this.bounds.y - terminal.bounds.y,
      ch,
      fg,
      bg,
    );
  }

  renderPanel(terminal: Terminal) {
    terminal.frame(Colors.Grey1);

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let tile = game.level.getTile(x, y);
        if (tile == null) continue;
        let substance = tile.substance;
        let { char, fg, bg } = tile.glyph;

        if (substance) {
          char = substance.char || char; 
          fg = substance.fg;
          bg = substance.bg;
        }

        terminal.put(x, y, char, fg, bg);
      }
    }

    let focusedEntity: Entity | undefined;

    for (let entity of game.level.entities) {
      let glyph = entity.getStatusGlyph();
      let intentGlyph = entity.getIntentGlyph();

      terminal.put(
        entity.pos.x,
        entity.pos.y,
        glyph.char,
        glyph.fg,
        glyph.bg || Colors.Black
      );

      if (intentGlyph) {
        terminal.putGlyph(
          entity.pos.x,
          entity.pos.y,
          intentGlyph,
        );
      }

      if (terminal.isPointerOver(entity.pos.x, entity.pos.y)) {
        focusedEntity = entity;
      }
    }

    for (let fx of game.level.fx) {
      fx(terminal);
    }

    if (focusedEntity) {
      this.drawEntityPopup(terminal, focusedEntity);
    }

    if (this.dijkstraMapsEnabled) {
      this.drawDijkstraMaps(terminal);
    }

    if (terminal.isKeyDown("Alt")) {
      this.drawShortestPath(terminal);
    }

    for (let renderer of ViewportPanel.debuggingRenderers) {
      renderer(terminal);
    }
  }

  drawShortestPath(terminal: Terminal) {
    let pointer = terminal.getRelativePointerPosition();
    let path = game.level.findShortestPath(game.player.pos, pointer);

    for (let cell of path) {
      terminal.put(cell.x, cell.y, "+", Colors.Green);
    }

    terminal.print(pointer.x + 1, pointer.y, `${pointer.x}, ${pointer.y}`, Colors.White);
  }

  drawDijkstraMaps(terminal: Terminal) {
    let map = game.level.getDijkstraMap(game.player.pos);
    console.log(Array2D.toString(Array2D.map(map.costSoFar, (cost) => isFinite(cost) ? String(cost % 10) : "∞")));

    for (let y = 0; y < game.level.height; y++) {
      for (let x = 0; x < game.level.width; x++) {
        let cost = Array2D.get(map.costSoFar, x, y)!;
        putDebugDigit(terminal, x, y, cost);
      }
    }
  }

  drawEntityPopup(terminal: Terminal, entity: Entity) {
    let text = "";

    if (entity.hp) {
      text += `{31}${Chars.Heart}{1}${entity.hp.current}{/} `;
    }

    text += entity.name;

    if (entity.statuses.length) {
      text += " ";
    }

    for (let status of entity.statuses) {
      text += glyphToString(status.glyph);
    }

    terminal.popup({
      x: Math.floor(terminal.width / 2),
      y: terminal.height,
      text,
      textColor: Colors.Grey4,
      align: "end",
      justify: "center",
    });
  }
}

export class MessagesPanel extends Panel {
  viewport: ViewportPanel;

  constructor(viewport: ViewportPanel, x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
    this.viewport = viewport;
  }

  renderPanel(terminal: Terminal): void {
    let ty = 0;
    let tx = 0;
    let defer = () => {};

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
              this.viewport.put(terminal, part.pos.x, part.pos.y, Chars.Skull, Colors.White);
            } else {
              this.viewport.put(terminal, part.pos.x, part.pos.y - 1, Chars.South, Colors.White);
            }
          }
          tx += 1;
        } else if (part instanceof Tile) {
          terminal.putGlyph(tx, ty, part.glyph);
          if (terminal.isPointerOver(tx, ty)) {
            this.viewport.put(terminal, part.pos.x, part.pos.y - 1, Chars.South, Colors.White);
          }
          tx += 1;
        } else if (part instanceof Status) {
          terminal.putGlyph(tx, ty, part.glyph);

          if (terminal.isPointerOver(tx, ty)) {
            defer = () => terminal.popup({
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
            defer = () => terminal.popup({
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

    defer();
  }
}

export class SidebarPanel extends Panel {
  renderPanel(terminal: Terminal): void {
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
}

export class TopBarPanel extends Panel {
  renderPopup = () => {};
  _x = 0;

  drawHitpointsPopup(terminal: Terminal, x: number, y: number) {
    terminal.popup({
      x,
      y,
      title: "Hitpoints",
      text: "If these run out, the game is over."
    });
  }

  drawStatusPopup(terminal: Terminal, status: Status, x: number, y: number) {
    terminal.popup({
      x,
      y,
      title: status.name,
      text: status.description,
    });
  }

  renderStatusIcons(terminal: Terminal, statuses: Status[]) {
    for (let status of statuses) {
      let turns = String(status.turns);
      let width = 1 + turns.length;
      terminal.putGlyph(this._x, 0, status.glyph);
      terminal.print(this._x + 1, 0, turns, Colors.White);

      if (terminal.isPointerOver(this._x, 0, width, 1)) {
        let px = this._x;
        this.renderPopup = () => this.drawStatusPopup(terminal, status, px, 2);
      }

      this._x += width + 1;
    }
  }

  renderHitpoints(terminal: Terminal, hp: Stat) {
    let _hp = String(hp.current);
    terminal.put(0, 0, Chars.Heart, Colors.Red);
    terminal.print(1, 0, _hp, Colors.White);

    if (terminal.isPointerOver(0, 0, 1 + _hp.length, 1)) {
      this.renderPopup = () => this.drawHitpointsPopup(terminal, 0, 2);
    }

    this._x = _hp.length + 2;
  }

  renderAbility(terminal: Terminal, ability: Ability) {
    let usable = ability.canUse();
    let fg = usable ? ability.glyph.fg : Colors.Grey2;
    let bg = usable ? ability.glyph.bg : Colors.Grey1;

    let x1 = terminal.width - 1;
    let x0 = terminal.width - ability.name.length - 2;
    terminal.put(x1, 0, ability.glyph.char, fg, bg);
    terminal.print(x0, 0, ability.name, fg);

    if (terminal.isPointerOver(x1, 0)) {
      terminal.popup({
        x: x1,
        y: 1,
        align: "start",
        justify: "end",
        text: ability.description,
      });
    }
  }

  renderPanel(terminal: Terminal): void {
    let { hp, ability, statuses } = game.player;

    this.renderPopup = () => {};

    this.renderHitpoints(terminal, hp);

    if (statuses.length) {
      this.renderStatusIcons(terminal, statuses);
    }

    if (ability) {
      this.renderAbility(terminal, ability);
    }

    this.renderPopup();
  }
}
