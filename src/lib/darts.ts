// Dart scoring engine: 501 and Cricket.
// Pure functions — all state transitions are deterministic and replayable.

export type Multiplier = 0 | 1 | 2 | 3;
export type Dart = { segment: number; multiplier: Multiplier };
export type FinishRule = "straight" | "double" | "master" | "both";
export type Side = "a" | "b";

export const dartPoints = (d: Dart) => d.segment * d.multiplier;

export const dartLabel = (d: Dart) => {
  if (d.multiplier === 0 || d.segment === 0) return "Miss";
  if (d.segment === 25) return d.multiplier === 2 ? "Bullseye" : "Bull";
  return `${d.multiplier === 3 ? "T" : d.multiplier === 2 ? "D" : ""}${d.segment}`;
};

// ---------------- 501 ----------------

export type OhOneState = {
  kind: "501";
  remaining: Record<Side, number>;
  openedIn: Record<Side, boolean>;
  turn: Side;
  darts: Dart[]; // darts thrown in the current turn
  turnNumber: number;
  winner: Side | null;
  lastEvent: string | null;
};

export const newOhOne = (doubleIn: boolean): OhOneState => ({
  kind: "501",
  remaining: { a: 501, b: 501 },
  openedIn: { a: !doubleIn, b: !doubleIn },
  turn: "a",
  darts: [],
  turnNumber: 1,
  winner: null,
  lastEvent: null,
});

const isDouble = (d: Dart) => d.multiplier === 2;
const isTriple = (d: Dart) => d.multiplier === 3;

function validFinish(d: Dart, rule: FinishRule) {
  if (rule === "straight") return true;
  if (rule === "double") return isDouble(d);
  if (rule === "master") return isDouble(d) || isTriple(d);
  return isDouble(d) || isTriple(d); // "both" — double or master out
}

export type ThrowOutcome = {
  state: OhOneState;
  busted: boolean;
  won: boolean;
  remainingAfter: number;
  turnEnded: boolean;
};

export function throwOhOne(
  state: OhOneState,
  dart: Dart,
  opts: { doubleIn: boolean; finishRule: FinishRule },
): ThrowOutcome {
  const side = state.turn;
  const s: OhOneState = {
    ...state,
    remaining: { ...state.remaining },
    openedIn: { ...state.openedIn },
    darts: [...state.darts, dart],
  };
  const before = state.remaining[side];
  let busted = false;
  let won = false;

  if (!s.openedIn[side]) {
    // Must open on a double
    if (isDouble(dart)) {
      s.openedIn[side] = true;
      s.remaining[side] = before - dartPoints(dart);
      s.lastEvent = "Opened in";
    } else {
      s.lastEvent = "Needs a double to start";
    }
  } else {
    const after = before - dartPoints(dart);
    if (after < 0) {
      busted = true;
    } else if (after === 0) {
      if (validFinish(dart, opts.finishRule)) {
        won = true;
        s.remaining[side] = 0;
        s.winner = side;
      } else {
        busted = true;
      }
    } else if (after === 1 && opts.finishRule !== "straight") {
      busted = true; // cannot finish on 1 when a double/master out is required
    } else {
      s.remaining[side] = after;
    }
  }

  if (busted) {
    s.remaining[side] = before;
    s.lastEvent = "Bust";
  }

  const turnEnded = won ? false : busted || s.darts.length === 3;
  if (turnEnded) {
    s.turn = side === "a" ? "b" : "a";
    s.darts = [];
    s.turnNumber = state.turnNumber + 1;
  }

  return { state: s, busted, won, remainingAfter: s.remaining[side], turnEnded };
}

// ---------------- Cricket ----------------

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25] as const;
export type CricketNumber = (typeof CRICKET_NUMBERS)[number];

export type CricketState = {
  kind: "Cricket";
  marks: Record<Side, Record<number, number>>;
  score: Record<Side, number>;
  turn: Side;
  darts: Dart[];
  turnNumber: number;
  winner: Side | null;
  lastEvent: string | null;
};

const emptyMarks = () =>
  CRICKET_NUMBERS.reduce<Record<number, number>>((acc, n) => ((acc[n] = 0), acc), {});

export const newCricket = (): CricketState => ({
  kind: "Cricket",
  marks: { a: emptyMarks(), b: emptyMarks() },
  score: { a: 0, b: 0 },
  turn: "a",
  darts: [],
  turnNumber: 1,
  winner: null,
  lastEvent: null,
});

export const isClosed = (s: CricketState, side: Side, n: number) => (s.marks[side][n] ?? 0) >= 3;
const bothClosed = (s: CricketState, n: number) => isClosed(s, "a", n) && isClosed(s, "b", n);

export function allClosed(s: CricketState, side: Side) {
  return CRICKET_NUMBERS.every((n) => isClosed(s, side, n));
}

export function throwCricket(state: CricketState, dart: Dart) {
  const side = state.turn;
  const other: Side = side === "a" ? "b" : "a";
  const s: CricketState = {
    ...state,
    marks: { a: { ...state.marks.a }, b: { ...state.marks.b } },
    score: { ...state.score },
    darts: [...state.darts, dart],
  };

  const n = dart.segment;
  const hits = dart.multiplier;
  const scoring = (CRICKET_NUMBERS as readonly number[]).includes(n) && hits > 0;

  if (!scoring) {
    s.lastEvent = "No score";
  } else {
    const capped = n === 25 ? Math.min(hits, 2) : hits;
    let remainingHits = capped;
    const need = 3 - (s.marks[side][n] ?? 0);
    const toMark = Math.min(need, remainingHits);
    s.marks[side][n] = (s.marks[side][n] ?? 0) + toMark;
    remainingHits -= toMark;
    if (remainingHits > 0 && !isClosed(s, other, n)) {
      s.score[side] += remainingHits * n;
    }
    s.lastEvent = `${dartLabel(dart)}`;
  }

  const closedAll = allClosed(s, side);
  const won = closedAll && s.score[side] >= s.score[other];
  if (won) s.winner = side;

  const turnEnded = won ? false : s.darts.length === 3;
  if (turnEnded) {
    s.turn = other;
    s.darts = [];
    s.turnNumber = state.turnNumber + 1;
  }

  return { state: s, won, turnEnded, busted: false, remainingAfter: s.score[side] };
}

export type GameState = OhOneState | CricketState;

// Suppress unused warning for helper used by UI consumers.
export const cricketNumberClosedByBoth = bothClosed;
