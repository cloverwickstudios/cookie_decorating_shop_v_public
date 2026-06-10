/* ============================================================
 * render.js — every visual in the game, drawn procedurally.
 * No image files: just canvas paths, gradients, and shadows.
 * ============================================================ */

/* ---------- Palette: cozy, warm, storybook ---------- */
const PALETTE = {
  wallTop:     '#fbeedd',
  wallBottom:  '#f3ddc2',
  wainscot:    '#e7c49a',
  woodLight:   '#c98f5a',
  woodMid:     '#b07943',
  woodDark:    '#8a5a2e',
  beltBand:    '#5b5f6e',
  beltStripe:  '#6d7283',
  beltFrame:   '#9aa0b0',
  cookieMid:   '#e3b272',
  cookieEdge:  '#c08f4f',
  cookieSpot:  '#b9854a',
  ticketPaper: '#fffdf6',
  ticketEdge:  '#e8ddc4',
  inkDark:     '#6b4a32',
  good:        '#54b06a',
  bad:         '#e2574f',
  shadow:      'rgba(90, 60, 30, 0.18)',
};

/* Rainbow sprinkle rod colors (drawing only; rules live in game.js). */
const SPRINKLE_COLORS = ['#e2574f', '#f7a23b', '#f7d154', '#54b06a', '#5a9fc9', '#9b6bd6'];

