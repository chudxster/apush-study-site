# APUSH Study

A study site for AP U.S. History, with flashcards, quizzes, matching, typed recall, timeline ordering, and cause/effect + FRQ practice.

**Live:** https://chudxster.github.io/apush-study-site/

## How it works
Pick a **Unit** (name, years, pages), then a **Topic**, then a **Method**:

- **Topics:** Vocab (with a Laws & Acts filter), Events, People, Economy, Culture & Society, Themes & Cause/Effect, Everything
- **Methods:** Flashcards · Quiz · Matching · Learn / Write · Timeline Order · Cause & Effect / FRQ
- **Difficulty:** Easy · Medium · Hard · Adaptive (levels up after 3 right in a row, down after 2 misses)

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
