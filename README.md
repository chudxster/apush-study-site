# APUSH Study

A study site for AP U.S. History, with flashcards, quizzes, matching, typed recall, timeline ordering, and cause/effect + FRQ practice.

**Live:** https://chudxster.github.io/apush-study-site/

## How it works
Pick a **Unit** (name, years, pages), then **one or more Topics**, then a **Method**:

- **Topics:** Vocab (with a Laws & Acts filter), Events, People, Economy, Culture & Society, Themes & Cause/Effect, Good for Essays, Everything. Select several to study them together.
- **Methods:** Necessities · Flashcards · Quiz · Matching · Learn / Write · Timeline Order · Cause & Effect / FRQ
- **Practice Test** (unit page): every Must Know term + a few extra terms (default 5, adjustable), with the extras picked by how likely they are to appear on a test. No feedback until the end. You get two scores: Raw % and Weighted % (Must Know ×7, Good to Know ×5, Niche ×3).
- **Necessities:** 7.5 minutes of Easy flashcards on the Must Know terms (plus class-calendar vocab), then a 20-question test
- **Relevancy (which terms):** Must Know (what everyone should know and what will be on the test) · Good to Know (includes all class-calendar vocab) · Niche (everything) · Expansive (6 rounds: Must Know ×2 → Good to Know ×2 → Everything ×2)
- **Question bank:** ~860 quiz questions. Every term has its definition question plus extra written questions (Must Know 3, Good to Know 2, Niche 1).
- **Background:** cursor warp, warp radius, parallax and slow movement are all adjustable in Settings.
- **Difficulty (how you're tested):** Easy · Medium · Hard · Adaptive (levels up after 3 right in a row, down after 2 misses)
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
