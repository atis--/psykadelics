const WHITE = 0xffffff;
const GREEN = 0x81df5b;
const YELLOW = 0xeede22;
const NUMBER_BLUE = 0x69c8da;

export function screenToGrid(xs, ys, world, cellSize) {
  const { x: xw, y: yw } = world.position;
  const xd = xs - xw;
  const yd = ys - yw;
  let x, y;
  if (xd < 0) {
    x = -Math.floor((Math.floor((-2 * xd) / cellSize) + 1) / 2);
    if (x == -0) {
      x = 0;
    }
  } else {
    x = Math.floor((Math.floor((2 * xd) / cellSize) + 1) / 2);
  }
  if (yd < 0) {
    y = -Math.floor((Math.floor((-2 * yd) / cellSize) + 1) / 2);
    if (y == -0) {
      y = 0;
    }
  } else {
    y = Math.floor((Math.floor((2 * yd) / cellSize) + 1) / 2);
  }
  return [x, y];
}

function onesDone(game) {
  return game.state.level + 1 == game.state.ones.length;
}

export function buildGrid(game) {
  const gridGraphics = new PIXI.Graphics();
  const { boardSize, cellSize } = game;
  for (let i = -boardSize; i <= boardSize; i++) {
    for (let j = -boardSize; j <= boardSize; j++) {
      gridGraphics.rect(
        cellSize * (i - 0.5),
        cellSize * (j - 0.5),
        cellSize,
        cellSize
      );
      gridGraphics.fill((i + j) % 2 == 0 ? 0x757575 : 0x606060);
    }
  }
  return gridGraphics;
}

function cellFontStyle(x, y, sumValue, cellSize, next = false) {
  const tileType = (x + y) % 2;

  let fill = NUMBER_BLUE;
  if (sumValue) {
    if (next) {
      fill = GREEN;
    } else {
      fill = tileType == 0 ? 0xa5a5a5 : 0x909090; // shades of gray
    }
  }

  let fontSize = cellSize / (sumValue ? 2.2 : 1.3);
  return new PIXI.TextStyle({
    fontFamily: "ShinyCrystal",
    fontSize,
    fontWeight: "bold",
    letterSpacing: 2,
    fill,
  });
}

function buildCellText(x, y, value, sumValue, cellSize) {
  const txt = new PIXI.Text({
    text: value,
    style: cellFontStyle(x, y, sumValue, cellSize),
  });
  txt.anchor.set(0.5);
  txt.position.set(cellSize * x, cellSize * y - 1);
  return txt;
}

export function markNextMoves(game) {
  const { board, state, cellSize } = game;
  const oneStonesDone = onesDone(game);
  const nextValue = state.seq.length + 2;
  let nextMoveExists = false;
  for (const [location, boardEntry] of Object.entries(board)) {
    if (boardEntry.value > 0) {
      continue; // skip placed values
    }
    const [x, y] = location.split(",").map((n) => +n);
    if (!nextMoveExists && boardEntry.value == -nextValue) {
      nextMoveExists = true;
    }
    boardEntry.txt.style = cellFontStyle(
      x,
      y,
      true,
      cellSize,
      oneStonesDone && boardEntry.value == -nextValue
    );
  }
  return nextMoveExists || !oneStonesDone;
}

const walkaround = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

function isOutside(game, x, y) {
  const { boardSize } = game;
  return x < -boardSize || x > boardSize || y < -boardSize || y > boardSize;
}

function placeSumValues(game, x, y, value) {
  const { board, cellSize, state } = game;
  const newTexts = [];
  for (const [xd, yd] of walkaround) {
    const xw = x + xd;
    const yw = y + yd;
    if (isOutside(game, xw, yw)) {
      continue;
    }

    const location = `${xw},${yw}`;
    const boardEntry = board[location];
    if (boardEntry) {
      // update existing entry if applicable
      if (boardEntry.value < 0) {
        boardEntry.value -= value;
        boardEntry.txt.text = -boardEntry.value;
      }
    } else {
      // create new board entry
      const txt = buildCellText(xw, yw, value, true, cellSize);
      board[location] = { value: -value, txt };
      newTexts.push(txt);
    }
  }
  return newTexts;
}

