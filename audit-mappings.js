// Comprehensive mapping audit script
const fs = require('fs');
global.window = global;
eval(fs.readFileSync('/home/user/workspace/arka-translator/engine.js', 'utf8'));

const dict = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/dictionary.json', 'utf8'));
const sentData = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/sentence_memory.json', 'utf8'));
const greetData = JSON.parse(fs.readFileSync('/home/user/workspace/arka-translator/greetings.json', 'utf8'));
const engine = new ArkaEngine(dict, sentData, greetData);

// Build a quick word→meaning map from dictionary
const dictMap = {};
for (const e of dict) {
  dictMap[e.word] = e.meaning || '';
}

console.log('='.repeat(80));
console.log('AUDIT 1: JP_ARKA_OVERRIDES — 辞書との照合');
console.log('='.repeat(80));

const overrides = ArkaEngine.JP_ARKA_OVERRIDES;
const issues1 = [];

for (const [jp, arka] of Object.entries(overrides)) {
  const meaning = dictMap[arka];
  if (!meaning) {
    issues1.push({ type: 'NOT_IN_DICT', jp, arka, detail: `辞書に "${arka}" が存在しない` });
    continue;
  }
  // Check if the Japanese word appears in the meaning
  // For single kanji/short words, check more loosely
  const jpClean = jp.replace(/[なのだですい]/g, '');
  const meaningLower = meaning.toLowerCase();
  if (!meaningLower.includes(jp) && jpClean.length >= 2 && !meaningLower.includes(jpClean)) {
    // Try partial match — check if any part of jp appears
    let found = false;
    for (let len = Math.min(jp.length, 4); len >= 2; len--) {
      const sub = jp.slice(0, len);
      if (meaningLower.includes(sub)) { found = true; break; }
    }
    if (!found) {
      issues1.push({ type: 'MISMATCH', jp, arka, detail: `"${jp}" が辞書の意味 "${meaning.slice(0, 100)}" に見当たらない` });
    }
  }
}

console.log(`\n--- 辞書に存在しないアルカ (${issues1.filter(i => i.type === 'NOT_IN_DICT').length}件) ---`);
for (const i of issues1.filter(i => i.type === 'NOT_IN_DICT')) {
  console.log(`  ✗ ${i.jp} → ${i.arka} : ${i.detail}`);
}

console.log(`\n--- 意味の不一致の可能性 (${issues1.filter(i => i.type === 'MISMATCH').length}件) ---`);
for (const i of issues1.filter(i => i.type === 'MISMATCH')) {
  console.log(`  ? ${i.jp} → ${i.arka} : ${i.detail}`);
}

console.log('\n' + '='.repeat(80));
console.log('AUDIT 2: 重複マッピング（同じ日本語が異なるアルカに割り当て）');
console.log('='.repeat(80));

