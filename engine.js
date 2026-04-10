// ===== ARKA TRANSLATION ENGINE v4.0 =====
// Enhanced with melidia wiki parallel corpus data
// + Subject inference, Kansai→Southern dialect, Pronunciation guide, Poetry mode
// + Translation mode support: 新生アルカ/制アルカ/古アルカ/俗アルカ

class ArkaEngine {
  constructor() {
    this.dict = [];
    this.wordMap = new Map();      // arka word → entry
    this.reverseMap = new Map();   // japanese keyword → [{arkaWord, entry, score}]
    this.sentenceMemory = [];      // parallel corpus for sentence-level matching
    this.greetingsMap = new Map(); // greeting word → Japanese meaning
    this.ready = false;
    this.currentVariant = 'shinsee'; // Default: 新生アルカ
  }

  setVariant(variantId) {
    if (ArkaVariants && ArkaVariants.VARIANTS[variantId]) {
      this.currentVariant = variantId;
    }
  }

  getVariant() {
    return this.currentVariant;
  }

  // --- Initialize with dictionary data ---
  async init(dictData) {
    this.dict = dictData;
    this._buildIndices();
    // Load sentence memory, wiki vocab, and greetings in parallel
    await Promise.all([
      this._loadSentenceMemoryFromFile(),
      this._loadWikiVocab(),
      this._loadGreetings()
    ]);
    this.ready = true;
  }

  _buildIndices() {
    // Forward index: arka → entry
    // For homographs like ket/ket(2), store ALL entries and pick the most common/useful one
    const allEntries = new Map(); // key → [entry, entry, ...]
    for (const entry of this.dict) {
      const key = entry.word.toLowerCase().replace(/\(\d+\)$/, '').trim();
      if (!allEntries.has(key)) allEntries.set(key, []);
      allEntries.get(key).push(entry);
    }
    // For single entries, just use them. For multiple, prefer the one with more common meaning.
    for (const [key, entries] of allEntries) {
      if (entries.length === 1) {
        this.wordMap.set(key, entries[0]);
      } else {
        // Pick the entry whose meaning contains common Japanese words (not technical/specialized)
        // Prefer entries with shorter, more common meanings
        let best = entries[0];
        for (const e of entries) {
          const m = e.meaning || '';
          // Prefer entries with common noun/verb meanings over letter/symbol meanings
          if (m.includes('の文字') || m.includes('接尾辞') || m.includes('接頭辞')) continue;
          best = e;
          break;
        }
        this.wordMap.set(key, best);
      }
    }

    // Reverse index: Japanese → arka
    for (const entry of this.dict) {
      const arkaWord = entry.word.replace(/\(\d+\)$/, '').trim();
      const meaning = entry.meaning || '';
      const keywords = this._extractJapaneseKeywords(meaning);
      for (const kw of keywords) {
        if (!this.reverseMap.has(kw)) {
          this.reverseMap.set(kw, []);
        }
        this.reverseMap.get(kw).push({
          arkaWord,
          entry,
          level: entry.level || 99
        });
      }
    }

    // Sort reverse entries by level (lower = more basic = preferred)
    for (const [, arr] of this.reverseMap) {
      arr.sort((a, b) => (a.level || 99) - (b.level || 99));
    }
  }

  _extractJapaneseKeywords(meaning) {
    const keywords = new Set();
    let cleaned = meaning.replace(/［[^］]+］/g, '');
    const parts = cleaned.split(/[、。；;,\/（）()～〜・！？!?\s]+/);
    // Japanese particles/single-char words that must never be standalone keywords
    const STOP_WORDS = new Set([
      'は', 'が', 'の', 'に', 'へ', 'で', 'と', 'も', 'を',
      'い', 'う', 'え', 'お', 'か', 'こ', 'そ', 'な', 'ね',
      'よ', 'れ', 'ろ', 'わ', 'ん', 'だ', 'た', 'て', 'し',
      'ハイ', 'やぁ', 'やあ', 'は～い'
    ]);
    for (let part of parts) {
      part = part.trim();
      // Require minimum 2 chars to avoid single-particle pollution
      if (part.length >= 2 && part.length <= 20) {
        if (!STOP_WORDS.has(part)) {
          keywords.add(part);
        }
        const stripped = part.replace(/[をはがのにへでとも]$/g, '');
        if (stripped.length >= 2 && stripped !== part && !STOP_WORDS.has(stripped)) {
          keywords.add(stripped);
        }
      }
    }
    return keywords;
  }

  // ===== SENTENCE MEMORY (parallel corpus from melidia wiki) =====
  async _loadSentenceMemoryFromFile() {
    try {
      const resp = await fetch('sentence_memory.json');
      if (resp.ok) {
        const data = await resp.json();
        this.sentenceMemory = data;
        console.log(`Loaded ${data.length} sentence pairs from melidia wiki corpus`);
      } else {
        console.warn('Failed to load sentence_memory.json, using fallback');
        this._loadSentenceMemoryFallback();
      }
    } catch (e) {
      console.warn('Error loading sentence_memory.json:', e);
      this._loadSentenceMemoryFallback();
    }
  }

  _loadSentenceMemoryFallback() {
    this.sentenceMemory = [
      {arka:"tu et durne e 5 sel iten lamsae bezet l'at alagel im xelt e ruuj, xel nainan sein mix lexn t'alklax i seelarna t'arbazard le landir melsel, ke atu taxel.", ja:"元日を待ち望むアルバザードの中央アルナ市から救難信号を受けて警官たちがそこへ急行したのは、ルージュの月に舞い降りた、例年よりも早い初雪の日から五日が経った夜のことである。"},
      {arka:"luus ke atu kont lo tio vei felan tovat xok maldel.", ja:"学生が騒いで喧嘩しただけだろう、彼らはそう思いつつもそこへ向かった。"},
      {arka:"son luus na vem, ku vil em fi ka xe felez.", ja:"それゆえ彼らは怯えて、とある教室で何も言えなくなってしまった。"},
      {arka:"omi e felez es rig vamel.", ja:"教室の戸が乱暴に破壊されていた。"},
      {arka:"yan elen sein es lufabad al aks.", ja:"そして机が床に散乱していた。"},
      {arka:"fok tu aks til eri hanel.", ja:"しかもその床には血が一面に広がっていた。"},
    ];
  }

  // Load greetings from external JSON
  async _loadGreetings() {
    try {
      const resp = await fetch('greetings.json');
      if (resp.ok) {
        const data = await resp.json();
        for (const [word, meaning] of Object.entries(data)) {
          this.greetingsMap.set(word.toLowerCase(), meaning);
        }
        // Hardcoded entries have more nuanced meanings - override JSON for those
        for (const [word, meaning] of Object.entries(ArkaEngine.GREETINGS)) {
          this.greetingsMap.set(word, meaning);
        }
        console.log(`Loaded ${this.greetingsMap.size} greeting expressions`);
      } else {
        // Fallback to static
        for (const [word, meaning] of Object.entries(ArkaEngine.GREETINGS)) {
          this.greetingsMap.set(word, meaning);
        }
      }
    } catch (e) {
      console.warn('Error loading greetings.json:', e);
      for (const [word, meaning] of Object.entries(ArkaEngine.GREETINGS)) {
        this.greetingsMap.set(word, meaning);
      }
    }
  }

  // Load wiki vocabulary supplement
  async _loadWikiVocab() {
    try {
      const resp = await fetch('wiki_vocab.json');
      if (resp.ok) {
        const data = await resp.json();
        let added = 0;
        for (const v of data) {
          const key = v.word.toLowerCase();
          if (!this.wordMap.has(key)) {
            const entry = { word: v.word, meaning: v.meaning, level: 99, pos: [], source: 'wiki' };
            this.wordMap.set(key, entry);
            this.dict.push(entry);
            // Also add to reverse index
            const keywords = this._extractJapaneseKeywords(v.meaning);
            for (const kw of keywords) {
              if (!this.reverseMap.has(kw)) this.reverseMap.set(kw, []);
              this.reverseMap.get(kw).push({ arkaWord: v.word, entry, level: 99 });
            }
            added++;
          }
        }
        console.log(`Added ${added} wiki vocabulary entries to dictionary`);
      }
    } catch (e) {
      console.warn('Error loading wiki_vocab.json:', e);
    }
  }

  // --- Core language data ---
  // Standard pronouns
  static PRONOUNS = {
    'an': '私', 'ti': 'あなた', 'lu': '彼/彼女', 'la': 'あの人', 'el': '人々/不特定の人',
    'ans': '私たち', 'tiis': 'あなたたち', 'luus': '彼ら', 'laas': 'あの人たち',
    'ant': '私の', 'tiil': 'あなたの', 'luut': '彼の/彼女の', 'laat': 'あの人の',
    'anso': '私たちの', 'tiiso': 'あなたたちの',
    'tu': 'これ/それ', 'le': 'あれ/その', 'tuus': 'これら', 'lees': 'あれら',
    'nos': '自分', 'nozet': '自分の',
    // 代動詞
    'so': 'そうする',
    // 疑問代詞
    'to': '何', 'xe': '誰か/何か', 'fi': '何か/誰か',
    // milia位相（女性語）
    'non': '私[女性語]', 'noan': '私の[女性語]',
    'lena': '私たち[女性語]', 'lenan': '私たちの[女性語]',
    'tyu': 'あなた[女性語]', 'tuan': 'あなたの[女性語]',
    'lilis': 'あなたたち[女性語]', 'lilin': 'あなたたちの[女性語]',
    'nono': '私の[幼児語]',
    // mayu位相（古語）
    'noel': 'アタシ[古語]', 'notte': 'アタシの[古語]',
    'xian': 'アンタ[古語]', 'xiant': 'アンタの[古語]',
    'xenon': 'アタシたち[古語]', 'xenoan': 'アタシたちの[古語]',
    'telul': 'アンタたち[古語]', 'telet': 'アンタたちの[古語]',
    // yuul位相（男性語）
    'ami': '僕[男性語]', 'amit': '僕の[男性語]',
    'tol': '君[男性語]', 'tolte': '君の[男性語]',
    'sean': '僕たち[男性語]', 'seant': '僕たちの[男性語]',
    'flent': '君たち[男性語]', 'flandol': '君たちの[男性語]',
    // yunk位相（鳥籠姫）
    'yuna': 'わたくし[上品]', 'yunol': 'わたくしの[上品]',
    'moe': 'あなた様[上品]', 'moen': 'あなた様の[上品]',
    'kolet': 'わたくしたち[上品]', 'ekol': 'わたくしたちの[上品]',
    'felie': 'あなたがた[上品]', 'felial': 'あなたがたの[上品]',
    // rente位相（丁寧語の三人称）
    'ansiel': 'あちらの方[丁寧]', 'ansiett': 'あちらの方の[丁寧]',
    'lusiel': 'こちらの方[丁寧]', 'lusiett': 'こちらの方の[丁寧]',
    // yunte位相（子供語）
    'lain': '彼ら[子供語]', 'laint': '彼らの[子供語]',
  };

  static REVERSE_PRONOUNS = {
    // --- 一人称（位相別マッピング） ---
    '私': 'an', 'わたし': 'an',
    '僕': 'ami', 'ぼく': 'ami',           // yuul位相（男性語）
    '俺': 'an', 'おれ': 'an',
    'あたし': 'non',                       // milia位相（女性語）
    'あたい': 'noel',                      // mayu位相（下町女性語）
    'うち': 'non',                         // 関西女性語→milia
    'わたくし': 'yuna',                    // yunk位相（上品）
    '吾輩': 'an', 'わがはい': 'an',        // 文語・尊大
    '我': 'an', 'われ': 'an',             // 古語
    'わし': 'an',                          // 老人語
    '余': 'an', '拙者': 'an', '小生': 'an', '某': 'an',  // 文語
    // 一人称複数
    '私たち': 'ans', 'わたしたち': 'ans', '我々': 'ans',
    '僕たち': 'sean', '俺たち': 'ans',    // yuul複数
    'あたしたち': 'lena',                  // milia複数
    // --- 二人称（位相別マッピング） ---
    'あなた': 'ti',
    '君': 'tol', 'きみ': 'tol',           // yuul位相
    'あんた': 'xian',                      // mayu位相
    'おまえ': 'dis', 'お前': 'dis',       // arden位相
    'てめえ': 'baz', 'てめぇ': 'baz', '貴様': 'baz', 'きさま': 'baz',  // alben位相
    'おめえ': 'beg',                       // gano位相
    '汝': 'ti', 'なんじ': 'ti', 'そなた': 'ti', 'そち': 'ti', 'おぬし': 'ti',  // 古語
    'あなた様': 'moe', 'あなたさま': 'moe', // yunk位相
    // 二人称複数
    'あなたたち': 'tiis', 'あなたがた': 'felie',
    '君たち': 'flent', 'おまえら': 'bcand', 'てめえら': 'bcand',
    // --- 三人称 ---
    '彼': 'lu', '彼女': 'lu', '彼ら': 'luus',
    'あの人': 'la',
    // --- 指示・所有 ---
    'これ': 'tu', 'この': 'tu', 'それ': 'tu', 'あれ': 'le', 'あの': 'le',
    'これら': 'tuus', 'あれら': 'lees',
    '私の': 'ant', 'あなたの': 'tiil',
    '僕の': 'amit', '俺の': 'ant',
  };

  static CASE_PARTICLES = {
    'a': '～に/～へ', 'al': '～に/～へ',
    'i': '～から', 'it': '～から',
    'ka': '～で/～に(場所)',
    'im': '～のとき/～に(時間)',
    'kon': '～で(道具)',
    'ok': '～と一緒に',
    'ol': 'もし/～なら',
    'e': '～の',
    'kont': '～しながら',
    'frem': '～の近くに',
    'pot': '～の中に',
    'xed': '～なしで',
    'yun': '～のように/～であるかのように',
    'emo': '～から判断して',
    'xalt': '～として',
    'sol': '(主格)',    // 主語を明示する格詞
    'tex': '～によれば(根拠)',
    'ras': '～回(回数)',
    'sas': '～番目に',
    'lit': '～を越えずに',
    'rak': '～を越えて',
    'dim': '～に似合わず',
    'enk': '～とは違って',
    'on': '～について/～に関して',
    // rente位相の格詞
    'kokko': '～を伴って/～で[幼児語]',
    'kokkoen': '～を伴って[子供語]',
  };

  static TENSE_MARKERS = {
    'at': '(過去)', 'ses': '(経験過去)'
  };