export function undoMove(game) {
  const { state, board, cellSize } = game;
  if (state.seq.length > 0) {
    const [x, y] = state.seq.pop();
    const undoValue = state.seq.length + 2;
    for (const [xd, yd] of walkaround) {
      const xw = x + xd;
      const yw = y + yd;
      if (isOutside(game, xw, yw)) {
        continue;
      }

      // subtract value from sum
      const location = `${xw},${yw}`;
      const boardEntry = board[location];
      if (boardEntry.value < 0) {
        boardEntry.value += undoValue;
        boardEntry.txt.text = -boardEntry.value;
        if (boardEntry.value == 0) {
          // if value goes up to zero, remove board entry
          boardEntry.txt.destroy();
          delete board[location];
        }
      }
    }

    // set undone stone to its sum value
    const boardEntry = board[`${x},${y}`];
    boardEntry.value = -undoValue;
    boardEntry.txt.style = cellFontStyle(x, y, true, cellSize);
  } else if (state.ones.length > 1) {
    let sumValue = 0;
    const [x, y] = state.ones.pop();
    for (const [xd, yd] of walkaround) {
      const xw = x + xd;
      const yw = y + yd;
      if (isOutside(game, xw, yw)) {
        continue;
      }

      // subtract value from sum
      const location = `${xw},${yw}`;
      const boardEntry = board[location];
      if (boardEntry.value < 0) {
        boardEntry.value += 1;
        boardEntry.txt.text = -boardEntry.value;
        if (boardEntry.value == 0) {
          // if value goes up to zero, remove board entry
          boardEntry.txt.destroy();
          delete board[location];
        }
      } else {
        sumValue += boardEntry.value;
      }
    }

    // remove stone from board or replace with sum value
    const location = `${x},${y}`;
    const boardEntry = board[location];
    if (sumValue == 0) {
      boardEntry.txt.destroy();
      delete board[location];
    } else {
      boardEntry.value = -sumValue;
      boardEntry.txt.text = sumValue;
      boardEntry.txt.style = cellFontStyle(x, y, true, cellSize);
    }
  }
}

// -> [placed, [graphics]]
export function placeValue(game, x, y) {
  const { board, state, cellSize } = game;
  const location = `${x},${y}`;
  let boardEntry = board[location];
  if (boardEntry && boardEntry.value > 0) {
    return [false, []]; // location already occupied
  }

  let value;
  if (!onesDone(game)) {
    value = 1;
    state.ones.push([x, y]);
  } else {
    value = state.seq.length + 2;
    if (!boardEntry || boardEntry.value !== -value) {
      return [false, []]; // sum value mismatch
    }
    state.seq.push([x, y]);
  }

  // if board entry exists, update its value and font style
  if (boardEntry) {
    boardEntry.value = value;
    boardEntry.txt.text = value;
    boardEntry.txt.style = cellFontStyle(x, y, false, cellSize);
    const graphics = placeSumValues(game, x, y, value);
    return [true, graphics];
  }

  // create a new board entry
  boardEntry = board[location] = {
    value,
    txt: buildCellText(x, y, value, false, cellSize),
  };
  const graphics = placeSumValues(game, x, y, value);
  graphics.push(boardEntry.txt);
  return [true, graphics];
}

export function ensureInt(n, from, to) {
  if (!Number.isSafeInteger(n)) {
    return from;
  }
  return Math.min(Math.max(from, n), to);
}

export function makeGameFromState(state, cellSize) {
  const graphics = [];
  const game = {
    state: {
      level: state.level,
      ones: [],
      seq: [],
    },
    board: {}, // "1,-2" => { +-value, txt: PIXI.Text }
    boardSize: 50,
    cellSize,
  };
  for (const [x, y] of state.ones) {
    const [placed, g] = placeValue(game, x, y);
    graphics.push(...g);
  }
  for (const [x, y] of state.seq) {
    const [placed, g] = placeValue(game, x, y);
    graphics.push(...g);
  }
  return [game, graphics];
}

export function rebuildGraphics(game) {
  const graphics = [];
  const { board, cellSize } = game;

  for (const [location, boardEntry] of Object.entries(board)) {
    const [x, y] = location.split(",").map((n) => +n);
    boardEntry.txt = buildCellText(
      x,
      y,
      Math.abs(boardEntry.value),
      boardEntry.value < 0,
      cellSize
    );
    graphics.push(boardEntry.txt);
  }

  return graphics;
}

export class Button {
  constructor(parent, text, fn) {
    this.positionFn = null;

    // button container
    const alpha = 0.6;
    this.button = new PIXI.Container();
    this.button.alpha = alpha;

    // button text
    const txt = new PIXI.Text({
      text,
      style: {
        fontFamily: "ubuntu",
        fontSize: 32,
        fontWeight: "bold",
        fill: WHITE,
      },
    });
    txt.anchor.set(0.5);

    // rounded rectangle
    const rect = new PIXI.Graphics();
    function makeRect(active) {
      rect
        .clear()
        .roundRect(0, 0, txt.width + 40, 40, 10)
        .fill(0x389dae); // light blue
      if (active) {
        rect.stroke({ width: 2, color: WHITE });
      }
    }

    // append and position
    makeRect(false);
    this.button.addChild(rect);
    txt.position.set(rect.width / 2, 19);
    this.button.addChild(txt);

    // handle events
    let inside = false;
    this.button.eventMode = "static";
    this.button.on("pointerenter", (event) => {
      inside = true;
      makeRect(true);
      this.button.alpha = 1.0;
    });
    this.button.on("pointerleave", (event) => {
      inside = false;
      makeRect(false);
      this.button.alpha = alpha;
    });
    this.button.on("pointerdown", (event) => {
      makeRect(false);
      this.button.alpha = alpha;
      fn();
    });
    this.button.on("pointerup", (event) => {
      if (inside) {
        makeRect(true);
        this.button.alpha = 1.0;
      }
    });

    parent.addChild(this.button);
  }

