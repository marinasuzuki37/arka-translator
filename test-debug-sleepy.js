const fs = require('fs');
global.window = {};
global.ArkaVariants = { VARIANTS: { shinsee: {} }, postProcessSeiArka: (t) => ({text:t,untranslatable:[]}), postProcessKoArka: (t) => ({text:t,untranslatable:[]}) };
const engineSrc = fs.readFileSync('engine.js', 'utf8');
eval(engineSrc);
const ArkaEngine = window.ArkaEngine;

const engine = new ArkaEngine();
// Manually load dict (minimal) so reverseMap works
const dictData = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
// Can't do full async init in Node, so build indices manually
engine.dict = dictData;
engine._buildIndices();
// Load greetings statically
for (const [word, meaning] of Object.entries(ArkaEngine.GREETINGS)) {
  engine.greetingsMap.set(word, meaning);
}
engine.ready = true;

const input = 'わたしはすごく眠たい';
console.log('=== Input:', input, '===');

// Step 1: Check REVERSE_PRONOUNS
console.log('\n--- REVERSE_PRONOUNS check ---');
console.log('わたし:', ArkaEngine.REVERSE_PRONOUNS['わたし']);
console.log('私:', ArkaEngine.REVERSE_PRONOUNS['私']);

// Step 2: Check word lookups
console.log('\n--- Word lookup checks ---');
const testWords = ['すごく', 'すごい', '眠たい', '眠い', '眠', 'すごく眠たい'];
for (const w of testWords) {
  const result = engine._lookupJapanese(w);
  console.log(`  ${w}: ${result ? result.arkaWord + ' (' + (result.entry?.meaning||'').slice(0,30) + ')' : 'NOT FOUND'}`);
}

// Step 3: Check reverseMap for 眠
console.log('\n--- reverseMap scan for sleep/sleepy ---');
for (const [key, entries] of engine.reverseMap) {
  if (key.includes('眠') || key.includes('ねむ')) {
    console.log(`  "${key}" → ${entries.map(e => e.arkaWord).join(', ')}`);
  }
}

// Step 4: Full copula detection
console.log('\n--- Copula detection ---');
const copula = engine._detectCopulaPattern(input);
console.log('copulaInfo:', copula);

// Step 5: Replacement pipeline
console.log('\n--- _replaceGreetingsAndPronouns ---');
const replaced = engine._replaceGreetingsAndPronouns(input);
console.log('replaced:', replaced);

// Step 6: Tokenization
console.log('\n--- _tokenizeJapanese ---');
const tokens = engine._tokenizeJapanese(replaced);
console.log('tokens:', tokens);

// Step 7: Full translation
console.log('\n--- Full translateJapaneseToArka ---');
const result = engine.translateJapaneseToArka(input);
console.log('translation:', result.translation);
console.log('breakdown:', result.breakdown.map(b => `${b.original}→${b.root}[${b.type}]`).join(' | '));