  static CONJUNCTIONS = {
    'ke': 'そして', 'son': 'それゆえ/だから', 'yan': 'そして/しかも', 'fok': 'しかも/なぜなら',
    'ku': 'そして/だから', 'tal': 'しかし/だが', 'ar': '(理由)',
    'mil': '(目的)', 'lo': '(方法/引用)',
    'del': 'すなわち(同格)', 'les': '～する者/もの(関係詞)',
    'xel': '(同格句)',
    'mon': '確かに/なるほど'
  };

  static SENTENCE_PARTICLES = {
    // === 文頭純詞 ===
    'tio': '単なる/ただ～だけ',
    'ala': '一体(修辞疑問)',
    'taik': '更には/その上',
    'tan': 'やはり',
    'hot': '～しか',
    'as': '少なくとも',
    'tis': '～すら/～さえ',
    'es': 'なぜ',    // 文頭純詞用法
    'lala': 'あらまあ/なんてことだ[子供語]',
    'kils': '厳密には',
    'map': '本当に/全く',
    'ai': 'たくさん',
    'aluut': '全く/完全に',
    'yam': 'やはり',
    // === 文末純詞 ===
    'sei': '～だろうか(推量)',
    'in': '～のようだ(見た感じ)',
    'xan': '～だったのか(気付き)',
    'na': '～のようだ(感覚)',
    'ter': '～のようだ(聞いた感じ)',
    'tisee': '～なのだ(情報提供)',
    'kok': '～だよね？(同意要求)',
    'dec': '～じゃないよね？',
    'sin': '～なんて(嫌悪)',
    'dac': '～でしょ？',
    // === milia位相の文末純詞 ===
    'eyo': '～かなぁ[女性語]',
    'sete': '～よね？[女性語]',
    'tisse': '～なのよ[女性語]',
    'tissen': '～なのよね[女性語]',
    'deeln': '～じゃないの？[女性語]',
    'puppu': 'もうっ！[女性語]',
    // === rente位相（幼児語） ===
    'au': '～でしょ？[幼児語]',
    'aan': '～だなぁ[幼児語]',
    'deel': '～じゃないよね？[幼児語]',
    // === mayu位相（古語） ===
    'sanna': '～よね[古語]',
    'enxe': '～かなぁ[古語]',
    'xiima': '～なのよ[古語]',
    // === yuul位相（男性語） ===
    'fixet': '～だろうか[男性語]',
    'ranxel': '～だよな[男性語]',
    'flenzel': '～なんだ[男性語]',
    // === yunk位相（鳥籠姫） ===
    'yuulia': '～でございますの[上品]',
    'malia': '～ですわよね[上品]',
    'axem': '～ですわよね[上品]',
    // === yunte位相（子供語） ===
    'nonno': '～だよね？[子供語]',
    // === 丁寧形(an-) ===
    'aneyo': '～かしら[女性語/丁寧]',
    'antisse': '～なのですよ[丁寧]',
    'ansete': '～ですよね[丁寧]',
    'anmian': '～です[丁寧]',
    'annau': '～です[丁寧]',
    'ansanna': '～よね[古語/丁寧]',
    'anxiima': '～なのです[古語/丁寧]',
  };

  static MODAL_ADVERBS = {
    'lax': '～したい', 'lan': '～したい',
    'ris': '～したくない', 'rin': '～したくない',
    'sen': '～できる', 'vil': '～できない',
    'fal': '～すべき', 'xaf': '～しなければならない',
    'sil': '～する(未来)', 'van': '～するつもり', 'fan': '～するつもり',
    'em': '～するようになる',
    'kit': '～し始める',
    'das': '～しよう(勧誘)',
    'sant': '～してほしい(弱依頼)',
    'lut': 'ずっと(通時制)',
    'tur': '今から(現在)',
    'terk': '～しに出かける',
    'ca': '(強調)',
    // 位相別の法副詞
    'dia': '～しよう[幼児語]',  // dasのrente位相
    'myun': '～してほしい[女性語]',  // santのmilia位相
  };

  static IMPERATIVES = {
    're': '～しろ(命令)', 'den': '～するな(禁止)',
    'mir': '～してください', 'fon': '～しないでください'
  };

  static GREETINGS = {
    'soonoyun': 'こんにちは',
    'sentant': 'ありがとう(恩恵)',
    'seeretis': 'ありがとう(依頼)',
    'vantant': 'ごめんなさい',
    'passo': '大丈夫/いいよ',
    'ilpasso': '大丈夫/問題ない',
    'waa': 'わあ',
    'haizenx': '(自己非難)',
    'haizen': '(非難)'
  };

  static REVERSE_GREETINGS = {
    'こんにちは': 'ansoonoyun', 'おはよう': 'soonoyun', 'こんばんは': 'ansoonoyun',
    'おはようございます': 'ansoonoyun', 'やあ': 'soonoyun', 'どうも': 'sentant',
    'ありがとう': 'sentant', 'ありがとうございます': 'ansentant',
    'どうもありがとうございます': 'misent',
    'すみません': 'anvantant', 'ごめんなさい': 'vantant', 'ごめん': 'vantant',
    '申し訳ございません': 'anvantant', '申し訳ありません': 'anvantant',
    '大丈夫': 'passo', 'いいよ': 'passo', 'ようこそ': 'kekko',
    'いらっしゃいませ': 'mikekko', 'お待たせしました': 'misolvat'
  };

  static SPECIAL_NEGATION = {
    'et': { neg: 'de', meaning: '～である/～でない' },
    'til': { neg: 'si', meaning: '持つ/持たない' },
    'xa': { neg: 'mi', meaning: '存在する/存在しない' },
    'lax': { neg: 'ris', meaning: '欲しい/欲しくない' },
    'sen': { neg: 'vil', meaning: 'できる/できない' }
  };

  static NEGATION_WORDS = new Set(['de', 'si', 'mi', 'ris', 'vil', 'te']);

  // rente位相の特殊形
  static REGISTER_VARIANTS = {
    'te': { base: 'de', meaning: '～でない[幼児語]', type: 'negation' },  // deのrente形
    'nan': { base: 'nos', meaning: '自分[幼児語]', type: 'pronoun' },
    'lein': { base: 'sab', meaning: '着る[女性語]', type: 'verb' },
    'nanna': { base: 'onna', meaning: '女の子[幼児語]', type: 'noun' },
  };

  // 複数マーカーと文法語
  static GRAMMAR_WORDS = {
    'sein': 'たち/複数',   // 複数マーカー
    'sif': 'いくつかの/複数',
    'sol': '(主格)',     // 主語を明示
    'atu': 'ここ/そこ',
    'lyu': 'あそこ',
    'flej': 'この場所',
    'di': 'たくさんの人',
    'xok': '互い',
    'vei': '一部の人/もの',
    'tuo': '今頃/現在付近',
    'soan': '実行者/犯人',
  };

  // Aspect suffixes (checked on unknown words)
  static ASPECT_SUFFIXES = [
    { suffix: 'and', meaning: '反復', jp: '～し続ける' },
    { suffix: 'or', meaning: '経過', jp: '～している' },
    { suffix: 'ik', meaning: '完了', jp: '～した' },
    { suffix: 'es', meaning: '継続', jp: '～している/～してある' },
    { suffix: 'at', meaning: '過去', jp: '～した' }
  ];

  // Derivational suffixes (動副詞, 分詞, etc.)
  static DERIVATIONAL_SUFFIXES = [
    { suffix: 'el', meaning: '動副詞', jp: '～して/～く/～に(副詞的)' },
    { suffix: 'an', meaning: '主格分詞', jp: '～する者/～した者' },
    { suffix: 'ol', meaning: '対格分詞', jp: '～されるもの' },
    { suffix: 'anel', meaning: '主格動副詞', jp: '～しながら' },
    { suffix: 'astel', meaning: '再帰動副詞', jp: '～しつつ' }
  ];

  // Numbers
  static NUMBERS = {
    '0': 'ノル', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9'
  };

