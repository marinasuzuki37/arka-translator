// Test script for AI output sanitization
// Run with: node test-sanitize.js

const fs = require('fs');
const vm = require('vm');

// Load the file and wrap for Node.js execution
const code = fs.readFileSync('ai-fallback.js', 'utf8');
const wrappedCode = code + '\nmodule.exports = { ArkaAIFallback };';
const tmpFile = '/tmp/_test_ai_fallback.js';
fs.writeFileSync(tmpFile, wrappedCode);
const { ArkaAIFallback } = require(tmpFile);

const fallback = new ArkaAIFallback(null);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('\n=== JP→Arka方向 (日本語→アルカ) ===\n');

test('英語の前置き除去 (Here is the translation:)', () => {
  const r = fallback.sanitizeAIOutput('Here is the translation: vortor kern teom ladia', 'jp-to-arka');
  assert(!r.rejected, 'Should not reject');
  assert(!r.text.includes('Here'), 'English preamble should be gone');
  assert(r.text.includes('vortor'), 'Arka text should remain');
});

test('日本語の前置き除去 (翻訳結果:)', () => {
  const r = fallback.sanitizeAIOutput('翻訳結果：vortor kern teom ladia', 'jp-to-arka');
  assert(!r.rejected);
  assert(!r.text.includes('翻訳結果'), 'JP preamble should be removed');
});

test('"Sure!" 前置き除去', () => {
  const r = fallback.sanitizeAIOutput('Sure! vortor kern teom ladia', 'jp-to-arka');
  assert(!r.rejected);
  assert(!r.text.toLowerCase().includes('sure'), 'Sure should be removed');
});

test('キリル文字(ロシア語)除去', () => {
  const r = fallback.sanitizeAIOutput('vortor Привет kern teom', 'jp-to-arka');
  assert(!r.text.includes('Привет'), 'Cyrillic must be removed');
});

test('韓国語(ハングル)除去', () => {
  const r = fallback.sanitizeAIOutput('vortor 안녕하세요 kern teom', 'jp-to-arka');
  assert(!r.text.includes('안녕'), 'Korean must be removed');
});

test('アラビア語除去', () => {
  const r = fallback.sanitizeAIOutput('vortor مرحبا kern teom', 'jp-to-arka');
  assert(!r.text.includes('مرحبا'), 'Arabic must be removed');
});

test('タイ語除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern สวัสดี teom', 'jp-to-arka');
  assert(!r.text.includes('สวัสดี'), 'Thai must be removed');
});

test('ヒンディー語(デーヴァナーガリー)除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern नमस्ते teom', 'jp-to-arka');
  assert(!r.text.includes('नमस्ते'), 'Hindi must be removed');
});

test('ヘブライ語除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern שלום teom', 'jp-to-arka');
  assert(!r.text.includes('שלום'), 'Hebrew must be removed');
});

test('末尾の英語Note除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern teom ladia\nNote: This is an approximate translation.', 'jp-to-arka');
  assert(!r.text.includes('Note'), 'Note should be removed');
  assert(!r.text.includes('approximate'), 'English explanation gone');
});

test('末尾の日本語補足除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern teom ladia\nただし、完全な翻訳ではありません。', 'jp-to-arka');
  assert(!r.text.includes('ただし'), 'JP postamble should be removed');
});

test('マークダウン太字除去', () => {
  const r = fallback.sanitizeAIOutput('**vortor** kern teom ladia', 'jp-to-arka');
  assert(!r.text.includes('**'), 'Bold markers gone');
  assert(r.text.includes('vortor'), 'Text inside bold preserved');
});

test('マークダウン見出し除去', () => {
  const r = fallback.sanitizeAIOutput('## Translation\nvortor kern teom ladia', 'jp-to-arka');
  assert(!r.text.includes('##'), 'Headers removed');
});

test('コードフェンス除去', () => {
  const r = fallback.sanitizeAIOutput('```\nvortor kern teom ladia\n```', 'jp-to-arka');
  assert(!r.text.includes('```'), 'Code fences removed');
  assert(r.text.includes('vortor'), 'Content preserved');
});

test('括弧付き引用除去', () => {
  const r = fallback.sanitizeAIOutput('「vortor kern teom ladia」', 'jp-to-arka');
  assert(!r.text.startsWith('「'), 'Opening quote removed');
});

test('日本語残留片除去 (JP→Arka出力内)', () => {
  const r = fallback.sanitizeAIOutput('vortor kern 翼は teom ladia', 'jp-to-arka');
  assert(!r.text.includes('翼は'), 'JP residue removed');
});

test('複数行の英語説明行を除去', () => {
  const r = fallback.sanitizeAIOutput('vortor kern teom ladia\nThis translates the poetic Japanese text into Arka.', 'jp-to-arka');
  assert(!r.text.includes('translates'), 'English line removed');
  assert(r.text.includes('vortor'), 'Arka line preserved');
});

