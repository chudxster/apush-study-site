window.Modes = window.Modes || {};
// Mini Test: 10 weighted-random Must Know questions, graded like the Practice
// Test, to show what to study next. Shares the Practice Test code.
Modes.minitest = Object.assign(Object.create(Modes.practicetest), {
  name: 'Mini Test', icon: 'target', mini: true, SIZE: 10,
  desc: '10 quick Must Know questions that show you what to study next.'
});