  getWidth() {
    return this.button.width;
  }

  getHeight() {
    return this.button.height;
  }

  setPositionFn(fn) {
    this.positionFn = fn;
    this.button.position.set(...this.positionFn());
  }

  handleScreenResize() {
    this.button.position.set(...this.positionFn());
  }
}

export class HintText {
  constructor(app, game, moveExists) {
    this.app = app;
    this.container = new PIXI.Container();
    this.txt = new PIXI.Text({
      text: "Place",
      style: {
        fontFamily: "ubuntu",
        fontSize: 28,
        fontWeight: "bold",
        fill: WHITE,
      },
    });
    this.txt.anchor.y = 1;
    this.container.addChild(this.txt);

    this.numberTxt = new PIXI.Text({
      text: 1,
      style: {
        fontFamily: "ubuntu",
        fontSize: 28,
        fontWeight: "bold",
        fill: NUMBER_BLUE,
      },
    });
    this.numberTxt.anchor.y = 1;
    this.numberTxt.x = this.txt.width + 10;
    this.container.addChild(this.numberTxt);
    this.positionContainer();
    this.app.stage.addChild(this.container);
    this.setHint(game, moveExists);
  }

  positionContainer() {
    const textWidth = this.txt.width + this.numberTxt.width + 10;
    this.container.position.set(
      this.app.screen.width / 2 - textWidth / 2,
      this.app.screen.height - 10
    );
  }

  setHint(game, moveExists) {
    const { state } = game;
    if (moveExists) {
      if (onesDone(game)) {
        this.txt.text = "Place:";
        this.numberTxt.text = state.seq.length + 2;
      } else {
        const remainingOnes = state.level + 1 - state.ones.length;
        this.txt.text =
          remainingOnes == 1 ? "Place" : `Place ${remainingOnes} x`;
        this.numberTxt.text = 1;
      }
    } else {
      this.txt.text = "Game over. Your score:";
      this.numberTxt.text = state.seq.length + 1;
    }
    this.numberTxt.x = this.txt.width + 10;
    this.positionContainer();
  }

  handleScreenResize() {
    this.positionContainer();
  }
}

export class Congratulations {
  constructor(app, text) {
    this.app = app;
    this.hidden = false;
    this.object = this.rect = this.star = this.txt = null;
    this.create();
  }

  create() {
    const { screen } = this.app;
    this.object = new PIXI.Container();
    this.object.renderable = !this.hidden;

    // overlay rectangle
    this.rect = new PIXI.Graphics()
      .rect(0, 0, screen.width, screen.height)
      .fill({ color: 0x000000, alpha: 0.5 });
    this.rect.eventMode = "static";
    this.object.addChild(this.rect);

    // success star
    const starSize = Math.min(screen.width, screen.height) / 4;
    this.star = new PIXI.Graphics()
      .star(screen.width / 2, screen.height / 2, 5, starSize)
      .fill({ color: YELLOW, alpha: 0.8 })
      .stroke({ width: 8, color: GREEN, alpha: 0.5 });
    this.object.addChild(this.star);

    // congrats text
    this.txt = new PIXI.Text({
      text: "Congratulations!",
      style: {
        fontFamily: "ubuntu",
        fontSize: 32,
        fontWeight: "bold",
        fill: WHITE,
        align: "center",
        wordWrap: true,
        wordWrapWidth: 300,
      },
    });
    this.txt.anchor.set(0.5);
    this.txt.x = screen.width / 2;
    this.txt.y = screen.height / 2;
    this.object.addChild(this.txt);

    this.button = new Button(this.object, "Continue", () => {
      this.hide();
    });
    this.button.setPositionFn(() => {
      return [
        this.app.screen.width / 2 - this.button.getWidth() / 2,
        this.app.screen.height - this.button.getHeight() - 50,
      ];
    });

    // add to application stage
    this.app.stage.addChild(this.object);
  }

  setText(message) {
    this.txt.text = message;
  }

  destroy() {
    this.object.destroy({ children: true });
    this.object = this.rect = this.star = this.txt = null;
  }

  resize() {
    this.destroy();
    this.create();
  }

  show() {
    this.hidden = false;
    this.object.renderable = true;
  }

  hide() {
    this.hidden = true;
    this.object.renderable = false;
  }
}