  // ===== PRONUNCIATION GUIDE =====
  // Arka pronunciation rules based on official phonology:
  // x = /ʃ/ (sh), c = /r/ (trilled r), j = /ʒ/ (zh), y = /j/ (y)
  // tx = /tʃ/ (ch), ts = /ts/, h = /h/ (ih→/ç/, ah/oh→/x/)
  // q = /ə/ (schwa), other consonants/vowels = standard romanization
  static getArkaReading(word) {
    let reading = word.toLowerCase();
    // Order matters: longer patterns first
    reading = reading.replace(/tx/g, 'チ');
    reading = reading.replace(/ts/g, 'ツ');
    reading = reading.replace(/sh/g, 'シ__TEMP__'); // protect existing 'sh' if any
    reading = reading.replace(/xa/g, 'シャ').replace(/xi/g, 'シ').replace(/xu/g, 'シュ').replace(/xe/g, 'シェ').replace(/xo/g, 'ショ');
    reading = reading.replace(/x/g, 'シュ'); // standalone x
    reading = reading.replace(/シ__TEMP__/g, 'シ');
    reading = reading.replace(/ja/g, 'ジャ').replace(/ji/g, 'ジ').replace(/ju/g, 'ジュ').replace(/je/g, 'ジェ').replace(/jo/g, 'ジョ');
    reading = reading.replace(/j/g, 'ジュ');
    reading = reading.replace(/ca/g, 'ラ').replace(/ci/g, 'リ').replace(/cu/g, 'ル').replace(/ce/g, 'レ').replace(/co/g, 'ロ');
    reading = reading.replace(/c/g, 'ル');
    reading = reading.replace(/ya/g, 'ヤ').replace(/yi/g, 'イ').replace(/yu/g, 'ユ').replace(/ye/g, 'イェ').replace(/yo/g, 'ヨ');
    reading = reading.replace(/wa/g, 'ワ').replace(/wi/g, 'ウィ').replace(/wu/g, 'ウ').replace(/we/g, 'ウェ').replace(/wo/g, 'ウォ');
    reading = reading.replace(/fa/g, 'ファ').replace(/fi/g, 'フィ').replace(/fu/g, 'フ').replace(/fe/g, 'フェ').replace(/fo/g, 'フォ');
    reading = reading.replace(/f/g, 'フ');  // standalone f
    reading = reading.replace(/va/g, 'ヴァ').replace(/vi/g, 'ヴィ').replace(/vu/g, 'ヴ').replace(/ve/g, 'ヴェ').replace(/vo/g, 'ヴォ');
    reading = reading.replace(/v/g, 'ヴ');  // standalone v
    reading = reading.replace(/la/g, 'ラ').replace(/li/g, 'リ').replace(/lu/g, 'ル').replace(/le/g, 'レ').replace(/lo/g, 'ロ');
    reading = reading.replace(/l/g, 'ル');
    reading = reading.replace(/ra/g, 'ラ').replace(/ri/g, 'リ').replace(/ru/g, 'ル').replace(/re/g, 'レ').replace(/ro/g, 'ロ');
    reading = reading.replace(/r/g, 'ル');
    reading = reading.replace(/na/g, 'ナ').replace(/ni/g, 'ニ').replace(/nu/g, 'ヌ').replace(/ne/g, 'ネ').replace(/no/g, 'ノ');
    // n before consonant or end of string → ン
    // Must handle both latin consonants and already-converted katakana
    reading = reading.replace(/n([^aiueoアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヴ])/g, 'ン$1');
    reading = reading.replace(/n([\u30A0-\u30FF])/g, 'ン$1');  // n before any katakana (already converted)
    reading = reading.replace(/n$/g, 'ン');
    reading = reading.replace(/ma/g, 'マ').replace(/mi/g, 'ミ').replace(/mu/g, 'ム').replace(/me/g, 'メ').replace(/mo/g, 'モ');
    reading = reading.replace(/m/g, 'ム');
    reading = reading.replace(/ka/g, 'カ').replace(/ki/g, 'キ').replace(/ku/g, 'ク').replace(/ke/g, 'ケ').replace(/ko/g, 'コ');
    reading = reading.replace(/k/g, 'ク');
    reading = reading.replace(/ga/g, 'ガ').replace(/gi/g, 'ギ').replace(/gu/g, 'グ').replace(/ge/g, 'ゲ').replace(/go/g, 'ゴ');
    reading = reading.replace(/g/g, 'グ');
    reading = reading.replace(/ta/g, 'タ').replace(/ti/g, 'ティ').replace(/tu/g, 'トゥ').replace(/te/g, 'テ').replace(/to/g, 'ト');
    reading = reading.replace(/t/g, 'ト');
    reading = reading.replace(/da/g, 'ダ').replace(/di/g, 'ディ').replace(/du/g, 'ドゥ').replace(/de/g, 'デ').replace(/do/g, 'ド');
    reading = reading.replace(/d/g, 'ド');
    reading = reading.replace(/sa/g, 'サ').replace(/si/g, 'スィ').replace(/su/g, 'ス').replace(/se/g, 'セ').replace(/so/g, 'ソ');
    reading = reading.replace(/s/g, 'ス');
    reading = reading.replace(/za/g, 'ザ').replace(/zi/g, 'ズィ').replace(/zu/g, 'ズ').replace(/ze/g, 'ゼ').replace(/zo/g, 'ゾ');
    reading = reading.replace(/z/g, 'ズ');
    reading = reading.replace(/pa/g, 'パ').replace(/pi/g, 'ピ').replace(/pu/g, 'プ').replace(/pe/g, 'ペ').replace(/po/g, 'ポ');
    reading = reading.replace(/p/g, 'プ');
    reading = reading.replace(/ba/g, 'バ').replace(/bi/g, 'ビ').replace(/bu/g, 'ブ').replace(/be/g, 'ベ').replace(/bo/g, 'ボ');
    reading = reading.replace(/b/g, 'ブ');
    reading = reading.replace(/ha/g, 'ハ').replace(/hi/g, 'ヒ').replace(/hu/g, 'フ').replace(/he/g, 'ヘ').replace(/ho/g, 'ホ');
    reading = reading.replace(/h/g, 'フ');
    // Vowels
    reading = reading.replace(/a/g, 'ア').replace(/i/g, 'イ').replace(/u/g, 'ウ').replace(/e/g, 'エ').replace(/o/g, 'オ');
    reading = reading.replace(/q/g, 'ə');
    // Clean up any remaining latin chars
    reading = reading.replace(/'/g, '');
    return reading;
  }

  // ===== SOUTHERN DIALECT (ルティア語) CONVERSION =====
  // Based on official ルティア語 phonological rules:
  // - r → approximant (closer to u)
  // - syllable-final c → l (acmadio → almadio)
  // - word-final voiced stops devoice (lend → lent)
  // - word-final voiceless stops are unreleased (swallowed)
  // - flat intonation, syllable-timed
  static toSouthernDialect(word) {
    let result = word.toLowerCase();
    // c before consonant → l
    result = result.replace(/c([^aeiou])/g, 'l$1');
    // Word-final c → l
    result = result.replace(/c$/g, 'l');
    // Word-final voiced stops devoice: d→t, b→p, g→k
    result = result.replace(/d$/g, 't');
    result = result.replace(/b$/g, 'p');
    result = result.replace(/g$/g, 'k');
    return result;
  }

  // Get southern dialect reading (ルティア語風カタカナ)
  static getSouthernReading(word) {
    const dialectWord = ArkaEngine.toSouthernDialect(word);
    return ArkaEngine.getArkaReading(dialectWord);
  }

  // ===== KANSAI-BEN DETECTION =====
  static KANSAI_PATTERNS = [
    // Verb endings (allow trailing punctuation with [。！？!?\s]*$)
    { pattern: /へん[。！？!?\sなでやわ]*$/, standard: 'ない', type: 'negation' },
    { pattern: /やん[。！？!?\s]*$/, standard: 'じゃない', type: 'negation' },
    { pattern: /てん[。！？!?\s]*$/, standard: 'ている', type: 'progressive' },
    { pattern: /とん[。！？!?\s]*$/, standard: 'ている', type: 'progressive' },
    { pattern: /はる[。！？!?\s]*$/, standard: 'ている/される', type: 'honorific' },
    { pattern: /なあかん[。！？!?\s]*$/, standard: 'なければならない', type: 'obligation' },
    { pattern: /んとちゃう[。！？!?\s]*$/, standard: 'のではないか', type: 'question' },
    // Copula/sentence-final
    { pattern: /やねん[。！？!?\s]*$/, standard: 'なのだ', type: 'emphasis' },
    { pattern: /やんか[。！？!?\s]*$/, standard: 'じゃないか', type: 'assertion' },
    { pattern: /やで[。！？!?\s]*$/, standard: 'だよ', type: 'assertion' },
    { pattern: /やな[。！？!?\s]*$/, standard: 'だね', type: 'agreement' },
    { pattern: /やろ[。！？!?\s]*$/, standard: 'だろう', type: 'question' },
    { pattern: /やわ[。！？!?\s]*$/, standard: 'だわ', type: 'feminine' },
    { pattern: /やん[。！？!?]/, standard: 'だよね', type: 'tag' },
    { pattern: /でんがな[。！？!?\s]*$/, standard: 'ですよ', type: 'emphatic' },
    { pattern: /まんがな[。！？!?\s]*$/, standard: 'ますよ', type: 'emphatic' },
    { pattern: /まへん[。！？!?\s]*$/, standard: 'ません', type: 'polite_neg' },
    // Special vocabulary
    { pattern: /めっちゃ/, standard: 'とても', type: 'adverb' },
    { pattern: /ほんま/, standard: '本当', type: 'adverb' },
    { pattern: /あかん/, standard: 'だめ', type: 'adjective' },
    { pattern: /ちゃう/, standard: '違う', type: 'verb' },
    { pattern: /おおきに/, standard: 'ありがとう', type: 'greeting' },
    { pattern: /なんぼ/, standard: 'いくら', type: 'interrogative' },
    { pattern: /しゃあない/, standard: '仕方がない', type: 'phrase' },
    { pattern: /かまへん/, standard: '構わない', type: 'phrase' },
    { pattern: /えらい/, standard: '大変/すごい', type: 'adjective' },
    { pattern: /あんじょう/, standard: 'うまく', type: 'adverb' },
  ];

  static isKansaiBen(text) {
    let score = 0;
    // Split into sentences so end-of-sentence patterns match mid-text
    const sentences = text.split(/[。！？!?]+/).filter(s => s.trim());
    const targets = [text, ...sentences.map(s => s.trim())];
    for (const p of ArkaEngine.KANSAI_PATTERNS) {
      let matched = false;
      for (const t of targets) {
        if (p.pattern.test(t)) { matched = true; break; }
      }
      if (matched) {
        score += (p.type === 'greeting' || p.type === 'emphatic') ? 3 : 1;
      }
    }
    // Also check for や copula usage (instead of だ)
    if (/[^あいうえおかきくけこ]や[。、!？\s]/.test(text)) score += 1;
    return score >= 2;
  }

  static normalizeKansai(text) {
    let result = text;
    // Convert Kansai to standard Japanese for translation
    result = result.replace(/おおきに/g, 'ありがとう');
    result = result.replace(/めっちゃ/g, 'とても');
    result = result.replace(/ほんまに/g, '本当に');
    result = result.replace(/ほんま/g, '本当');
    result = result.replace(/あかん/g, 'だめ');
    result = result.replace(/しゃあない/g, '仕方がない');
    result = result.replace(/かまへん/g, '構わない');
    result = result.replace(/なんぼ/g, 'いくら');
    result = result.replace(/あんじょう/g, 'うまく');
    result = result.replace(/えらい/g, 'とても');
    result = result.replace(/やねん/g, 'なのだ');
    result = result.replace(/やんか/g, 'じゃないか');
    result = result.replace(/やん([。！？!?\s]|$)/g, 'じゃない$1');
    result = result.replace(/やで/g, 'だよ');
    result = result.replace(/やな/g, 'だね');
    result = result.replace(/やろ/g, 'だろう');
    result = result.replace(/やわ/g, 'だわ');
    result = result.replace(/へん/g, 'ない');
    result = result.replace(/([^い])てん/g, '$1ている');
    result = result.replace(/([^い])とん/g, '$1ている');
    result = result.replace(/でんがな/g, 'ですよ');
    result = result.replace(/まんがな/g, 'ますよ');
    result = result.replace(/まへん/g, 'ません');
    // Replace copula や with だ (context-sensitive)
    result = result.replace(/([ぁ-ん])や([。、\s!？]|$)/g, '$1だ$2');
    return result;
  }

  // ===== JAPANESE SUBJECT INFERENCE =====
  // Detects subjectless Japanese sentences and infers implicit subject
  static SUBJECT_PARTICLES = ['は', 'が', 'も'];
  static JP_VERB_ENDINGS = [
    'る', 'う', 'つ', 'く', 'ぐ', 'す', 'ぬ', 'ぶ', 'む', // dictionary
    'た', 'だ', // past
    'て', 'で', // te-form
    'ない', 'ます', 'ません', // polite/negative
    'よう', 'たい', 'れる', 'られる', 'せる', 'させる', // volitional etc
  ];
  static JP_ADJ_ENDINGS = ['い', 'しい', 'かった', 'くない'];
  static JP_COPULA = ['だ', 'です', 'である', 'でしょう', 'だった'];

  static inferSubject(text) {
    // Check if the sentence already has a subject marker
    for (const p of ArkaEngine.SUBJECT_PARTICLES) {
      // Look for particle preceded by content
      const idx = text.indexOf(p);
      if (idx > 0 && idx < text.length - 1) {
        // Verify it's actually a subject particle (not part of a word)
        const before = text[idx - 1];
        if (/[ぁ-ん々ー\u4e00-\u9fff]/.test(before)) {
          return { hasSubject: true, subject: null };
        }
      }
    }

    // Check for pronouns already present
    const pronounPatterns = ['私', '僕', '俺', 'あなた', '君', '彼', '彼女', 'わたし', 'ぼく', 'おれ', 'あたし', 'わし', 'うち', 'わたくし', 'あたい', '吾輩', 'わがはい', '我', 'われ', '余', '拙者', '小生', '某', 'あんた', 'おまえ', 'お前', 'てめえ', 'てめぇ', '貴様', 'きさま', 'おめえ', '汝', 'なんじ', 'そなた', 'そち', 'おぬし', 'あなた様', 'あなたさま'];
    for (const pron of pronounPatterns) {
      if (text.includes(pron)) return { hasSubject: true, subject: null };
    }

    // Detect sentence type for implicit subject inference
    // Commands → 2nd person (ti)
    if (/^[してくださいなさいろ]/.test(text) || text.endsWith('しろ') || text.endsWith('してください') || text.endsWith('しなさい') || text.endsWith('して')) {
      return { hasSubject: false, subject: 'ti', reason: '命令文(暗黙の二人称)' };
    }

    // Questions about the listener → 2nd person
    if (text.endsWith('？') || text.endsWith('?') || text.endsWith('か') || text.endsWith('かい') || text.endsWith('かな')) {
      if (text.includes('好き') || text.includes('欲しい') || text.includes('行く') || text.includes('来る') || text.includes('わかる') || text.includes('知っている')) {
        return { hasSubject: false, subject: 'ti', reason: '質問文(暗黙の二人称)' };
      }
    }

    // Desire/intention → 1st person
    if (text.includes('たい') || text.includes('ほしい') || text.includes('つもり') || text.includes('よう')) {
      return { hasSubject: false, subject: 'an', reason: '願望/意思(暗黙の一人称)' };
    }

    // Emotional/sensory statements → 1st person
    if (text.includes('嬉しい') || text.includes('悲しい') || text.includes('寂しい') || text.includes('怖い') || text.includes('楽しい') || text.includes('辛い') || text.includes('痛い') || text.includes('好き') || text.includes('嫌い')) {
      return { hasSubject: false, subject: 'an', reason: '感情/感覚(暗黙の一人称)' };
    }

    // Default: short sentences without subject → 1st person
    if (text.length < 20 && !text.includes('は') && !text.includes('が')) {
      return { hasSubject: false, subject: 'an', reason: '短文(暗黙の一人称)' };
    }

    return { hasSubject: false, subject: null };
  }

  // ===== POETRY/SHORT TEXT DETECTION =====
  static isPoeticText(text) {
    // Multi-line with short lines
    const lines = text.split(/\n/);
    if (lines.length >= 2) {
      const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
      if (avgLen < 20) return true;
    }
    // Very short, no punctuation, AND contains literary kanji = likely poetic fragment
    // (Don't trigger on normal short sentences like greetings or simple statements)
    const literaryKanji = /[儚脆散朽枯滅彷徊魂翼闇光涙夢運命絶望希望永遠寒空]/;
    if (text.length < 15 && !/[。、！？!?,.]/.test(text) && literaryKanji.test(text)) return true;
    // Detect literary/poetic compound expressions (require STRONG signals)
    // Weak signals like ている/ていく alone are not enough — they appear in regular text
    const strongPoeticPatterns = /(にゆく|りゆく|えゆく|みゆく|ながら|つつ|のまま|のように|果てない|尽きない|終わりなき|儚い|脆く|散りゆく|朽ちていく|消えていく|枯れていく|崩れていく)/;
    if (strongPoeticPatterns.test(text)) return true;
    return false;
  }

  // ===== POETIC / FREE TRANSLATION ENGINE =====
  // Decomposes Japanese literary compound expressions into semantic phrases,
  // then composes natural Arka sentences with proper grammar.

  // --- Compound expression patterns (order matters: longest first) ---
  static POETIC_COMPOUND_PATTERNS = [
    // Progressive/directional V+ていく = gradually (aspect: -or = in progress)
    { pattern: /(死にゆく)/g, replace: '_DYING_' },
    { pattern: /(散りゆく)/g, replace: '_SCATTERING_' },
    { pattern: /(消えゆく)/g, replace: '_FADING_' },
    { pattern: /(枯れゆく)/g, replace: '_WITHERING_' },
    { pattern: /(崩れゆく)/g, replace: '_COLLAPSING_' },
    { pattern: /(沈みゆく)/g, replace: '_SINKING_' },
    { pattern: /(朵ちていく)/g, replace: '_DECAYING_' },
    { pattern: /(朽ちていく)/g, replace: '_DECAYING_' },
    { pattern: /(消えていく)/g, replace: '_FADING_' },
    { pattern: /(枯れていく)/g, replace: '_WITHERING_' },
    { pattern: /(壊れていく)/g, replace: '_CRUMBLING_' },
    { pattern: /(流れていく)/g, replace: '_FLOWING_AWAY_' },
    { pattern: /(溜けていく)/g, replace: '_DISSOLVING_' },
    { pattern: /(崩れていく)/g, replace: '_COLLAPSING_' },
    { pattern: /(沈んでいく)/g, replace: '_SINKING_' },
    { pattern: /(磨り減っていく)/g, replace: '_ERODING_' },
    { pattern: /(薄れていく)/g, replace: '_THINNING_' },
    { pattern: /(強くなっていく)/g, replace: '_STRENGTHENING_' },
    { pattern: /(光り続ける)/g, replace: '_SHINING_ON_' },
    // V+にゆく = heading toward
    { pattern: /([\u4E00-\u9FFF\u3040-\u309F]+)にゆく/g, handler: '_TOWARD_' },
    // V+ながら = while doing
    { pattern: /([\u4E00-\u9FFF\u3040-\u309F]+)ながら/g, handler: '_WHILE_' },
    // V+つつ = while / in the process of
    { pattern: /([\u4E00-\u9FFF\u3040-\u309F]+)つつ/g, handler: '_WHILE_' },
    // Adj+くて = being adj and...
    // 果てない/尽きない = endless
    { pattern: /果てない/g, replace: '_ENDLESS_' },
    { pattern: /尽きない/g, replace: '_ENDLESS_' },
    { pattern: /終わりなき/g, replace: '_ENDLESS_' },
    { pattern: /終わらない/g, replace: '_ENDLESS_' },
    { pattern: /限りない/g, replace: '_ENDLESS_' },
    // のように = like/as (simile)
    { pattern: /のように/g, replace: '_LIKE_' },
    { pattern: /ように/g, replace: '_LIKE_' },
    // V+ている generic
    { pattern: /([\u4E00-\u9FFF\u3040-\u309F]+)ている/g, handler: '_CONTINUOUS_' },
    // V+ていく generic progressive
    { pattern: /([\u4E00-\u9FFF\u3040-\u309F]+)ていく/g, handler: '_PROGRESSIVE_' },
  ];

  // Mapping of compound tokens to Arka expressions
  static POETIC_TOKEN_MAP = {
    '_DYING_': { words: ['vortor'], meaning: '死にゆく', note: 'vort+or(経過相)' },
    '_DECAYING_': { words: ['greinor'], meaning: '朽ちていく', note: 'grein+or' },
    '_FADING_': { words: ['sedor'], meaning: '消えていく', note: 'sedo+or' },
    '_WITHERING_': { words: ['almansor'], meaning: '枯れていく', note: 'almans+or' },
    '_CRUMBLING_': { words: ['klemar'], meaning: '壊れていく', note: 'klema+or' },
    '_FLOWING_AWAY_': { words: ['leir'], meaning: '流れていく', note: 'lei+or' },
    '_DISSOLVING_': { words: ['sedor'], meaning: '溜けていく', note: 'sedo+or' },
    '_COLLAPSING_': { words: ['vernor'], meaning: '崩れていく', note: 'vern+or' },
    '_SINKING_': { words: ['mendor'], meaning: '沈んでいく', note: 'mend+or' },
    '_ERODING_': { words: ['greinor'], meaning: '磨り減っていく', note: 'grein+or' },
    '_THINNING_': { words: ['sedor'], meaning: '薄れていく', note: 'sedo+or' },
    '_STRENGTHENING_': { words: ['kanvir'], meaning: '強くなっていく', note: 'kanvi+or' },
    '_SHINING_ON_': { words: ['fares'], meaning: '光り続ける', note: 'far+es(継続相)' },
    '_SCATTERING_': { words: ['metor'], meaning: '散りゆく', note: 'met+or(経過相)' },
    '_ENDLESS_': { words: ['teom'], meaning: '果てない/無限の', note: '永遠の' },
    '_LIKE_': { words: ['yun'], meaning: 'のように', note: 'yun=比喩格詞' },
  };

  // Arka aspect suffixes for poetic conjugation
  // Based on 新生アルカ grammar: 7 aspects
  // -at past, -es continuous, -or progressive(becoming), -ik perfective
  // -os experiential, -an repeated, -ok habitual/willing
  static ARKA_ASPECT = {
    past: 'at',         // ~した
    continuous: 'es',   // ~している
    progressive: 'or',  // ~しつつある / ~していく
    perfective: 'ik',   // ~し終わった
    experiential: 'os', // ~したことがある
    repeated: 'an',     // 繰り返し~する
    habitual: 'ok',     // ~する習慣がある
  };

  // Apply aspect suffix to Arka verb (handles open/closed syllable rules)
  static applyAspect(verb, aspect) {
    if (!verb || !aspect) return verb;
    const suffix = ArkaEngine.ARKA_ASPECT[aspect];
    if (!suffix) return verb;
    // Check if verb ends in vowel (open syllable) → shorter suffix
    const lastChar = verb.slice(-1).toLowerCase();
    const isOpenSyllable = 'aeiou'.includes(lastChar);
    // For open syllables: -at → -t, -es → -s, -or → -r, -ik → -k
    if (isOpenSyllable && suffix.length === 2) {
      return verb + suffix[suffix.length - 1];
    }
    return verb + suffix;
  }

  // Decompose poetic Japanese into semantic phrase tokens
  _decomposePoeticJapanese(text) {
    let processed = text;
    const tokens = [];

    // Phase 1: Apply FIXED compound patterns first (order matters: longest match first)
    // These are complete expressions like 死にゆく, 果てない, 朽ちていく etc.
    for (const pat of ArkaEngine.POETIC_COMPOUND_PATTERNS) {
      if (!pat.replace) continue; // Skip dynamic handlers in phase 1
      const regex = new RegExp(pat.pattern.source, pat.pattern.flags);
      if (regex.test(processed)) {
        processed = processed.replace(regex, ` ${pat.replace} `);
        const tokenInfo = ArkaEngine.POETIC_TOKEN_MAP[pat.replace];
        if (tokenInfo) {
          tokens.push({ type: 'compound', token: pat.replace, info: tokenInfo });
        }
      }
    }

    // Phase 2: Apply DYNAMIC compound patterns (ながら, つつ, にゆく, ている, ていく)
    // Use non-greedy matching and extract just the verb stem (not particles)
    // Pattern: capture the nearest content word before ながら/つつ
    const dynamicPatterns = [
      { suffix: 'ながら', handler: '_WHILE_' },
      { suffix: 'つつ', handler: '_WHILE_' },
      { suffix: 'にゆく', handler: '_TOWARD_' },
      { suffix: 'ている', handler: '_CONTINUOUS_' },
      { suffix: 'ていく', handler: '_PROGRESSIVE_' },
    ];
    for (const dp of dynamicPatterns) {
      const idx = processed.indexOf(dp.suffix);
      if (idx === -1) continue;
      // Walk backwards from the suffix to find the verb stem
      // Stop at particles (はがのをにへでとも), spaces, or token markers
      let verbStart = idx - 1;
      const particles = new Set(['は', 'が', 'の', 'を', 'に', 'へ', 'で', 'と', 'も', ' ']);
      while (verbStart >= 0 && !particles.has(processed[verbStart]) && processed[verbStart] !== ' ' && processed[verbStart] !== '_') {
        verbStart--;
      }
      verbStart++;
      const verbPart = processed.slice(verbStart, idx);
      if (verbPart.length > 0) {
        const fullMatch = verbPart + dp.suffix;
        const placeholder = `__DYN_${dp.handler}${verbPart}__`;
        processed = processed.replace(fullMatch, ` ${placeholder} `);
        tokens.push({ type: 'compound_dynamic', token: placeholder, handler: dp.handler, verbPart });
      }
    }

    return { processed, tokens };
  }

  // Translate a poetic line using compound decomposition + Arka grammar
  _translatePoeticLine(text) {
    const breakdown = [];

    // Step 1: Decompose compounds
    const { processed, tokens } = this._decomposePoeticJapanese(text);

    // Step 2: Split remaining text around compound tokens and translate each part
    const parts = processed.split(/\s+/).filter(s => s.trim());
    const arkaParts = [];

    for (const part of parts) {
      // Check if this is a FIXED compound token
      if (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__DYN_')) {
        const tokenInfo = ArkaEngine.POETIC_TOKEN_MAP[part];
        if (tokenInfo) {
          arkaParts.push(...tokenInfo.words);
          breakdown.push({
            original: tokenInfo.meaning,
            root: tokenInfo.words.join(' '),
            type: 'compound',
            meaning: `${tokenInfo.meaning} [${tokenInfo.note}]`,
            entry: null, suffixes: [], prefixes: []
          });
        }
        continue;
      }

      // Check if this is a DYNAMIC compound token (__DYN_HANDLER_verb__)
      if (part.startsWith('__DYN_') && part.endsWith('__')) {
        const inner = part.slice(6, -2); // remove __DYN_ and __
        let handler = '';
        let verbPart = '';
        for (const h of ['_WHILE_', '_TOWARD_', '_CONTINUOUS_', '_PROGRESSIVE_']) {
          if (inner.startsWith(h)) {
            handler = h;
            verbPart = inner.slice(h.length);
            break;
          }
        }
        if (handler === '_WHILE_') {
          const stemResult = this._resolveJpVerbStem(verbPart);
          arkaParts.push(stemResult.arka);
          arkaParts.push('kont');
          breakdown.push({
            original: verbPart + 'ながら',
            root: stemResult.arka + ' kont',
            type: 'compound',
            meaning: `${verbPart}ながら [kont=同時格]`,
            entry: null, suffixes: [], prefixes: []
          });
        } else if (handler === '_TOWARD_') {
          const stemResult = this._resolveJpVerbStem(verbPart);
          const arkaVerb = ArkaEngine.applyAspect(stemResult.arka, 'progressive');
          arkaParts.push(arkaVerb);
          breakdown.push({
            original: verbPart + 'にゆく',
            root: arkaVerb,
            type: 'compound',
            meaning: `${verbPart}に向かって [-or=経過相]`,
            entry: null, suffixes: [], prefixes: []
          });
        } else if (handler === '_CONTINUOUS_') {
          const stemResult = this._resolveJpVerbStem(verbPart);
          const arkaVerb = ArkaEngine.applyAspect(stemResult.arka, 'continuous');
          arkaParts.push(arkaVerb);
          breakdown.push({
            original: verbPart + 'ている',
            root: arkaVerb,
            type: 'compound',
            meaning: `${verbPart}ている [-es=継続相]`,
            entry: null, suffixes: [], prefixes: []
          });
        } else if (handler === '_PROGRESSIVE_') {
          const stemResult = this._resolveJpVerbStem(verbPart);
          const arkaVerb = ArkaEngine.applyAspect(stemResult.arka, 'progressive');
          arkaParts.push(arkaVerb);
          breakdown.push({
            original: verbPart + 'ていく',
            root: arkaVerb,
            type: 'compound',
            meaning: `${verbPart}ていく [-or=経過相]`,
            entry: null, suffixes: [], prefixes: []
          });
        }
        continue;
      }

      // Regular text: may contain multiple words with particles
      // Use the standard tokenizer to split properly
      const subTokens = this._splitPoeticFragment(part);
      for (const word of subTokens) {
        if (!word || !word.trim()) continue;
        const result = this._lookupJapanese(word);
        if (result) {
          arkaParts.push(result.arkaWord);
          breakdown.push({
            original: word,
            root: result.arkaWord,
            type: 'word',
            meaning: word,
            entry: result.entry, suffixes: [], prefixes: []
          });
        } else if (word.trim()) {
          arkaParts.push(`[${word}]`);
          breakdown.push({
            original: word,
            root: word,
            type: 'unknown',
            meaning: '(該当なし)',
            entry: null, suffixes: [], prefixes: []
          });
        }
      }
    }

    return { translation: arkaParts.join(' ').trim(), breakdown };
  }

  // Split a remaining Japanese text fragment into individual content words
  _splitPoeticFragment(text) {
    const PARTICLES = new Set(['を', 'は', 'が', 'の', 'に', 'へ', 'で', 'と', 'も']);
    const MULTI_PARTICLES = ['から', 'まで', 'より', 'など', 'けど'];
    const words = [];
    let remaining = text.trim();

    while (remaining.length > 0) {
      // Skip leading particles
      if (PARTICLES.has(remaining[0])) {
        remaining = remaining.slice(1);
        continue;
      }
      let mpSkipped = false;
      for (const mp of MULTI_PARTICLES) {
        if (remaining.startsWith(mp)) {
          remaining = remaining.slice(mp.length);
          mpSkipped = true;
          break;
        }
      }
      if (mpSkipped) continue;

      // Greedy match: try longest possible word from overrides/reverseMap
      let found = false;
      for (let len = Math.min(remaining.length, 12); len >= 1; len--) {
        const candidate = remaining.slice(0, len);
        // Strip trailing particles from candidate
        let stripped = candidate;
        for (const p of [...PARTICLES]) {
          if (stripped.endsWith(p) && stripped.length > p.length) {
            stripped = stripped.slice(0, -p.length);
          }
        }
        if (stripped.length >= 1 && (ArkaEngine.JP_ARKA_OVERRIDES[stripped] || this.reverseMap.has(stripped))) {
          words.push(stripped);
          remaining = remaining.slice(candidate.length);
          // Also skip any trailing particles
          while (remaining.length > 0 && PARTICLES.has(remaining[0])) {
            remaining = remaining.slice(1);
          }
          found = true;
          break;
        }
      }
      if (!found) {
        // Collect unmatched characters
        let unmatched = remaining[0];
        remaining = remaining.slice(1);
        // Keep collecting until we hit a particle or can match
        while (remaining.length > 0 && !PARTICLES.has(remaining[0])) {
          let canMatch = false;
          for (let len = Math.min(remaining.length, 12); len >= 2; len--) {
            const sub = remaining.slice(0, len);
            if (ArkaEngine.JP_ARKA_OVERRIDES[sub] || this.reverseMap.has(sub)) {
              canMatch = true;
              break;
            }
          }
          if (canMatch) break;
          unmatched += remaining[0];
          remaining = remaining.slice(1);
        }
        if (unmatched.trim()) words.push(unmatched);
      }
    }
    return words;
  }

  // Resolve a Japanese verb/adj fragment to its Arka base form
  _resolveJpVerbStem(fragment) {
    // Try direct override lookup
    if (ArkaEngine.JP_ARKA_OVERRIDES[fragment]) {
      return { arka: ArkaEngine.JP_ARKA_OVERRIDES[fragment], matched: fragment };
    }
    // Try adding common verb endings
    const endings = ['る', 'い', 'う', 'く', 'す', 'つ', 'ふ', 'ぶ', 'む', 'ぬ', 'ぐ'];
    for (const end of endings) {
      const candidate = fragment + end;
      if (ArkaEngine.JP_ARKA_OVERRIDES[candidate]) {
        return { arka: ArkaEngine.JP_ARKA_OVERRIDES[candidate], matched: candidate };
      }
    }
    // Try removing te-form / masu-stem endings
    const teStripped = fragment.replace(/[ちしきぎにみびりっいええれ]$/, '');
    if (teStripped !== fragment) {
      for (const end of endings) {
        const candidate = teStripped + end;
        if (ArkaEngine.JP_ARKA_OVERRIDES[candidate]) {
          return { arka: ArkaEngine.JP_ARKA_OVERRIDES[candidate], matched: candidate };
        }
      }
    }
    // Try reverse map
    if (this.reverseMap.has(fragment) && this.reverseMap.get(fragment).length > 0) {
      return { arka: this.reverseMap.get(fragment)[0].arkaWord, matched: fragment };
    }
    for (const end of endings) {
      const candidate = fragment + end;
      if (this.reverseMap.has(candidate) && this.reverseMap.get(candidate).length > 0) {
        return { arka: this.reverseMap.get(candidate)[0].arkaWord, matched: candidate };
      }
    }
    // Fallback: return fragment unchanged
    return { arka: `[${fragment}]`, matched: null };
  }

  // --- Look up Arka word ---
  lookupArka(word) {
    const lower = word.toLowerCase();
    if (this.wordMap.has(lower)) return this.wordMap.get(lower);
    const cleaned = lower.replace(/\(\d+\)$/, '').trim();
    if (this.wordMap.has(cleaned)) return this.wordMap.get(cleaned);
    return null;
  }

  // --- Analyze a single Arka token ---
  analyzeToken(token) {
    const lower = token.toLowerCase();
    const result = {
      original: token,
      root: lower,
      entry: null,
      suffixes: [],
      prefixes: [],
      type: 'unknown',
      meaning: ''
    };

    // Check if it's a number
    if (/^\d+$/.test(token)) {
      result.type = 'number';
      result.meaning = token;
      return result;
    }

    // Check greetings (from dynamically loaded greetings map)
    if (this.greetingsMap.has(lower)) {
      result.type = 'greeting';
      // Strip annotations like (丁寧), (恩恵) etc. for clean translation
      result.meaning = this.greetingsMap.get(lower).replace(/\([^)]+\)/g, '').trim();
      return result;
    }

    // Check sentence particles (文頭/文末純詞) - BEFORE pronouns so 'tio', 'taik' etc. are caught
    if (ArkaEngine.SENTENCE_PARTICLES[lower]) {
      result.type = 'sentence_particle';
      result.meaning = ArkaEngine.SENTENCE_PARTICLES[lower];
      return result;
    }

    // Check pronouns
    if (ArkaEngine.PRONOUNS[lower]) {
      result.type = 'pronoun';
      result.meaning = ArkaEngine.PRONOUNS[lower];
      return result;
    }

    // Check conjunctions BEFORE particles (so 'tal', 'mon', 'del' etc. are caught)
    if (ArkaEngine.CONJUNCTIONS[lower]) {
      result.type = 'conjunction';
      result.meaning = ArkaEngine.CONJUNCTIONS[lower];
      return result;
    }

    // Check case particles
    if (ArkaEngine.CASE_PARTICLES[lower]) {
      result.type = 'particle';
      result.meaning = ArkaEngine.CASE_PARTICLES[lower];
      return result;
    }

    // Check modal adverbs (includes 'em')
    if (ArkaEngine.MODAL_ADVERBS[lower]) {
      result.type = 'modal';
      result.meaning = ArkaEngine.MODAL_ADVERBS[lower];
      return result;
    }

    // Check imperatives
    if (ArkaEngine.IMPERATIVES[lower]) {
      result.type = 'imperative';
      result.meaning = ArkaEngine.IMPERATIVES[lower];
      return result;
    }

    // Check tense markers
    if (ArkaEngine.TENSE_MARKERS[lower]) {
      result.type = 'tense';
      result.meaning = ArkaEngine.TENSE_MARKERS[lower];
      return result;
    }

    // Check negation prefix
    if (lower === 'en') {
      result.type = 'negation';
      result.meaning = '否定(～ない)';
      return result;
    }

    // Check special negation pairs
    for (const [pos, info] of Object.entries(ArkaEngine.SPECIAL_NEGATION)) {
      if (lower === pos || lower === info.neg) {
        result.type = 'special';
        result.meaning = info.meaning;
        return result;
      }
    }

    // Check passive marker
    if (lower === 'yu') {
      result.type = 'passive';
      result.meaning = '受身(～される)';
      return result;
    }

    // Check causative
    if (lower === 'sols') {
      result.type = 'causative';
      result.meaning = '使役(～させる)';
      return result;
    }

    // Check register-specific variants (rente te=de, etc.)
    if (ArkaEngine.REGISTER_VARIANTS[lower]) {
      const rv = ArkaEngine.REGISTER_VARIANTS[lower];
      result.type = rv.type === 'negation' ? 'special' : 'word';
      result.meaning = rv.meaning;
      return result;
    }

    // Check grammar words (sein, atu, xok, etc.)
    if (ArkaEngine.GRAMMAR_WORDS[lower]) {
      result.type = 'word';
      result.meaning = ArkaEngine.GRAMMAR_WORDS[lower];
      return result;
    }

    // Direct dictionary lookup
    let entry = this.lookupArka(lower);
    if (entry) {
      result.entry = entry;
      result.type = 'word';
      result.meaning = this._extractCoreMeaning(entry.meaning);
      return result;
    }

    // Try stripping ASPECT suffixes first (higher priority)
    for (const asp of ArkaEngine.ASPECT_SUFFIXES) {
      if (lower.endsWith(asp.suffix) && lower.length > asp.suffix.length + 1) {
        const stem = lower.slice(0, -asp.suffix.length);
        entry = this.lookupArka(stem);
        if (entry) {
          result.root = stem;
          result.entry = entry;
          result.type = 'word';
          result.suffixes.push({ form: asp.suffix, label: asp.meaning, jp: asp.jp });
          result.meaning = this._extractCoreMeaning(entry.meaning);
          return result;
        }
      }
    }

    // Try stripping DERIVATIONAL suffixes (動副詞 -el, 分詞 -an/-ol, etc.)
    for (const deriv of ArkaEngine.DERIVATIONAL_SUFFIXES) {
      if (lower.endsWith(deriv.suffix) && lower.length > deriv.suffix.length + 1) {
        const stem = lower.slice(0, -deriv.suffix.length);
        entry = this.lookupArka(stem);
        if (entry) {
          result.root = stem;
          result.entry = entry;
          result.type = 'word';
          result.suffixes.push({ form: deriv.suffix, label: deriv.meaning, jp: deriv.jp });
          result.meaning = this._extractCoreMeaning(entry.meaning);
          return result;
        }
      }
    }

    // Try compound: strip common prefixes (al-, en-, etc.)
    const prefixes = [
      { prefix: 'al', meaning: '反/逆' },
      { prefix: 'ax', meaning: '超/極' },
      { prefix: 'on', meaning: '続' },
      { prefix: 'en', meaning: '非/無' },
    ];
    for (const pfx of prefixes) {
      if (lower.startsWith(pfx.prefix) && lower.length > pfx.prefix.length + 1) {
        const stem = lower.slice(pfx.prefix.length);
        entry = this.lookupArka(stem);
        if (entry) {
          result.root = stem;
          result.entry = entry;
          result.type = 'word';
          result.prefixes.push({ form: pfx.prefix, label: pfx.meaning });
          result.meaning = pfx.meaning + '・' + this._extractCoreMeaning(entry.meaning);
          return result;
        }
      }
    }

    // Try an- prefix (polite form of greetings/sentence particles)
    if (lower.startsWith('an') && lower.length > 3) {
      const stem = lower.slice(2);
      // Check if stem is a known greeting
      if (this.greetingsMap.has(stem)) {
        result.type = 'greeting';
        result.meaning = this.greetingsMap.get(stem).replace(/\([^)]+\)/g, '').trim();
        return result;
      }
      // Check if stem is a sentence particle
      if (ArkaEngine.SENTENCE_PARTICLES[stem]) {
        result.type = 'sentence_particle';
        result.meaning = ArkaEngine.SENTENCE_PARTICLES[stem] + '[丁寧]';
        return result;
      }
    }