/* ---------- Small drawing helpers ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Springy scale-in used for the check / X pop. */
function easeOutBack(t) {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/** Deterministic pseudo-random stream (so cookie speckles don't flicker). */
function seededRand(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ---------- Scene pieces ---------- */

function drawBackground(ctx, time) {
  // Warm wall
  const wall = ctx.createLinearGradient(0, 0, 0, LAYOUT.counterTop);
  wall.addColorStop(0, PALETTE.wallTop);
  wall.addColorStop(1, PALETTE.wallBottom);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, CANVAS_W, LAYOUT.counterTop);

  // Soft scalloped wallpaper trim along the top
  ctx.fillStyle = 'rgba(244, 143, 177, 0.35)';
  for (let x = 0; x < CANVAS_W; x += 48) {
    ctx.beginPath();
    ctx.arc(x + 24, 0, 22, 0, Math.PI);
    ctx.fill();
  }

  drawShelf(ctx, 28, 138, 178);
  drawShelf(ctx, CANVAS_W - 206, 138, 178);
  drawCustomer(ctx, 868, 196, time);
}

/** A little wall shelf holding pastel candy jars. */
function drawShelf(ctx, x, y, w) {
  // jars first (they sit on the shelf board)
  const jarColors = ['#f48fb1', '#7ec3ea', '#f7d154'];
  const jarW = 34, gap = (w - jarColors.length * jarW) / (jarColors.length + 1);
  jarColors.forEach((col, i) => {
    const jx = x + gap + i * (jarW + gap);
    const jy = y - 40;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';            // glass
    roundRect(ctx, jx, jy, jarW, 40, 8);
    ctx.fill();
    ctx.fillStyle = col;                                  // candy fill
    roundRect(ctx, jx + 4, jy + 14, jarW - 8, 22, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.woodMid;                      // lid
    roundRect(ctx, jx + 2, jy - 6, jarW - 4, 9, 4);
    ctx.fill();
  });
  // shelf board + brackets
  ctx.fillStyle = PALETTE.woodMid;
  roundRect(ctx, x, y, w, 12, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(x + 14, y + 12, 8, 10);
  ctx.fillRect(x + w - 22, y + 12, 8, 10);
}

/* ---------- Customers ----------
 * A rotating cast: a new friend steps up with each new order. The species
 * is picked from orders completed — but during the win celebration the
 * CURRENT customer stays to enjoy their cookies; the next one arrives
 * along with the next ticket. Add an entry here for more customers.
 */
const CUSTOMER_SPECIES = [
  { kind: 'bear',  fur: '#c79a6b', dark: '#a87e51', apron: '#f48fb1' },
  { kind: 'bunny', fur: '#ece4dc', dark: '#f3b8cb', apron: '#7ec3ea' },
  { kind: 'fox',   fur: '#e0823f', dark: '#c2661f', apron: '#93d8ad' },
  { kind: 'puppy', fur: '#d9b380', dark: '#a8825a', apron: '#f7d154' },
];

/** Friendly round customer waiting by the end of the belt. */
function drawCustomer(ctx, x, y, time) {
  const served = state.phase === 'win' ? state.ordersDone - 1 : state.ordersDone;
  const sp = CUSTOMER_SPECIES[Math.max(0, served) % CUSTOMER_SPECIES.length];
  const bob = Math.sin(time * 1.8) * 3;   // gentle idle bob
  ctx.save();
  ctx.translate(x, y + bob);

  // body (lower half hidden behind the belt, drawn later)
  ctx.fillStyle = sp.fur;
  roundRect(ctx, -34, 26, 68, 56, 26);
  ctx.fill();
  ctx.fillStyle = sp.apron;               // little apron bib
  roundRect(ctx, -20, 42, 40, 34, 14);
  ctx.fill();

  // ears that sit BEHIND the head
  if (sp.kind === 'bear') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = sp.fur;
      ctx.beginPath(); ctx.arc(s * 26, -34, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = sp.dark;
      ctx.beginPath(); ctx.arc(s * 26, -34, 6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (sp.kind === 'bunny') {
    for (const s of [-1, 1]) {            // tall upright ears, pink inside
      ctx.save();
      ctx.translate(s * 15, -48);
      ctx.rotate(s * 0.18);
      ctx.fillStyle = sp.fur;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = sp.dark;
      ctx.beginPath(); ctx.ellipse(0, 2, 5, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (sp.kind === 'fox') {
    for (const s of [-1, 1]) {            // pointy triangle ears
      ctx.fillStyle = sp.fur;
      ctx.beginPath();
      ctx.moveTo(s * 10, -32);
      ctx.lineTo(s * 30, -58);
      ctx.lineTo(s * 34, -26);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = sp.dark;
      ctx.beginPath();
      ctx.moveTo(s * 17, -36);
      ctx.lineTo(s * 28, -51);
      ctx.lineTo(s * 30, -32);
      ctx.closePath(); ctx.fill();
    }
  }

  // head
  ctx.fillStyle = sp.fur;
  ctx.beginPath(); ctx.arc(0, -8, 36, 0, Math.PI * 2); ctx.fill();

  // ears that hang IN FRONT of the head (puppy's floppy ones)
  if (sp.kind === 'puppy') {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 30, -22);
      ctx.rotate(s * 0.45);
      ctx.fillStyle = sp.dark;
      ctx.beginPath(); ctx.ellipse(0, 8, 11, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // muzzle (fox gets a white one, like a real fox's chin patch)
  ctx.fillStyle = sp.kind === 'fox' ? '#fff6ec' : '#f0dcbb';
  ctx.beginPath(); ctx.ellipse(0, 3, 17, 13, 0, 0, Math.PI * 2); ctx.fill();

  // face: eyes (happy closed arcs during the win beat!), nose, smile
  ctx.strokeStyle = '#3c2a1c';
  ctx.fillStyle = '#3c2a1c';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (state.phase === 'win') {
    for (const s of [-1, 1]) {            // ^_^ eyes
      ctx.beginPath();
      ctx.arc(s * 13, -12, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.arc(-13, -14, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -14, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  if (sp.kind === 'bunny') {
    // little triangle nose + buck teeth
    ctx.beginPath();
    ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(0, 1);
    ctx.closePath();
    ctx.fillStyle = sp.dark; ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -4, 2, 8, 7, 2); ctx.fill();
  } else {
    ctx.fillStyle = '#3c2a1c';
    ctx.beginPath(); ctx.ellipse(0, -2, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#3c2a1c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 3, 8, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  if (sp.kind === 'puppy') {              // happy little tongue
    ctx.fillStyle = '#f48fb1';
    ctx.beginPath(); ctx.ellipse(0, 12, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  // rosy cheeks
  ctx.fillStyle = 'rgba(244,143,177,0.5)';
  ctx.beginPath(); ctx.arc(-22, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Conveyor belt: framed band with animated stripes and end rollers. */
function drawBelt(ctx) {
  const y = LAYOUT.beltY - LAYOUT.beltH / 2;
  const h = LAYOUT.beltH;

  // support legs
  ctx.fillStyle = PALETTE.beltFrame;
  ctx.fillRect(70, y + h, 16, LAYOUT.counterTop - (y + h));
  ctx.fillRect(CANVAS_W - 86, y + h, 16, LAYOUT.counterTop - (y + h));

  // belt band
  ctx.fillStyle = PALETTE.beltBand;
  roundRect(ctx, -10, y, CANVAS_W + 20, h, 14);
  ctx.fill();

  // moving stripes — offset driven by the same distance cookies travel,
  // so the belt visibly "carries" them.
  ctx.save();
  roundRect(ctx, -10, y, CANVAS_W + 20, h, 14);
  ctx.clip();
  ctx.strokeStyle = PALETTE.beltStripe;
  ctx.lineWidth = 7;
  const spacing = 46;
  const off = state.beltScroll % spacing;
  for (let x = -spacing * 2 + off; x < CANVAS_W + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, y + h + 4);
    ctx.lineTo(x + 18, y - 4);
    ctx.stroke();
  }
  // top/bottom edge shading
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-10, y, CANVAS_W + 20, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(-10, y + h - 6, CANVAS_W + 20, 6);
  ctx.restore();

  // end rollers
  for (const rx of [26, CANVAS_W - 26]) {
    ctx.fillStyle = PALETTE.beltFrame;
    ctx.beginPath();
    ctx.arc(rx, LAYOUT.beltY, h / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.beltBand;
    ctx.beginPath();
    ctx.arc(rx, LAYOUT.beltY, h / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One cookie: tan disc + speckles, optional frosting, slot number tag. */
function drawCookie(ctx, c) {
  const y = LAYOUT.cookieY;
  // squash/pop: briefly scale up then settle (c.pop counts down from 0.28)
  const popT = c.pop > 0 ? c.pop / 0.28 : 0;
  const scale = 1 + Math.sin(popT * Math.PI) * 0.12;

  ctx.save();
  ctx.translate(c.x, y);
  ctx.scale(scale, scale);

  // soft drop shadow onto the belt
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, COOKIE_RADIUS * 0.72, COOKIE_RADIUS * 0.95, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // cookie base: warm radial gradient with a darker baked edge
  const g = ctx.createRadialGradient(-8, -10, 6, 0, 0, COOKIE_RADIUS);
  g.addColorStop(0, '#eec182');
  g.addColorStop(0.75, PALETTE.cookieMid);
  g.addColorStop(1, PALETTE.cookieEdge);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, COOKIE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.cookieSpot;
  ctx.lineWidth = 2;
  ctx.stroke();

  // baked speckles, deterministic per slot so they don't shimmer
  const rnd = seededRand(c.slot + 7);
  ctx.fillStyle = PALETTE.cookieSpot;
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * (COOKIE_RADIUS - 12);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.6 + rnd() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (c.color) drawFrosting(ctx, c.color, COOKIE_RADIUS - 7);
  if (c.sprinkled) drawSprinkleRods(ctx, c.slot * 13 + 5, COOKIE_RADIUS - 12, 14);
  ctx.restore();

  // slot number tag under the belt
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(c.x, LAYOUT.beltY + LAYOUT.beltH / 2 + 16, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.inkDark;
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(c.slot + 1), c.x, LAYOUT.beltY + LAYOUT.beltH / 2 + 17);

  // brief spatula flourish right after frosting
  if (c.spatula > 0 && c.color) drawSpatula(ctx, c.x, y, c.spatula / 0.55, c.color);
}

/** Piped frosting: a ring of bumps around a filled center, plus a gloss. */
function drawFrosting(ctx, color, r) {
  ctx.fillStyle = color.fill;
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);     // center pool
  ctx.fill();
  const bumps = 9;
  for (let i = 0; i < bumps; i++) {          // piped edge bumps
    const a = (i / bumps) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), 7.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = color.dark;              // soft defining edge
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';  // glossy highlight
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.34, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Scatter of little rainbow rods (cookie tops, the bowl, drag visual).
 *  Deterministic via the seed so sprinkles don't shimmer frame to frame. */
function drawSprinkleRods(ctx, seed, radius, count) {
  const rnd = seededRand(seed);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * radius;
    const rot = rnd() * Math.PI;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d * 0.9);
    ctx.rotate(rot);
    ctx.fillStyle = SPRINKLE_COLORS[i % SPRINKLE_COLORS.length];
    roundRect(ctx, -3.4, -1.2, 6.8, 2.4, 1.2);
    ctx.fill();
    ctx.restore();
  }
}

/** Spatula-with-icing flourish: lifts and fades as t goes 1 -> 0. */
function drawSpatula(ctx, x, y, t, color) {
  const lift = (1 - t) * 26;                 // rises away from the cookie
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 2);
  ctx.translate(x + 16, y - 22 - lift);
  ctx.rotate(-0.55 + (1 - t) * 0.25);
  // wooden handle
  ctx.fillStyle = PALETTE.woodMid;
  roundRect(ctx, 8, -5, 38, 10, 5);
  ctx.fill();
  // metal blade
  ctx.fillStyle = '#cfd4dd';
  roundRect(ctx, -26, -8, 36, 16, 8);
  ctx.fill();
  // icing dollop on the blade
  ctx.fillStyle = color.fill;
  ctx.beginPath();
  ctx.ellipse(-14, -8, 12, 7, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

/** Order ticket: pinned card with the required color sequence. */
function drawTicket(ctx) {
  const n = state.order.length;
  const iconR = 15, iconGap = 38;
  const w = Math.max(220, n * iconGap + 56);
  const x = (CANVAS_W - w) / 2;
  const { y, h } = LAYOUT.ticket;

  // paper with soft shadow
  ctx.save();
  ctx.shadowColor = 'rgba(90,60,30,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = PALETTE.ticketPaper;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = PALETTE.ticketEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  // clip at the top
  ctx.fillStyle = PALETTE.woodDark;
  roundRect(ctx, CANVAS_W / 2 - 26, y - 6, 52, 12, 6);
  ctx.fill();

  ctx.fillStyle = PALETTE.inkDark;
  ctx.font = 'bold 15px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ORDER', CANVAS_W / 2, y + 20);

  // the required sequence as a row of mini frosted cookies
  const rowX = CANVAS_W / 2 - ((n - 1) * iconGap) / 2;
  const rowY = y + h - 34;
  const nextSlot = state.cookies.find(c => !isCookieComplete(c)); // first unfinished
  state.order.forEach((color, i) => {
    const ix = rowX + i * iconGap;
    // mini cookie + frosting (+ sprinkles if this slot needs them)
    ctx.fillStyle = PALETTE.cookieMid;
    ctx.beginPath(); ctx.arc(ix, rowY, iconR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.cookieEdge;
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color.fill;
    ctx.beginPath(); ctx.arc(ix, rowY, iconR - 4, 0, Math.PI * 2); ctx.fill();
    if (state.sprinkleSlots[i]) {
      ctx.save();
      ctx.translate(ix, rowY);
      drawSprinkleRods(ctx, i * 31 + 3, iconR - 7, 5);
      ctx.restore();
    }
    // slot number above the icon
    ctx.fillStyle = PALETTE.inkDark;
    ctx.font = '11px Trebuchet MS, sans-serif';
    ctx.fillText(String(i + 1), ix, rowY - iconR - 8);
    // done: small green check under fully finished slots
    const cookie = state.cookies[i];
    if (cookie && isCookieComplete(cookie)) {
      drawCheck(ctx, ix, rowY + iconR + 9, 6, PALETTE.good, 3);
    } else if (state.phase === 'play' && nextSlot && nextSlot.slot === i) {
      // gentle ring marking the next cookie arriving on the belt
      ctx.strokeStyle = 'rgba(107,74,50,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ix, rowY, iconR + 4, 0, Math.PI * 2); ctx.stroke();
    }
  });

  // orders-completed tally, tucked on the ticket corner
  ctx.fillStyle = 'rgba(107,74,50,0.65)';
  ctx.font = '12px Trebuchet MS, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('done: ' + state.ordersDone, x + w - 12, y + 18);
}

function drawCheck(ctx, x, y, size, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x - size * 0.25, y + size * 0.7);
  ctx.lineTo(x + size, y - size * 0.7);
  ctx.stroke();
}

function drawCross(ctx, x, y, size, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

/** Warm wooden counter with plank lines; the player's station. */
function drawCounter(ctx) {
  const top = LAYOUT.counterTop;
  const g = ctx.createLinearGradient(0, top, 0, CANVAS_H);
  g.addColorStop(0, PALETTE.woodLight);
  g.addColorStop(0.5, PALETTE.woodMid);
  g.addColorStop(1, PALETTE.woodDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, CANVAS_W, CANVAS_H - top);

  // counter lip
  ctx.fillStyle = PALETTE.woodDark;
  roundRect(ctx, -6, top - 8, CANVAS_W + 12, 18, 8);
  ctx.fill();

  // plank seams + a little grain
  ctx.strokeStyle = 'rgba(90,55,25,0.30)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const py = top + 10 + i * ((CANVAS_H - top) / 5);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(CANVAS_W, py); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,235,205,0.12)';
  for (let i = 0; i < 5; i++) {
    const py = top + 28 + i * ((CANVAS_H - top) / 5);
    ctx.beginPath(); ctx.moveTo(40 + i * 180, py); ctx.lineTo(150 + i * 180, py); ctx.stroke();
  }
}

/** Frosting buckets: rounded tinted tubs with a swirled surface. */
function drawBuckets(ctx) {
  for (const b of getBucketRects()) {
    const col = b.color;
    // soft shadow on the counter
    ctx.fillStyle = 'rgba(60,35,15,0.30)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h - 4, b.w * 0.52, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // tub body, slightly tapered
    const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    g.addColorStop(0, col.light);
    g.addColorStop(0.5, '#fffaf2');
    g.addColorStop(1, col.light);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x + 6, b.y + 18);
    ctx.lineTo(b.x + b.w - 6, b.y + 18);
    ctx.lineTo(b.x + b.w - 14, b.y + b.h - 6);
    ctx.quadraticCurveTo(b.x + b.w / 2, b.y + b.h + 4, b.x + 14, b.y + b.h - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // frosting surface with a piped swirl peak
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + 18, b.w / 2 - 5, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + 10, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2 + 4, b.y + 2, 9, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';   // gloss
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2 - 14, b.y + 14, 12, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // label
    ctx.fillStyle = PALETTE.inkDark;
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(col.label, b.x + b.w / 2, b.y + b.h - 24);
  }
  if (sprinklesUnlocked()) drawSprinkleBowl(ctx);
}

/** Bowl of rainbow sprinkles, appears beside the buckets in stage 2. */
function drawSprinkleBowl(ctx) {
  const b = getSprinkleBowlRect();
  const cx = b.x + b.w / 2;
  // shadow
  ctx.fillStyle = 'rgba(60,35,15,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, b.y + b.h - 4, b.w * 0.52, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // sugar mound peeking over the rim (behind the bowl)
  ctx.fillStyle = '#fff6ec';
  ctx.beginPath();
  ctx.ellipse(cx, b.y + 34, b.w / 2 - 12, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, b.y + 28);
  drawSprinkleRods(ctx, 99, b.w / 2 - 18, 16);
  ctx.restore();
  // ceramic bowl
  const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
  g.addColorStop(0, '#fde8f0');
  g.addColorStop(0.5, '#fffaf5');
  g.addColorStop(1, '#fde8f0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(b.x + 2, b.y + 42);
  ctx.quadraticCurveTo(b.x + 8, b.y + b.h - 2, cx, b.y + b.h - 2);
  ctx.quadraticCurveTo(b.x + b.w - 8, b.y + b.h - 2, b.x + b.w - 2, b.y + 42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e3a8c0';
  ctx.lineWidth = 2;
  ctx.stroke();
  // rim stripe
  ctx.fillStyle = '#f48fb1';
  roundRect(ctx, b.x + 2, b.y + 38, b.w - 4, 9, 4);
  ctx.fill();
  // label
  ctx.fillStyle = PALETTE.inkDark;
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sprinkles', cx, b.y + b.h - 24);
}

/** Frosting blob (or pinch of sprinkles) riding the cursor while dragging. */
function drawDrag(ctx) {
  const d = state.drag;
  if (!d) return;
  if (d.kind === 'sprinkles') {
    // a little spoonful of sprinkles
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = '#cfd4dd';                 // spoon bowl
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.woodMid;           // handle
    ctx.save();
    ctx.rotate(-0.2);
    roundRect(ctx, 14, -4, 34, 8, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff6ec';                 // sugar heap
    ctx.beginPath();
    ctx.ellipse(-2, -4, 13, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    drawSprinkleRods(ctx, 47, 11, 8);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(d.x, d.y);
  // small spatula under the blob, angled like it's carrying it
  ctx.rotate(-0.3);
  ctx.fillStyle = PALETTE.woodMid;
  roundRect(ctx, 10, 2, 34, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#cfd4dd';
  roundRect(ctx, -22, -2, 34, 13, 7);
  ctx.fill();
  ctx.rotate(0.3);
  // wobbly frosting dollop
  ctx.fillStyle = d.color.fill;
  ctx.beginPath();
  ctx.ellipse(-6, -8, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2, -18, 9, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-11, -12, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Message banner + the big animated check / X result mark. */
function drawFeedback(ctx) {
  if (state.messageTimer > 0 && state.message) {
    const isGood = state.phase === 'win';
    ctx.save();
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    const tw = ctx.measureText(state.message).width;
    const bx = CANVAS_W / 2, by = 408;
    ctx.fillStyle = 'rgba(255, 253, 246, 0.95)';
    roundRect(ctx, bx - tw / 2 - 22, by - 22, tw + 44, 44, 22);
    ctx.fill();
    ctx.strokeStyle = isGood ? PALETTE.good : PALETTE.bad;
    ctx.lineWidth = 3;
    roundRect(ctx, bx - tw / 2 - 22, by - 22, tw + 44, 44, 22);
    ctx.stroke();
    ctx.fillStyle = isGood ? PALETTE.good : PALETTE.bad;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.message, bx, by + 1);
    ctx.restore();
  }

  // big result mark scaling in over the ticket
  if (state.phase === 'win' || state.phase === 'miss') {
    const t = easeOutBack(Math.min(1, state.resultAnim));
    const cx = CANVAS_W / 2;
    const cy = LAYOUT.ticket.y + LAYOUT.ticket.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(t, t);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = state.phase === 'win' ? PALETTE.good : PALETTE.bad;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    if (state.phase === 'win') drawCheck(ctx, 0, 0, 14, '#ffffff', 6);
    else drawCross(ctx, 0, 0, 12, '#ffffff', 6);
    ctx.restore();
  }
}

/** Shared rounded button used by both end-of-game overlays. */
function drawOverlayButton(ctx, b, fillColor) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = fillColor;
  roundRect(ctx, b.x, b.y, b.w, b.h, 27);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 24);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 21px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
}

/** "Congrats — all orders done!" panel with Play again / Take a break. */
function drawGameOver(ctx) {
  ctx.fillStyle = 'rgba(60, 40, 30, 0.45)';          // dim the shop
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const t = easeOutBack(Math.min(1, state.resultAnim));
  ctx.save();
  ctx.translate(CANVAS_W / 2, 250);
  ctx.scale(t, t);
  ctx.translate(-CANVAS_W / 2, -250);

  // panel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = PALETTE.ticketPaper;
  roundRect(ctx, CANVAS_W / 2 - 280, 130, 560, 300, 22);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f48fb1';
  ctx.lineWidth = 4;
  roundRect(ctx, CANVAS_W / 2 - 280, 130, 560, 300, 22);
  ctx.stroke();

  // festive confetti sprinkles along the panel top
  ctx.save();
  ctx.translate(CANVAS_W / 2, 168);
  drawSprinkleRods(ctx, 21, 240, 18);
  ctx.restore();

  ctx.fillStyle = PALETTE.inkDark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px Trebuchet MS, sans-serif';
  ctx.fillText('Congrats!', CANVAS_W / 2, 226);
  ctx.font = '22px Trebuchet MS, sans-serif';
  ctx.fillText('You completed all ' + GAME_ORDERS + ' orders!', CANVAS_W / 2, 276);
  ctx.font = '16px Trebuchet MS, sans-serif';
  ctx.fillStyle = 'rgba(107,74,50,0.7)';
  ctx.fillText('Every customer went home happy', CANVAS_W / 2, 308);

  const btns = getOverlayButtons();
  drawOverlayButton(ctx, btns[0], PALETTE.good);     // Play again?
  drawOverlayButton(ctx, btns[1], PALETTE.woodMid);  // Take a break
  ctx.restore();
}

/** Semi-transparent "CLOSED" sign at a slight diagonal, plus Resume. */
function drawBreak(ctx) {
  ctx.fillStyle = 'rgba(45, 30, 22, 0.55)';          // dim the shop more
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const t = easeOutBack(Math.min(1, state.resultAnim));
  ctx.save();
  ctx.translate(CANVAS_W / 2, 270);
  ctx.scale(t, t);
  ctx.rotate(-0.07);                                 // the slight diagonal

  // hanging string + nail
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-60, -160); ctx.lineTo(0, -118);
  ctx.moveTo(60, -160);  ctx.lineTo(0, -118);
  ctx.stroke();
  ctx.fillStyle = '#cfd4dd';
  ctx.beginPath(); ctx.arc(0, -160, 5, 0, Math.PI * 2); ctx.fill();

  // the sign itself, semi-transparent
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = PALETTE.ticketPaper;
  roundRect(ctx, -230, -118, 460, 230, 18);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.woodDark;
  ctx.lineWidth = 8;
  roundRect(ctx, -230, -118, 460, 230, 18);
  ctx.stroke();

  ctx.fillStyle = PALETTE.bad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px Trebuchet MS, sans-serif';
  ctx.fillText('CLOSED', 0, -40);
  ctx.fillStyle = PALETTE.inkDark;
  ctx.font = '24px Trebuchet MS, sans-serif';
  ctx.fillText('taking a break — be back soon!', 0, 40);
  ctx.restore();

  // resume button (drawn unrotated so its hitbox is a plain rect)
  const btn = getOverlayButtons()[0];
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.resultAnim);
  drawOverlayButton(ctx, btn, PALETTE.good);
  ctx.restore();
}

/* ---------- Frame entry point ---------- */

function drawFrame(ctx, time) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground(ctx, time);   // wall, shelves, customer (behind the belt)
  drawTicket(ctx);
  drawBelt(ctx);
  for (const c of state.cookies) drawCookie(ctx, c);
  drawCounter(ctx);
  drawBuckets(ctx);
  drawFeedback(ctx);
  drawDrag(ctx);               // dragged frosting rides on top of the shop
  if (state.phase === 'gameover') drawGameOver(ctx);
  else if (state.phase === 'break') drawBreak(ctx);
}
