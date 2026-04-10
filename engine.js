// ===== ARKA TRANSLATION ENGINE v3.0 =====
// Enhanced with melidia wiki parallel corpus data
// + Subject inference, Kansai→Southern dialect, Pronunciation guide, Poetry mode

class ArkaEngine {
  constructor() {
    this.dict = [];
    this.wordMap = new Map();      // arka word → entry
    this.reverseMap = new Map();   // japanese keyword → [{arkaWord, entry, score}]
    this.sentenceMemory = [];      // parallel corpus for sentence-level matching
    this.greetingsMap = new Map(); // greeting word → Japanese meaning
    this.ready = false;
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
    for (const entry of this.dict) {
      const key = entry.word.toLowerCase().replace(/\(\d+\)$/, '').trim();
      if (!this.wordMap.has(key)) {
        this.wordMap.set(key, entry);
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
    for (let part of parts) {
      part = part.trim();
      if (part.length >= 1 && part.length <= 20) {
        const stripped = part.replace(/[をはがのにへでとも]$/g, '');
        if (stripped.length >= 1) {
          keywords.add(stripped);
        }
        if (part !== stripped) keywords.add(part);
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
    '私': 'an', 'わたし': 'an', '僕': 'an', 'ぼく': 'an', '俺': 'an',
    'あなた': 'ti', 'きみ': 'ti', '君': 'ti',
    '彼': 'lu', '彼女': 'lu', '彼ら': 'luus',
    'あの人': 'la',
    '私たち': 'ans', 'わたしたち': 'ans', '我々': 'ans',
    'あなたたち': 'tiis',
    'これ': 'tu', 'この': 'tu', 'それ': 'tu', 'あれ': 'le', 'あの': 'le',
    'これら': 'tuus', 'あれら': 'lees',
    '私の': 'ant', 'あなたの': 'tiil'
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
    reading = reading.replace(/va/g, 'ヴァ').replace(/vi/g, 'ヴィ').replace(/vu/g, 'ヴ').replace(/ve/g, 'ヴェ').replace(/vo/g, 'ヴォ');
    reading = reading.replace(/la/g, 'ラ').replace(/li/g, 'リ').replace(/lu/g, 'ル').replace(/le/g, 'レ').replace(/lo/g, 'ロ');
    reading = reading.replace(/l/g, 'ル');
    reading = reading.replace(/ra/g, 'ラ').replace(/ri/g, 'リ').replace(/ru/g, 'ル').replace(/re/g, 'レ').replace(/ro/g, 'ロ');
    reading = reading.replace(/r/g, 'ル');
    reading = reading.replace(/na/g, 'ナ').replace(/ni/g, 'ニ').replace(/nu/g, 'ヌ').replace(/ne/g, 'ネ').replace(/no/g, 'ノ');
    reading = reading.replace(/n([^aiueoアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヴ])/g, 'ン$1');
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
    const pronounPatterns = ['私', '僕', '俺', 'あなた', '君', '彼', '彼女', 'わたし', 'ぼく', 'おれ', 'あたし', 'わし', 'うち'];
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
    // Very short, no punctuation = likely poetic fragment
    if (text.length < 15 && !/[。、！？!?,.]/.test(text)) return true;
    return false;
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
      result.meaning = this.greetingsMap.get(lower);
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
        result.meaning = this.greetingsMap.get(stem) + '[丁寧]';
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
    // Remove POS tags like ［名詞］
    let cleaned = meaningStr.replace(/［[^］]+］/g, ' ').trim();
    // Split by various delimiters and get the first meaningful segment
    const segments = cleaned.split(/[。；]/)[0];
    // Split by comma or 、 to get individual meanings
    const parts = segments.split(/[、,]+/);
    // Collect up to 2-3 short meanings for better translation
    const meanings = [];
    for (const part of parts) {
      const trimmed = part.trim();
      // Skip yulを～ patterns and very long entries
      if (trimmed && trimmed.length > 0 && !trimmed.startsWith('yulを') && !trimmed.startsWith('yulに') && !trimmed.startsWith('yulが')) {
        if (trimmed.length <= 15) {
          meanings.push(trimmed);
          if (meanings.length >= 2) break;
        } else if (meanings.length === 0) {
          meanings.push(trimmed.slice(0, 15) + '…');
          break;
        }
      }
    }
    // If we still have nothing, try taking the first part
    if (meanings.length === 0) {
      const first = parts[0]?.trim() || '';
      if (first) meanings.push(first.length > 15 ? first.slice(0, 15) + '…' : first);
    }
    return meanings.join('/');
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
    if (!text.trim()) return { translation: '', breakdown: [], sentenceMatch: null, pronunciation: '' };

    // Check sentence memory for exact/near match
    const sentenceMatch = this.findSentenceMatch(text);

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
      pronunciation
    };
  }

  // --- Japanese → Arka Translation ---
  translateJapaneseToArka(text) {
    if (!text.trim()) return { translation: '', breakdown: [], isKansai: false, isSouthern: false, isPoetic: false, pronunciation: '' };

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
      const lineResult = this._translateJpLineToArka(line, isPoetic);
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

    return { translation, breakdown: allBreakdown, isKansai, isSouthern: isKansai, isPoetic, pronunciation };
  }

  _translateJpLineToArka(text, isPoetic = false) {
    const breakdown = [];
    let processedText = text;

    // Subject inference
    const subjectInfo = ArkaEngine.inferSubject(processedText);
    let inferredSubject = null;
    if (!subjectInfo.hasSubject && subjectInfo.subject) {
      inferredSubject = subjectInfo.subject;
    }

    // Check for full greeting phrases first (sort by length descending to match longer phrases first)
    const greetingEntries = Object.entries(ArkaEngine.REVERSE_GREETINGS)
      .sort((a, b) => b[0].length - a[0].length);
    for (const [jp, arka] of greetingEntries) {
      if (processedText.includes(jp)) {
        processedText = processedText.replace(jp, ` __GREETING_${arka}__ `);
      }
    }

    // Check for pronoun phrases
    for (const [jp, arka] of Object.entries(ArkaEngine.REVERSE_PRONOUNS)) {
      if (processedText.includes(jp)) {
        processedText = processedText.replace(new RegExp(this._escapeRegex(jp), 'g'), ` __PRONOUN_${arka}__ `);
      }
    }

    const segments = this._tokenizeJapanese(processedText);
    const arkaParts = [];

    // Add inferred subject at the beginning (SVO order)
    if (inferredSubject && !isPoetic) {
      arkaParts.push(inferredSubject);
      breakdown.push({
        original: `(${inferredSubject})`,
        root: inferredSubject,
        type: 'pronoun',
        meaning: ArkaEngine.PRONOUNS[inferredSubject] + ' [推定]',
        entry: null, suffixes: [], prefixes: []
      });
    }

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

    return { translation: arkaParts.join(' ').trim(), breakdown };
  }

  _lookupJapanese(word) {
    if (!word || !word.trim()) return null;
    const cleaned = word.trim();

    if (this.reverseMap.has(cleaned) && this.reverseMap.get(cleaned).length > 0) {
      return this.reverseMap.get(cleaned)[0];
    }

    const endings = ['する', 'い', 'な', 'く', 'た', 'て', 'に', 'を', 'は', 'が', 'の', 'で', 'も', 'へ', 'から', 'まで', 'より', 'ます', 'です', 'だ', 'である'];
    for (const end of endings) {
      if (cleaned.endsWith(end) && cleaned.length > end.length) {
        const stem = cleaned.slice(0, -end.length);
        if (this.reverseMap.has(stem) && this.reverseMap.get(stem).length > 0) {
          return this.reverseMap.get(stem)[0];
        }
      }
    }

    for (const [key, entries] of this.reverseMap) {
      if (key.includes(cleaned) || cleaned.includes(key)) {
        if (entries.length > 0) return entries[0];
      }
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
    return text
      .split(/[\s、。！？!?,，.]+/)
      .filter(s => s.trim())
      .flatMap(s => {
        const result = [];
        let remaining = s;
        while (remaining.length > 0) {
          let found = false;
          for (let len = Math.min(remaining.length, 10); len >= 1; len--) {
            const candidate = remaining.slice(0, len);
            if (this.reverseMap.has(candidate)) {
              result.push(candidate);
              remaining = remaining.slice(len);
              found = true;
              break;
            }
          }
          if (!found) {
            result.push(remaining[0]);
            remaining = remaining.slice(1);
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
