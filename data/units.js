// Unit registry. To add a unit: add an entry here (with its `subject` id from
// data/subjects.js) and a data/<id>.js file that sets window.UNIT_DATA["<id>"].
// Unit data loads on demand; no script tag needed. Unit ids must be unique
// across all subjects. Only id, subject, name are required; years, pages,
// blurb, chapters, sections and assessment are optional.
window.UNITS = [
  {
    id: "boom-to-bust",
    subject: "apush",
    name: "Boom to Bust",
    years: "1920–1939",
    pages: "pp. 705–768",
    blurb: "The Roaring Twenties, the Crash of 1929, the Great Depression, and FDR's New Deal.",
    chapters: [
      { n: 30, title: "American Life in the “Roaring Twenties”", years: "1920–1932" },
      { n: 31, title: "The Great Depression and the New Deal", years: "1933–1939" }
    ],
    // Reading sections from the class calendar. Items are matched by page,
    // and items whose `key` lists a section are that section's class vocab.
    sections: [
      { id: "oct28", label: "Oct 28", title: "New era & culture wars", from: 705, to: 718, chapters: [30] },
      { id: "nov2", label: "Nov 2", title: "Lost Generation & GOP rule", from: 719, to: 730, chapters: [30] },
      { id: "nov4", label: "Nov 4", title: "Crash, Hoover & the New Deal", from: 730, to: 756, chapters: [30, 31] },
      { id: "nov5", label: "Nov 5", title: "Later New Deal & legacy", from: 756, to: 768, chapters: [31] }
    ],
    assessment: "Nov 9"
  },
  {
    id: "wwii",
    subject: "apush",
    name: "WWII",
    years: "1933–1945",
    pages: "pp. 770–817",
    blurb: "FDR's foreign policy, the road from neutrality to Pearl Harbor, the home front, and Allied victory in Europe and the Pacific.",
    chapters: [
      { n: 32, title: "Franklin D. Roosevelt and the Shadow of War", years: "1933–1941" },
      { n: 33, title: "America in World War II", years: "1941–1945" }
    ]
  }
];
