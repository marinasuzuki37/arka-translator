// ===== ARKA TRANSLATION ENGINE v2.0 =====
// Enhanced with melidia wiki parallel corpus data

class ArkaEngine {
  constructor() {
    this.dict = [];
    this.wordMap = new Map();      // arka word → entry
    this.reverseMap = new Map();   // japanese keyword → [{arkaWord, entry, score}]
    this.sentenceMemory = [];      // parallel corpus for sentence-level matching
    this.ready = false;
  }

  // --- Initialize with dictionary data ---
  async init(dictData) {
    this.dict = dictData;
    this._buildIndices();
    // Load sentence memory and wiki vocab in parallel
    await Promise.all([
      this._loadSentenceMemoryFromFile(),
      this._loadWikiVocab()
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
  static PRONOUNS = {
    'an': '私', 'ti': 'あなた', 'lu': '彼/彼女', 'la': 'あの人', 'el': '人々/不特定の人',
    'ans': '私たち', 'tiis': 'あなたたち', 'luus': '彼ら', 'laas': 'あの人たち',
    'ant': '私の', 'tiil': 'あなたの', 'luut': '彼の/彼女の', 'laat': 'あの人の',
    'tu': 'これ/それ', 'le': 'あれ/その', 'tuus': 'これら', 'lees': 'あれら',
    'non': '私(丁寧)', 'nos': '彼女(丁寧)'
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
    'xalt': '～として'
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
    // 文頭純詞
    'tio': '単なる/ただ～だけ',
    'ala': '一体(修辞疑問)',
    'taik': '更には/その上',
    'tan': 'やはり',
    'hot': '～しか',
    'as': '少なくとも',
    'tis': '～すら/～さえ',
    // 文末純詞
    'sei': '～だろうか(推量)',
    'in': '～のようだ(視覚推量)',
    'xan': '～だったのか(気付き)',
    'eyo': '～だろうか(milia位相)'
  };

  static MODAL_ADVERBS = {
    'lax': '～したい', 'lan': '～したい',
    'ris': '～したくない', 'rin': '～したくない',
    'sen': '～できる', 'vil': '～できない',
    'fal': '～すべき', 'xaf': '～しなければならない',
    'sil': '～する(未来)', 'van': '～するつもり', 'fan': '～するつもり',
    'em': '～するようになる'
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
    'こんにちは': 'soonoyun', 'おはよう': 'soonoyun', 'こんばんは': 'soonoyun',
    'ありがとう': 'sentant', 'ありがとうございます': 'sentant',
    'すみません': 'vantant', 'ごめんなさい': 'vantant', 'ごめん': 'vantant',
    '大丈夫': 'passo', 'いいよ': 'passo'
  };

  static SPECIAL_NEGATION = {
    'et': { neg: 'de', meaning: '～である/～でない' },
    'til': { neg: 'si', meaning: '持つ/持たない' },
    'xa': { neg: 'mi', meaning: '存在する/存在しない' },
    'lax': { neg: 'ris', meaning: '欲しい/欲しくない' },
    'sen': { neg: 'vil', meaning: 'できる/できない' }
  };

  static NEGATION_WORDS = new Set(['de', 'si', 'mi', 'ris', 'vil']);

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

    // Check greetings
    if (ArkaEngine.GREETINGS[lower]) {
      result.type = 'greeting';
      result.meaning = ArkaEngine.GREETINGS[lower];
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
      { prefix: 'on', meaning: '続' }
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
    if (!text.trim()) return { translation: '', breakdown: [], sentenceMatch: null };

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

    return {
      translation: fullTranslation.trim(),
      breakdown: allBreakdown,
      sentenceMatch
    };
  }

  // --- Japanese → Arka Translation ---
  translateJapaneseToArka(text) {
    if (!text.trim()) return { translation: '', breakdown: [] };

    const breakdown = [];

    // Check for full greeting phrases first
    for (const [jp, arka] of Object.entries(ArkaEngine.REVERSE_GREETINGS)) {
      if (text.includes(jp)) {
        text = text.replace(jp, ` __GREETING_${arka}__ `);
      }
    }

    // Check for pronoun phrases
    for (const [jp, arka] of Object.entries(ArkaEngine.REVERSE_PRONOUNS)) {
      if (text.includes(jp)) {
        text = text.replace(new RegExp(this._escapeRegex(jp), 'g'), ` __PRONOUN_${arka}__ `);
      }
    }

    const segments = this._tokenizeJapanese(text);
    const arkaParts = [];

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
