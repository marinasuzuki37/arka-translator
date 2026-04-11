const fs = require('fs');
global.window = {};
global.ArkaVariants = { VARIANTS: { shinsee: {} }, postProcessSeiArka: (t) => ({text:t,untranslatable:[]}), postProcessKoArka: (t) => ({text:t,untranslatable:[]}) };
eval(fs.readFileSync('engine.js', 'utf8'));
const ArkaEngine = window.ArkaEngine;
const engine = new ArkaEngine();
engine.dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
engine._buildIndices();
for (const [word, meaning] of Object.entries(ArkaEngine.GREETINGS)) engine.greetingsMap.set(word, meaning);
engine.ready = true;

// Check: is すごく in reverseMap?
console.log('reverseMap has すごく:', engine.reverseMap.has('すごく'));
console.log('reverseMap has すごい:', engine.reverseMap.has('すごい'));
console.log('reverseMap has ごく:', engine.reverseMap.has('ごく'));
console.log('reverseMap has す:', engine.reverseMap.has('す'));
console.log('JP_ARKA_OVERRIDES has すごく:', !!ArkaEngine.JP_ARKA_OVERRIDES['すごく']);
console.log('JP_ARKA_OVERRIDES has すごい:', !!ArkaEngine.JP_ARKA_OVERRIDES['すごい']);

// Test _splitJapaneseSegment directly
const seg = 'すごく眠たい';
console.log('\n_splitJapaneseSegment("' + seg + '"):');
const result = engine._splitJapaneseSegment(seg);
console.log(result);

// Check MAX_JP_TOKEN_LEN
console.log('\nMAX_JP_TOKEN_LEN:', ArkaEngine.MAX_JP_TOKEN_LEN);

// Test: does the longest-match loop find すごく?
for (let len = Math.min(seg.length, ArkaEngine.MAX_JP_TOKEN_LEN || 10); len >= 2; len--) {
  const candidate = seg.slice(0, len);
  const inOverrides = !!ArkaEngine.JP_ARKA_OVERRIDES[candidate];
  const inReverse = engine.reverseMap.has(candidate);
  if (inOverrides || inReverse) {
    console.log(`  Match at len=${len}: "${candidate}" (overrides=${inOverrides}, reverse=${inReverse})`);
    break;
  }
}

// Also check if 眠たい or 眠い can be found
console.log('\nreverseMap has 眠たい:', engine.reverseMap.has('眠たい'));
console.log('reverseMap has 眠い:', engine.reverseMap.has('眠い'));
console.log('JP_ARKA_OVERRIDES has 眠たい:', !!ArkaEngine.JP_ARKA_OVERRIDES['眠たい']);
console.log('JP_ARKA_OVERRIDES has 眠い:', !!ArkaEngine.JP_ARKA_OVERRIDES['眠い']);
