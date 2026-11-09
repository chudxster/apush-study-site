// Template for a unit data file. Copy to data/<unit-id>.js, rename the key
// below, and register the unit in data/units.js (with its subject id).
// Not loaded by the site.
window.UNIT_DATA = window.UNIT_DATA || {};
window.UNIT_DATA["unit-id"] = {
  items: [
    {
      id: "001",                  // unique within this file
      kind: "concept",            // concept | person | event | law (anything else is fine too)
      topics: ["vocab"],          // topic ids from the subject in data/subjects.js
      term: "Photosynthesis",
      def: "Process where plants turn light, water and CO2 into glucose and oxygen.",
      detail: "Happens in the chloroplasts.",  // optional extra fact
      aliases: [],                // optional other accepted answers for typed recall
      rel: "must",                // must | good | niche
      weight: 8,                  // 1-10: how likely it is to be on a test
      qs: ["Which process in chloroplasts produces glucose and oxygen?"], // optional extra quiz questions
      chapter: 1,                 // optional: enables the chapter filter / labels
      page: 12,                   // optional
      year: null                  // optional: dated items enable Timeline Order
    }
  ],
  causeEffect: [],  // optional: { id, cause, effect, why, chapter }
  frq: []           // optional: { id, prompt, points: [...], chapter }
};