    // Try mi- prefix (honorific form)
    if (lower.startsWith('mi') && lower.length > 3) {
      const stem = lower.slice(2);
      if (this.greetingsMap.has(stem)) {
        result.type = 'greeting';
        result.meaning = this.greetingsMap.get(stem) + '[敬語]';
        return result;
      }
      // mi- as honorific prefix on nouns
      entry = this.lookupArka(stem);
      if (entry) {
        result.root = stem;
        result.entry = entry;
        result.type = 'word';
        result.prefixes.push({ form: 'mi', label: 'お～(敬語)' });
        result.meaning = 'お' + this._extractCoreMeaning(entry.meaning);
        return result;
      }
    }

    // Unknown word
    result.meaning = token;
    return result;
  }

  _extractCoreMeaning(meaningStr) {
    if (!meaningStr) return '';
    // Split by POS tags to get sections
    const sections = meaningStr.split(/［[^］]+］/).filter(s => s.trim());
    
    // Katakana-only names (like ミーナ, ハール) that are just readings of the Arka word
    const isKatakanaName = (s) => /^[\u30A0-\u30FFー・]+$/.test(s.trim());
    // Check if string is a sentence (has 。 or is very long)
    const isSentence = (s) => s.includes('。') || s.length > 15;
    
    // Try each section to find the best Japanese meaning
    for (const section of sections) {
      // Split by 。 first to avoid joining sentences, then by comma
      const sentences = section.split(/。/)[0]; // Only take before first period
      const parts = sentences.split(/[、,]+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed.length === 0) continue;
        // Skip: yul patterns, romaji, long explanations
        if (trimmed.startsWith('yul') || trimmed.startsWith('xen ')) continue;
        if (/^[a-zA-Z]/.test(trimmed)) continue;
        if (isKatakanaName(trimmed) && trimmed.length <= 5) continue;
        if (trimmed.length > 15) continue;
        if (trimmed.includes('→') || trimmed.includes('←')) continue;
        if (trimmed.startsWith('～')) continue;
        // Skip generic/grammar-like short entries
        if (trimmed.length === 1 && /[あ-ん]/.test(trimmed)) continue;
        return trimmed;
      }
    }
    
    // Fallback: just get the first non-empty short part
    for (const section of sections) {
      const parts = section.split(/[、,。]+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && trimmed.length > 0 && trimmed.length <= 10) {
          return trimmed;
        }
      }
    }
    return '';
  }

  // ===== SENTENCE-LEVEL MATCHING =====
  _normalizeForMatch(text) {
    return text.toLowerCase()
      .replace(/'/g, ' ')       // expand apostrophe contractions
      .replace(/[.!?,;:'"…。！？、]/g, '')  // strip punctuation
      .replace(/\s+/g, ' ')     // normalize whitespace
      .trim();
  }

  findSentenceMatch(arkaText) {
    const normalizedInput = this._normalizeForMatch(arkaText);
    if (!normalizedInput) return null;

    let bestMatch = null;
    let bestScore = 0;
    const inputWords = normalizedInput.split(/\s+/);
    const inputWordSet = new Set(inputWords);

    for (const pair of this.sentenceMemory) {
      const normalizedCorpus = this._normalizeForMatch(pair.arka);

      // Exact match
      if (normalizedInput === normalizedCorpus) {
        return { match: pair, score: 1.0, type: 'exact' };
      }

      // Fast pre-filter: check at least 3 common content words
      const corpusWords = normalizedCorpus.split(/\s+/);
      const corpusWordSet = new Set(corpusWords);
      let commonCount = 0;
      for (const w of inputWords) {
        if (w.length > 2 && corpusWordSet.has(w)) commonCount++;
      }
      if (commonCount < 3 && inputWords.length > 5) continue;

      // Dice coefficient
      const common = inputWords.filter(w => corpusWordSet.has(w));
      const score = (common.length * 2) / (inputWords.length + corpusWords.length);

      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = { match: pair, score, type: 'fuzzy' };
      }
    }

    return bestMatch;
  }

  // --- Arka → Japanese Translation ---
  translateArkaToJapanese(text) {
    if (!text.trim()) return { translation: '', breakdown: [], sentenceMatch: null, pronunciation: '', variantWarning: null };

    const variant = this.currentVariant;

    // === 制アルカ mode: handle 時相詞 (hyphenated verbs) ===
    if (variant === 'sei') {
      return this._translateSeiArkaToJapanese(text);
    }
    // === 古アルカ mode: SOV word order awareness ===
    if (variant === 'ko') {
      return this._translateKoArkaToJapanese(text);
    }
    // === 新生/俗アルカ: standard processing ===

    // Check sentence memory for exact/near match
    // Only use sentence memory for multi-word inputs (avoid interference with single words/greetings)
    let sentenceMatch = null;
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount >= 4) {
      sentenceMatch = this.findSentenceMatch(text);
    }

    // Strip outer quotes before processing
    const cleanedText = text.replace(/["""'']/g, ' ').trim();
    const sentences = cleanedText.split(/([.!?。！？]+)/);
    const allBreakdown = [];
    let fullTranslation = '';

    for (let si = 0; si < sentences.length; si++) {
      const sentence = sentences[si];
      if (/^[.!?。！？]+$/.test(sentence)) {
        fullTranslation += sentence;
        continue;
      }
      if (!sentence.trim()) continue;

      // Pre-process: expand apostrophe contractions (e.g., l'at → l at)
      const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
      const tokens = [];
      for (const t of rawTokens) {
        // Handle comma-attached tokens
        const commaMatch = t.match(/^(.+?)(,)$/);
        const base = commaMatch ? commaMatch[1] : t;

        // Expand apostrophe contractions
        const apoMatch = base.match(/^([a-zA-Z]+)'([a-zA-Z]+)$/);
        if (apoMatch) {
          tokens.push(apoMatch[1]);
          tokens.push(apoMatch[2]);
        } else {
          tokens.push(base);
        }
        if (commaMatch) tokens.push(',');
      }
      const analyzed = tokens.filter(t => t !== ',').map(t => this.analyzeToken(t));
      allBreakdown.push(...analyzed);

      const jpParts = [];
      let i = 0;
      let isNegated = false;
      let imperative = null;
      let tenseAdverb = null;
      let modalAdverb = null;

      while (i < analyzed.length) {
        const a = analyzed[i];

        // Handle negation prefix
        if (a.type === 'negation') {
          isNegated = true;
          i++;
          continue;
        }

        // Handle imperatives
        if (a.type === 'imperative') {
          imperative = a;
          i++;
          continue;
        }

        // Handle tense/modal adverbs
        if (a.type === 'modal') {
          if (['sil'].includes(a.original.toLowerCase())) {
            tenseAdverb = a;
          } else {
            modalAdverb = a;
          }
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle tense markers
        if (a.type === 'tense') {
          // Don't output standalone — it modifies previous verb
          if (jpParts.length > 0) {
            jpParts[jpParts.length - 1] += a.meaning;
          } else {
            jpParts.push(a.meaning);
          }
          i++;
          continue;
        }

        // Handle sentence particles
        if (a.type === 'sentence_particle') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle conjunctions
        if (a.type === 'conjunction') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle greetings
        if (a.type === 'greeting') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle numbers
        if (a.type === 'number') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle pronouns
        if (a.type === 'pronoun') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle particles
        if (a.type === 'particle') {
          jpParts.push(a.meaning.replace(/^～/g, ''));
          i++;
          continue;
        }

        // Handle passive
        if (a.type === 'passive') {
          const lastIdx = jpParts.length - 1;
          if (lastIdx >= 0) {
            jpParts[lastIdx] = jpParts[lastIdx] + '(受身)';
          }
          i++;
          continue;
        }

        // Handle causative
        if (a.type === 'causative') {
          jpParts.push('～させる');
          i++;
          continue;
        }

        // Handle special pairs (et/de, til/si, etc.)
        if (a.type === 'special') {
          const lower = a.original.toLowerCase();
          if (ArkaEngine.NEGATION_WORDS.has(lower)) {
            jpParts.push(a.meaning.split('/')[1] || a.meaning);
          } else {
            jpParts.push(a.meaning.split('/')[0] || a.meaning);
          }
          i++;
          continue;
        }

        // Handle regular words
        if (a.type === 'word') {
          let jp = a.meaning;
          // Apply suffixes
          for (const suf of a.suffixes) {
            jp += suf.jp;
          }
          // Apply prefixes
          for (const pfx of a.prefixes) {
            // Already handled in meaning
          }
          // Apply negation
          if (isNegated) {
            jp += 'ない';
            isNegated = false;
          }
          // Apply imperative
          if (imperative) {
            const imp = imperative.original.toLowerCase();
            if (imp === 're') jp += '(しろ)';
            else if (imp === 'den') jp += '(するな)';
            else if (imp === 'mir') jp += '(してください)';
            else if (imp === 'fon') jp += '(しないで)';
            imperative = null;
          }
          jpParts.push(jp);
          i++;
          continue;
        }

        // Unknown words — pass through original
        jpParts.push(a.original);
        i++;
      }

      fullTranslation += jpParts.join(' ') + ' ';
    }

    // Generate pronunciation guide
    const cleanedForPron = text.replace(/[.!?,;:'"…。！？、]/g, '').trim();
    const pronWords = cleanedForPron.split(/\s+/).filter(Boolean);
    const pronunciation = pronWords.map(w => {
      const lower = w.toLowerCase().replace(/'/g, '');
      if (/^\d+$/.test(lower)) return w;
      return ArkaEngine.getArkaReading(lower);
    }).join(' ');

    return {
      translation: fullTranslation.trim(),
      breakdown: allBreakdown,
      sentenceMatch,
      pronunciation,
      variantWarning: null
    };
  }

  // === 制アルカ Arka→JP ===
  _translateSeiArkaToJapanese(text) {
    const cleanedText = text.replace(/[""“”'']/g, ' ').trim();
    const sentences = cleanedText.split(/([.!?。！？]+)/);
    const allBreakdown = [];
    let fullTranslation = '';

    for (let si = 0; si < sentences.length; si++) {
      const sentence = sentences[si];
      if (/^[.!?。！？]+$/.test(sentence)) { fullTranslation += sentence; continue; }
      if (!sentence.trim()) continue;

      const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
      const tokens = [];
      for (const t of rawTokens) {
        const commaMatch = t.match(/^(.+?)(,)$/);
        const base = commaMatch ? commaMatch[1] : t;
        const apoMatch = base.match(/^([a-zA-Z]+)'([a-zA-Z]+)$/);
        if (apoMatch) { tokens.push(apoMatch[1]); tokens.push(apoMatch[2]); }
        else { tokens.push(base); }
        if (commaMatch) tokens.push(',');
      }

      const jpParts = [];
      for (const token of tokens.filter(t => t !== ',')) {
        // Try 制アルカ specific analysis first
        const seiResult = ArkaVariants.analyzeSeiArkaToken(token, this);
        if (seiResult.recognized) {
          jpParts.push(seiResult.meaning);
          allBreakdown.push({
            original: token, root: token, type: seiResult.type,
            meaning: seiResult.meaning, entry: null, suffixes: [], prefixes: []
          });
          continue;
        }
        // Fall back to standard analysis
        const a = this.analyzeToken(token);
        allBreakdown.push(a);
        if (a.meaning && a.type !== 'unknown') { jpParts.push(a.meaning); }
        else { jpParts.push(a.original); }
      }
      fullTranslation += jpParts.join(' ') + ' ';
    }

    // Check translatability
    const arkaWords = text.split(/\s+/).filter(w => w.trim());
    const transCheck = ArkaVariants.checkTranslatability(arkaWords, 'sei', this);
    const variantWarning = ArkaVariants.getUntranslatableWarning(transCheck.untranslatable, 'sei');

    const pronWords = text.replace(/[.!?,;:'"…。！？、]/g, '').trim().split(/\s+/).filter(Boolean);
    const pronunciation = pronWords.map(w => {
      const lower = w.toLowerCase().replace(/'/g, '');
      if (/^\d+$/.test(lower)) return w;
      return ArkaEngine.getArkaReading(lower.replace(/-/g, ''));
    }).join(' ');

    return { translation: fullTranslation.trim(), breakdown: allBreakdown, sentenceMatch: null, pronunciation, variantWarning };
  }

  // === 古アルカ Arka→JP ===
  _translateKoArkaToJapanese(text) {
    // 古アルカ: SOV order, and pronouns differ (na=私)
    // Use 制アルカ-aware token analysis (shares pronouns with 古アルカ)
    const cleanedText = text.replace(/[""“”'']/g, ' ').trim();
    const sentences = cleanedText.split(/([.!?。！？]+)/);
    const allBreakdown = [];
    let fullTranslation = '';

    for (let si = 0; si < sentences.length; si++) {
      const sentence = sentences[si];
      if (/^[.!?。！？]+$/.test(sentence)) { fullTranslation += sentence; continue; }
      if (!sentence.trim()) continue;

      const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
      const tokens = [];
      for (const t of rawTokens) {
        const commaMatch = t.match(/^(.+?)(,)$/);
        const base = commaMatch ? commaMatch[1] : t;
        const apoMatch = base.match(/^([a-zA-Z]+)'([a-zA-Z]+)$/);
        if (apoMatch) { tokens.push(apoMatch[1]); tokens.push(apoMatch[2]); }
        else { tokens.push(base); }
        if (commaMatch) tokens.push(',');
      }

      const jpParts = [];
      for (const token of tokens.filter(t => t !== ',')) {
        // Try 古/制アルカ specific analysis first (na=私 etc.)
        const variantResult = ArkaVariants.analyzeSeiArkaToken(token, this);
        if (variantResult.recognized) {
          jpParts.push(variantResult.meaning);
          allBreakdown.push({
            original: token, root: token, type: variantResult.type,
            meaning: variantResult.meaning, entry: null, suffixes: [], prefixes: []
          });
          continue;
        }
        // Fall back to standard analysis
        const a = this.analyzeToken(token);
        allBreakdown.push(a);
        if (a.meaning && a.type !== 'unknown') { jpParts.push(a.meaning); }
        else { jpParts.push(a.original); }
      }
      fullTranslation += jpParts.join(' ') + ' ';
    }

    // Check translatability (古アルカ has very limited known vocabulary)
    const arkaWords = text.split(/\s+/).filter(w => w.trim());
    const transCheck = ArkaVariants.checkTranslatability(arkaWords, 'ko', this);
    const variantWarning = ArkaVariants.getUntranslatableWarning(transCheck.untranslatable, 'ko');

    const pronWords = text.replace(/[.!?,;:'"…。！？、]/g, '').trim().split(/\s+/).filter(Boolean);
    const pronunciation = pronWords.map(w => {
      const lower = w.toLowerCase().replace(/'/g, '');
      if (/^\d+$/.test(lower)) return w;
      return ArkaEngine.getArkaReading(lower);
    }).join(' ');

    return { translation: fullTranslation.trim(), breakdown: allBreakdown, sentenceMatch: null, pronunciation, variantWarning };
  }

  // Renamed original method for reuse (delegates to standard flow)
  translateArkaToJapaneseStandard(text) {
    // Temporarily switch to shinsee for standard processing
    const savedVariant = this.currentVariant;
    this.currentVariant = 'shinsee';
    const result = this.translateArkaToJapanese(text);
    this.currentVariant = savedVariant;
    return result;
  }

  // === HIGH-PRIORITY JP→ARKA OVERRIDES ===
  // Direct mappings verified against dictionary.
  // Fixes homophone collisions, incorrect reverse-map entries, and common words.
  static JP_ARKA_OVERRIDES = {
    // --- Verbs (verified against dictionary) ---
    '行く': 'ke', '来る': 'luna', '見る': 'in',
    '食べる': 'kui', '飲む': 'xen', '走る': 'lef', '歩く': 'luk',
    '読む': 'isk', '書く': 'axt', '言う': 'ku', '話す': 'kul',
    '聞く': 'ter', '知る': 'ser', '思う': 'lo', '考える': 'rafis',
    '分かる': 'loki', '愛する': 'tiia', '生きる': 'ikn', '死ぬ': 'vort',
    '持つ': 'til', '落ちる': 'met', '飛ぶ': 'left', '消える': 'sedo',
    '失う': 'tifl', '泣く': 'ena',
    '笑う': 'gah',       // FIX: kook=状態→gah=笑う
    '眠る': 'mok',       // FIX: omol→mok=眠る、寝る
    '起きる': 'net',     // FIX: teo=ちがう→net=起きる、目覚める
    '待つ': 'vat',       // FIX: tat=周期→vat=待つ
    '忘れる': 'kel',     // FIX: leeve=満月→kel=忘れる
    '覚える': 'mal',     // FIX: kalk→mal=覚える、記憶する
    '探す': 'yui',       // FIX: look→yui=探す、捜す
    '祈る': 'filia',
    '叫ぶ': 'gaax',      // FIX: klam→gaax=叫ぶ
    '歌う': 'miks',
    '踊る': 'milm',      // FIX: alan=世間→milm=踊る
    '守る': 'almi',      // FIX: diin=とにかく→almi=盾で守る
    '壊す': 'rig',       // FIX: klema=殲滅→rig=壊す、破壊する
    '作る': 'lad',       // FIX: fent→lad=作る、造る、創る
    '生まれる': 'fias',   // FIX: felm=分業→fias=生まれる
    '育つ': 'kant',      // FIX: felid→kant=育つ、成長する
    '育てる': 'kant',
    '終わる': 'is',      // FIX: ten=8→is=終える、終わる
    '始まる': 'kit',     // FIX: soa=そのような→kit=始める、始まる
    '続く': 'onk',       // FIX: van=意志副詞→onk=続ける、続く
    '止まる': 'mono',    // FIX: daim=永久停止→mono=止まる、停止
    '燃える': 'fai',
    '流れる': 'ekx',     // FIX: lei=本→ekx=流れる
    '揺れる': 'mag',     // FIX: flan=望遠鏡→mag=揺れる、震える
    '輝く': 'flip',      // FIX: far=光(名詞)→flip=輝く
    '枯れる': 'almans', '散る': 'met', '咲く': 'mans', '朽ちる': 'grein',
    '沈む': 'mend', '浮かぶ': 'eyut', '崩れる': 'vern',
    '彷徨う': 'flas', 'さまよう': 'flas',
    '壊れる': 'rig',     // FIX: klema→rig
    '飾る': 'dolk',      // FIX: mon=明瞭→dolk=飾る
    '輝かせる': 'flip',  // FIX: far→flip
    '放浪する': 'flas', '漂う': 'sens', '迷う': 'reiz',
    '怒る': 'jo',        // NEW: 怒る
    '許す': 'xilhi',     // NEW: 許す、赦す
    '赦す': 'xilhi',
    '泳ぐ': 'loks',      // NEW: 泳ぐ
    // --- Colors ---
    '赤い': 'har', '赤': 'har', '白い': 'fir', '白': 'fir',
    '黒い': 'ver', '黒': 'ver', '青い': 'soret', '青': 'soret',
    '緑': 'diia',
    // --- Adjectives (verified) ---
    '大きい': 'kai', '小さい': 'lis', '美しい': 'fiiyu',
    '良い': 'rat', '悪い': 'yam', '新しい': 'sam', '古い': 'sid',
    '早い': 'foil', '遅い': 'demi', '速い': 'tax',
    '強い': 'kanvi', '弱い': 'ivn', '高い': 'sor', '低い': 'hait',
    '長い': 'fil', '短い': 'fen', '寒い': 'sort', '暑い': 'hart',
    '熱い': 'hart', '冷たい': 'sort',
    '儚い': 'yunfi', '脆い': 'minat', '永遠': 'teom', '果てない': 'teom',
    '虚しい': 'reyu',
    '孤独': 'reino',      // FIX: laap=寂しい→reino=孤独な
    '孤独な': 'reino',
    '深い': 'hol',
    '遠い': 'flon',       // FIX: vosn→flon=遠い
    '近い': 'amis', '暗い': 'anje', '明るい': 'firte',
    '静か': 'seer',       // FIX: poen=3時/東→seer=静かな
    '静かな': 'seer',
    '激しい': 'vam',
    '優しい': 'niit',     // FIX: noan=私の(milia)→niit=優しい
    '残酷': 'fuo',       // FIX: ketet=女々しい→fuo=残酷な
    '残酷な': 'fuo',
    '綺麗': 'limi', '綺麗な': 'limi', 'きれい': 'limi', 'キレイ': 'limi',
    '清潔': 'osk', '清潔な': 'osk',
    '静かに': 'seer', '穏やか': 'diina', '寂しい': 'laap',
    '可愛い': 'ank',      // NEW: 可愛い
    'かわいい': 'ank',
    '広い': 'dok',        // NEW: 広い
    '狭い': 'get',        // NEW: 狭い
    // --- Emotions ---
    '好き': 'siina', '嫌い': 'sin', '怖い': 'vem',
    '悲しい': 'emt', '嬉しい': 'nau',
    '楽しい': 'ban', '痛い': 'yai', '眠い': 'omo',
    '怒り': 'jo',        // FIX: gaiz=不快→jo=怒り
    '恐怖': 'vem', '絶望': 'diver',
    // --- People & Family ---
    '人': 'lan', '男': 'vik', '女': 'min',
    '子供': 'lazal', '先生': 'xanxa', '友達': 'hacn',
    '父': 'kaan', '母': 'laal', '兄': 'alser', '姉': 'eeta',
    '弟': 'aruuj', '妹': 'amel',
    '学生': 'felan',      // NEW: 学生
    // --- Places & Nature ---
    '学校': 'felka', '家': 'ra', '部屋': 'ez',
    '空': 'jan', '山': 'wal', '海': 'tier', '川': 'erei',
    '森': 'kalto', '木': 'zom', '道': 'font',
    '花': 'miina', '猫': 'ket', '犬': 'kom',
    '大地': 'ako', '島': 'lein',
    '魚': 'eli',          // NEW: 魚
    // --- Directions ---
    '上': 'hal', '下': 'mol',     // NEW: 上/下
    '前': 'sa', '後ろ': 'xi',    // NEW: 前/後ろ
    '右': 'mik', '左': 'lank',   // NEW: 右/左
    // --- Seasons ---
    '春': 'axte', '夏': 'flea',   // NEW: 季節
    '秋': 'alis', '冬': 'diaxer',
    // --- Time ---
    '朝': 'faar', '夜': 'vird', '今日': 'fis',
    '明日': 'kest', '昨日': 'toxel', '時間': 'miv',
    '永遠に': 'teom', '未来': 'sil', '過去': 'ses',
    // --- Things ---
    '水': 'er', '雨': 'esk', '風': 'teeze', '雪': 'sae',  // NEW: 雪
    '太陽': 'faal', '月': 'xelt', '星': 'liifa',
    '本': 'lei', '手紙': 'hek', '名前': 'est',
    '愛': 'tiia', '世界': 'fia',
    '涙': 'ena', '血': 'erix', '炎': 'fai', '火': 'fai', '灰': 'dofl',
    '影': 'axk', '鏡': 'leiz', '盾': 'eld',
    '鎖': 'zekl', '鳥': 'mil',
    '石': 'dol',          // NEW: 石
    '金': 'fant', '鉄': 'frea',  // NEW: 金属
    '音': 'fo',           // NEW: 音
    '言葉': 'hac',        // NEW: 言葉→hac(文字・言葉)
    '文字': 'hac',
    '食事': 'kuil',       // NEW: 食事
    '食べ物': 'kulala',    // NEW: 食べ物
    '飲み物': 'xenol',    // NEW: 飲み物
    '料理': 'bel',        // NEW: 料理
    // --- Fantasy & Mythology ---
    '剣': 'xado',
    '王': 'ald',          // FIX: eeld→ald(王の一般的表現)
    '姫': 'hime',         // NEW: 姫
    '城': 'nalt',         // NEW: 城
    '神': 'alies',        // NEW: 神
    '悪魔': 'adel',       // NEW: 悪魔
    '天使': 'lans',       // NEW: 天使
    '精霊': 'fiine',      // NEW: 精霊
    '魔法': 'art',        // NEW: 魔法
    '戦争': 'garma',      // NEW: 戦争
    '平和': 'alvas',      // FIX: fien=けれども→alvas=平和
    '自由': 'silt',       // NEW: 自由
    '自由な': 'silt',
    '必要': 'xir',        // NEW: 必要
    '必要な': 'xir',
    // --- Body ---
    '手': 'las', '目': 'ins', '耳': 'tem', '口': 'kuo',
    '心': 'alem', '頭': 'osn', '魂': 'seles', '翼': 'kern',
    '傷': 'nak', '胸': 'kulf', '花びら': 'mint',
    // --- People ---
    '少女': 'fian', '少年': 'alfian', '一人': 'ves', '独り': 'ves',
    // --- Abstract ---
    '声': 'xiv', '歌': 'miks', '夢': 'lond',
    '光': 'far', '闇': 'vel', '命': 'livro', '死': 'vort',
    '希望': 'ladia', '願い': 'filia', '運命': 'teel',
    '記憶': 'mal',        // FIX: kalk→mal=記憶
    '約束': 'hain',       // FIX: lant=美しい→hain=約束を守る
    '祈り': 'filia',
    '奇跡': 'iskal',      // FIX: meltia=悪魔名→iskal=奇跡
    '真実': 'nektxan',    // FIX: faar=朝→nektxan=真実・真相
    '嘘': 'liifa', '罪': 'ain',
    '赦し': 'xilhi',      // FIX: albixe→xilhi=許し、赦し
    '戦い': 'kont',
    '終わり': 'is',      // FIX: ten→8 → is
    '始まり': 'kit',     // FIX: soa→kit
    '中': 'ka', '内': 'ka', '果て': 'teom',
    '地': 'ako',
    // --- PATCH: 衝突修正 & 欠落追加 ---
    '蝶': 'malz',         // FIX: axte(春)と衝突→malz=蝶
    '蝶々': 'malz',
    '変わる': 'em',        // FIX: xen(飲む)と衝突→em=～になる
    '変える': 'miyu',      // miyu=変える
    '変化': 'miyu',
    // --- PATCH: 動詞活用・文末対応 ---
    '行く': 'ke',          // 行く
    '行った': 'ke',       // 行く(過去)
    '来る': 'luna',        // 来る
    '来た': 'luna',        // 来た
    'いる': 'xa',          // いる(存在)
    'いた': 'xa',          // いた
    'ある': 'xa',          // ある(存在)
    'あった': 'xa',       // あった
    '持つ': 'til',         // 持つ
    '持った': 'til',
    '降る': 'ar',          // 降る
    '降った': 'ar',
    '感謝': 'sent',        // 感謝
    '見る': 'in',         // 見る
    '見た': 'in',
    '聞く': 'ter',         // 聞く
    '聞いた': 'ter',
    '言う': 'kul',         // 言う
    '言った': 'kul',
    '話す': 'kul',         // 話す
    '話した': 'kul',
    '思う': 'na',          // 思う
    '思った': 'na',
    '知る': 'ser',         // 知る
    '知った': 'ser',
    '会う': 'akt',         // 会う
    '会った': 'akt',
    '走る': 'lef',         // 走る
    '走った': 'lef',
    '歩く': 'luk',         // 歩く
    '歩いた': 'luk',
    '座る': 'skin',       // 座る
    '立つ': 'xtam',       // 立つ... 要確認
    '眠る': 'mok',
    '起きる': 'net',
    '食べる': 'kui',       // 食べる
    '飲む': 'xen',         // 飲む
    '読む': 'isk',         // 読む
    '書く': 'axt',        // 書く
    '書いた': 'axt',
    '開く': 'hom',        // 開く
    '開いた': 'hom',
    '閉じる': 'deyu',      // 閉じる
    '閉じた': 'deyu',
    '入る': 'lat',          // 入る
    '入った': 'lat',
    '出る': 'leev',        // 出る
    '出た': 'leev',
    '上がる': 'koa',      // 上がる
    '下がる': 'kend',     // 下がる
    '飛ぶ': 'left',        // 飛ぶ
    '飛んだ': 'left',
    '落ちる': 'met',      // 落ちる
    '落ちた': 'met',
    // --- 詐問・其の他 ---
    '何': 'to',           // 何 = what
    '名': 'est',          // 名 = 名前
    '者': 'el',           // 者 = person (generic)
  };

  // --- Japanese → Arka Translation ---
  translateJapaneseToArka(text) {
    if (!text.trim()) return { translation: '', breakdown: [], isKansai: false, isSouthern: false, isPoetic: false, pronunciation: '', variantWarning: null };

    const variant = this.currentVariant;

    // Detect Kansai-ben
    const isKansai = ArkaEngine.isKansaiBen(text);
    let processedText = text;
    if (isKansai) {
      processedText = ArkaEngine.normalizeKansai(text);
    }

    // Detect poetry/short text
    const isPoetic = ArkaEngine.isPoeticText(processedText);

    // Handle multi-line text (poetry)
    const lines = processedText.split(/\n/).filter(l => l.trim());
    const allBreakdown = [];
    const lineResults = [];

    for (const line of lines) {
      // Use poetic engine for literary text, standard for regular text
      // But if copula pattern is detected (XはADJ/N), use standard path
      // so that copula 'et'/'de' insertion logic runs correctly
      const hasCopula = this._detectCopulaPattern(line) !== null;
      const lineResult = (isPoetic && !hasCopula)
        ? this._translatePoeticLine(line)
        : this._translateJpLineToArka(line, isPoetic && !hasCopula);
      lineResults.push(lineResult);
      allBreakdown.push(...lineResult.breakdown);
    }

    let translation = lineResults.map(r => r.translation).join('\n');

    // Apply southern dialect if Kansai detected
    let pronunciation = '';
    if (isKansai) {
      const words = translation.split(/\s+/);
      translation = words.map(w => {
        if (w.startsWith('[') || /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u.test(w)) return w;
        return ArkaEngine.toSouthernDialect(w);
      }).join(' ');
      pronunciation = words.map(w => {
        if (w.startsWith('[') || /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u.test(w)) return w;
        return ArkaEngine.getSouthernReading(w);
      }).join(' ');
    } else {
      const words = translation.split(/\s+/);
      pronunciation = words.map(w => {
        if (w.startsWith('[') || /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u.test(w)) return w;
        return ArkaEngine.getArkaReading(w);
      }).join(' ');
    }

    // Apply variant post-processing
    let variantWarning = null;
    if (variant === 'sei') {
      const seiResult = ArkaVariants.postProcessSeiArka(translation, this);
      translation = seiResult.text;
      if (seiResult.untranslatable.length > 0) {
        variantWarning = ArkaVariants.getUntranslatableWarning(seiResult.untranslatable, 'sei');
      }
    } else if (variant === 'ko') {
      const koResult = ArkaVariants.postProcessKoArka(translation, this);
      translation = koResult.text;
      if (koResult.untranslatable.length > 0) {
        variantWarning = ArkaVariants.getUntranslatableWarning(koResult.untranslatable, 'ko');
      }
    }

    return { translation, breakdown: allBreakdown, isKansai, isSouthern: isKansai, isPoetic, pronunciation, variantWarning };
  }

  // ===== COPULA DETECTION =====
  // Detects if a Japanese sentence uses the "XはY" predicate pattern
  // that requires copula 'et' (or negative 'de') in Arka.
  // Pattern: 「NはADJい」→ N et ADJ, 「NはNだ」→ N et N
  // Verbs do NOT use copula.
  _detectCopulaPattern(text) {
    // Find topic marker は position
    const waIdx = text.indexOf('は');
    if (waIdx <= 0 || waIdx >= text.length - 1) return null;

    // Verify は is preceded by content (not part of a word like はし)
    // Also allow __PRONOUN_xxx__ tokens (from nuance preprocessing)
    const textBeforeWa = text.slice(0, waIdx).trim();
    const beforeWa = text[waIdx - 1];
    const isPronounToken = /__PRONOUN_\w+__\s*$/.test(textBeforeWa) || /__$/.test(textBeforeWa);
    if (!isPronounToken && !/[ぁ-ん々ー\u4e00-\u9fff\u30a0-\u30ff]/.test(beforeWa)) return null;

    const subject = text.slice(0, waIdx);
    const predicate = text.slice(waIdx + 1).trim();
    if (!predicate) return null;

    // Check for negative copula patterns first (ではない, じゃない)
    const negPatterns = ['ではない', 'じゃない', 'ではありません', 'じゃありません', 'でない'];
    let isNegative = false;
    let predicateCore = predicate;
    for (const neg of negPatterns) {
      if (predicate.endsWith(neg)) {
        isNegative = true;
        predicateCore = predicate.slice(0, -neg.length);
        break;
      }
    }

    // Detect verb predicates — these do NOT get copula
    // Verb endings that indicate the predicate is verbal
    const verbEndings = [
      'する', 'した', 'して', 'しない', 'します', 'しません',
      'れる', 'れた', 'れて', 'られる', 'られた',
      'せる', 'させる',
      'ている', 'ていた', 'ていない', 'ています', 'ておく',
      'てある', 'てあった',
      'える', 'える', 'おる', 'ある',
      'いく', 'いった', 'くる', 'きた',
    ];
    // Common verb dictionary form endings (context-dependent)
    const verbDictEndings = ['る', 'う', 'つ', 'く', 'ぐ', 'す', 'ぬ', 'ぶ', 'む'];
    const verbTaEndings = ['った', 'んだ', 'した', 'いた', 'いだ'];
    const verbTeEndings = ['って', 'んで', 'して', 'いて', 'いで'];
    const verbMasuEndings = ['ます', 'ません', 'ました', 'ませんでした'];

    // Check explicit verb compound endings
    for (const ve of verbEndings) {
      if (predicate.endsWith(ve) && predicate.length > ve.length) {
        return null; // It's a verb sentence, no copula needed
      }
    }
    for (const ve of verbMasuEndings) {
      if (predicate.endsWith(ve)) {
        return null; // polite verb
      }
    }

    // Detect i-adjective predicate (ends in い but NOT ない as standalone)
    // e.g., 美しい, 大きい, 赤い
    const iAdjPattern = /[ぁ-ん\u4e00-\u9fff](しい|かしい|い)$/;
    const iAdjNegPattern = /[ぁ-ん\u4e00-\u9fff](しくない|くない)$/;

    if (iAdjNegPattern.test(predicate)) {
      // Negative i-adjective: 美しくない → de fiiyu
      // Strip くない/しくない to get the adj stem for lookup
      let adjPart = predicate;
      if (predicate.endsWith('しくない')) {
        adjPart = predicate.slice(0, -4) + 'しい';
      } else if (predicate.endsWith('くない')) {
        adjPart = predicate.slice(0, -3) + 'い';
      }
      return { subject, predicate: adjPart, copula: 'de', type: 'adj-neg' };
    }

    if (iAdjPattern.test(predicate) && !isNegative) {
      return { subject, predicate, copula: 'et', type: 'adj' };
    }

    // Detect na-adjective + copula (e.g., 静かだ, 綺麗です)
    const copulaEndings = ['だ', 'です', 'である', 'でした', 'でしょう', 'だった', 'だろう'];
    for (const cop of copulaEndings) {
      if (predicate.endsWith(cop) && predicate.length > cop.length) {
        const nounOrAdj = predicate.slice(0, -cop.length);
        return { subject, predicate: nounOrAdj, copula: isNegative ? 'de' : 'et', type: 'noun-copula' };
      }
    }

    // Detect negative pattern: NはNではない / NはADJではない
    if (isNegative && predicateCore) {
      return { subject, predicate: predicateCore, copula: 'de', type: 'neg-copula' };
    }

    // Bare predicate with は — could be adj or noun predicate with implied copula
    // e.g., 猫は美しい (casual, copula-less i-adj predicate)
    if (iAdjPattern.test(predicate)) {
      return { subject, predicate, copula: 'et', type: 'adj' };
    }

    // If predicate is a noun (no verb endings, no adj endings) → copula sentence
    // Check for verb endings — verbs do not use copula
    const hasVerbEnding = verbDictEndings.some(e => predicate.endsWith(e) && predicate.length >= 2);
    const hasVerbTaEnding = verbTaEndings.some(e => predicate.endsWith(e));
    const hasVerbTeEnding = verbTeEndings.some(e => predicate.endsWith(e));

    if (hasVerbEnding || hasVerbTaEnding || hasVerbTeEnding) {
      // Likely a verb sentence — no copula needed
      return null;
    }

    // No verb endings detected — treat as noun predicate: 「彼は先生」→ la et sete
    return { subject, predicate, copula: isNegative ? 'de' : 'et', type: 'noun-pred' };
  }

  // --- Shared helpers for JP→Arka pipeline ---

  /** Replace greeting/pronoun phrases with placeholder tokens */
  _replaceGreetingsAndPronouns(text) {
    let processed = text;
    const greetingEntries = Object.entries(ArkaEngine.REVERSE_GREETINGS)
      .sort((a, b) => b[0].length - a[0].length);
    for (const [jp, arka] of greetingEntries) {
      if (processed.includes(jp)) {
        processed = processed.replace(jp, ` __GREETING_${arka}__ `);
      }
    }
    for (const [jp, arka] of Object.entries(ArkaEngine.REVERSE_PRONOUNS)) {
      if (processed.includes(jp)) {
        processed = processed.replace(new RegExp(this._escapeRegex(jp), 'g'), ` __PRONOUN_${arka}__ `);
      }
    }
    return processed;
  }

  /** Resolve tokenized JP segments into Arka words + breakdown entries */
  _resolveSegmentsToArka(segments) {
    const arkaParts = [];
    const breakdown = [];
    for (const seg of segments) {
      if (seg.startsWith('__GREETING_')) {
        const word = seg.replace('__GREETING_', '').replace('__', '');
        arkaParts.push(word);
        breakdown.push({ original: word, root: word, type: 'greeting', meaning: ArkaEngine.GREETINGS[word] || word, entry: null, suffixes: [], prefixes: [] });
        continue;
      }
      if (seg.startsWith('__PRONOUN_')) {
        const word = seg.replace('__PRONOUN_', '').replace('__', '');
        arkaParts.push(word);
        breakdown.push({ original: word, root: word, type: 'pronoun', meaning: ArkaEngine.PRONOUNS[word] || word, entry: null, suffixes: [], prefixes: [] });
        continue;
      }
      const result = this._lookupJapanese(seg);
      if (result) {
        arkaParts.push(result.arkaWord);
        breakdown.push({ original: seg, root: result.arkaWord, type: 'word', meaning: seg, entry: result.entry, suffixes: [], prefixes: [] });
      } else if (seg.trim()) {
        arkaParts.push(`[${seg}]`);
        breakdown.push({ original: seg, root: seg, type: 'unknown', meaning: '(該当なし)', entry: null, suffixes: [], prefixes: [] });
      }
    }
    return { arkaParts, breakdown };
  }

  /** Tokenize Japanese text with greeting/pronoun replacement */
  _jpTextToArkaTokens(text) {
    const replaced = this._replaceGreetingsAndPronouns(text);
    const segments = this._tokenizeJapanese(replaced);
    return this._resolveSegmentsToArka(segments);
  }

  /** Apply nuance post-processing if available */
  _applyNuancePostprocess(translation, nuanceInfo) {
    if (nuanceInfo && typeof window !== 'undefined' && window.NuancePatch) {
      return window.NuancePatch.postprocessArkaNuance(translation, nuanceInfo);
    }
    return translation;
  }

  _translateJpLineToArka(text, isPoetic = false) {
    let processedText = text;

    // ===== NUANCE PRE-PROCESSING =====
    let nuanceInfo = null;
    if (typeof window !== 'undefined' && window.NuancePatch) {
      nuanceInfo = window.NuancePatch.preprocessJapaneseNuance(processedText);
      processedText = nuanceInfo.text;
      processedText = processedText.replace(/__NUANCE_PRONOUN_(\w+)__/g, '__PRONOUN_$1__');
    }

    // ===== COPULA DETECTION =====
    const copulaInfo = this._detectCopulaPattern(processedText);

    // Subject inference
    const subjectInfo = ArkaEngine.inferSubject(processedText);
    let inferredSubject = null;
    if (!subjectInfo.hasSubject && subjectInfo.subject) {
      inferredSubject = subjectInfo.subject;
    }

    // ===== COPULA PATH =====
    if (copulaInfo) {
      const { subject: subjectText, predicate: predicateText, copula } = copulaInfo;

      // Translate subject + predicate through shared pipeline
      const subResult = this._jpTextToArkaTokens(subjectText);
      const predResult = this._jpTextToArkaTokens(predicateText);

      // Assemble: subject + copula + predicate
      const copulaMeaning = copula === 'et' ? '～である（繋辞）' : '～でない（否定繋辞）';
      const copulaBreakdown = { original: 'は', root: copula, type: 'copula', meaning: copulaMeaning, entry: null, suffixes: [], prefixes: [] };

      const arkaParts = [...subResult.arkaParts, copula, ...predResult.arkaParts];
      const breakdown = [...subResult.breakdown, copulaBreakdown, ...predResult.breakdown];

      let translation = arkaParts.join(' ').trim();
      translation = this._applyNuancePostprocess(translation, nuanceInfo);
      return { translation, breakdown };
    }

    // ===== STANDARD PATH =====
    const { arkaParts, breakdown } = this._jpTextToArkaTokens(processedText);

    // Add inferred subject at the beginning (SVO order)
    if (inferredSubject && !isPoetic) {
      arkaParts.unshift(inferredSubject);
      breakdown.unshift({
        original: `(${inferredSubject})`,
        root: inferredSubject,
        type: 'pronoun',
        meaning: ArkaEngine.PRONOUNS[inferredSubject] + ' [推定]',
        entry: null, suffixes: [], prefixes: []
      });
    }

    let translation = arkaParts.join(' ').trim();
    translation = this._applyNuancePostprocess(translation, nuanceInfo);
    return { translation, breakdown };
  }

  _lookupJapanese(word) {
    if (!word || !word.trim()) return null;
    const cleaned = word.trim();

    // === 1. Check override table first (highest priority) ===
    if (ArkaEngine.JP_ARKA_OVERRIDES[cleaned]) {
      const arkaWord = ArkaEngine.JP_ARKA_OVERRIDES[cleaned];
      const entry = this.lookupArka(arkaWord);
      return { arkaWord, entry: entry || { word: arkaWord, meaning: cleaned }, level: entry?.level || 1 };
    }

    // === 2. Try stripping verb/adj conjugation endings to match overrides ===
    const CONJUGATION_ENDINGS = [
      'される', 'させる', 'られる',  // passive/causative
      'したい', 'くない', 'した', 'して',  // compound
      'ない', 'ます', 'ません', 'です',  // polite
      'する', 'い', 'な', 'く', 'た', 'て',  // basic
    ];
    for (const end of CONJUGATION_ENDINGS) {
      if (cleaned.endsWith(end) && cleaned.length > end.length) {
        const stem = cleaned.slice(0, -end.length);
        if (ArkaEngine.JP_ARKA_OVERRIDES[stem]) {
          const arkaWord = ArkaEngine.JP_ARKA_OVERRIDES[stem];
          const entry = this.lookupArka(arkaWord);
          return { arkaWord, entry: entry || { word: arkaWord, meaning: stem }, level: entry?.level || 1 };
        }
        // Also try stem + い (for adj), stem + る (for verb), stem + う (for verb)
        for (const reattach of ['い', 'る', 'う', 'く', 'す']) {
          const candidate = stem + reattach;
          if (ArkaEngine.JP_ARKA_OVERRIDES[candidate]) {
            const arkaWord = ArkaEngine.JP_ARKA_OVERRIDES[candidate];
            const entry = this.lookupArka(arkaWord);
            return { arkaWord, entry: entry || { word: arkaWord, meaning: candidate }, level: entry?.level || 1 };
          }
        }
      }
    }

    // === 3. Direct reverse map lookup ===
    if (this.reverseMap.has(cleaned) && this.reverseMap.get(cleaned).length > 0) {
      return this.reverseMap.get(cleaned)[0];
    }

    // === 4. Try stripping grammatical endings for reverse map ===
    const endings = ['する', 'い', 'な', 'く', 'た', 'て', 'に', 'を', 'は', 'が', 'の', 'で', 'も', 'へ', 'から', 'まで', 'より', 'ます', 'です', 'だ', 'である'];
    for (const end of endings) {
      if (cleaned.endsWith(end) && cleaned.length > end.length) {
        const stem = cleaned.slice(0, -end.length);
        if (stem.length >= 2 && this.reverseMap.has(stem) && this.reverseMap.get(stem).length > 0) {
          return this.reverseMap.get(stem)[0];
        }
      }
    }

    // === 5. Fuzzy match (conservative) ===
    if (cleaned.length >= 3) {
      let bestMatch = null;
      let bestScore = 0;
      for (const [key, entries] of this.reverseMap) {
        if (key.length < 2 || entries.length === 0) continue;
        if (key === cleaned) return entries[0];
        // Allow substring match only with high overlap
        if (cleaned.length >= 3 && key.length >= 3) {
          if (key.includes(cleaned) && cleaned.length >= key.length * 0.6) {
            const score = cleaned.length / key.length;
            if (score > bestScore) { bestScore = score; bestMatch = entries[0]; }
          } else if (cleaned.includes(key) && key.length >= cleaned.length * 0.6) {
            const score = key.length / cleaned.length;
            if (score > bestScore) { bestScore = score; bestMatch = entries[0]; }
          }
        }
      }
      if (bestMatch && bestScore >= 0.6) return bestMatch;
    }

    return null;
  }

  _tokenizeJapanese(text) {
    const tokens = [];
    let current = '';
    const parts = text.split(/(__(?:GREETING|PRONOUN)_[a-z]+__)/);
    for (const part of parts) {
      if (part.startsWith('__')) {
        if (current.trim()) {
          tokens.push(...this._splitJapaneseSegment(current));
          current = '';
        }
        tokens.push(part);
      } else {
        current += part;
      }
    }
    if (current.trim()) {
      tokens.push(...this._splitJapaneseSegment(current));
    }
    return tokens.filter(t => t.trim());
  }

  _splitJapaneseSegment(text) {
    // Japanese particles to silently drop during tokenization
    const PARTICLES_SET = new Set(['を', 'は', 'が', 'の', 'に', 'へ', 'で', 'と', 'も']);
    const PARTICLES_MULTI = ['から', 'まで', 'より', 'など', 'けど', 'けれど'];
    
    return text
      .split(/[\s、。！？!?,，.]+/)
      .filter(s => s.trim())
      .flatMap(s => {
        const result = [];
        let remaining = s;
        while (remaining.length > 0) {
          // First, skip standalone single-char particles at start
          if (remaining.length === 1 && PARTICLES_SET.has(remaining)) {
            remaining = '';
            break;
          }
          // Check for multi-char particles at start
          let particleSkipped = false;
          for (const p of PARTICLES_MULTI) {
            if (remaining.startsWith(p) && remaining.length === p.length) {
              remaining = '';
              particleSkipped = true;
              break;
            }
          }
          if (particleSkipped) break;

          let found = false;
          // Try override table first (longest match)
          for (let len = Math.min(remaining.length, 12); len >= 2; len--) {
            const candidate = remaining.slice(0, len);
            // Check override table
            if (ArkaEngine.JP_ARKA_OVERRIDES[candidate]) {
              result.push(candidate);
              remaining = remaining.slice(len);
              found = true;
              break;
            }
            // Check reverse map
            if (this.reverseMap.has(candidate)) {
              result.push(candidate);
              remaining = remaining.slice(len);
              found = true;
              break;
            }
            // Try stripping trailing particle
            for (const p of [...PARTICLES_SET]) {
              if (candidate.endsWith(p) && candidate.length > p.length) {
                const stem = candidate.slice(0, -p.length);
                if (stem.length >= 2 && (ArkaEngine.JP_ARKA_OVERRIDES[stem] || this.reverseMap.has(stem))) {
                  result.push(stem);
                  remaining = remaining.slice(stem.length);
                  // Skip the particle
                  if (remaining.startsWith(p)) {
                    remaining = remaining.slice(p.length);
                  }
                  found = true;
                  break;
                }
              }
            }
            if (found) break;
            // Try multi-char particles
            for (const p of PARTICLES_MULTI) {
              if (candidate.endsWith(p) && candidate.length > p.length) {
                const stem = candidate.slice(0, -p.length);
                if (stem.length >= 2 && (ArkaEngine.JP_ARKA_OVERRIDES[stem] || this.reverseMap.has(stem))) {
                  result.push(stem);
                  remaining = remaining.slice(stem.length);
                  if (remaining.startsWith(p)) remaining = remaining.slice(p.length);
                  found = true;
                  break;
                }
              }
            }
            if (found) break;
          }
          if (!found) {
            // Check if current char is a particle to skip
            if (PARTICLES_SET.has(remaining[0])) {
              remaining = remaining.slice(1);
              continue;
            }
            // Collect consecutive unmatched characters as a single token
            let unmatched = '';
            while (remaining.length > 0) {
              // When we hit a particle, flush unmatched and skip particle
              if (PARTICLES_SET.has(remaining[0])) {
                if (unmatched) {
                  result.push(unmatched);
                  unmatched = '';
                }
                remaining = remaining.slice(1);
                continue;
              }
              // Check for multi-char particle
              let multiSkipped = false;
              for (const mp of PARTICLES_MULTI) {
                if (remaining.startsWith(mp)) {
                  if (unmatched) {
                    result.push(unmatched);
                    unmatched = '';
                  }
                  remaining = remaining.slice(mp.length);
                  multiSkipped = true;
                  break;
                }
              }
              if (multiSkipped) continue;
              
              let canMatch = false;
              for (let len = Math.min(remaining.length, 12); len >= 2; len--) {
                const sub = remaining.slice(0, len);
                if (ArkaEngine.JP_ARKA_OVERRIDES[sub] || this.reverseMap.has(sub)) {
                  canMatch = true;
                  break;
                }
              }
              if (canMatch) break;
              unmatched += remaining[0];
              remaining = remaining.slice(1);
            }
            if (unmatched) result.push(unmatched);
          }
        }
        return result;
      });
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --- Dictionary search ---
  searchDictionary(query, options = {}) {
    if (!query.trim()) return [];
    const lower = query.toLowerCase().trim();
    const { level, pos, limit = 100 } = options;
    const results = [];

    for (const entry of this.dict) {
      if (level && level !== 'all' && entry.level !== parseInt(level)) continue;
      if (pos && pos !== 'all' && !(entry.pos || []).some(p => p.includes(pos))) continue;

      let score = 0;
      const wordLower = entry.word.toLowerCase();
      const meaningLower = (entry.meaning || '').toLowerCase();

      if (wordLower === lower) score = 100;
      else if (wordLower.startsWith(lower)) score = 80;
      else if (wordLower.includes(lower)) score = 60;
      else if (meaningLower.includes(lower)) score = 40;
      else continue;

      if (entry.level && entry.level <= 2) score += 5;
      results.push({ entry, score });
      if (results.length >= limit * 3) break;
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.entry.level || 99) - (b.entry.level || 99);
    });

    return results.slice(0, limit).map(r => r.entry);
  }
}

// Export
window.ArkaEngine = ArkaEngine;
