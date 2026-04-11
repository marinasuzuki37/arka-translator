const fs = require('fs');
const { JSDOM } = require('jsdom');

const engineCode = fs.readFileSync('engine.js', 'utf8');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const fn = new Function('window', 'document', engineCode + '\nwindow.ArkaEngine = ArkaEngine;');
fn(dom.window, dom.window.document);
const ArkaEngine = dom.window.ArkaEngine;

const dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
const greetings = JSON.parse(fs.readFileSync('greetings.json', 'utf8'));
const memory = JSON.parse(fs.readFileSync('sentence_memory.json', 'utf8'));

const engine = new ArkaEngine();
engine.dict = dict;
engine._buildIndices();
engine.sentenceMemory = memory;
for (const [k, v] of Object.entries(greetings)) {
  engine.greetingsMap.set(k, v);
}
engine.ready = true;

const text = '死にたいけど生きなきゃいけない。';
console.log('Input:', text);

// Step 1: Check tokenizer
const tokens = engine._splitJapaneseSegment(text);
console.log('\nTokens:', tokens);

// Step 2: Check each token's lookup
for (const tok of tokens) {
  const result = engine._lookupJapanese(tok);
  if (result) {
    console.log(`  "${tok}" → ${result.arkaWord}`);
  } else {
    console.log(`  "${tok}" → [UNKNOWN]`);
  }
}

// Step 3: Full translation
const result = engine.translateJapaneseToArka(text);
console.log('\nTranslation:', result.translation);
console.log('\nBreakdown:');
for (const b of result.breakdown) {
  console.log(`  "${b.original}" → ${b.root} (${b.type})`);
}

// Step 4: Check what overrides exist
console.log('\n--- Override checks ---');
const checks = ['死にたい', '死に', '死ぬ', '生きなきゃ', '生き', '生きる', 'いけない', '生きなきゃいけない', 'なきゃ', 'けど'];
for (const w of checks) {
  const ov = ArkaEngine.JP_ARKA_OVERRIDES[w];
  const rv = engine.reverseMap.has(w);
  console.log(`  "${w}" → override:${ov || 'none'}, reverseMap:${rv}`);
}
