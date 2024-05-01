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

export function buildGrid(game) {
  const gridGraphics = new PIXI.Graphics();
  const size = game.state.size;
  const cellSize = game.cellSize;
  for (let i = -size; i <= size; i++) {
    for (let j = -size; j <= size; j++) {
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

const cachedStyles = {};

function cellFontStyle(x, y, sumValue, cellSize, next = false) {
  const tileType = (x + y) % 2;
  const key = `${sumValue},${tileType},${next}`;
  if (cachedStyles[key]) {
    return cachedStyles[key];
  }
  let fill = 0xffffff;
  if (sumValue) {
    if (next) {
      fill = 0x6cbe4b; // bright green
    } else {
      fill = tileType == 0 ? 0xa5a5a5 : 0x909090; // shades of gray
    }
  }
  return (cachedStyles[key] = new PIXI.TextStyle({
    fontFamily: "ShinyCrystal",
    fontSize: cellSize / (sumValue ? 2.5 : 1.2),
    fontWeight: "bold",
    fill,
  }));
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

function colorNextMove(game) {
  const { board, state, cellSize } = game;
  const oneStonesDone = state.level + 1 == state.ones.length;
  const nextValue = state.seq.length + 2;
  for (const [location, boardEntry] of Object.entries(board)) {
    if (boardEntry.value > 0) {
      continue; // skip placed values
    }
    const [x, y] = location.split(",").map((n) => +n);
    boardEntry.txt.style = cellFontStyle(
      x,
      y,
      true,
      cellSize,
      oneStonesDone && boardEntry.value == -nextValue
    );
  }
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
  const { state } = game;
  return x < -state.size || x > state.size || y < -state.size || y > state.size;
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

function undoMove(game) {
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

    // set undone stone to its sum value & color moves
    const boardEntry = board[`${x},${y}`];
    boardEntry.value = -undoValue;
    colorNextMove(game);
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
    colorNextMove(game);
  }
}

export function placeValue(game, x, y) {
  const { board, state, cellSize } = game;
  const location = `${x},${y}`;
  let boardEntry = board[location];
  if (boardEntry && boardEntry.value > 0) {
    return null; // location already occupied
  }

  let value;
  if (state.ones.length <= state.level) {
    value = 1;
    state.ones.push([x, y]);
  } else {
    value = state.seq.length + 2;
    if (!boardEntry || boardEntry.value !== -value) {
      return null; // sum value mismatch
    }
    state.seq.push([x, y]);
  }

  // if board entry exists, update its value and font style
  if (boardEntry) {
    boardEntry.value = value;
    boardEntry.txt.text = value;
    boardEntry.txt.style = cellFontStyle(x, y, false, cellSize);
    const graphics = placeSumValues(game, x, y, value);
    if (state.level == state.ones.length - 1) {
      colorNextMove(game);
    }
    return graphics.length > 0 ? graphics : null;
  }

  // create a new board entry
  boardEntry = board[location] = {
    value,
    txt: buildCellText(x, y, value, false, cellSize),
  };
  const graphics = placeSumValues(game, x, y, value);
  graphics.push(boardEntry.txt);
  if (state.level == state.ones.length - 1) {
    colorNextMove(game);
  }
  return graphics.length > 0 ? graphics : null;
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

export function addUndoButton(game, stage) {
  let undoBtn = new PIXI.Container();
  undoBtn.position.set(8, 8);

  let undoRect = new PIXI.Graphics()
    .roundRect(0, 0, 120, 40, 10)
    .fill(0x389dae);
  undoBtn.addChild(undoRect);

  const undoTxt = new PIXI.Text({
    text: "Undo",
    style: {
      fontFamily: "ubuntu",
      fontSize: 32,
      fontWeight: "bold",
      fill: 0xffffff,
    },
  });
  undoTxt.anchor.set(0.5);
  undoTxt.position.set(60, 19);
  undoBtn.addChild(undoTxt);

  let inside = false;
  undoBtn.eventMode = "static";
  undoBtn.on("pointerenter", (event) => {
    inside = true;
    undoRect
      .clear()
      .roundRect(0, 0, 120, 40, 10)
      .fill(0x2dbed8)
      .stroke({ width: 2, color: 0xffffff });
  });
  undoBtn.on("pointerleave", (event) => {
    inside = false;
    undoRect.clear().roundRect(0, 0, 120, 40, 10).fill(0x389dae);
  });
  undoBtn.on("pointerdown", (event) => {
    undoRect.clear().roundRect(0, 0, 120, 40, 10).fill(0x389dae);
    undoMove(game);
  });
  undoBtn.on("pointerup", (event) => {
    if (inside) {
      undoRect
        .clear()
        .roundRect(0, 0, 120, 40, 10)
        .fill(0x2dbed8)
        .stroke({ width: 2, color: 0xffffff });
    }
  });

  stage.addChild(undoBtn);
}
