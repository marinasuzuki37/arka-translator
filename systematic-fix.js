/**
 * Systematic fix plan based on mass test analysis (283 unknown words)
 * 
 * Category 1: COMMON WORDS (158 occurrences) — Add to JP_ARKA_OVERRIDES
 * Category 2: VERB CONJUGATIONS (37 occurrences) — Improve _lookupJapanese
 * Category 3: FRAGMENT LEAKAGE (112 occurrences) — Fix tokenizer
 * Category 4: お/ご HONORIFIC PREFIXES (38 occurrences) — Add prefix stripping
 * Category 5: KANSAI (16 occurrences) — Improve normalizeKansai
 * Category 6: PARTICLES/ENDINGS (12 occurrences) — Better handling
 */

// ===== CATEGORY 1: Missing common words to add to JP_ARKA_OVERRIDES =====
const MISSING_COMMON_WORDS = {
  // --- Nouns (high frequency in test) ---
  '写真': 'foto',         // 写真 — from dict: foto=写真
  '顔': 'fas',            // 顔 — from dict: fas=顔
  '元気': 'siiyu',        // 元気 — siiyu=元気な、すごい
  '資料': 'semas',        // 資料 — semas=資料、書類
  '笑顔': 'gahfas',       // 笑顔 — compound: gah(笑う)+fas(顔)
  '気': 'seles',          // 気 — seles=気、精神
  '意味': 'yol',          // 意味 — yol=意味
  '話': 'kul',            // 話 — kul=話す
  '事': 'vis',            // 事 — vis=こと
  '子': 'lazal',          // 子 — lazal=子供
  '色': 'kolor',          // 色 — kolor=色
  '駅': 'gaatl',          // 駅 — gaatl=駅
  '電車': 'gaatyun',      // 電車 — gaatyun=電車
  '暇': 'frei',           // 暇 — frei=暇な
  '暇な': 'frei',
  '町': 'envil',          // 町 — envil=町
  '窓': 'fenist',         // 窓 — fenist=窓
  '桜': 'luxia',          // 桜 — luxia=桜
  '波': 'lens',           // 波 — lens=波
  '岸': 'mil',            // 岸 — mil=岸 (careful: also 鳥)
  '瞳': 'inia',           // 瞳 — inia=瞳
  '霞': 'fask',           // 霞 — fask=霧、霞
  '奥': 'xa',             // 奥 — 内部、奥
  '美貌': 'fiiyu',        // 美貌 — fiiyu=美しい
  '庭園': 'hort',         // 庭園 — hort=庭
  '庭': 'hort',
  '池': 'erel',           // 池 — erel=池
  '首': 'nekk',           // 首 — nekk=首
  '皺': 'siv',            // 皺 — siv=しわ
  '生涯': 'livro',        // 生涯 — livro=人生、命
  '恥': 'paxt',           // 恥 — paxt=恥
  '袴': 'foan',           // 袴 — foan=ズボン(近似)
  '縞': 'rain',           // 縞 — rain=縞模様(近似)
  '稜線': 'leev',         // 稜線 — leev=線(近似)
  '縁側': 'albem',        // 縁側 — albem=ベランダ(近似)
  '見当': 'loki',         // 見当 — loki=分かる(近似)
  '特徴': 'avai',         // 特徴 — avai=特徴
  '充実感': 'kaxen',      // 充実感 — kaxen=満たす(近似)
  '変貌': 'miyu',         // 変貌 — miyu=変化
  '奇怪': 'zal',          // 奇怪 — zal=不思議な
  '残像': 'axk',          // 残像 — axk=影(近似)
  '正直': 'nektxan',      // 正直 — nektxan=真実(近似)
  '奥底': 'hol',          // 奥底 — hol=深い(近似)
  '遅刻': 'demi',         // 遅刻 — demi=遅い
  
  // --- Keigo/Business words ---
  '確認': 'dix',          // 確認 — dix=確認する
  '連絡': 'lexn',         // 連絡 — lexn=連絡
  '相談': 'berna',        // 相談 — berna=相談
  '検討': 'rafis',        // 検討 — rafis=考える
  '指摘': 'dix',          // 指摘 — dix=指摘(近似)
  '指定': 'dix',          // 指定
  '回答': 'sokta',        // 回答 — sokta=返信
  '要望': 'lax',          // 要望 — lax=欲しい
  '承知': 'loki',         // 承知 — loki=分かる
  '迷惑': 'xet',          // 迷惑 — xet=迷惑
  '丁寧': 'alit',         // 丁寧 — alit=丁寧な
  '多忙': 'diina',        // 多忙 — diina=忙しい(近似)
  '恐縮': 'vantant',      // 恐縮 — vantant=すみません(近似)
  '手数': 'fas',          // 手数 — 近似
  '利用': 'miv',          // 利用
  '署名': 'leste',        // 署名 — leste=サイン
  '不明': 'nem',          // 不明 — nem=不明
  '件': 'vis',            // 件 — vis=こと
  '点': 'vis',            // 点 — vis=こと(近似)
  '本日': 'fis',          // 本日 = 今日
  '先日': 'veid',         // 先日 — veid=先日
  '弊社': 'non',          // 弊社 — non=私の(近似、自社)
  '打ち合わせ': 'ata',    // 打ち合わせ — ata=会議(近似)
  '会議': 'ata',
  '誠に': 'yuliet',       // 誠に — yuliet=本当に
  '誠': 'yuliet',
  '幸い': 'nau',          // 幸い — nau=嬉しい(近似)
  
  // --- Time/Quantity ---
  '今': 'fia',            // 今 — 近似
  '今夜': 'fisvird',      // 今夜 — compound: fis(今日)+vird(夜)
  '明後日': 'ovelis',     // 明後日 — ovelis=明後日
  '一緒': 'kok',          // 一緒 — kok=一緒に
  '一緒に': 'kok',
  '大勢': 'di',           // 大勢 — di=たくさん
  '二度': 'ru',           // 二度 — ru=二(近似)
  '一枚': 'ves',          // 一枚 — ves=一つ
  
  // --- Expressions ---
  'まったく': 'yuu',      // まったく — yuu=全く
  'どこ': 'tee',          // どこ — tee=どこ
  'どこか': 'netatee',    // どこか — 不定のどこか
  'いちど': 'rask',       // いちど — rask=一度(近似)
  '一度': 'rask',
  '何事': 'to',           // 何事 — to=何
  'まじ': 'yuliet',       // まじ — yuliet=本当
  'いや': 'mi',           // いや — mi=いいえ(近似)
};

