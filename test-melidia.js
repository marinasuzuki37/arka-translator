const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = '<html><body><div id="output"></div></body></html>';
const dom = new JSDOM(html);
const varCode = fs.readFileSync('variants.js', 'utf8');
new Function('window', 'document', varCode)(dom.window, dom.window.document);
const nuanceCode = fs.readFileSync('nuance-patch.js', 'utf8');
new Function('window', 'document', nuanceCode)(dom.window, dom.window.document);
const code = fs.readFileSync('engine.js', 'utf8');
const fn = new Function('window', 'document', code + '; return ArkaEngine;');
const ArkaEngine = fn(dom.window, dom.window.document);
const dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
const greetings = JSON.parse(fs.readFileSync('greetings.json', 'utf8'));
const memory = JSON.parse(fs.readFileSync('sentence_memory.json', 'utf8'));
const engine = new ArkaEngine();
// Manually init without async fetch
engine.dict = dict;
engine._buildIndices();
engine.sentenceMemory = memory;
for (const [arka, jp] of Object.entries(greetings)) {
  engine.greetingsMap.set(arka.toLowerCase(), jp);
}
engine.ready = true;
console.log('wordMap size:', engine.wordMap.size, '| reverseMap size:', engine.reverseMap.size);

// Read all Arka lines from melidia
const lines = fs.readFileSync('../melidia_arka_lines.txt', 'utf8')
  .split('\n')
  .filter(l => l.trim());

// Split lines into sentences (split on period, question mark, exclamation)
const sentences = [];
for (const line of lines) {
  // Split on sentence boundaries but keep dialogue intact
  const parts = line.split(/(?<=[.!?])\s+/);
  for (const p of parts) {
    const cleaned = p.trim();
    if (cleaned.length >= 5) {
      sentences.push(cleaned);
    }
  }
}

console.log(`Total sentences to translate: ${sentences.length}`);

// Translate each sentence (Arka → Japanese)
let complete = 0, partial = 0, fail = 0;
const unknowns = {};
const failedSamples = [];
const partialSamples = [];

for (const sent of sentences) {
  try {
    const result = engine.translateArkaToJapanese(sent);
    const jp = result.translation || '';
    
    // Check quality
    const tokens = result.breakdown || [];
    const totalTokens = tokens.length;
    const unknownTokens = tokens.filter(t => t.type === 'unknown').length;
    
    if (totalTokens === 0) {
      fail++;
      failedSamples.push(sent);
    } else if (unknownTokens === 0) {
      complete++;
    } else {
      const ratio = unknownTokens / totalTokens;
      if (ratio <= 0.2) {
        // Mostly translated (80%+ tokens known)
        partial++;
        unknownTokens > 0 && tokens.filter(t => t.type === 'unknown').forEach(t => {
          unknowns[t.original] = (unknowns[t.original] || 0) + 1;
        });
      } else {
        partial++;
        tokens.filter(t => t.type === 'unknown').forEach(t => {
          unknowns[t.original] = (unknowns[t.original] || 0) + 1;
        });
      }
      if (partialSamples.length < 30) {
        partialSamples.push({ sent: sent.substring(0, 80), jp: jp.substring(0, 80), unknown: unknownTokens, total: totalTokens });
      }
    }
  } catch (e) {
    fail++;
    if (failedSamples.length < 10) failedSamples.push(sent.substring(0, 60) + ' [ERROR: ' + e.message.substring(0, 50) + ']');
  }
}

const total = sentences.length;
console.log(`\n=== melidia.pdf 翻訳精度 ===`);
console.log(`総文数: ${total}`);
console.log(`完全翻訳 (全トークン既知): ${complete} (${(100*complete/total).toFixed(1)}%)`);
console.log(`部分翻訳 (一部未知語あり): ${partial} (${(100*partial/total).toFixed(1)}%)`);
console.log(`失敗: ${fail} (${(100*fail/total).toFixed(1)}%)`);
console.log(`翻訳成功率 (完全+部分): ${complete+partial} (${(100*(complete+partial)/total).toFixed(1)}%)`);

// Token-level analysis
let totalAllTokens = 0, totalUnknownTokens = 0;
for (const sent of sentences) {
  try {
    const result = engine.translateArkaToJapanese(sent);
    const tokens = result.breakdown || [];
    totalAllTokens += tokens.length;
    totalUnknownTokens += tokens.filter(t => t.type === 'unknown').length;
  } catch(e) {}
}
console.log(`\n--- トークンレベル精度 ---`);
console.log(`総トークン数: ${totalAllTokens}`);
console.log(`既知トークン: ${totalAllTokens - totalUnknownTokens} (${(100*(totalAllTokens-totalUnknownTokens)/totalAllTokens).toFixed(1)}%)`);
console.log(`未知トークン: ${totalUnknownTokens} (${(100*totalUnknownTokens/totalAllTokens).toFixed(1)}%)`);

console.log(`\n--- 未知語トップ30 ---`);
const sorted = Object.entries(unknowns).sort((a,b) => b[1]-a[1]).slice(0, 30);
for (const [w, c] of sorted) {
  console.log(`  ${w}: ${c}回`);
}

if (partialSamples.length) {
  console.log(`\n--- 部分翻訳サンプル (先頭15件) ---`);
  for (const s of partialSamples.slice(0, 15)) {
    console.log(`  [${s.unknown}/${s.total}未知] ${s.sent}`);
    console.log(`    → ${s.jp}`);
  }
}

if (failedSamples.length) {
  console.log(`\n--- 失敗サンプル ---`);
  for (const s of failedSamples.slice(0, 5)) {
    console.log(`  ${s}`);
  }
}
