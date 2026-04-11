const fs = require('fs');
global.window = {};
global.ArkaVariants = { VARIANTS: { shinsee: {} }, postProcessSeiArka: (t) => ({text:t,untranslatable:[]}), postProcessKoArka: (t) => ({text:t,untranslatable:[]}) };
eval(fs.readFileSync('engine.js', 'utf8'));
const ArkaEngine = window.ArkaEngine;
const engine = new ArkaEngine();
engine.dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
engine._buildIndices();
for (const [w, m] of Object.entries(ArkaEngine.GREETINGS)) engine.greetingsMap.set(w, m);
engine.ready = true;

const tests = [
  ['わたしはすごく眠たい', 'an et tinka omo', 'adv+oral adj'],
  ['英恵さん、おはようございます', 'hanae ansoonoyun', '名前+挨拶'],
  ['鈴木様、こんにちは', 'suzuki soonoyun', '様+挨拶'],
  ['猫はとても美しい', 'ket et tiina fiiyu', 'adv+adj'],
  ['私はちょっと悲しい', 'an et dis emt', 'adv+emotion'],
  ['彼女はまだ寂しい', null, 'まだ+adj (check no crash)'],
];

let pass = 0, fail = 0;
for (const [input, expected, desc] of tests) {
  const result = engine.translateJapaneseToArka(input);
  const t = result.translation;
  const bd = result.breakdown.map(b => `${b.original}→${b.root}[${b.type}]`).join(' | ');

  if (expected && t.includes(expected.split(' ')[0]) && !t.includes('[')) {
    // Check no unknown brackets
    const hasUnknown = t.includes('[') && t.includes(']');
    if (!hasUnknown) {
      console.log(`  ✓ ${desc}: "${input}" → "${t}"`);
      pass++;
    } else {
      console.log(`  ✗ ${desc}: "${input}" → "${t}" (has unknown brackets)`);
      console.log(`    breakdown: ${bd}`);
      fail++;
    }
  } else if (!expected) {
    // Just check it doesn't crash and produces something
    console.log(`  ℹ ${desc}: "${input}" → "${t}"`);
    console.log(`    breakdown: ${bd}`);
    pass++;
  } else {
    console.log(`  ✗ ${desc}: "${input}" → "${t}" (expected to contain: ${expected})`);
    console.log(`    breakdown: ${bd}`);
    fail++;
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
