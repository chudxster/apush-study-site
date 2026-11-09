# Cram

A study site for any class, with flashcards, quizzes, matching, typed recall, timeline ordering, cause/effect + FRQ practice and practice tests. Built from class notes.

**Live:** https://chudxster.github.io/cram/

## How it works
Pick a **Subject**, then a **Unit**, then **one or more Topics**, then a **Method**:

- **Topics** (each subject sets its own; these are APUSH's): Vocab (with a Laws & Acts filter), Events, People, Economy, Culture & Society, Themes & Cause/Effect, Good for Essays, Everything. Select several to study them together.
- **Teach Me** (top of the unit page, the main way to learn): each session teaches a set of related terms from one stretch of history, in time order, shows them on a timeline with their causes and effects, then quizzes them. Every term climbs a ladder (Seen → Recognized → Understood → Mastered), and mastered terms come back for spaced reviews. The **Tree** style has you drag cause → effect links between about 12 linked terms before the quiz.
- **Methods:** Teach Me · Checkpoint Mode · Flashcards · Quiz · Matching · Timeline Order · Cause & Effect / FRQ
- **Checkpoint Mode** (top of the unit page, the main way to study): nonstop short rounds that switch styles (quiz, matching, typed recall, cause & effect) and topics. Every 3 rounds a checkpoint shows your scores, your weakest topics and terms, and lets you change difficulty, relevancy and topics before you continue.
- **Practice Test** (unit page): a short test of 15, 25 or 40 questions (25 by default), about 80% Must Know, with terms picked by how likely they are to appear on a test. No feedback until the end. You get two scores: Raw % and Weighted %. Weighted counts each question by its term's weight. It ends with a **Recommended** list, and every wrong answer explains the right term and what you picked instead.
- **Term weights (1–10):** every term has a weight for how likely it is to be on a real test. It's based on relevancy tier, class calendar, essay usefulness and how often the term appears in the notes, with the biggest terms (FDR, New Deal, the crash, Prohibition…) hand-set to 9–10.
- **Word Bank** (button next to Session): every term with its short definition, plus a search box. **View options** picks the unit (this page's unit, any one unit, or all units), what to show (all terms, unlocked or locked cards, relevance tiers, Teach Me progress), the sort (A–Z, relevance, year, textbook order, weakest first, Teach Me ladder, card rarity, recently unlocked, any of them reversed) and the display (definitions, badges, reveal locked names). Your choices are saved. The **Timeline** view lays every term out in year columns (≈ = year estimated from the textbook page), colored by Teach Me mastery, with the cause → effect tree drawn between them. The **Graph** view shows each term as a small card (name + short definition) connected to the terms it mentions and to its causes and effects; more relevant terms get bigger cards closer to the middle. Zoom out for an overview, zoom in to read the definitions. Drag to move, scroll or pinch to zoom, click a term for its card.
- **Cause & effect questions:** terms are linked by cause and effect, so quizzes ask what caused a term and what it led to.
- **People questions:** wrong answers always hold the same kind of role (a president's question offers only presidents, a justice's only justices, and so on).
- **Relevancy (which terms):** Must Know (what everyone should know and what will be on the test) · Good to Know (includes all class-calendar vocab) · Niche (everything) · Expansive (6 rounds: Must Know ×2 → Good to Know ×2 → Everything ×2)
- **Question bank:** ~860 quiz questions. Every term has its definition question plus extra written questions (Must Know 3, Good to Know 2, Niche 1).
- **Background:** a faint drifting star field with a small meteor about every 15 seconds (it lights up the stars it passes) and a short, slightly brighter meteor shower about every 2 minutes. Cursor warp, warp radius, parallax, slow movement and shooting stars are all adjustable in Settings.
- **Difficulty (how you're tested):** Easy · Medium · Hard · Adaptive (levels up after 3 right in a row, down after 2 misses)
- **Study sessions:** before you start, pick a study time and a break time (15 / 5 recommended). An alarm rings at the end of each study block and each break.

Pick your highlight color with the gear in the top right. The whole palette is built from that one color. Your color, mastery and best scores are saved in your browser.

## Subjects & units
**AP U.S. History**

| Unit | Years | Pages |
|---|---|---|
| Boom to Bust (Ch. 30–31) | 1920–1939 | pp. 705–768 |

## Run locally
There is no build step.

- **Quickest:** double-click `index.html`. It runs straight from the file.
- **Local server (closest to the live site):** in PowerShell, from this folder, run
  `powershell -ExecutionPolicy Bypass -File .\serve.ps1`, then open http://127.0.0.1:8000/. Stop it with Ctrl+C.
  Use `-Port 9000` for a different port. Files are never cached, so after editing just refresh the page.

Progress is saved per address, so local testing never touches your progress on the live site.

## Adding a unit
1. Add an entry to `data/units.js` with its `subject` id.
2. Copy `data/_template.js` to `data/<unit-id>.js` and fill in the items (`data/boom-to-bust.js` is a full example). Unit data loads on demand, so no `<script>` tag is needed.

## Adding a subject
1. Add an entry to `data/subjects.js`: name, short name, blurb, and its topic list (or leave `topics` out to use the default Vocab / People / Everything).
2. Add its units as above.

Study methods hide themselves when a unit's data can't support them: Timeline Order needs dated items, Cause & Effect / FRQ needs `causeEffect` or `frq` entries, and the Laws & Acts filter only shows when items have `kind: "law"`.
