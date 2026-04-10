// ===== ARKA VARIANT TRANSLATION ENGINES =====
// Supports: 新生アルカ (default), 制アルカ, 古アルカ, 俗アルカ
// Each variant has different grammar rules and may have limited vocabulary.

class ArkaVariants {
  // ===== VARIANT DEFINITIONS =====
  static VARIANTS = {
    'shinsee': {
      id: 'shinsee',
      label: '新生アルカ',
      period: '2008～2013',
      description: '現行の標準アルカ。メルテーブル・7相アスペクト・位相代名詞・豊富な格詞を持つ。',
      isDefault: true,
      hasFullVocab: true,
    },
    'zoku': {
      id: 'zoku',
      label: '俗アルカ',
      period: '2013～',
      description: '新生アルカの文法を継承し、コミュニティにより語彙が拡張されたもの。',
      isDefault: false,
      hasFullVocab: true,
    },
    'sei': {
      id: 'sei',
      label: '制アルカ',
      period: '2001～2008',
      description: 'n対語（母音交替対義語）と時相詞（動詞語幹+時制相接辞）を持つ体系的な言語。',
      isDefault: false,
      hasFullVocab: false,
    },
    'ko': {
      id: 'ko',
      label: '古アルカ',
      period: '1991～2001',
      description: '表意幻字を使用。語順はSOV→SVOへ移行中。エクスプローダー（助動詞相当）を持つ。',
      isDefault: false,
      hasFullVocab: false,
    },
  };

  // ===== 制アルカ (SEI-ARKA) GRAMMAR =====
  // Key differences from 新生アルカ:
  // 1. 時相詞: Verb stem + hyphen + tense/aspect suffix
  // 2. n対語: Vowel alternation for antonyms/sets
  // 3. Different pronoun set (na instead of an for 1st person)
  // 4. Grammar words differ in some cases

  // 制アルカ pronouns (from prototype)
  static SEI_PRONOUNS = {
    '私': 'na', 'わたし': 'na', '僕': 'na', '俺': 'na',
    'あなた': 'ti', '君': 'ti',
    '彼': 'lu', '彼女': 'lu',
    'あの人': 'o',
    '私たち': 'na sein', 'あなたたち': 'ti sein',
    'これ': 'tu', 'あれ': 'va',
    'ここ': 'tuka', 'あそこ': 'vaka',
  };

  static SEI_PRONOUNS_REVERSE = {
    'na': '私', 'ti': 'あなた', 'lu': '彼/彼女', 'o': 'あの人',
    'tu': 'これ', 'va': 'あれ', 'tuka': 'ここ', 'vaka': 'あそこ',
    'so': 'それ(無生)',
  };

  // 制アルカ 時相詞 (tense-aspect suffixes)
  // Format: verb-suffix (hyphen separated)
  // Based on available sources: at=past, present is unmarked, future uses modal
  static SEI_TENSE_ASPECT = {
    'at': { meaning: '過去・開始相', jp: '～し始めた' },
    'ak': { meaning: '過去・終了相', jp: '～し終えた' },
    'ot': { meaning: '現在・経過相', jp: '～している' },
    'ok': { meaning: '現在・完了相', jp: '～してある' },
    'it': { meaning: '未来・開始相', jp: '～し始めるだろう' },
    'ik': { meaning: '未来・終了相', jp: '～し終えるだろう' },
    'et': { meaning: '反復相', jp: '～し続ける' },
    'ek': { meaning: '瞬間相', jp: '～する(一瞬)' },
    // Prototype period suffixes (slightly different)
    'to': { meaning: '過去(PT)', jp: '～した' },
    'xa': { meaning: '現在(PT)', jp: '～する' },
    'su': { meaning: '未来(PT)', jp: '～するだろう' },
    'da': { meaning: '過去現在(PT)', jp: '～していた' },
  };

  // 制アルカ modals (from prototype)
  static SEI_MODALS = {
    'muna': '～しましょうか(勧誘)',
    'desa': '～してもよい(許可)',
    'desi': '～してはいけない(禁止)',
    'lapi': '～したくない(懸念)',
    'tuxa': '～しなければならない(必要)',
    'xafa': '～すべきだ(責任)',
    'fala': '～しないほうがよい(義務)',
    'mi': '～してください(依頼)',
    'lapa': '～したい(希望)',
    'vena': '～できる(可能)',
    'veni': '～できない(不可能)',
    're': '～しろ(命令)',
  };

