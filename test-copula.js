// Test copula et/de insertion logic
const fs = require('fs');

// Load the engine
const engineCode = fs.readFileSync('/home/user/workspace/arka-translator/engine.js', 'utf8');
const dictData = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/dictionary.json', 'utf8'));
const sentenceData = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/sentence_memory.json', 'utf8'));
const greetingsData = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/greetings.json', 'utf8'));

// Quick eval to get the class
global.window = global;
eval(engineCode);

const engine = new ArkaEngine(dictData, sentenceData, greetingsData);

// Test cases
const tests = [
  // === COPULA INSERTION (et) ===
  { input: '猫は美しい', expectContains: 'et', expectPattern: /ket\s+et\s+fiiyu/, desc: '猫は美しい → ket et fiiyu' },
  { input: '空は青い', expectContains: 'et', desc: '空は青い → N et ADJ (i-adj)' },
  { input: '花は綺麗だ', expectContains: 'et', desc: '花は綺麗だ → N et ADJ (na-adj + da)' },
  { input: '花は綺麗です', expectContains: 'et', desc: '花は綺麗です → N et ADJ (na-adj + desu)' },
  { input: '彼は先生だ', expectContains: 'et', desc: '彼は先生だ → N et N (noun + copula)' },
  { input: '彼は先生です', expectContains: 'et', desc: '彼は先生です → N et N (noun + copula polite)' },

  // === NEGATIVE COPULA (de) ===
  { input: '猫は美しくない', expectContains: 'de', desc: '猫は美しくない → N de ADJ (neg i-adj)' },
  { input: '彼は先生ではない', expectContains: 'de', desc: '彼は先生ではない → N de N (neg copula)' },
  { input: '彼は先生じゃない', expectContains: 'de', desc: '彼は先生じゃない → N de N (neg copula casual)' },

  // === VERB SENTENCES (NO copula) ===
  { input: '猫は走る', expectNotContains: 'et', desc: '猫は走る → no et (verb)' },
  { input: '猫は食べている', expectNotContains: 'et', desc: '猫は食べている → no et (verb progressive)' },
  { input: '彼は歩いた', expectNotContains: 'et', desc: '彼は歩いた → no et (verb past)' },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const result = engine.translateJapaneseToArka(t.input);
    const translation = result.translation;
    let ok = true;
    let reason = '';

    if (t.expectContains && !translation.includes(t.expectContains)) {
      ok = false;
      reason = `Expected '${t.expectContains}' in output`;
    }
    if (t.expectNotContains && translation.includes(` ${t.expectNotContains} `)) {
      ok = false;
      reason = `Did NOT expect '${t.expectNotContains}' in output`;
    }
    if (t.expectPattern && !t.expectPattern.test(translation)) {
      ok = false;
      reason = `Pattern ${t.expectPattern} not matched`;
    }

    if (ok) {
      console.log(`✓ ${t.desc}`);
      console.log(`  → ${translation}`);
      passed++;
    } else {
      console.log(`✗ ${t.desc}`);
      console.log(`  → ${translation}`);
      console.log(`  FAIL: ${reason}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${t.desc}`);
    console.log(`  ERROR: ${e.message}`);
    failed++;
  }
}

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);
