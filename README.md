# APUSH Study

A study site for AP U.S. History, with flashcards, quizzes, matching, typed recall, timeline ordering, and cause/effect + FRQ practice.

**Live:** https://chudxster.github.io/apush-study-site/

## How it works
Pick a **Unit** (name, years, pages), then a **Topic**, then a **Method**:

- **Topics:** Vocab (with a Laws & Acts filter), Events, People, Economy, Culture & Society, Themes & Cause/Effect, Everything
- **Methods:** Necessities · Flashcards · Quiz · Matching · Learn / Write · Timeline Order · Cause & Effect / FRQ
- **Necessities:** 5 minutes of Easy flashcards on the must-know items, then a 15-question test on them
- **Difficulty:** Easy (must-know only) · Medium (+ supporting details) · Hard (everything) · Adaptive (levels up after 3 right in a row, down after 2 misses)
- **Study sessions:** before you start, pick a study time and a break time (15 / 5 recommended). An alarm rings at the end of each study block and each break.

Pick your highlight color with the gear in the top right. The whole palette is built from that one color. Your color, mastery and best scores are saved in your browser.

## Units
| Unit | Years | Pages |
|---|---|---|
| Boom to Bust (Ch. 30–31) | 1920–1939 | pp. 705–768 |

## Run locally
There's no build step. Open `index.html` in a browser.

## Adding a unit
1. Add an entry to `data/units.js`.
2. Create `data/<unit-id>.js` that sets `window.UNIT_DATA["<unit-id>"] = { items, causeEffect, frq }` (see `data/boom-to-bust.js` for the schema).
3. Add a `<script>` tag for it in `index.html`.