  // 制アルカ n対語 examples
  // Format: {center: 'u-form', pairs: [{word, meaning}, ...]}
  static N_TAIGO = [
    { center: 'hu', pairs: [{ word: 'ha', meaning: '上' }, { word: 'hi', meaning: '下' }] },
    { center: 'fun', pairs: [{ word: 'fan', meaning: '女' }, { word: 'fin', meaning: '男' }] },
    { center: null, pairs: [{ word: 'bal', meaning: '天井' }, { word: 'bil', meaning: '壁' }, { word: 'bol', meaning: '床' }] },
    { center: null, pairs: [{ word: 'keta', meaning: '春' }, { word: 'keti', meaning: '夏' }, { word: 'keto', meaning: '秋' }, { word: 'kete', meaning: '冬' }] },
  ];

  // 制アルカ numbers
  static SEI_NUMBERS = {
    '0': 'yo', '1': 'hu', '2': 'ko', '3': 'be', '4': 'vo',
    '5': 'xo', '6': 'nu', '7': 'zo', '8': 'fe', '9': 'le',
    '十': 'to', '百': 'ga', '千': 'te',
  };

  // Build n対語 lookup maps
  static _buildNTaigoMap() {
    const jpToSei = {};
    const seiToJp = {};
    for (const group of ArkaVariants.N_TAIGO) {
      for (const pair of group.pairs) {
        jpToSei[pair.meaning] = pair.word;
        seiToJp[pair.word] = pair.meaning;
      }
      if (group.center) {
        seiToJp[group.center] = group.pairs.map(p => p.meaning).join('/') + '(総称)';
      }
    }
    return { jpToSei, seiToJp };
  }

  // ===== 古アルカ (KO-ARKA) GRAMMAR =====
  // Key differences:
  // 1. SOV word order (later period: transitioning to SVO)
  // 2. 表意幻字 (logographic writing - not applicable in translation)
  // 3. エクスプローダー (auxiliary verb-like elements)
  // 4. Richer case system
  // 5. Different pronouns
  // 6. Very limited online vocabulary

  static KO_PRONOUNS = {
    '私': 'na', 'わたし': 'na', '僕': 'na',
    'あなた': 'ti', '君': 'ti',
    '彼': 'lu', '彼女': 'lu',
    '私の': 'e an', // [e an] → [æn] in colloquial
  };

  static KO_PRONOUNS_REVERSE = {
    'na': '私', 'ti': 'あなた', 'lu': '彼/彼女',
  };

  // 古アルカ エクスプローダー (auxiliary verbs)
  // These were absorbed into 純詞 and 時相詞 in 制アルカ
  static KO_EXPLODERS = {
    'hanvet': { meaning: 'エクスプローダー(助動詞)', jp: '(文法助動詞)' },
  };

  // ===== VARIANT-AWARE TRANSLATION =====

  /**
   * Convert 新生アルカ text to 制アルカ approximation
   * Main transformations:
   * - Apply n対語 vocabulary where applicable
   * - Add 時相詞 hyphenation to verbs
   * - Replace pronouns (an→na)
   * - Track untranslatable portions
   */
  static convertToSeiArka(arkaText, engine) {
    const words = arkaText.split(/\s+/);
    const result = [];
    const untranslatable = [];

    for (const word of words) {
      const lower = word.toLowerCase();

      // Skip punctuation and brackets
      if (/^[\[\].,!?。！？]+$/.test(word)) {
        result.push(word);
        continue;
      }

      // Convert pronouns: an→na
      if (lower === 'an') { result.push('na'); continue; }
      if (lower === 'ans') { result.push('na sein'); continue; }
      if (lower === 'ant') { result.push('e na'); continue; }

      // Check n対語 reverse lookup (新生→制)
      const nTaigo = ArkaVariants._nTaigoFromShinsee(lower, engine);
      if (nTaigo) {
        result.push(nTaigo);
        continue;
      }

      // Most vocabulary is shared between 制 and 新生, but some words changed.
      // If the word exists in 新生 dictionary, keep it (制 likely had similar form)
      if (engine.wordMap.has(lower)) {
        result.push(word);
        continue;
      }

      // Unknown word - mark as potentially untranslatable
      // But keep it (制アルカ might have had it)
      result.push(word);
    }

    return {
      text: result.join(' '),
      untranslatable,
    };
  }

  /**
   * Convert JP→Arka result for 制アルカ mode
   * Adds 時相詞 notation and n対語 substitutions
   */
  static postProcessSeiArka(arkaText, engine) {
    const words = arkaText.split(/\s+/);
    const result = [];
    const untranslatable = [];

    for (const word of words) {
      const lower = word.toLowerCase();

      // Skip brackets (untranslated Japanese)
      if (word.startsWith('[') && word.endsWith(']')) {
        untranslatable.push(word.slice(1, -1));
        result.push(word);
        continue;
      }

      // Convert pronouns
      if (lower === 'an') { result.push('na'); continue; }
      if (lower === 'ans') { result.push('na sein'); continue; }
      if (lower === 'ant') { result.push('e na'); continue; }

      // Check if word is a verb in the dictionary - add 時相詞 notation
      const entry = engine.lookupArka(lower);
      if (entry) {
        const pos = entry.pos || [];
        const isVerb = pos.some(p => p.includes('動詞'));
        if (isVerb) {
          // In 制アルカ, verbs appear as stem-tenseMarker
          // Default present tense = no marker, or explicitly add -xa for clarity
          result.push(word);
          continue;
        }
      }

      // Check n対語
      const nTaigo = ArkaVariants._nTaigoFromShinsee(lower, engine);
      if (nTaigo) {
        result.push(nTaigo);
        continue;
      }

      result.push(word);
    }

    return {
      text: result.join(' '),
      untranslatable,
    };
  }

