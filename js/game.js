/* ============================================================
 * game.js — game state, rules, order generation, and matching.
 * All gameplay tunables live in the constants block below.
 * ============================================================ */

/* ---------- Tunables ---------- */
const CANVAS_W = 960;
const CANVAS_H = 600;

const BELT_SPEED     = 50;    // px/sec — keep slow enough that dragging feels easy
const COOKIE_SPACING = 130;   // px between cookie centers on the belt
const COOKIE_RADIUS  = 34;    // px
const ORDER_MIN      = 4;     // smallest order length
const ORDER_MAX      = 6;     // largest order length

// Frosting colors. Add an entry here and a bucket appears automatically.
const FROSTING_COLORS = [
  { id: 'pink',   label: 'Pink',   fill: '#f48fb1', dark: '#d96a96', light: '#ffd1e2' },
  { id: 'blue',   label: 'Blue',   fill: '#7ec3ea', dark: '#5a9fc9', light: '#cdeaf8' },
  { id: 'yellow', label: 'Yellow', fill: '#f7d154', dark: '#d9ad2e', light: '#fdedb3' },
  { id: 'mint',   label: 'Mint',   fill: '#93d8ad', dark: '#67b487', light: '#cdf0da' },
];

const WIN_PAUSE_SEC  = 2.0;   // how long the green check / message lingers
const MISS_PAUSE_SEC = 1.7;   // how long the red X / message lingers

/* Stage progression: plain-icing orders first, then sprinkle orders,
 * then the "congrats, you did it all!" screen. */
const STAGE1_ORDERS  = 5;     // orders before sprinkles unlock
const GAME_ORDERS    = 10;    // total orders to finish the game
const SPRINKLE_SLOTS = 2;     // cookies per stage-2 order that need sprinkles

/* ---------- Layout (shared by hit-testing here and drawing in render.js) ---------- */
const LAYOUT = {
  beltY: 252,            // vertical center of the conveyor belt band
  beltH: 58,             // belt band height
  cookieY: 244,          // vertical center of cookies riding the belt
  spawnX: -COOKIE_RADIUS - 16,            // cookies enter from the LEFT...
  exitX: CANVAS_W + COOKIE_RADIUS + 10,   // ...and travel RIGHT off-screen
  ticket: { y: 14, h: 92 },               // order ticket (width is dynamic)
  counterTop: 330,       // wood counter starts here
  bucketY: 462,          // top of the frosting bucket row
  bucketW: 100,
  bucketH: 110,
  bucketGap: 26,
};

/** Bucket rects, derived from the color list (centered row). */
function getBucketRects() {
  const n = FROSTING_COLORS.length;
  const totalW = n * LAYOUT.bucketW + (n - 1) * LAYOUT.bucketGap;
  const startX = (CANVAS_W - totalW) / 2;
  return FROSTING_COLORS.map((c, i) => ({
    color: c,
    x: startX + i * (LAYOUT.bucketW + LAYOUT.bucketGap),
    y: LAYOUT.bucketY,
    w: LAYOUT.bucketW,
    h: LAYOUT.bucketH,
  }));
}

/** The sprinkle bowl sits just right of the bucket row (stage 2 only). */
function getSprinkleBowlRect() {
  const buckets = getBucketRects();
  const last = buckets[buckets.length - 1];
  return { x: last.x + LAYOUT.bucketW + LAYOUT.bucketGap, y: LAYOUT.bucketY,
           w: LAYOUT.bucketW, h: LAYOUT.bucketH };
}

/** Sprinkles unlock once the first STAGE1_ORDERS orders are done. */
function sprinklesUnlocked() {
  return state.ordersDone >= STAGE1_ORDERS;
}

/* ---------- State ---------- */
const state = {
  phase: 'play',        // 'play' | 'win' | 'miss' | 'gameover' | 'break'
  phaseTimer: 0,        // counts down during win/miss pauses
  order: [],            // array of color objects; index = required slot color
  sprinkleSlots: [],    // booleans per slot: does this cookie need sprinkles?
  cookies: [],          // { slot, x, color, sprinkled, pop, spatula }
  ordersDone: 0,
  message: '',
  messageTimer: 0,
  resultAnim: 0,        // 0..1 scale-in progress for the check / X / overlays
  drag: null,           // { kind:'icing'|'sprinkles', color, x, y } or null
  beltScroll: 0,        // accumulated belt distance, used for stripe animation
};

