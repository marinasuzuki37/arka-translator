// Mass translation test: run all novel sentences through the engine
// Analyze: translation rate, unknown words, failure patterns
const fs = require('fs');
global.window = {};
global.ArkaVariants = {
  VARIANTS: { shinsee: {} },
  postProcessSeiArka: (t) => ({text:t,untranslatable:[]}),
  postProcessKoArka: (t) => ({text:t,untranslatable:[]})
};
eval(fs.readFileSync('engine.js', 'utf8'));
const ArkaEngine = window.ArkaEngine;
const engine = new ArkaEngine();
engine.dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
engine._buildIndices();
for (const [w, m] of Object.entries(ArkaEngine.GREETINGS)) engine.greetingsMap.set(w, m);
// Load greetings.json
try {
  const gdata = JSON.parse(fs.readFileSync('greetings.json', 'utf8'));
  for (const [word, meaning] of Object.entries(gdata)) {
    engine.greetingsMap.set(word.toLowerCase(), meaning);
  }
} catch(e) {}
engine.ready = true;

const novels = JSON.parse(fs.readFileSync('test-novels.json', 'utf8'));

const results = {
  totalSentences: 0,
  fullyTranslated: 0,   // no [brackets]
  partiallyTranslated: 0, // has some [brackets] but also some translated words
  failed: 0,             // mostly [brackets]
  unknownWords: {},       // word → count
  failedSentences: [],    // {category, sentence, translation, unknowns}
  categoryStats: {},
};

for (const category of novels) {
  const catName = category.title;
  const catStats = { total: 0, full: 0, partial: 0, failed: 0 };

  for (const sentence of category.sentences) {
    if (!sentence.trim()) continue;
    results.totalSentences++;
    catStats.total++;

    let result;
    try {
      result = engine.translateJapaneseToArka(sentence);
    } catch (e) {
      results.failed++;
      catStats.failed++;
      results.failedSentences.push({
        category: catName, sentence, translation: 'ERROR: ' + e.message, unknowns: []
      });
      continue;
    }

    const translation = result.translation;
    const breakdown = result.breakdown;

    // Count unknown words (in [brackets])
    const unknowns = [];
    const bracketMatches = translation.match(/\[([^\]]+)\]/g) || [];
    for (const m of bracketMatches) {
      const word = m.slice(1, -1);
      unknowns.push(word);
      results.unknownWords[word] = (results.unknownWords[word] || 0) + 1;
    }

    // Count total tokens and unknown tokens
    const totalTokens = breakdown.length;
    const unknownTokens = breakdown.filter(b => b.type === 'unknown').length;
    const unknownRatio = totalTokens > 0 ? unknownTokens / totalTokens : 0;

    if (unknownTokens === 0) {
      results.fullyTranslated++;
      catStats.full++;
    } else if (unknownRatio <= 0.5) {
      results.partiallyTranslated++;
      catStats.partial++;
      if (unknowns.length > 0) {
        results.failedSentences.push({
          category: catName, sentence,
          translation: translation.slice(0, 80),
          unknowns
        });
      }
    } else {
      results.failed++;
      catStats.failed++;
      results.failedSentences.push({
        category: catName, sentence,
        translation: translation.slice(0, 80),
        unknowns
      });
    }
  }
  results.categoryStats[catName] = catStats;
}

// === OUTPUT REPORT ===
console.log('====== 翻訳エンジン網羅テスト結果 ======\n');
console.log(`総文数: ${results.totalSentences}`);
console.log(`完全翻訳: ${results.fullyTranslated} (${(results.fullyTranslated/results.totalSentences*100).toFixed(1)}%)`);
console.log(`部分翻訳: ${results.partiallyTranslated} (${(results.partiallyTranslated/results.totalSentences*100).toFixed(1)}%)`);
console.log(`失敗: ${results.failed} (${(results.failed/results.totalSentences*100).toFixed(1)}%)`);

console.log('\n--- カテゴリ別 ---');
for (const [cat, stats] of Object.entries(results.categoryStats)) {
  const pct = stats.total > 0 ? (stats.full/stats.total*100).toFixed(1) : '0';
  console.log(`  ${cat}: ${stats.full}/${stats.total} 完全翻訳 (${pct}%) | 部分${stats.partial} | 失敗${stats.failed}`);
}

// Top unknown words
console.log('\n--- 未知語ランキング (出現5回以上) ---');
const sorted = Object.entries(results.unknownWords).sort((a,b) => b[1] - a[1]);
for (const [word, count] of sorted) {
  if (count >= 2) console.log(`  "${word}": ${count}回`);
}

// Show all unknown words for pattern analysis
console.log('\n--- 全未知語一覧 ---');
const allUnknowns = Object.keys(results.unknownWords).sort();
console.log(`  計${allUnknowns.length}語: ${allUnknowns.join(', ')}`);

// Failed sentence examples (first 30)
console.log('\n--- 失敗・部分翻訳の例 (先頭30件) ---');
for (const item of results.failedSentences.slice(0, 30)) {
  console.log(`  [${item.category}] "${item.sentence.slice(0,40)}..." → unknowns: [${item.unknowns.join(', ')}]`);
}

// Save full report to file
fs.writeFileSync('test-mass-results.json', JSON.stringify(results, null, 2));
console.log('\n詳細結果: test-mass-results.json に保存済み');