const jpToArka = {};
for (const [jp, arka] of Object.entries(overrides)) {
  if (!jpToArka[jp]) jpToArka[jp] = [];
  jpToArka[jp].push(arka);
}
for (const [jp, arkaList] of Object.entries(jpToArka)) {
  if (arkaList.length > 1) {
    console.log(`  ⚠ "${jp}" → ${arkaList.join(', ')} (複数マッピング)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('AUDIT 3: 同一アルカが異なる日本語に割り当て（衝突）');
console.log('='.repeat(80));

const arkaToJp = {};
for (const [jp, arka] of Object.entries(overrides)) {
  if (!arkaToJp[arka]) arkaToJp[arka] = [];
  arkaToJp[arka].push(jp);
}
const collisions = [];
for (const [arka, jpList] of Object.entries(arkaToJp)) {
  if (jpList.length > 1) {
    // Filter out trivial duplicates (e.g., 綺麗/綺麗な)
    const unique = [...new Set(jpList.map(j => j.replace(/[なのだです]/g, '')))];
    if (unique.length > 1) {
      collisions.push({ arka, jpList, meaning: dictMap[arka] ? dictMap[arka].slice(0, 80) : '(辞書なし)' });
    }
  }
}
for (const c of collisions) {
  console.log(`  ⚠ ${c.arka} ← ${c.jpList.join(', ')} : ${c.meaning}`);
}

console.log('\n' + '='.repeat(80));
console.log('AUDIT 4: reverseMap問題検出（辞書自動生成マッピングの誤り）');
console.log('='.repeat(80));

// Check for common Japanese words that map to unexpected Arka words
const commonWords = [
  '食べる', '飲む', '走る', '歩く', '読む', '書く', '言う', '話す',
  '聞く', '知る', '思う', '考える', '愛する', '生きる', '死ぬ',
  '猫', '犬', '鳥', '魚', '花', '木', '山', '海', '川', '空',
  '赤', '青', '白', '黒', '緑', '大きい', '小さい', '美しい',
  '水', '火', '風', '土', '光', '闇', '夢', '愛', '命', '心',
  '人', '男', '女', '子供', '父', '母', '兄', '姉', '弟', '妹',
  '朝', '夜', '今日', '明日', '昨日', '時間', '世界',
  '学校', '家', '部屋', '手', '目', '耳', '口', '頭',
  '食べ物', '飲み物', '友達', '先生', '学生', '本', '名前',
  '天気', '雨', '雪', '太陽', '月', '星',
  '可愛い', '怖い', '悲しい', '嬉しい', '楽しい', '痛い',
  '好き', '嫌い', '暑い', '寒い', '熱い', '冷たい',
  '走る', '泳ぐ', '飛ぶ', '歌う', '踊る', '笑う', '泣く',
  '強い', '弱い', '高い', '低い', '長い', '短い',
  '新しい', '古い', '良い', '悪い', '早い', '遅い',
  '近い', '遠い', '深い', '広い', '狭い',
  '右', '左', '上', '下', '前', '後ろ',
  '春', '夏', '秋', '冬',
  '金', '銀', '石', '鉄',
  '食事', '料理', '言葉', '文字', '数', '音', '色',
  '可能', '不可能', '必要', '自由', '平和', '戦争',
  '魔法', '剣', '盾', '王', '姫', '城',
  '神', '悪魔', '天使', '精霊',
];

const missing = [];
const wrongMapping = [];

for (const jp of commonWords) {
  // Check override first
  if (overrides[jp]) continue;

  // Check reverse map
  const rev = engine.reverseMap.get(jp);
  if (!rev || rev.length === 0) {
    missing.push(jp);
  } else {
    // Check if the top result makes sense
    const topArka = rev[0].arkaWord;
    const topMeaning = dictMap[topArka] || '';
    // Flag if the meaning doesn't seem to contain the JP word
    const jpClean = jp.replace(/[いなのだです]/g, '');
    if (jpClean.length >= 2 && !topMeaning.includes(jp) && !topMeaning.includes(jpClean)) {
      wrongMapping.push({ jp, arka: topArka, meaning: topMeaning.slice(0, 80) });
    }
  }
}

console.log(`\n--- 頻出語の未登録 (${missing.length}件) ---`);
for (const m of missing) {
  // Try to find candidates in dictionary
  const candidates = [];
  for (const e of dict) {
    if (e.meaning && e.meaning.includes(m)) {
      candidates.push(e.word + ':' + e.meaning.slice(0, 40));
    }
  }
  console.log(`  ✗ ${m} → 未登録 ${candidates.length > 0 ? '候補: ' + candidates.slice(0, 3).join(' | ') : ''}`);
}

console.log(`\n--- 頻出語の疑わしいマッピング (${wrongMapping.length}件) ---`);
for (const w of wrongMapping) {
  console.log(`  ? ${w.jp} → ${w.arka} : "${w.meaning}"`);
}

console.log('\n' + '='.repeat(80));
console.log('AUDIT 5: xen衝突チェック (飲む/変わる 両方xen)');
console.log('='.repeat(80));
// Known issue: xen is both 飲む and 変わる in overrides
const xenEntries = Object.entries(overrides).filter(([jp, arka]) => arka === 'xen');
console.log('xen mappings:', xenEntries.map(([jp]) => jp).join(', '));
const xenDict = dictMap['xen'] || '';
console.log('Dict meaning:', xenDict.slice(0, 150));

// Check for other duplicate arka values that shouldn't be duplicated
const suspectDups = Object.entries(arkaToJp)
  .filter(([arka, jpList]) => {
    const unique = [...new Set(jpList.map(j => j.replace(/[なのだですいく]/g, '')))];
    return unique.length > 1;
  })
  .map(([arka, jpList]) => ({ arka, jpList, meaning: (dictMap[arka] || '').slice(0, 80) }));

console.log('\n--- 同一アルカに異なる意味の日本語がマッピング ---');
for (const s of suspectDups) {
  console.log(`  ⚠ ${s.arka} ← [${s.jpList.join(', ')}] : ${s.meaning}`);
}

console.log('\n' + '='.repeat(80));
console.log('AUDIT COMPLETE');
console.log('='.repeat(80));
