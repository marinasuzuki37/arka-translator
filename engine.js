// ===== ARKA TRANSLATION ENGINE =====

class ArkaEngine {
  constructor() {
    this.dict = [];
    this.wordMap = new Map();      // arka word → entry
    this.reverseMap = new Map();   // japanese keyword → [{arkaWord, entry, score}]
    this.ready = false;
  }

  // --- Initialize with dictionary data ---
  async init(dictData) {
    this.dict = dictData;
    this._buildIndices();
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
    // Parse meaning field to extract core Japanese words
    for (const entry of this.dict) {
      const arkaWord = entry.word.replace(/\(\d+\)$/, '').trim();
      const meaning = entry.meaning || '';
      
      // Extract keywords from meaning
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
    // Remove POS tags in brackets like ［名詞］
    let cleaned = meaning.replace(/［[^］]+］/g, '');
    // Split by common delimiters
    const parts = cleaned.split(/[、。；;,\/（）()～〜・！？!?\s]+/);
    for (let part of parts) {
      part = part.trim();
      if (part.length >= 1 && part.length <= 20) {
        // Remove trailing particles for matching
        const stripped = part.replace(/[をはがのにへでとも]$/g, '');
        if (stripped.length >= 1) {
          keywords.add(stripped);
        }
        if (part !== stripped) keywords.add(part);
      }
    }
    return keywords;
  }

  // --- Core pronouns/special words ---
  static PRONOUNS = {
    'an': '私', 'ti': 'あなた', 'lu': '彼/彼女', 'la': 'あの人', 'el': '人',
    'ans': '私たち', 'tiis': 'あなたたち', 'luus': 'この人たち', 'laas': 'あの人たち',
    'ant': '私の', 'tiil': 'あなたの', 'luut': 'この人の', 'laat': 'あの人の',
    'tu': 'これ', 'le': 'あれ', 'tuus': 'これら', 'lees': 'あれら'
  };

  static REVERSE_PRONOUNS = {
    '私': 'an', 'わたし': 'an', '僕': 'an', 'ぼく': 'an', '俺': 'an',
    'あなた': 'ti', 'きみ': 'ti', '君': 'ti',
    '彼': 'lu', '彼女': 'lu', '彼ら': 'luus',
    'あの人': 'la',
    '私たち': 'ans', 'わたしたち': 'ans', '我々': 'ans',
    'あなたたち': 'tiis',
    'これ': 'tu', 'この': 'tu', 'あれ': 'le', 'あの': 'le',
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
    'ol': 'もし',
    'le': '(関係節)',
    'e': '～の'
  };

  static TENSE_MARKERS = {
    'at': '(過去)', 'ses': '(経験過去)'
  };

  static CONJUNCTIONS = {
    'ke': 'そして', 'son': 'だから', 'yan': 'しかし', 'fok': 'なぜなら',
    'ku': 'だから', 'ar': '(理由)', 'mil': '(目的)', 'lo': '(方法)',
    'yul': '(対象)'
  };

  static MODAL_ADVERBS = {
    'lax': '～したい', 'lan': '～したい',
    'ris': '～したくない', 'rin': '～したくない',
    'sen': '～できる', 'vil': '～できない',
    'fal': '～すべき', 'xaf': '～しなければならない',
    'sil': '～する(未来)', 'van': '～するつもり', 'fan': '～するつもり'
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
    'ilpasso': '大丈夫/問題ない'
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

  static ASPECT_SUFFIXES = [
    { suffix: 'and', meaning: '反復', jp: '～し続ける' },
    { suffix: 'or', meaning: '経過', jp: '～している' },
    { suffix: 'ik', meaning: '完了', jp: '～した' },
    { suffix: 'es', meaning: '継続', jp: '～してある' },
    { suffix: 'at', meaning: '過去', jp: '～した' }
  ];

  // --- Look up Arka word ---
  lookupArka(word) {
    const lower = word.toLowerCase();
    // Direct lookup
    if (this.wordMap.has(lower)) return this.wordMap.get(lower);
    // Try without trailing number notation
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

    // Check greetings
    if (ArkaEngine.GREETINGS[lower]) {
      result.type = 'greeting';
      result.meaning = ArkaEngine.GREETINGS[lower];
      return result;
    }

    // Check pronouns
    if (ArkaEngine.PRONOUNS[lower]) {
      result.type = 'pronoun';
      result.meaning = ArkaEngine.PRONOUNS[lower];
      return result;
    }

    // Check case particles
    if (ArkaEngine.CASE_PARTICLES[lower]) {
      result.type = 'particle';
      result.meaning = ArkaEngine.CASE_PARTICLES[lower];
      return result;
    }

    // Check modal adverbs
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

    // Check conjunctions
    if (ArkaEngine.CONJUNCTIONS[lower]) {
      result.type = 'conjunction';
      result.meaning = ArkaEngine.CONJUNCTIONS[lower];
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

    // Try stripping suffixes
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

    // Unknown word
    result.meaning = '(不明)';
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
    // Take the first non-empty part
    for (const part of parts) {
      const trimmed = part.trim();
      // Skip entries that look like grammar annotations (yulを～ patterns)
      if (trimmed && trimmed.length > 0 && !trimmed.startsWith('yulを')) {
        return trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed;
      }
    }
    const first = parts[0]?.trim() || '';
    return first.length > 30 ? first.slice(0, 30) + '…' : first;
  }

  // --- Arka → Japanese Translation ---
  translateArkaToJapanese(text) {
    if (!text.trim()) return { translation: '', breakdown: [] };

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

      // Pre-process: expand apostrophe contractions (e.g., l'at → l at, t'arbazard → t arbazard)
      const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
      const tokens = [];
      for (const t of rawTokens) {
        // Handle comma-attached tokens (e.g., "word,")
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
          i++;
          continue;
        }

        // Handle tense markers
        if (a.type === 'tense') {
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

        // Handle pronouns
        if (a.type === 'pronoun') {
          jpParts.push(a.meaning);
          i++;
          continue;
        }

        // Handle particles
        if (a.type === 'particle') {
          // Particle modifies the preceding word — add particle meaning after
          jpParts.push(a.meaning.replace('～', ''));
          i++;
          continue;
        }

        // Handle passive
        if (a.type === 'passive') {
          // Modify previous verb
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

        // Unknown words — pass through
        jpParts.push(a.original);
        i++;
      }

      // Apply tense/modal modifications
      let sentenceJp = jpParts.join(' ');
      if (tenseAdverb) {
        sentenceJp += '(未来)';
      }
      if (modalAdverb) {
        sentenceJp += modalAdverb.meaning;
      }

      fullTranslation += sentenceJp + ' ';
    }

    return {
      translation: fullTranslation.trim(),
      breakdown: allBreakdown
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

    // Tokenize remaining Japanese text
    // Simple approach: split by particles and common patterns
    const segments = this._tokenizeJapanese(text);
    const arkaParts = [];

    for (const seg of segments) {
      // Handle placeholders
      if (seg.startsWith('__GREETING_')) {
        const word = seg.replace('__GREETING_', '').replace('__', '');
        arkaParts.push(word);
        breakdown.push({
          original: word,
          root: word,
          type: 'greeting',
          meaning: ArkaEngine.GREETINGS[word] || word,
          entry: null,
          suffixes: [],
          prefixes: []
        });
        continue;
      }
      if (seg.startsWith('__PRONOUN_')) {
        const word = seg.replace('__PRONOUN_', '').replace('__', '');
        arkaParts.push(word);
        breakdown.push({
          original: word,
          root: word,
          type: 'pronoun',
          meaning: ArkaEngine.PRONOUNS[word] || word,
          entry: null,
          suffixes: [],
          prefixes: []
        });
        continue;
      }

      // Look up in reverse map
      const result = this._lookupJapanese(seg);
      if (result) {
        arkaParts.push(result.arkaWord);
        breakdown.push({
          original: seg,
          root: result.arkaWord,
          type: 'word',
          meaning: seg,
          entry: result.entry,
          suffixes: [],
          prefixes: []
        });
      } else if (seg.trim()) {
        // Pass through if not found
        arkaParts.push(`[${seg}]`);
        breakdown.push({
          original: seg,
          root: seg,
          type: 'unknown',
          meaning: '(該当なし)',
          entry: null,
          suffixes: [],
          prefixes: []
        });
      }
    }

    return {
      translation: arkaParts.join(' ').trim(),
      breakdown
    };
  }

  _lookupJapanese(word) {
    if (!word || !word.trim()) return null;
    const cleaned = word.trim();

    // Direct lookup in reverse map
    if (this.reverseMap.has(cleaned) && this.reverseMap.get(cleaned).length > 0) {
      return this.reverseMap.get(cleaned)[0];
    }

    // Try stripping common Japanese endings
    const endings = ['する', 'い', 'な', 'く', 'た', 'て', 'に', 'を', 'は', 'が', 'の', 'で', 'も', 'へ', 'から', 'まで', 'より', 'ます', 'です', 'だ', 'である'];
    for (const end of endings) {
      if (cleaned.endsWith(end) && cleaned.length > end.length) {
        const stem = cleaned.slice(0, -end.length);
        if (this.reverseMap.has(stem) && this.reverseMap.get(stem).length > 0) {
          return this.reverseMap.get(stem)[0];
        }
      }
    }

    // Substring search (try to find matching entry)
    for (const [key, entries] of this.reverseMap) {
      if (key.includes(cleaned) || cleaned.includes(key)) {
        if (entries.length > 0) return entries[0];
      }
    }

    return null;
  }

  _tokenizeJapanese(text) {
    // Simple tokenization: split by particles, punctuation, and spaces
    // This is a basic approach — a real system would use a morphological analyzer
    const tokens = [];
    let current = '';

    // First handle special placeholders
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
    // Split by common particles and delimiters
    return text
      .split(/[\s、。！？!?,，.]+/)
      .filter(s => s.trim())
      .flatMap(s => {
        // Try to split by Japanese particles
        const result = [];
        let remaining = s;
        // Greedy match: try to find known words from the reverse map
        while (remaining.length > 0) {
          let found = false;
          // Try longest match first
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
            // Take one character and continue
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
      // Filter by level
      if (level && level !== 'all' && entry.level !== parseInt(level)) continue;
      // Filter by POS
      if (pos && pos !== 'all' && !(entry.pos || []).some(p => p.includes(pos))) continue;

      let score = 0;
      const wordLower = entry.word.toLowerCase();
      const meaningLower = (entry.meaning || '').toLowerCase();

      // Exact match on Arka word
      if (wordLower === lower) score = 100;
      // Starts with query (Arka)
      else if (wordLower.startsWith(lower)) score = 80;
      // Contains query (Arka)
      else if (wordLower.includes(lower)) score = 60;
      // Japanese meaning contains query
      else if (meaningLower.includes(lower)) score = 40;
      // Partial match
      else continue;

      // Boost lower-level words
      if (entry.level && entry.level <= 2) score += 5;

      results.push({ entry, score });

      if (results.length >= limit * 3) break; // Early exit with buffer
    }

    // Sort by score descending, then by level ascending
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.entry.level || 99) - (b.entry.level || 99);
    });

    return results.slice(0, limit).map(r => r.entry);
  }
}

// Export
window.ArkaEngine = ArkaEngine;