test('[翻訳不能]マーカー付きは許可', () => {
  const r = fallback.sanitizeAIOutput('axoz fles [ブロックチェーン] sonax', 'jp-to-arka');
  assert(!r.rejected, 'Bracketed terms should be allowed');
});

test('純英語は拒否', () => {
  const r = fallback.sanitizeAIOutput('The translation of this text would require more context.', 'jp-to-arka');
  assert(r.rejected, 'Pure English must be rejected');
});

test('全て外国語は拒否', () => {
  const r = fallback.sanitizeAIOutput('Привет мир 안녕하세요', 'jp-to-arka');
  assert(r.rejected, 'All-foreign must be rejected');
});

test('空文字列は拒否', () => {
  const r = fallback.sanitizeAIOutput('', 'jp-to-arka');
  assert(r.rejected, 'Empty must be rejected');
});

test('nullは拒否', () => {
  const r = fallback.sanitizeAIOutput(null, 'jp-to-arka');
  assert(r.rejected, 'Null must be rejected');
});

console.log('\n=== Arka→JP方向 (アルカ→日本語) ===\n');

test('有効な日本語出力は通過', () => {
  const r = fallback.sanitizeAIOutput('私は月を食べたい', 'arka-to-jp');
  assert(!r.rejected, 'Valid JP should pass');
  assert(r.text.includes('月'), 'JP text preserved');
});

test('日本語+英語説明の混在→英語除去', () => {
  const r = fallback.sanitizeAIOutput('私は月を食べたい。This means I want to eat the moon.', 'arka-to-jp');
  assert(!r.text.includes('This means'), 'English part removed');
  assert(r.text.includes('月'), 'Japanese preserved');
});

test('日本語+キリル文字混在→キリル除去', () => {
  const r = fallback.sanitizeAIOutput('私は月を食べたい。Перевод текста.', 'arka-to-jp');
  assert(!r.text.includes('Перевод'), 'Cyrillic removed');
  assert(r.text.includes('月'), 'Japanese preserved');
});

test('日本語+韓国語混在→韓国語除去', () => {
  const r = fallback.sanitizeAIOutput('私は月を食べたい。번역입니다.', 'arka-to-jp');
  assert(!r.text.includes('번역'), 'Korean removed');
  assert(r.text.includes('月'), 'Japanese preserved');
});

test('純英語のJP出力は拒否', () => {
  const r = fallback.sanitizeAIOutput('I want to eat the moon.', 'arka-to-jp');
  assert(r.rejected, 'Pure English JP output must be rejected');
});

test('日本語が少なすぎる出力は拒否', () => {
  const r = fallback.sanitizeAIOutput('a b c d e f g h i j k l m n o p あ', 'arka-to-jp');
  assert(r.rejected, 'Too little JP should be rejected');
});

console.log('\n=== 複合テスト ===\n');

test('全ての汚染を同時に含むケース', () => {
  const raw = 'Sure! Here is the translation:\n**vortor** kern Привет 안녕 teom ladia\nNote: This is approximate. ただし注意してください。';
  const r = fallback.sanitizeAIOutput(raw, 'jp-to-arka');
  assert(!r.rejected, 'Should survive after cleanup');
  assert(!r.text.includes('Sure'), 'No Sure');
  assert(!r.text.includes('Привет'), 'No Cyrillic');
  assert(!r.text.includes('안녕'), 'No Korean');
  assert(!r.text.includes('**'), 'No markdown');
  assert(!r.text.includes('Note'), 'No Note');
  assert(!r.text.includes('ただし'), 'No JP postamble');
  assert(r.text.includes('vortor'), 'Arka preserved');
  assert(r.text.includes('kern'), 'Arka preserved');
});