/* ---------- Order lifecycle ---------- */

/** Generate a fresh random order and feed blank cookies onto the belt.
 *  In the sprinkle stage, SPRINKLE_SLOTS random slots also need sprinkles. */
function newOrder() {
  const n = ORDER_MIN + Math.floor(Math.random() * (ORDER_MAX - ORDER_MIN + 1));
  state.order = Array.from({ length: n }, () =>
    FROSTING_COLORS[Math.floor(Math.random() * FROSTING_COLORS.length)]);
  state.sprinkleSlots = new Array(n).fill(false);
  if (sprinklesUnlocked()) {
    // shuffle slot indices, mark the first few as needing sprinkles
    const slots = Array.from({ length: n }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    slots.slice(0, SPRINKLE_SLOTS).forEach(s => { state.sprinkleSlots[s] = true; });
  }
  spawnCookies();
}

/** (Re)spawn one blank cookie per order slot, queued off the left edge.
 *  Slot 0 leads (rightmost), so cookies arrive in slot order. */
function spawnCookies() {
  state.cookies = state.order.map((_, i) => ({
    slot: i,
    x: LAYOUT.spawnX - i * COOKIE_SPACING,
    color: null,     // null = blank; otherwise the applied frosting color obj
    sprinkled: false,
    pop: 0,          // squash/pop animation timer (counts down)
    spatula: 0,      // spatula flourish timer (counts down)
  }));
}

/** Restart the whole game from order #1 (Play again / Resume). */
function resetGame() {
  state.ordersDone = 0;
  state.phase = 'play';
  state.message = '';
  state.messageTimer = 0;
  state.drag = null;
  newOrder();
}

/* ---------- Win / miss transitions ---------- */

function winOrder() {
  state.phase = 'win';
  state.phaseTimer = WIN_PAUSE_SEC;
  state.resultAnim = 0;
  state.ordersDone++;
  if (state.ordersDone === STAGE1_ORDERS) {
    state.message = "Nice! Let's add some sprinkles!";   // stage 2 unlocked
  } else if (state.ordersDone >= GAME_ORDERS) {
    state.message = 'That was the last order!';          // congrats screen next
  } else {
    state.message = 'Nice job — order complete! Next order!';
  }
  state.messageTimer = WIN_PAUSE_SEC;
  Sfx.ding();
}

function missOrder() {
  state.phase = 'miss';
  state.phaseTimer = MISS_PAUSE_SEC;
  state.resultAnim = 0;
  state.message = 'Try again!';
  state.messageTimer = MISS_PAUSE_SEC;
  Sfx.buzz();
}

/* ---------- Per-frame update ---------- */

function updateGame(dt) {
  // Decay little per-cookie animation timers regardless of phase.
  for (const c of state.cookies) {
    if (c.pop > 0)     c.pop = Math.max(0, c.pop - dt);
    if (c.spatula > 0) c.spatula = Math.max(0, c.spatula - dt);
  }
  if (state.messageTimer > 0) state.messageTimer -= dt;
  state.resultAnim = Math.min(1, state.resultAnim + dt * 4); // check/X scale-in

  if (state.phase === 'play') {
    state.beltScroll += BELT_SPEED * dt;
    for (const c of state.cookies) {
      c.x += BELT_SPEED * dt;
      // MISS: an unfinished cookie (blank, or still missing its required
      // sprinkles) escaped off the end of the belt.
      if (!isCookieComplete(c) && c.x > LAYOUT.exitX) {
        missOrder();
        return;
      }
    }
  } else if (state.phase === 'win' || state.phase === 'miss') {
    // Win/miss pause: belt freezes, then we move on.
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      const won = state.phase === 'win';
      state.message = '';
      state.messageTimer = 0;
      if (won && state.ordersDone >= GAME_ORDERS) {
        state.phase = 'gameover';   // all orders served — congrats screen
        state.resultAnim = 0;
      } else {
        state.phase = 'play';
        if (won) newOrder();    // fresh random order after a win
        else spawnCookies();    // SAME order, fresh blank cookies after a miss
      }
    }
  }
  // 'gameover' and 'break' phases just wait for a button click (main.js).
}