  /**
   * Convert JP→Arka result for 古アルカ mode
   * Main change: SOV word order (reorder SVO→SOV)
   */
  static postProcessKoArka(arkaText, engine) {
    const words = arkaText.split(/\s+/);
    const untranslatable = [];

    // Track untranslatable
    for (const word of words) {
      if (word.startsWith('[') && word.endsWith(']')) {
        untranslatable.push(word.slice(1, -1));
      }
    }

    // Convert pronouns
    let result = words.map(w => {
      const lower = w.toLowerCase();
      if (lower === 'an') return 'na';
      if (lower === 'ans') return 'na sein';
      if (lower === 'ant') return 'e na';
      return w;
    });

    // Attempt SOV reorder for simple sentences:
    // SVO: Subject Verb Object → SOV: Subject Object Verb
    // This is a simplified heuristic for basic sentences
    result = ArkaVariants._reorderToSOV(result, engine);

    return {
      text: result.join(' '),
      untranslatable,
    };
  }

  /**
   * Simple SVO→SOV reorder heuristic
   * SVO: Subject Verb Object → SOV: Subject Object Verb
   * Only applies to simple sentences
   */
  static _reorderToSOV(words, engine) {
    if (words.length <= 2) return words;

    // Find verb candidates (checking dictionary POS and known overrides)
    const verbWords = new Set();
    if (ArkaEngine.JP_ARKA_OVERRIDES) {
      // Build set of known verb Arka words from overrides
      const verbJP = [
        '行く', '来る', '見る', '食べる', '飲む', '走る', '歩く',
        '読む', '書く', '言う', '話す', '聞く', '知る', '思う', '考える',
        '分かる', '愛する', '生きる', '死ぬ'
      ];
      for (const jp of verbJP) {
        if (ArkaEngine.JP_ARKA_OVERRIDES[jp]) {
          verbWords.add(ArkaEngine.JP_ARKA_OVERRIDES[jp]);
        }
      }
    }

    // Words that should NOT be treated as verbs for SOV reorder
    // (pronouns, particles, conjunctions etc. that happen to have verb POS)
    const pronounsAndParticles = new Set(['na', 'ti', 'lu', 'o', 'so', 'tu', 'va',
      'e', 'a', 'al', 'i', 'it', 'ka', 'im', 'kon', 'ok', 'ol',
      'son', 'yan', 'fok', 'tal', 'ar', 'mil',
      'sein', 'at', 'ses', 'et', 'de', 'an', 'ans', 'ant']);

    // Find the first verb in the word list
    let verbIdx = -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase().replace(/[[\]]/g, '');
      // Skip known pronouns/particles
      if (pronounsAndParticles.has(w)) continue;
      // Check known verb set from overrides (high confidence)
      if (verbWords.has(w)) { verbIdx = i; break; }
      // Check dictionary POS (only if verb is the FIRST listed POS = primary function)
      const entry = engine.lookupArka(w);
      if (entry) {
        const pos = entry.pos || [];
        if (pos.length > 0 && pos[0].includes('動詞')) {
          verbIdx = i;
          break;
        }
      }
    }

    // SVO → SOV: move verb to end
    // Before: [S] [V] [O ...] → After: [S] [O ...] [V]
    if (verbIdx >= 0 && verbIdx < words.length - 1) {
      const before = words.slice(0, verbIdx);
      const verb = words[verbIdx];
      const after = words.slice(verbIdx + 1);
      return [...before, ...after, verb];
    }

