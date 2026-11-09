// Subject registry. To add a subject: add an entry here, then add its units to
// data/units.js with `subject: "<id>"`. See data/_template.js for a unit file.
//
// topics: the topic cards shown on a unit page. Items join a topic through
//   item.topics. 'everything' is special: it always means the whole unit.
//   short = name used when several topics are combined; ce = include the
//   unit's causeEffect / frq prompts when this topic is picked.
// methods (optional): which study methods to offer. Defaults to all of them;
//   methods also hide themselves when the data can't support them (e.g.
//   Timeline needs dated items, Cause & Effect needs causeEffect/frq data).
// chapterLabel (optional): what a unit's sections are called. Default "Ch.".
window.SUBJECTS = [
  {
    id: "apush",
    name: "AP U.S. History",
    short: "APUSH",
    icon: "book",
    blurb: "Flashcards, quizzes, matching, timelines and FRQ practice built from textbook notes.",
    chapterLabel: "Ch.",
    topics: [
      { id: "vocab", name: "Vocab", icon: "book", desc: "Key terms, concepts, laws & acts" },
      { id: "events", name: "Events", icon: "calendar", desc: "What happened, and when", ce: true },
      { id: "people", name: "People", icon: "user", desc: "Who they were and why they matter" },
      { id: "economy", name: "Economy", icon: "chart", desc: "Booms, busts, banks, tariffs, relief", ce: true },
      { id: "culture", name: "Culture & Society", short: "Culture", icon: "music", desc: "Jazz Age, Prohibition, Harlem Renaissance", ce: true },
      { id: "themes", name: "Themes & Cause/Effect", short: "Themes", icon: "link", desc: "Big ideas, connections, FRQ practice", ce: true },
      { id: "essay", name: "Good for Essays", short: "Essay Terms", icon: "pen", desc: "Terms that fit almost any short-answer or essay prompt, each with the themes it supports", ce: true },
      { id: "everything", name: "Everything", icon: "layers", desc: "The whole unit, mixed together", ce: true }
    ]
  }
];

// Topics used by a subject that doesn't list its own.
window.DEFAULT_TOPICS = [
  { id: "vocab", name: "Vocab", icon: "book", desc: "Key terms and concepts" },
  { id: "people", name: "People", icon: "user", desc: "Who they were and why they matter" },
  { id: "everything", name: "Everything", icon: "layers", desc: "The whole unit, mixed together", ce: true }
];
