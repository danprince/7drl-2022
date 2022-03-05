import { Terminal } from "./terminal";
import { View, Colors } from "./ui";

export class GameView extends View {
  render(terminal: Terminal) {
    let box = terminal.child(10, 10, 20, 10);
    box.write(0, 0, `Testing {3}`);
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "G":
        this.ui.open(new GlyphPickerView());
        return true;
      default:
        return false;
    }
  }
}

export class GlyphPickerView extends View {
  activeColor = Colors.White;
  activeChar = "\x00"

  render(terminal: Terminal) {
    terminal = terminal.child(5, 5, 30, 30);

    let dialog = terminal.child(0, 0, 18, 18);
    dialog.box(0, 0, dialog.width, dialog.height, Colors.Grey2);
    let selectedChar = this.activeChar;

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        let active  = dialog.isPointerOver(x + 1, y + 1);
        let index = x + y * 16;
        let char = String.fromCharCode(index);
        let fg = active ? Colors.White : Colors.Grey3;
        let bg = Colors.Black;
        dialog.put(x + 1, y + 1, char, fg, bg);

        if (active && dialog.isPointerDown()) {
          this.activeChar = char;
        } else if (active) {
          selectedChar = char;
        }
      }
    }

    let hex = selectedChar.charCodeAt(0).toString(16).padStart(2, "0");
    dialog.print(1, 0, hex, Colors.Grey4, 0);

    let palette = terminal.child(18, 0, 6, 10);
    palette.box(0, 0, palette.width, palette.height, Colors.Grey2);
    let selectedColor = this.activeColor;

    for (let color = 0; color < 32; color++) {
      let x = 1 + color % 4;
      let y = 1 + color / 4 | 0;
      let active = palette.isPointerOver(x, y);

      if (active && palette.isPointerDown()) {
        this.activeColor = color;
      } else if (active) {
        selectedColor = color;
      }

      let char = selectedColor === color ? "\x7f" : " ";
      palette.put(x, y, " ", Colors.Black, color);
      palette.put(x, y, char, Colors.White);
    }

    let colorIndex = selectedColor.toString().padStart(2, "0");
    palette.print(1, 0, colorIndex, Colors.White, 0);

    let preview = terminal.child(19, 11, 1, 1);
    preview.frame(Colors.Grey2);
    preview.put(0, 0, this.activeChar, this.activeColor);

    let tilePreview = terminal.child(19, 14, 3, 3);
    tilePreview.frame(Colors.Grey2);

    for (let i = 0; i < tilePreview.width; i++) {
      for (let j = 0; j < tilePreview.height; j++) {
        tilePreview.put(i, j, this.activeChar, this.activeColor);
      }
    }
  }

  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        this.ui.close(this);
        return true;
      default:
        return false;
    }
  }
}
