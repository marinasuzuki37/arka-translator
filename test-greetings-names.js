// Test: Greeting mappings + Name+Honorific detection
// Run: node test-greetings-names.js

const fs = require('fs');

// Mock DOM environment for engine.js
global.window = {};
global.ArkaVariants = { VARIANTS: { shinsee: {} }, postProcessSeiArka: (t) => ({text:t,untranslatable:[]}), postProcessKoArka: (t) => ({text:t,untranslatable:[]}) };

// Load engine source
const engineSrc = fs.readFileSync('engine.js', 'utf8');
eval(engineSrc);

const ArkaEngine = window.ArkaEngine;
const engine = new ArkaEngine();

// === Test 1: Name extraction with honorific disambiguation ===
console.log('=== Test 1: _extractNamesWithHonorifics ===');

const nameTests = [
  // [input, expected_name_count, description, check_fn]
  ['鈴木さん、おはようございます', 1, '名前+さん', (r) => r.nameTokens[0].name === '鈴木' && r.nameTokens[0].honorific === 'さん'],
  ['英恵さん、おはようございます', 1, '名前+さん(given name)', (r) => r.nameTokens[0].name === '英恵'],
  ['鈴木様、お待たせしました', 1, '名前+様', (r) => r.nameTokens[0].name === '鈴木' && r.nameTokens[0].honorific === '様'],
  ['その様です', 0, 'その様=NOT honorific', null],
  ['この様に進めます', 0, 'この様=NOT honorific', null],
  ['同様に', 0, '同様=NOT honorific', null],
  ['多様な意見', 0, '多様=NOT honorific', null],
  ['田中先生、こんにちは', 1, '名前+先生', (r) => r.nameTokens[0].name === '田中' && r.nameTokens[0].honorific === '先生'],
  ['みさきちゃん、元気？', 1, '名前+ちゃん', (r) => r.nameTokens[0].name === 'みさき'],
  ['太郎くん、おはよう', 1, '名前+くん', (r) => r.nameTokens[0].name === '太郎'],
  ['山田殿、拝啓', 1, '名前+殿', (r) => r.nameTokens[0].name === '山田' && r.nameTokens[0].honorific === '殿'],
  ['様子を見る', 0, '様子=compound, NOT honorific', null],
];

let pass = 0, fail = 0;
for (const [input, expectedCount, desc, checkFn] of nameTests) {
  const result = ArkaEngine._extractNamesWithHonorifics(input);
  const countOk = result.nameTokens.length === expectedCount;
  const checkOk = checkFn ? checkFn(result) : true;
  if (countOk && checkOk) {
    console.log(`  ✓ ${desc}: "${input}" → ${result.nameTokens.length} names`);
    pass++;
  } else {
    console.log(`  ✗ ${desc}: "${input}" → got ${result.nameTokens.length} names (expected ${expectedCount})`);
    if (result.nameTokens.length > 0) console.log(`    tokens:`, JSON.stringify(result.nameTokens));
    if (checkFn && countOk) console.log(`    check failed`);
    fail++;
  }
}

// === Test 2: Name transliteration ===
console.log('\n=== Test 2: transliterateNameToArka ===');

const translitTests = [
  ['はなえ', 'hanae'],
  ['すずき', 'suzuki'],
  ['たなか', 'tanaka'],
  ['まりな', 'marina'],
  ['しょうた', 'xouta'],  // sh→x in Arka
  ['ゆうこ', 'yuuko'],
  ['ちひろ', 'tihiro'],
  ['アキラ', 'akira'],
  ['ケンジ', 'kenji'],
];

for (const [input, expected] of translitTests) {
  const result = ArkaEngine.transliterateNameToArka(input);
  if (result === expected) {
    console.log(`  ✓ ${input} → ${result}`);
    pass++;
  } else {
    console.log(`  ✗ ${input} → ${result} (expected ${expected})`);
    fail++;
  }
}

// === Test 3: Common name kanji readings ===
console.log('\n=== Test 3: COMMON_NAME_READINGS + transliteration ===');

const kanjiNameTests = [
  ['英恵', 'hanae'],
  ['鈴木', 'suzuki'],
  ['田中', 'tanaka'],
  ['太郎', 'tarou'],
];

for (const [kanji, expected] of kanjiNameTests) {
  const reading = ArkaEngine.COMMON_NAME_READINGS[kanji];
  if (!reading) {
    console.log(`  ✗ ${kanji}: no reading found`);
    fail++;
    continue;
  }
  const result = ArkaEngine.transliterateNameToArka(reading);
  if (result === expected) {
    console.log(`  ✓ ${kanji} → ${reading} → ${result}`);
    pass++;
  } else {
    console.log(`  ✗ ${kanji} → ${reading} → ${result} (expected ${expected})`);
    fail++;
  }
}

// === Test 4: REVERSE_GREETINGS coverage ===
console.log('\n=== Test 4: REVERSE_GREETINGS ===');

const greetingTests = [
  ['おはよう', 'soonoyun'],
  ['おはようございます', 'ansoonoyun'],
  ['こんにちは', 'soonoyun'],
  ['こんばんは', 'soonoyun'],
  ['おやすみ', 'xidia'],
  ['おやすみなさい', 'anxidia'],
  ['さようなら', 'doova'],
  ['はじめまして', 'dacma'],
  ['久しぶり', 'fiima'],
  ['よろしく', 'estol'],
  ['もしもし', 'tixante'],
  ['おかえり', 'lunan'],
  ['ただいま', 'lunan'],
  ['ありがとう', 'sentant'],
  ['ありがとうございます', 'ansentant'],
  ['ごめん', 'vant'],
  ['すみません', 'xante'],
];

for (const [jp, expected] of greetingTests) {
  const actual = ArkaEngine.REVERSE_GREETINGS[jp];
  if (actual === expected) {
    console.log(`  ✓ ${jp} → ${actual}`);
    pass++;
  } else {
    console.log(`  ✗ ${jp} → ${actual} (expected ${expected})`);
    fail++;
  }
}

// === Test 5: Full pipeline simulation ===
console.log('\n=== Test 5: _replaceGreetingsAndPronouns pipeline ===');

// We need a minimal engine with the method
const pipelineTests = [
  ['英恵さん、おはようございます', '__NAME_', '__GREETING_ansoonoyun__', '名前+挨拶'],
  ['鈴木様、こんにちは', '__NAME_', '__GREETING_soonoyun__', '様+挨拶'],
  ['その様です', null, null, 'その様=非敬称'],
];

for (const [input, expectName, expectGreeting, desc] of pipelineTests) {
  const result = engine._replaceGreetingsAndPronouns(input);
  const hasName = expectName ? result.includes(expectName) : !result.includes('__NAME_');
  const hasGreeting = expectGreeting ? result.includes(expectGreeting) : true;
  if (hasName && hasGreeting) {
    console.log(`  ✓ ${desc}: "${input}" → "${result.trim()}"`);
    pass++;
  } else {
    console.log(`  ✗ ${desc}: "${input}" → "${result.trim()}"`);
    if (expectName) console.log(`    expected to contain: ${expectName}, ${expectGreeting}`);
    fail++;
  }
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