    return words;
  }

  /**
   * Look up n対語 equivalent for a 新生アルカ word
   */
  static _nTaigoFromShinsee(arkaWord, engine) {
    // Check if the word's meaning maps to any n対語
    const entry = engine.lookupArka(arkaWord);
    if (!entry) return null;

    const meaning = entry.meaning || '';
    const { jpToSei } = ArkaVariants._buildNTaigoMap();

    // Check core meaning against n対語
    for (const [jp, sei] of Object.entries(jpToSei)) {
      if (meaning.includes(jp)) {
        return sei;
      }
    }
    return null;
  }

  /**
   * Translate Arka→JP in 制アルカ mode
   * Recognizes 時相詞 (hyphenated verb forms)
   */
  static analyzeSeiArkaToken(token, engine) {
    const lower = token.toLowerCase();

    // Check for 時相詞 hyphenation: verb-suffix
    if (lower.includes('-')) {
      const parts = lower.split('-');
      if (parts.length === 2) {
        const [stem, suffix] = parts;
        const tenseInfo = ArkaVariants.SEI_TENSE_ASPECT[suffix];
        const stemEntry = engine.lookupArka(stem);

        if (tenseInfo) {
          const stemMeaning = stemEntry ? engine._extractCoreMeaning(stemEntry.meaning) : stem;
          return {
            recognized: true,
            meaning: stemMeaning + tenseInfo.jp,
            type: 'sei_verb',
            stem,
            suffix,
            tenseInfo,
          };
        }
      }
    }

    // Check 制アルカ/古アルカ specific pronouns (MUST be checked before standard analysis
    // because 'na' = 私 in 制/古アルカ, but = 〜のようだ in 新生アルカ)
    if (ArkaVariants.SEI_PRONOUNS_REVERSE[lower]) {
      return {
        recognized: true,
        meaning: ArkaVariants.SEI_PRONOUNS_REVERSE[lower],
        type: 'pronoun',
      };
    }

    // Check 制アルカ modals
    if (ArkaVariants.SEI_MODALS[lower]) {
      return {
        recognized: true,
        meaning: ArkaVariants.SEI_MODALS[lower],
        type: 'modal',
      };
    }

    // Check n対語
    const { seiToJp } = ArkaVariants._buildNTaigoMap();
    if (seiToJp[lower]) {
      return {
        recognized: true,
        meaning: seiToJp[lower],
        type: 'n_taigo',
      };
    }

    return { recognized: false };
  }

  /**
   * Translate JP→Arka in 制アルカ mode
   * Uses n対語 vocabulary and 時相詞 verb forms
   */
  static lookupJapaneseSei(word, engine) {
    // Check 制アルカ pronouns
    if (ArkaVariants.SEI_PRONOUNS[word]) {
      return { arkaWord: ArkaVariants.SEI_PRONOUNS[word], type: 'pronoun' };
    }

    // Check n対語
    const { jpToSei } = ArkaVariants._buildNTaigoMap();
    if (jpToSei[word]) {
      return { arkaWord: jpToSei[word], type: 'n_taigo' };
    }

    // Fall through to standard lookup (most vocabulary is shared)
    return null;
  }

  // ===== UNTRANSLATABLE PORTION DETECTION =====

  /**
   * Check how translatable a text is for a given variant
   * Returns: { translatable: number, total: number, untranslatable: string[] }
   */
  static checkTranslatability(arkaWords, variant, engine) {
    const total = arkaWords.filter(w => !w.match(/^[\[\].,!?。！？\s]+$/)).length;
    let translatable = 0;
    const untranslatable = [];

    for (const word of arkaWords) {
      const lower = word.toLowerCase().replace(/[[\],\.!?。！？]/g, '').trim();
      if (!lower || lower.length === 0) continue;

      // Check if word exists in the variant's known vocabulary
      let found = false;

      if (variant === 'sei') {
        // Check 制アルカ specific
        const seiResult = ArkaVariants.analyzeSeiArkaToken(word, engine);
        if (seiResult.recognized) { found = true; }
        // Also check shared vocab
        if (!found && engine.lookupArka(lower)) { found = true; }
        if (!found) {
          // Check hyphenated forms
          if (lower.includes('-')) {
            const stem = lower.split('-')[0];
            if (engine.lookupArka(stem)) { found = true; }
          }
        }
      } else if (variant === 'ko') {
        // 古アルカ has very limited online vocabulary
        // We can only recognize basic shared words
        if (engine.lookupArka(lower)) { found = true; }
        if (ArkaVariants.KO_PRONOUNS_REVERSE[lower]) { found = true; }
      } else {
        // 新生/俗 have full vocabulary
        if (engine.lookupArka(lower)) { found = true; }
        found = true; // Default: assume translatable for full-vocab variants
      }

      if (found) {
        translatable++;
      } else {
        untranslatable.push(word);
      }
    }

    return { translatable, total, untranslatable };
  }

  /**
   * Generate untranslatable warning message
   */
  static getUntranslatableWarning(untranslatable, variant) {
    if (untranslatable.length === 0) return null;

    const variantLabel = ArkaVariants.VARIANTS[variant]?.label || variant;
    const words = untranslatable.slice(0, 10).join('、');
    const more = untranslatable.length > 10 ? `他${untranslatable.length - 10}語` : '';

    return {
      message: `⚠ ${variantLabel}では翻訳不能な部分があります`,
      details: `該当語: ${words}${more ? '、' + more : ''}`,
      count: untranslatable.length,
    };
  }
}

// Export
window.ArkaVariants = ArkaVariants;