test('LLMが中国語で回答した場合(Arka→JP)', () => {
  const r = fallback.sanitizeAIOutput('我想吃月亮。', 'arka-to-jp');
  // Note: Chinese Kanji shares Unicode range with Japanese Kanji
  // This is a known limitation. But with no Hiragana/Katakana present:
  const jpChars = (r.text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  // Pure Chinese without hiragana/katakana should have jpChars = 0, 
  // and Kanji-only sentences could slip through. We check the ratio.
  console.log('    (Chinese Kanji edge case - ' + (r.rejected ? 'REJECTED' : 'passed - Kanji overlap') + ')');
});

// =============================================
// ROUND-TRIP VERIFICATION TESTS
// =============================================

console.log('\n=== ラウンドトリップ検証テスト ===\n');

// Create a mock engine that simulates basic translation
const mockEngine = {
  ready: true,
  translateArkaToJapanese(text) {
    // Simple mock: map known Arka words to JP
    const map = {
      'an': '私', 'ti': 'あなた', 'lu': '彼', 'lad': '食べる',
      'ladat': '食べた', 'luna': '月', 'ket': '猫', 'seren': 'セレン',
      'fia': '水', 'non': '名前', 'salt': '殺す', 'xion': '心',
      'lax': 'したい', 'fir': '火', 'teo': '神', 'vil': 'できない',
      'sen': 'できる', 'ik': '行く', 'kul': '来る', 'siina': '美しい'
    };
    const words = text.toLowerCase().split(/\s+/);
    const translated = words.map(w => map[w] || `[${w}]`).join('');
    return { translation: translated };
  },
  translateJapaneseToArka(text) {
    // Simple mock: map known JP to Arka
    const map = {
      '私': 'an', 'あなた': 'ti', '猫': 'ket', '月': 'luna',
      '食べる': 'lad', '食べたい': 'lad lax', '水': 'fia',
      '名前': 'non', '心': 'xion', '火': 'fir', '神': 'teo',
      '美しい': 'siina', '行く': 'ik', '来る': 'kul'
    };
    // Very rough: try to find known substrings
    let result = text;
    for (const [jp, arka] of Object.entries(map)) {
      result = result.replace(jp, arka);
    }
    return { translation: result };
  }
};

const fallbackWithEngine = new ArkaAIFallback(mockEngine);

test('逆翻訳検証: 正確なアルカ出力 (高スコア)', () => {
  // Original JP: 私は猫を食べたい → AI Arka: an lad ket lax
  // Back-translate via mock: 私猫食べるしたい → shares 私, 猫, 食べ, したい with original
  const v = fallbackWithEngine.verifyAIOutput('私は猫を食べたい', 'an lad ket lax', 'jp-to-arka');
  assert(v.score > 0, `Score should be > 0, got ${v.score}`);
  assert(v.level !== 'fail', `Should not fail, got ${v.level}`);
  assert(v.backTranslation.length > 0, 'Should have back-translation');
});

test('逆翻訳検証: 完全に出鱈目なアルカ出力 (低スコア)', () => {
  // Original JP: 私は猫を食べたい → AI Arka: xyz abc def (nonsense)
  const v = fallbackWithEngine.verifyAIOutput('私は猫を食べたい', 'xyz abc def', 'jp-to-arka');
  // Mock will produce [xyz][abc][def] — no overlap with original JP
  assert(v.score < 0.3, `Score should be low for nonsense, got ${v.score}`);
});

test('逆翻訳検証: エンジン未準備時はwarn', () => {
  const noEngine = new ArkaAIFallback(null);
  const v = noEngine.verifyAIOutput('テスト', 'test', 'jp-to-arka');
  assert(v.level === 'warn', 'Should return warn when engine not ready');
});

test('逆翻訳検証: 空の入力', () => {
  const v = fallbackWithEngine.verifyAIOutput('', '', 'jp-to-arka');
  assert(v.score === 0, 'Empty input should score 0');
});

test('正規化: 句読点・括弧が除去される', () => {
  const n1 = fallbackWithEngine._normalizeForComparison('私は！猫、を。食べたい', 'jp');
  const n2 = fallbackWithEngine._normalizeForComparison('私は猫を食べたい', 'jp');
  assert(n1 === n2, `Normalized texts should match: "${n1}" vs "${n2}"`);
});

test('正規化: [翻訳不能]マーカーが除去される', () => {
  const n = fallbackWithEngine._normalizeForComparison('an lad [翻訳不能] ket', 'arka');
  assert(!n.includes('翻訳不能'), 'Untranslatable markers should be removed');
});

test('トークン化: 日本語の漢字・カタカナ分離', () => {
  const tokens = fallbackWithEngine._tokenize('私は猫を食べたい', 'jp');
  assert(tokens.length > 0, 'Should produce tokens');
  // Should extract kanji: 私, 猫, 食
  const hasKanji = tokens.some(t => /[\u4E00-\u9FFF]/.test(t));
  assert(hasKanji, 'Should extract kanji tokens');
});

test('トークン化: アルカのスペース分割', () => {
  const tokens = fallbackWithEngine._tokenize('an lad ket lax', 'arka');
  assert(tokens.length === 4, `Should have 4 tokens, got ${tokens.length}`);
});

test('トークン重み: 格詞は低重み', () => {
  const wContent = fallbackWithEngine._tokenWeight('luna', 'arka');
  const wFunc = fallbackWithEngine._tokenWeight('e', 'arka');
  assert(wContent > wFunc, 'Content words should weigh more than function words');
});

test('トークン重み: 漢字は高重み', () => {
  const wKanji = fallbackWithEngine._tokenWeight('猫', 'jp');
  const wHira = fallbackWithEngine._tokenWeight('は', 'jp');
  assert(wKanji > wHira, 'Kanji should weigh more than hiragana');
});

test('類似度: 完全一致は1.0', () => {
  const s = fallbackWithEngine._semanticSimilarity('test text', 'test text', 'arka-to-jp');
  assert(s === 1.0, `Perfect match should be 1.0, got ${s}`);
});

test('類似度: 完全不一致は0に近い', () => {
  const s = fallbackWithEngine._semanticSimilarity('abc def ghi', 'xyz uvw rst', 'arka-to-jp');
  assert(s < 0.1, `No overlap should be near 0, got ${s}`);
});

console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
