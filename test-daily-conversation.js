const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = '<html><body><div id="output"></div></body></html>';
const dom = new JSDOM(html);
const code = fs.readFileSync('engine.js', 'utf8');
const fn = new Function('window', 'document', code + '; return ArkaEngine;');
const ArkaEngine = fn(dom.window, dom.window.document);
const dict = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));
const greetings = JSON.parse(fs.readFileSync('greetings.json', 'utf8'));
const memory = JSON.parse(fs.readFileSync('sentence_memory.json', 'utf8'));
const engine = new ArkaEngine(dict, greetings, memory);

const TESTS = [
  // === 挨拶・基本 ===
  'おはようございます',
  'こんにちは',
  'こんばんは',
  'おやすみなさい',
  'ありがとうございます',
  'ごめんなさい',
  'すみません',
  'お元気ですか',
  'はい、元気です',
  'さようなら',
  'また明日',
  'お久しぶりです',
  'よろしくお願いします',
  // === 自己紹介 ===
  '私はマリナです',
  '私は学生です',
  '私は日本人です',
  '二十歳です',
  '東京に住んでいます',
  '趣味は読書です',
  // === 食事 ===
  'お腹が空いた',
  '何か食べたい',
  '水をください',
  'コーヒーを飲みたい',
  'この料理はおいしい',
  '今日の夕食は何ですか',
  '一緒に食べましょう',
  'もう食べられない',
  'いただきます',
  'ごちそうさまでした',
  // === 天気・時間 ===
  '今日はいい天気ですね',
  '明日は雨が降るらしい',
  '今何時ですか',
  '朝は寒かった',
  '夏は暑い',
  '風が強い',
  '雪が降っている',
  // === 移動・場所 ===
  '駅はどこですか',
  '学校に行きます',
  '家に帰りたい',
  'ここに座ってください',
  'あそこに猫がいる',
  '右に曲がってください',
  'まっすぐ歩いてください',
  '電車に乗る',
  'バスに乗り遅れた',
  // === 買い物 ===
  'これはいくらですか',
  'それをください',
  '高すぎる',
  '安い方がいい',
  'お金がない',
  'カードで払えますか',
  // === 感情・状態 ===
  '嬉しい',
  '悲しい',
  '怒っている',
  '疲れた',
  '眠い',
  '楽しい',
  '寂しい',
  '怖い',
  '心配です',
  '大丈夫です',
  'びっくりした',
  'つまらない',
  '恥ずかしい',
  // === 依頼・許可 ===
  '手伝ってください',
  'ちょっと待ってください',
  '入ってもいいですか',
  '写真を撮ってもいいですか',
  'もう一度言ってください',
  '静かにしてください',
  '窓を開けてください',
  'ドアを閉めてください',
  // === 質問 ===
  'これは何ですか',
  'あなたは誰ですか',
  'なぜですか',
  'いつ来ますか',
  'どこに行きますか',
  'どうやって行きますか',
  '好きな食べ物は何ですか',
  '何歳ですか',
  // === 日常動作 ===
  '朝六時に起きます',
  '毎日走っています',
  '本を読んでいる',
  '音楽を聴いている',
  '友達と話した',
  '映画を見に行った',
  '手紙を書いている',
  '部屋を掃除した',
  '服を洗った',
  '散歩に行こう',
  '電話をかけた',
  '買い物に行く',
  // === 家族・人間関係 ===
  '母が料理を作っている',
  '父は仕事に行った',
  '兄は大学生です',
  '妹は可愛い',
  '友達に会いたい',
  '彼は優しい人です',
  '彼女は頭がいい',
  // === 仕事・学校 ===
  '仕事は大変です',
  '明日は休みです',
  '宿題を忘れた',
  '試験は来週です',
  '会議は三時からです',
  '先生に質問がある',
  // === 体調 ===
  '頭が痛い',
  '熱がある',
  '病院に行った方がいい',
  '薬を飲んだ',
  '具合が悪い',
  'もう治った',
  // === 意見・判断 ===
  'それはいい考えです',
  '私もそう思います',
  'それは違うと思う',
  '分かりました',
  '分かりません',
  '知りません',
  '賛成です',
  '反対です',
  // === 複合・やや長い文 ===
  '明日は早いので今日は早く寝ます',
  '雨が降ったら家にいます',
  'もし時間があれば遊びに来てください',
  '彼が来るまで待ちましょう',
  '日本語を勉強しています',
  '猫と犬のどちらが好きですか',
  '昨日買った本を読んでいる',
  'この花は美しいですね',
  '海が見える部屋に泊まりたい',
  '一人で歩くのは怖い',
  '約束を忘れないでください',
  '嘘をつかないでください',
];

let total = 0, complete = 0, partial = 0, fail = 0;
const unknowns = {};
const failures = [];

for (const t of TESTS) {
  total++;
  const r = engine.translateJapaneseToArka(t);
  const text = r.translation || '';
  const bracketWords = text.match(/\[([^\]]+)\]/g) || [];
  const hasBracket = bracketWords.length > 0;

  if (!hasBracket && text && !text.includes('undefined')) {
    complete++;
  } else if (text && bracketWords.length < 3) {
    partial++;
    for (const bw of bracketWords) {
      const w = bw.replace(/[\[\]]/g, '');
      unknowns[w] = (unknowns[w] || 0) + 1;
    }
    failures.push({ text: t, result: text, type: 'partial' });
  } else {
    fail++;
    for (const bw of bracketWords) {
      const w = bw.replace(/[\[\]]/g, '');
      unknowns[w] = (unknowns[w] || 0) + 1;
    }
    failures.push({ text: t, result: text, type: 'fail' });
  }
}

console.log(`\n=== 日常会話テスト結果 ===`);
console.log(`総文数: ${total}`);
console.log(`完全翻訳: ${complete} (${(complete/total*100).toFixed(1)}%)`);
console.log(`部分翻訳: ${partial} (${(partial/total*100).toFixed(1)}%)`);
console.log(`失敗: ${fail} (${(fail/total*100).toFixed(1)}%)`);

console.log(`\n--- 未知語ランキング ---`);
const sorted = Object.entries(unknowns).sort((a,b) => b[1] - a[1]);
for (const [w, c] of sorted) {
  console.log(`  ${w}: ${c}回`);
}

console.log(`\n--- 失敗・部分翻訳 (全件) ---`);
for (const f of failures) {
  console.log(`  [${f.type}] ${f.text} → ${f.result}`);
}