// ===== CATEGORY 2: Verb forms that need better conjugation handling =====
// These are forms like 笑って, 待って, 住んで — te-form verbs
// Need to add explicit te-form / ta-form entries AND improve _lookupJapanese
const VERB_CONJUGATION_OVERRIDES = {
  // て-form (te-form) of known verbs
  '笑って': 'gah',        // 笑う→gah
  '待って': 'vat',         // 待つ→vat
  '住んで': 'sik',         // 住む→sik
  '住ん': 'sik',           // 住ん(で) fragment
  '困って': 'naki',        // 困る→naki
  '忘れて': 'kel',         // 忘れる→kel
  '遅れて': 'demi',        // 遅れる→demi
  '歩いて': 'luk',         // 歩く→luk
  '寄って': 'amis',        // 寄る→amis(近い→近づく)
  '着て': 'sab',           // 着る→sab
  '握って': 'til',         // 握る→til(持つ)
  '泣いて': 'ena',         // 泣く→ena
  '映って': 'nams',        // 映る→nams(映像)
  '引いて': 'lef',         // 引く→近似
  '抱いて': 'meks',        // 抱く→meks(抱擁)
  '呼んで': 'il',          // 呼ぶ→il(呼ぶ)
  '呼ん': 'il',
  '打ち': 'vas',           // 打つ→vas(打つ、戦う)
  '砕け': 'rig',           // 砕ける→rig(壊す)
  '座り': 'skin',          // 座る→skin
  '見上げて': 'in',        // 見上げる→in(見る)
  '瞬いて': 'flip',        // 瞬く→flip(輝く)
  '佇んで': 'xtam',        // 佇む→xtam(立つ)
  '佇ん': 'xtam',
  '見えた': 'in',          // 見える→in
  '止まった': 'mono',      // 止まる→mono
  '過ぎ去った': 'ses',     // 過ぎ去った→ses(過去)
  '振り返ら': 'in',        // 振り返る→in(見る)
  '照らして': 'far',       // 照らす→far(光)
  '照ら': 'far',
  '降り積もる': 'ar',      // 降り積もる→ar(降る)
  '降り積': 'ar',
  '包まれる': 'meks',      // 包む→meks
  '包': 'meks',
  '染まり': 'kolor',       // 染まる→kolor(色)
  '揺らし': 'mag',         // 揺らす→mag
  '連れ去って': 'ke',      // 連れ去る→ke(行く)
  '去り': 'ke',            // 去る→ke
  '生き続けて': 'ikn',     // 生き続ける→ikn
  '送って': 'xen',         // 送る→xen(近似)
  '遅くなって': 'demi',    // 遅くなる→demi
  '遅くなり': 'demi',
  '戻ら': 'kolt',          // 戻る→kolt
  '手放': 'tifl',          // 手放す→tifl(失う)
  '語る': 'kul',           // 語る→kul(話す)
  '組み': 'kok',           // 組む→kok(一緒)
  '傾け': 'mag',           // 傾ける→mag(揺れる→傾き)
  
  // -たい形 (desire form)
  '行きたい': 'ke',        // 行く→ke
  '行きたく': 'ke',
  '食べたい': 'kui',       // 食べる→kui
  '読み終わった': 'isk',   // 読み終わる→isk(読む)
  '読み終': 'isk',
  '知ってる': 'ser',       // 知っている→ser
  
  // -なかった / -ない compound forms  
  '眠れなかった': 'mok',   // 眠れる→mok
  '忘れてしまって': 'kel', // 忘れる→kel
  '安くなりませんか': 'dook', // 安い→dook(安い)
  '怒られちゃった': 'jo',  // 怒る→jo
  '忙しくて': 'diina',     // 忙しい→diina
  '遅かった': 'demi',      // 遅い→demi
  '振り返らなかった': 'in', // 振り返る→in
  
  // Keigo compound verb forms
  '申します': 'kul',       // 申す→kul(言う)
  '申し上げます': 'kul',
  '申し上げております': 'kul',
  'いただけます': 'sentant', // いただく→sentant(ありがとう)
  'いただき': 'sentant',
  '存じます': 'ser',       // 存じる→ser(知る)
  'ございます': 'xa',      // ございます→xa(ある)
  'ございません': 'mi',    // ございません→mi(ない)
  'まいります': 'ke',      // 参る→ke(行く)
  'させていただきます': 'sentant',
  
  // Common ます forms
  'ます': '',              // drop (polite suffix)
  
  // Literary/poetic verb forms
  '消えかけた': 'sedo',    // 消えかける→sedo
  '醜く': 'yam',           // 醜い→yam(悪い)
  '無かった': 'mi',        // 無い→mi
  '無く': 'mi',
  'しなかった': 'mi',      // しない→mi
};

// ===== CATEGORY 3: Kansai normalization improvements =====
const KANSAI_NORMALIZATIONS = {
  'めちゃくちゃ': 'とても',  // already handled partially
  'やねん': 'なのだ',
  'やろ': 'だろう',
  'やね': 'だね',
  'そや': 'そうだ',
  'しゃあない': '仕方がない',
  'かなわん': 'たまらない',
  'あかん': 'だめ',
  'うそやろ': '嘘だろう',
  'まじで': '本当に',
  'めっちゃ': 'とても',
  'めっちゃよかった': 'とても良かった',
  'せん': 'しない',
  'んちゃう': 'のではないか',
  '早よ': '早く',
};

console.log('Missing common words to add:', Object.keys(MISSING_COMMON_WORDS).length);
console.log('Verb conjugation entries to add:', Object.keys(VERB_CONJUGATION_OVERRIDES).length);
console.log('Kansai normalizations to improve:', Object.keys(KANSAI_NORMALIZATIONS).length);
console.log('Total new entries:', Object.keys(MISSING_COMMON_WORDS).length + Object.keys(VERB_CONJUGATION_OVERRIDES).length);
