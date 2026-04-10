// nuance-patch.js — 日本語の細かいニュアンス（一人称・敬語・文語・文末助詞・命令形・活用形）をアルカに反映
// engine.js の _translateJpLineToArka() の先頭で前処理として呼ばれる

(function() {

// ===== 1. 一人称・二人称バリエーション → アルカ位相別代名詞 =====
// 日本語の一人称は話者の性別・年齢・社会的立場を反映する。アルカにも位相(register)がある。
const JP_PRONOUN_MAP = {
  // --- 一人称 ---
  '吾輩':   'an',     // 文語・尊大 → 標準
  'わがはい': 'an',
  '我':     'an',     // 文語
  'わたくし': 'yuna',  // 上品 → yunk位相
  '私':     'an',     // 標準
  'わたし':  'an',
  'あたし':  'non',    // 女性語 → milia位相
  'あたい':  'noel',   // 下町女性語 → mayu位相
  '僕':     'ami',    // 男性語 → yuul位相
  'ぼく':   'ami',
  '俺':     'an',     // 男性・ぞんざい → 標準(アルカでは性別で位相分け)
  'おれ':   'an',
  'うち':   'non',    // 関西女性語 → milia
  'わし':   'an',     // 老人語 → 標準
  '自分':   'nos',    // 再帰
  '余':     'an',     // 文語・王族
  '拙者':   'an',     // 時代劇
  '小生':   'an',     // 書簡語
  '某':     'an',     // 古語・謙遜
  'われ':   'an',     // 古語
  '我々':   'ans',    // 一人称複数
  '私たち':  'ans',
  '僕たち':  'sean',   // yuul位相複数
  '俺たち':  'ans',
  'あたしたち': 'lena', // milia位相複数

  // --- 二人称 ---
  'あなた':  'ti',     // 標準
  'あんた':  'xian',   // ぞんざい → mayu位相
  '君':     'tol',    // 男性語 → yuul位相
  'きみ':   'tol',
  'おまえ':  'dis',    // ぞんざい → arden位相
  'お前':   'dis',
  'てめえ':  'baz',    // 卑語 → alben位相
  'てめぇ':  'baz',
  '貴様':   'baz',    // 卑語
  'きさま':  'baz',
  'おめえ':  'beg',    // 方言的 → gano位相
  '汝':     'ti',     // 古語 → 標準
  'なんじ':  'ti',
  'そなた':  'ti',     // 古語
  'そち':   'ti',
  'おぬし':  'ti',
  'あなた様': 'moe',   // 上品 → yunk位相
  'あなたさま': 'moe',
  'あなたがた': 'felie', // 上品複数
  'あなたたち': 'tiis',
  '君たち':  'flent',  // yuul複数
  'おまえら': 'bcand', // alben複数
  'てめえら': 'bcand',
};

// ===== 2. 文末表現 → アルカ文末純詞 =====
// 文末助詞は日本語の話者態度を表す。アルカの文末純詞(sentence-final particles)に対応。
const JP_SENTENCE_ENDER_MAP = [
  // 丁寧・敬語系
  { pattern: /でございます$/,  arka: 'aata', register: 'polite' },
  { pattern: /ですわ$/,       arka: 'aano', register: 'female_polite' },
  { pattern: /ますわ$/,       arka: 'aano', register: 'female_polite' },
  { pattern: /でしょう$/,     arka: 'na',   register: 'polite' },    // 推量
  { pattern: /だろう$/,       arka: 'na',   register: 'neutral' },   // 推量
  // 断定・強調
  { pattern: /のだ$/,         arka: 'a',    register: 'neutral' },   // 説明的断定
  { pattern: /んだ$/,         arka: 'a',    register: 'neutral' },
  { pattern: /のです$/,       arka: 'anna', register: 'polite' },    // 丁寧な説明
  { pattern: /んです$/,       arka: 'anna', register: 'polite' },
  // 文語・古語
  { pattern: /である$/,       arka: '', register: 'literary' },       // 処理済み（コピュラ）
  { pattern: /なり$/,         arka: '', register: 'archaic' },        // 古語断定
  { pattern: /ぞ$/,          arka: 'a',    register: 'archaic_male' },
  { pattern: /じゃ$/,         arka: 'a',    register: 'elder' },      // 老人語
  // 女性語
  { pattern: /だわ$/,         arka: 'aan',  register: 'female' },     // rente女性
  { pattern: /よね$/,         arka: 'na',   register: 'neutral' },
  { pattern: /わよ$/,         arka: 'aan',  register: 'female' },
  { pattern: /のよ$/,         arka: 'aan',  register: 'female' },
  { pattern: /かしら$/,       arka: 'na',   register: 'female' },    // 女性的推量
  // 男性語
  { pattern: /だぜ$/,         arka: 'a',    register: 'male' },
  { pattern: /だぞ$/,         arka: 'a',    register: 'male_strong' },
  { pattern: /だよ$/,         arka: 'a',    register: 'neutral' },
  { pattern: /さ$/,          arka: 'a',    register: 'casual_male' },
  // 疑問・確認
  { pattern: /かな$/,         arka: 'na',   register: 'neutral' },
  { pattern: /かね$/,         arka: 'na',   register: 'elder' },
  // 感嘆
  { pattern: /なぁ$/,         arka: 'aa',   register: 'exclamation' },
  { pattern: /ねぇ$/,         arka: 'aa',   register: 'exclamation' },
  { pattern: /よ$/,          arka: '',     register: 'neutral' },     // 軽い強調→無変換
  { pattern: /ね$/,          arka: '',     register: 'neutral' },     // 同意求め→無変換
  { pattern: /な$/,          arka: '',     register: 'neutral' },     // 独り言
];

// ===== 3. 命令・依頼表現 → アルカ法副詞 =====
// 命令形・依頼形: パターンとストリップ後の辞書形復元マップを含む
const JP_IMPERATIVE_MAP = [
  // 丁寧依頼
  { pattern: /[てで]いただけますか$/, arka_prefix: 'fon', strip_re: /[てで]いただけますか$/, polite: 3, teForm: true },
  { pattern: /[てで]くださいませ$/,  arka_prefix: 'fon', strip_re: /[てで]くださいませ$/, polite: 3, teForm: true },
  { pattern: /[てで]ください$/,     arka_prefix: 'fon', strip_re: /[てで]ください$/, polite: 2, teForm: true },
  { pattern: /[てで]くれ$/,         arka_prefix: 're', strip_re: /[てで]くれ$/, polite: 0, teForm: true },
  { pattern: /なさい$/,         arka_prefix: 're', strip: 'なさい', polite: 1 },
  // 動詞命令形(五段活用) — 命令形を辞書形に戻す
  { pattern: /け$/,            arka_prefix: 're', strip: '', polite: 0, verbEnd: true, dictRestore: { '行け': '行く', '書け': '書く', '聞け': '聞く' } },
  { pattern: /れ$/,            arka_prefix: 're', strip: '', polite: 0, verbEnd: true, dictRestore: { '走れ': '走る', '見れ': '見る' } },
  { pattern: /え$/,            arka_prefix: 're', strip: '', polite: 0, verbEnd: true, dictRestore: { '買え': '買う' } },
  // 禁止
  { pattern: /するな$/,         arka_prefix: 'den', strip: 'するな', polite: 0 },
  { pattern: /しないで$/,       arka_prefix: 'fon', strip: 'しないで', polite: 1 },
  { pattern: /ないでください$/,  arka_prefix: 'fon', strip: 'ないでください', polite: 2 },
  { pattern: /な$/,            arka_prefix: 'den', strip: 'な', polite: 0, verbEnd: true },
];

// テ形を辞書形に戻すマップ (行っ→行く, 読ん→読む, etc.)
const TE_FORM_TO_DICT = {
  '行っ': '行く', '歩い': '歩く', '書い': '書く', '聞い': '聞く', '開い': '開く',
  '読ん': '読む', '飲ん': '飲む', '死ん': '死ぬ',
  '走っ': '走る', '切っ': '切る', '入っ': '入る', '作っ': '作る',
  '待っ': '待つ', '立っ': '立つ', '持っ': '持つ',
  '話し': '話す', '出し': '出す', '探し': '探す',
  '飛ん': '飛ぶ', '遊ん': '遊ぶ', '呼ん': '呼ぶ',
  '見': '見る', '食べ': '食べる', '寝': '寝る', '起き': '起きる', '閉じ': '閉じる',
  '出': '出る', '落ち': '落ちる', '気付き': '気付く',
};

// ===== 4. 動詞活用形の正規化 → 語幹抽出 =====
const VERB_CONJUGATION_NORMALIZE = [
  // テイル形（進行/状態）
  { pattern: /っている$/, replace: 'る', aspect: 'progressive' },
  { pattern: /っておる$/, replace: 'る', aspect: 'progressive' },  // 古語
  { pattern: /ている$/, replace: 'る', aspect: 'progressive' },
  { pattern: /ておる$/, replace: 'る', aspect: 'progressive' },
  { pattern: /てる$/, replace: 'る', aspect: 'progressive' },
  // タ形（過去）
  { pattern: /った$/, replace: 'る', aspect: 'past' },
  { pattern: /いた$/, replace: 'く', aspect: 'past' },
  { pattern: /んだ$/, replace: 'む', aspect: 'past' },
  { pattern: /した$/, replace: 'す', aspect: 'past' },
  // マス形
  { pattern: /ります$/, replace: 'る', aspect: 'polite' },
  { pattern: /きます$/, replace: 'く', aspect: 'polite' },
  { pattern: /します$/, replace: 'す', aspect: 'polite' },
  { pattern: /ちます$/, replace: 'つ', aspect: 'polite' },
  { pattern: /にます$/, replace: 'ぬ', aspect: 'polite' },
  { pattern: /びます$/, replace: 'ぶ', aspect: 'polite' },
  { pattern: /みます$/, replace: 'む', aspect: 'polite' },
  { pattern: /ぎます$/, replace: 'ぐ', aspect: 'polite' },
  { pattern: /います$/, replace: 'う', aspect: 'polite' },
  // テ形
  { pattern: /って$/, replace: 'る', aspect: 'te' },
  { pattern: /いて$/, replace: 'く', aspect: 'te' },
  { pattern: /んで$/, replace: 'む', aspect: 'te' },
  { pattern: /して$/, replace: 'す', aspect: 'te' },
];

// ===== 5. 文語・古語正規化 =====
const ARCHAIC_NORMALIZE = [
  { pattern: /にあらず$/, replace: 'ではない' },
  { pattern: /であろう$/, replace: 'だろう' },
  { pattern: /であった$/, replace: 'だった' },
  { pattern: /であります$/, replace: 'です' },
  { pattern: /でござる$/, replace: 'です' },
  { pattern: /でございます$/, replace: 'です' },
  { pattern: /ておる$/, replace: 'ている' },
  { pattern: /おる$/, replace: 'いる' },
  { pattern: /ぞ$/, replace: '' },
  { pattern: /なり$/, replace: 'だ' },   // 古語断定
  // 何ぞ → 何
  { pattern: /何ぞ/, replace: '何' },
];

// ===== 6. 敬語レベルとアルカ文末純詞の対応 =====
// 丁寧度: 0=ぞんざい, 1=普通, 2=丁寧, 3=最敬
function getPolitenessSuffix(level) {
  if (level >= 3) return 'aata';  // 最敬 (～でございます)
  if (level >= 2) return 'aata';  // 丁寧 (～です/～ます)
  return '';  // 普通・ぞんざい → 付加なし
}

// ===== メイン前処理関数 =====
// テキストを受け取り、アルカ翻訳に適した形に正規化して返す
// 戻り値: { text, pronounReplacements, sentenceEnder, imperative, aspects, politeness }
function preprocessJapaneseNuance(text) {
  let processed = text;
  const result = {
    text: '',
    pronounReplacements: [],  // [{original, arka}]
    sentenceEnder: null,      // {arka, register}
    imperative: null,         // {arka_prefix, polite}
    aspects: [],              // ['progressive', 'past', ...]
    politeness: 1,            // 0-3
    isArchaic: false,
    isLiterary: false,
  };

  // --- Step 0: Greetingフレーズを保護 ---
  // 「ありがとうございます」「おやすみなさい」等はgreetings.jsonでマップ済みなので前処理で壊さない
  // engine.jsのREVERSE_GREETINGSで先にマッチされるので、ここでは全文がgreetingかどうかチェック
  const greetingPhrases = [
    'ありがとうございます', 'ありがとう', 'おはようございます', 'おはよう',
    'こんにちは', 'こんばんは', 'おやすみなさい', 'おやすみ',
    'さようなら', 'さよなら', 'ごめんなさい', 'すみません',
    'はじめまして', 'よろしくお願いします', 'いただきます',
    'お元気ですか', '久しぶり', 'おめでとう',
  ];
  const trimmed = processed.trim();
  for (const gp of greetingPhrases) {
    if (trimmed === gp || trimmed === gp + '。') {
      // 全文がgreeting→前処理スキップ
      result.text = trimmed;
      return result;
    }
  }

  // --- Step 1: 文語・古語を現代語に正規化 ---
  for (const rule of ARCHAIC_NORMALIZE) {
    if (rule.pattern.test(processed)) {
      result.isArchaic = true;
      processed = processed.replace(rule.pattern, rule.replace);
    }
  }

  // 「吾輩は猫である」→ 「である」は copula として処理される

  // --- Step 2: 命令・依頼表現の検出 ---
  for (const rule of JP_IMPERATIVE_MAP) {
    if (rule.pattern.test(processed)) {
      result.imperative = { arka_prefix: rule.arka_prefix, polite: rule.polite };
      result.politeness = rule.polite;

      if (rule.verbEnd && rule.dictRestore) {
        // 命令形→辞書形復元 (行け→行く)
        for (const [imperative, dictForm] of Object.entries(rule.dictRestore)) {
          if (processed.endsWith(imperative)) {
            processed = processed.slice(0, -imperative.length) + dictForm;
            break;
          }
        }
      } else if (rule.teForm) {
        // テ形+ください等 → テ形語幹を辞書形に戻す
        const stripPattern = rule.strip_re || rule.pattern;
        processed = processed.replace(stripPattern, '');
        // 残ったテ形語幹（行っ、読ん、見 etc.）を辞書形に復元
        const trimmedForTe = processed.trim();
        for (const [teStem, dictForm] of Object.entries(TE_FORM_TO_DICT)) {
          if (trimmedForTe.endsWith(teStem)) {
            processed = trimmedForTe.slice(0, -teStem.length) + dictForm;
            break;
          }
        }
      } else if (rule.strip) {
        processed = processed.replace(rule.pattern, '');
      }
      break;
    }
  }

  // --- Step 3: 文末表現の検出・除去 ---
  if (!result.imperative) {
    for (const rule of JP_SENTENCE_ENDER_MAP) {
      if (rule.pattern.test(processed)) {
        result.sentenceEnder = { arka: rule.arka, register: rule.register };
        // 丁寧度推定
        if (rule.register === 'polite' || rule.register === 'female_polite') {
          result.politeness = 2;
        }
        if (rule.register === 'literary' || rule.register === 'archaic') {
          result.isLiterary = true;
        }
        // 文末表現を除去して翻訳可能にする
        processed = processed.replace(rule.pattern, '');
        break;
      }
    }
  }

  // --- Step 4: 敬語レベル検出 ---
  if (/ます$|ました$|ません$|でしょう$|ございます$/.test(text)) {
    result.politeness = Math.max(result.politeness, 2);
  }
  if (/いただ|くださ|申し|参り|おり/.test(text)) {
    result.politeness = Math.max(result.politeness, 3);
  }

  // --- Step 5: 一人称・二人称の位相変換 ---
  // 長い語から優先マッチ
  const sortedPronouns = Object.entries(JP_PRONOUN_MAP)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [jp, arka] of sortedPronouns) {
    if (processed.includes(jp)) {
      result.pronounReplacements.push({ original: jp, arka });
      processed = processed.replace(new RegExp(jp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ` __NUANCE_PRONOUN_${arka}__ `);
    }
  }

  // --- Step 6: 動詞活用形の正規化 ---
  // トークン化前の全体テキストに対して行う
  for (const rule of VERB_CONJUGATION_NORMALIZE) {
    if (rule.pattern.test(processed)) {
      const before = processed;
      processed = processed.replace(rule.pattern, rule.replace);
      if (processed !== before) {
        result.aspects.push(rule.aspect);
      }
    }
  }

  // 「感謝いたします」→ 「感謝」
  processed = processed.replace(/いたします$/, '');
  processed = processed.replace(/いたす$/, '');

  // --- Step 7: 丁寧接頭辞「お」を除去 ---
  // 「お花」→「花」、「お水」→「水」
  processed = processed.replace(/お([一-鿿])/g, '$1');

  result.text = processed.trim();
  return result;
}

// ===== 後処理: 翻訳結果にニュアンスを付加 =====
function postprocessArkaNuance(arkaText, nuanceInfo) {
  let result = arkaText;

  // 命令形の法副詞を動詞の前に挿入
  if (nuanceInfo.imperative) {
    const prefix = nuanceInfo.imperative.arka_prefix;
    // アルカの語順: 主語 法副詞 動詞
    // 翻訳結果の最後の語（通常動詞）の前に挿入
    const parts = result.split(/\s+/).filter(p => p);
    if (parts.length > 0) {
      // [翻訳不能]マーカーでない最後の語を動詞と見なす
      const lastIdx = parts.length - 1;
      parts.splice(lastIdx, 0, prefix);
      result = parts.join(' ');
    }
  }

  // 文末純詞を追加
  if (nuanceInfo.sentenceEnder && nuanceInfo.sentenceEnder.arka) {
    result = result + ' ' + nuanceInfo.sentenceEnder.arka;
  }

  // 丁寧語の文末純詞追加（sentenceEnderがない場合）
  if (!nuanceInfo.sentenceEnder && nuanceInfo.politeness >= 2) {
    const suffix = getPolitenessSuffix(nuanceInfo.politeness);
    if (suffix) {
      result = result + ' ' + suffix;
    }
  }

  return result.trim();
}

// Export for use in engine.js
window.NuancePatch = {
  JP_PRONOUN_MAP,
  preprocessJapaneseNuance,
  postprocessArkaNuance,
};

})();