/* ---------- Matching logic ----------
 * Correctness is POSITIONAL: the cookie in belt slot i must receive
 * state.order[i]'s color. Because cookies physically arrive in slot
 * order, frosting them as they pass naturally completes the sequence
 * in order. In the sprinkle stage some slots ALSO need sprinkles, and
 * they only stick to an already-iced cookie (icing first, sprinkles
 * second). A wrong color — or sprinkles on a cookie that shouldn't
 * have them — is an immediate miss; the wrong decoration stays visible
 * during the pause so the mistake reads.
 */

function needsSprinkles(slot) {
  return state.sprinkleSlots[slot] === true;
}

/** Fully done = right color, plus sprinkles if this slot requires them. */
function isCookieComplete(c) {
  return c.color === state.order[c.slot] &&
         (!needsSprinkles(c.slot) || c.sprinkled);
}

function applyFrosting(cookie, color) {
  cookie.color = color;        // show the frosting either way
  cookie.pop = 0.28;           // squash/pop juice
  cookie.spatula = 0.55;       // brief spatula-with-icing flourish

  if (color === state.order[cookie.slot]) {
    Sfx.splat();
    if (state.cookies.every(isCookieComplete)) winOrder();
  } else {
    missOrder();               // wrong color for this slot
  }
}

function applySprinkles(cookie) {
  cookie.sprinkled = true;     // show the sprinkles either way
  cookie.pop = 0.28;

  if (needsSprinkles(cookie.slot)) {
    Sfx.sprinkle();
    if (state.cookies.every(isCookieComplete)) winOrder();
  } else {
    missOrder();               // this slot shouldn't have sprinkles
  }
}

/* ---------- Hit-testing (used by the drag handlers in main.js) ---------- */

/** Bucket under the point, or null. Simple rectangle containment. */
function bucketAt(x, y) {
  return getBucketRects().find(b =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

/** Sprinkle bowl containment test (only active once unlocked). */
function sprinkleBowlAt(x, y) {
  if (!sprinklesUnlocked()) return false;
  const b = getSprinkleBowlRect();
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** On-screen cookie under the point that can accept this drop, or null.
 *  kind 'icing' wants a blank cookie; 'sprinkles' wants an iced one that
 *  has no sprinkles yet (dropping sprinkles on a blank cookie just
 *  fizzles — icing always goes first). Circle test with a slightly
 *  generous radius so drops feel forgiving. */
function cookieAt(x, y, kind) {
  const r = COOKIE_RADIUS + 12;
  return state.cookies.find(c => {
    if (kind === 'icing'     && c.color !== null) return false;
    if (kind === 'sprinkles' && (c.color === null || c.sprinkled)) return false;
    if (c.x < -COOKIE_RADIUS || c.x > CANVAS_W + COOKIE_RADIUS) return false;
    const dx = x - c.x, dy = y - LAYOUT.cookieY;
    return dx * dx + dy * dy <= r * r;
  }) || null;
}

/* ---------- End-of-game overlay buttons ----------
 * Single source of truth for the congrats / break-screen buttons:
 * render.js draws these rects, and main.js routes clicks through
 * handleOverlayClick using the same geometry.
 */
function getOverlayButtons() {
  if (state.phase === 'gameover') {
    return [
      { id: 'again', x: CANVAS_W / 2 - 230, y: 352, w: 210, h: 54, label: 'Play again?' },
      { id: 'break', x: CANVAS_W / 2 + 20,  y: 352, w: 210, h: 54, label: 'Take a break' },
    ];
  }
  if (state.phase === 'break') {
    return [
      { id: 'resume', x: CANVAS_W / 2 - 95, y: 442, w: 190, h: 54, label: 'Resume?' },
    ];
  }
  return [];
}

function handleOverlayClick(x, y) {
  const btn = getOverlayButtons().find(b =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  if (!btn) return;
  if (btn.id === 'break') {
    state.phase = 'break';      // hang up the "closed" sign
    state.resultAnim = 0;
  } else {
    resetGame();                // 'again' and 'resume' both start over
  }
}

/* ----------------------------------------------------------------
 * Future hooks (out of scope for v1 — leave these seams in place):
 *  - difficulty ramp: scale BELT_SPEED / ORDER_MAX off state.ordersDone
 *  - scoring/timers: add to winOrder()
 *  - multiple cookie shapes: add a `shape` field to spawned cookies
 * ---------------------------------------------------------------- */
