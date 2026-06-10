# Cookie Decorating Shop 🍪

A cozy browser minigame: blank sugar cookies ride a conveyor belt past your
station, and you drag pastel frosting from the buckets onto each cookie to
match the customer's order — in order!


## How to play
- The **order ticket** at the top shows the required color sequence
  (position 1 → the cookie in belt slot 1, and so on).
- **Drag** frosting from a bucket at the bottom and **drop** it on a blank
  cookie as it rides by.
- Frost every cookie with its slot's color → ding! ✅ New order appears.
- Wrong color, or an unfinished cookie escapes off the end of the belt → ❌
  "Try again!" — the same order resets with fresh blank cookies.
- After 5 orders, **sprinkles** unlock: a rainbow bowl appears next to the
  buckets, and some ticket cookies now need icing first, then sprinkles.
- Complete all 10 orders for the congrats screen — play again, or flip the
  shop's "Closed" sign and take a break.

## Tech
- Vanilla HTML5 + CSS + JS, single `<canvas>`, no frameworks, no build step.
- All art is drawn procedurally (canvas paths/gradients); all SFX are
  synthesized with the Web Audio API. No image or sound files.
- Mouse and touch both work (pointer events).

## Project layout
```
index.html      canvas + script tags
style.css       page chrome / canvas scaling
js/audio.js     synthesized SFX (splat, ding, buzz, pickup) + background music
js/game.js      state, rules, order generation, matching, hit-testing
js/render.js    all procedural drawing
js/main.js      game loop + pointer input
```
Gameplay tunables (belt speed, order length, colors…) are the constants at
the top of `js/game.js`; the visual palette is at the top of `js/render.js`.
