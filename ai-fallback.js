// ===== AI FALLBACK ENGINE =====
// Uses Puter.js for free LLM inference when rule-based engine produces uncertain results
// Includes strict output sanitization to prevent foreign language contamination

class ArkaAIFallback {
  constructor(engine) {
    this.engine = engine; // reference to ArkaEngine instance
    this.enabled = false;
    this.ready = false;
    this.busy = false;
    this.model = 'gpt-5-nano'; // fast & free default
  }

  // Check if Puter.js is available
  checkReady() {
    this.ready = typeof puter !== 'undefined' && puter.ai && typeof puter.ai.chat === 'function';
    return this.ready;
  }

  setEnabled(val) {
    this.enabled = !!val;
  }

  setModel(modelName) {
    this.model = modelName || 'gpt-5-nano';
  }

  // =============================================
  // OUTPUT SANITIZATION & VALIDATION
  // =============================================

  // Regex character class ranges for scripts that should NEVER appear in output
  // Arka uses Latin letters; Japanese uses Hiragana/Katakana/Kanji
  // Anything else is contamination.
  static FORBIDDEN_SCRIPTS = [
    /[\u0400-\u04FF]/g,          // Cyrillic (Russian etc.)
    /[\u0600-\u06FF]/g,          // Arabic
    /[\u0E00-\u0E7F]/g,          // Thai
    /[\uAC00-\uD7AF]/g,          // Korean Hangul syllables
    /[\u1100-\u11FF]/g,          // Korean Jamo
    /[\u3130-\u318F]/g,          // Korean Hangul compatibility Jamo
    /[\u0900-\u097F]/g,          // Devanagari (Hindi)
    /[\u0980-\u09FF]/g,          // Bengali
    /[\u0A80-\u0AFF]/g,          // Gujarati
    /[\u0B00-\u0B7F]/g,          // Oriya
    /[\u0B80-\u0BFF]/g,          // Tamil
    /[\u0C00-\u0C7F]/g,          // Telugu
    /[\u0C80-\u0CFF]/g,          // Kannada
    /[\u0D00-\u0D7F]/g,          // Malayalam
    /[\u1000-\u109F]/g,          // Myanmar
    /[\u10A0-\u10FF]/g,          // Georgian
    /[\u1780-\u17FF]/g,          // Khmer
    /[\u2E80-\u2EFF]/g,          // CJK Radicals Supplement (obscure chars)
    /[\uFB50-\uFDFF]/g,          // Arabic Presentation Forms-A
    /[\uFE70-\uFEFF]/g,          // Arabic Presentation Forms-B
    /[\u0370-\u03FF]/g,          // Greek (unless specifically needed, strip it)
    /[\u0530-\u058F]/g,          // Armenian
    /[\u0590-\u05FF]/g,          // Hebrew
  ];

  // Common LLM preamble/postamble patterns to strip
  static LLM_NOISE_PATTERNS = [
    // English preambles
    /^(?:here\s+is|here's|below\s+is|the\s+translation\s+is|translated?\s*:?)\s*/i,
    /^(?:sure|okay|of\s+course|certainly|absolutely)[,!.]?\s*/i,
    /^(?:translation|result|output|answer)\s*[:：]\s*/i,
    /^(?:in\s+arka|arka\s+translation)\s*[:：]\s*/i,
    // Japanese preambles
    /^(?:翻訳結果|以下が翻訳|翻訳は以下|アルカ語に翻訳すると|日本語に翻訳すると)\s*[:：]?\s*/i,
    /^(?:翻訳|結果)\s*[:：]\s*/,
    // LLM disclaimers and notes at the end
    /(?:\n|\s)*(?:note|notes|注意|備考|補足|explanation|disclaimer)\s*[:：].*$/is,
    /(?:\n|\s)*(?:\*\*note\*\*|\*note\*|※).*$/is,
    /(?:\n|\s)*(?:this\s+(?:translation|is)|please\s+note|i\s+(?:should|have|want)).*$/is,
    /(?:\n|\s)*(?:ただし|なお、|注：|※).*$/is,
    // Markdown formatting
    /```[a-z]*\n?/g,
    /```\s*$/g,
    /^\*\*(.+?)\*\*$/gm,    // bold-wrapped lines → extract inner text
    /\*\*/g,                  // remaining bold markers
    /^#+\s+/gm,             // markdown headers
    /^[-*]\s+/gm,           // markdown list items
    // Quotes wrapping the whole output
    /^["「『]+/,
    /["」』]+$/,
    // Leading/trailing whitespace and newlines
    /^\s+|\s+$/g,
  ];

  // Allowed character ranges for Arka output (JP→Arka direction)
  // Arka: Latin letters, digits, common punctuation, brackets for untranslatable markers
  static ARKA_ALLOWED = /^[\sa-zA-ZÀ-ÖØ-öø-ÿ0-9.,!?;:'"()\[\]{}\-–—\/\\…・\n\r]+$/;

  // Allowed character ranges for Japanese output (Arka→JP direction)
  // Japanese: Hiragana, Katakana, Kanji, Latin letters (for Arka terms), numbers, punctuation
  static JP_ALLOWED = /^[\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFFa-zA-Z0-9.,!?;:'"()\[\]{}\-–—\/\\…・。、！？「」『』（）〈〉《》【】〔〕～〜：；×※●○◎▶▷△◇☆★♪♫\n\r]+$/;

  /**
   * Main sanitization pipeline for AI output.
   * @param {string} raw - Raw AI response text
   * @param {string} direction - 'jp-to-arka' or 'arka-to-jp'
   * @returns {{ text: string, warnings: string[], rejected: boolean }}
   */
  sanitizeAIOutput(raw, direction) {
    if (!raw || typeof raw !== 'string') {
      return { text: '', warnings: ['空の応答'], rejected: true };
    }

    const warnings = [];
    let text = raw;

    // === Phase 1: Strip forbidden scripts ===
    for (const regex of ArkaAIFallback.FORBIDDEN_SCRIPTS) {
      const match = text.match(regex);
      if (match) {
        warnings.push(`異言語文字を除去: ${match.slice(0, 3).join(', ')}…`);
        text = text.replace(regex, '');
      }
    }

    // === Phase 2: Strip LLM noise (preambles, postambles, markdown) ===
    for (const pattern of ArkaAIFallback.LLM_NOISE_PATTERNS) {
      const before = text;
      text = text.replace(pattern, pattern.source.includes('\\*\\*(.+?)\\*\\*') ? '$1' : '');
      if (text !== before) {
        warnings.push('LLMの余分な出力を除去');
      }
    }

    // === Phase 3: Handle multi-line — pick the most relevant line ===
    // LLMs sometimes return multiple variants or add explanations on separate lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 1) {
      if (direction === 'jp-to-arka') {
        // For Arka output, pick lines that look like Arka (mostly Latin)
        const arkaLines = lines.filter(l => {
          const latinRatio = (l.match(/[a-zA-Z]/g) || []).length / l.length;
          return latinRatio > 0.5 && !this._looksLikeEnglish(l);
        });
        if (arkaLines.length > 0) {
          text = arkaLines.join('\n');
          if (arkaLines.length < lines.length) {
            warnings.push(`${lines.length - arkaLines.length}行の非アルカ行を除去`);
          }
        } else {
          // Fall back to first line
          text = lines[0];
          warnings.push('アルカ行の特定に失敗、先頭行を使用');
        }
      } else {
        // For Japanese output, pick lines with Japanese characters
        const jpLines = lines.filter(l => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(l));
        if (jpLines.length > 0) {
          text = jpLines.join('\n');
          if (jpLines.length < lines.length) {
            warnings.push(`${lines.length - jpLines.length}行の非日本語行を除去`);
          }
        } else {
          text = lines[0];
          warnings.push('日本語行の特定に失敗、先頭行を使用');
        }
      }
    }

    // === Phase 4: Direction-specific validation ===
    if (direction === 'jp-to-arka') {
      // For Arka output: strip any remaining Japanese (except bracketed [翻訳不能] markers)
      text = text.replace(/(?<!\[)[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+(?!\])/g, (match) => {
        warnings.push(`アルカ出力に残った日本語を除去: ${match}`);
        return '';
      });
      // Check for English sentences that crept in
      text = this._removeEnglishSentences(text, warnings);
    } else {
      // For Japanese output: strip Latin-only sentences/fragments that look like English
      text = this._removeEnglishSentences(text, warnings);
      // Also strip any remaining standalone Latin word sequences (3+ words, no JP chars)
      text = text.replace(/(?:^|[\u3002\uff01\uff1f\.!?]\s*)([A-Z][a-zA-Z\s,;:'"]+)$/gm, (full, latinSpan) => {
        // Only strip if the Latin span has no Japanese and has 3+ words
        const words = latinSpan.trim().split(/\s+/);
        if (words.length >= 2 && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(latinSpan)) {
          warnings.push(`英語の断片を除去: "${latinSpan.trim().slice(0, 30)}"`);
          return full.replace(latinSpan, '');
        }
        return full;
      });
    }

    // === Phase 5: Clean up whitespace artifacts ===
    text = text.replace(/\s{2,}/g, ' ').trim();
    text = text.replace(/^\s*[.,;:!?]\s*/, '').trim(); // leading orphaned punctuation

    // === Phase 6: Final rejection check ===
    const rejected = this._shouldReject(text, direction);
    if (rejected) {
      warnings.push('検証失敗: 出力が翻訳結果として不適切');
    }

    return { text, warnings, rejected };
  }

  /**
   * Check if a line looks like English prose (not Arka).
   * Arka words tend to be shorter and don't contain common English function words.
   */
  _looksLikeEnglish(line) {
    const lower = line.toLowerCase();
    // Common English function words that never appear in Arka
    const englishMarkers = [
      'the ', ' the ', ' is ', ' are ', ' was ', ' were ', ' have ', ' has ',
      ' with ', ' from ', ' this ', ' that ', ' which ', ' would ', ' could ',
      ' should ', ' there ', ' their ', ' about ', ' what ', ' when ',
      ' where ', ' while ', ' because ', ' however ', ' therefore ',
      ' although ', ' through ', ' between ', ' before ', ' after ',
      ' means ', ' meaning ', ' refers ', ' literally ', ' translation ',
      ' translates ', ' translate ', ' note ', ' please '
    ];
    let englishHits = 0;
    for (const marker of englishMarkers) {
      if (lower.includes(marker)) englishHits++;
    }
    // 2+ English function words strongly suggests English
    return englishHits >= 2;
  }

  /**
   * Remove English sentences from text.
   * A "sentence" is detected as a span of Latin text containing common English words.
   */
  _removeEnglishSentences(text, warnings) {
    // Split by sentence boundaries (period, !, ?, 。, ！, ？)
    // Use a more aggressive split that catches boundaries even without trailing space
    const parts = text.split(/(?<=[.!?。！？])\s*/);
    const cleaned = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      if (this._looksLikeEnglish(part)) {
        warnings.push(`英語の文を除去: "${part.slice(0, 40)}…"`);
      } else {
        // Also strip trailing Latin-only spans that look like English fragments
        // e.g., "私は月を食べたい。This means" → remove "This means"
        const trimmed = part.replace(/[A-Z][a-z]+(?:\s+[a-z]+){2,}\s*$/g, (match) => {
          if (this._looksLikeEnglish(match)) {
            warnings.push(`英語の断片を除去: "${match.trim().slice(0, 30)}…"`);
            return '';
          }
          return match;
        });
        if (trimmed.trim()) cleaned.push(trimmed.trim());
      }
    }
    return cleaned.join(' ');
  }

  /**
   * Final check: should the entire AI result be rejected?
   */
  _shouldReject(text, direction) {
    if (!text || text.length < 2) return true;

    if (direction === 'jp-to-arka') {
      // Arka output should be mostly Latin letters
      const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      if (totalChars === 0) return true;
      // At least 40% Latin for Arka text (rest could be punctuation/brackets)
      if (latinChars / totalChars < 0.4) return true;

      // Should not be pure English
      if (this._looksLikeEnglish(text)) return true;
    } else {
      // Japanese output should contain at least some Japanese chars
      const jpChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length;
      if (jpChars === 0) return true;

      // Check for dominant non-JP/non-Arka characters
      const totalChars = text.replace(/\s/g, '').length;
      if (totalChars > 0 && jpChars / totalChars < 0.3) return true;
    }

    // Reject if mostly punctuation/symbols
    const alnum = (text.match(/[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF0-9]/g) || []).length;
    if (text.length > 5 && alnum / text.length < 0.3) return true;

    return false;
  }

  // =============================================
  // GRAMMAR CONTEXT & DICTIONARY
  // =============================================

  // Build a compact Arka grammar reference for the AI prompt
  _buildGrammarContext() {
    return `## アルカ語（Arka）基本文法

語順: SVO（主語-動詞-目的語）
格詞（前置詞に相当）は名詞の後ろに置く: luna e seren = セレンの月

### 代名詞
an=私, ti=あなた, lu=彼/彼女, la=あの人, ans=私たち, tiis=あなたたち, luus=彼ら
ant=私の, tiil=あなたの, luut=彼の/彼女の
tu=これ/それ, le=あれ, nos=自分

### 格詞（後置）
e=～の, a/al=～に/へ, i/it=～から, ka=～で(場所), im=～の時, kon=～で(道具/方法)
ok=～と一緒に, ol=もし, kont=～しながら, yun=～のように, on=～について
pot=～の中に, frem=～の近くに, xed=～なしで

### 動詞活用
過去: -at (例: lad=食べる → ladat=食べた)
経験過去: -ses (ladses=食べたことがある)
命令: re+動詞 (re lad=食べろ)
丁寧命令: mir+動詞 (mir lad=食べてください)
禁止: den+動詞 (den lad=食べるな)
副詞的修飾: lax=～したい, sen=～できる, vil=～できない, sil=～する(未来), van=～するつもり

### 接続詞
ke=そして, son=だから, yan=しかも, fok=なぜなら, tal=しかし, ar=なぜなら(理由節)

### 文末純詞（文末助詞）
sei=～だろうか, na=～のようだ, kok=～だよね？, tisee=～なのだ

### 敬語（丁寧語）
an- を付ける: sentant → ansentant (ありがとう → ありがとうございます)
soonoyun → ansoonoyun (こんにちは → こんにちは[丁寧])

### 発音規則
x=sh(シュ), c=ts(ツ), r=巻き舌r, v=ヴ, f=フ
母音: a,i,u,e,o（日本語と同じ）

### 複数形
名詞 + -s (ket=猫 → kets=猫たち, 母音終わりは -z: luna=月 → lunaz=月たち)`;
  }

  // Build dictionary excerpt for context (most relevant words)
  _buildDictExcerpt(text) {
    if (!this.engine || !this.engine.ready) return '';

    const words = [];
    const isJp = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

    if (isJp) {
      const segments = text.split(/[\s、。！？!?…,.\n]+/).filter(s => s.length >= 2);
      for (const seg of segments) {
        const matches = this.engine.reverseMap.get(seg);
        if (matches && matches.length > 0) {
          const best = matches[0];
          words.push(`${seg} = ${best.arkaWord}`);
        }
      }
    } else {
      const tokens = text.toLowerCase().split(/[\s.,!?;:]+/).filter(t => t.length >= 2);
      for (const token of tokens) {
        const cleaned = token.replace(/[()]/g, '');
        const entry = this.engine.wordMap.get(cleaned);
        if (entry) {
          const meaning = (entry.meaning || '').slice(0, 60);
          words.push(`${cleaned} = ${meaning}`);
        }
      }
    }

    if (words.length === 0) return '';
    return '\n\n## 関連語彙\n' + words.slice(0, 30).join('\n');
  }

  // =============================================
  // FALLBACK DETECTION
  // =============================================

  needsFallback(ruleResult, inputText) {
    if (!this.enabled || !this.ready) return false;
    if (!ruleResult || !ruleResult.translation) return true;

    const trans = ruleResult.translation;

    // Check for untranslated Japanese fragments remaining in Arka output
    const jpInOutput = (trans.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g) || []);
    if (jpInOutput.length > 0) return true;

    // Check for untranslated Arka fragments remaining in Japanese output
    const isJpInput = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(inputText);
    if (!isJpInput) {
      const romanWords = (trans.match(/[a-zA-Z]{3,}/g) || []);
      const totalWords = trans.split(/\s+/).length;
      if (totalWords > 2 && romanWords.length / totalWords > 0.5) return true;
    }

    // Check for [翻訳不能] markers
    if (trans.includes('[翻訳不能]') || trans.includes('(不明)')) return true;

    return false;
  }

  // =============================================
  // MAIN TRANSLATION
  // =============================================

  async translateWithAI(text, direction) {
    if (!this.ready || this.busy) return null;
    this.busy = true;

    try {
      const grammar = this._buildGrammarContext();
      const dictExcerpt = this._buildDictExcerpt(text);

      let systemPrompt, userPrompt;

      if (direction === 'jp-to-arka') {
        systemPrompt = `あなたはアルカ語（Arka）の専門翻訳家です。アルカ語は人工言語で、SVO語順を持ちます。

【厳守ルール】
1. 出力はアルカ語の翻訳文のみ。説明・注釈・コメントは一切付けないこと。
2. 英語・中国語・韓国語・その他の言語は絶対に使わないこと。
3. 辞書にない単語は角括弧[原語]で残すこと（例：[量子]）。
4. マークダウン記法（**太字**、# 見出し等）は使わないこと。
5. 「翻訳結果：」「Translation:」等の前置きは付けないこと。

${grammar}${dictExcerpt}`;

        userPrompt = text;
      } else {
        systemPrompt = `あなたはアルカ語（Arka）の専門翻訳家です。アルカ語は人工言語で、SVO語順を持ちます。

【厳守ルール】
1. 出力は日本語の翻訳文のみ。説明・注釈・コメントは一切付けないこと。
2. 英語・中国語・韓国語・その他の言語は絶対に使わないこと。
3. 翻訳できない部分は角括弧[原語]で残すこと。
4. マークダウン記法は使わないこと。
5. 「翻訳結果：」等の前置きは付けないこと。

${grammar}${dictExcerpt}`;

        userPrompt = text;
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // Wrap in a timeout promise (15 seconds max)
      const timeoutMs = 15000;
      const chatPromise = puter.ai.chat(messages, {
        model: this.model,
        temperature: 0.2, // lower temperature = more deterministic = less noise
        max_tokens: 512
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), timeoutMs)
      );
      const response = await Promise.race([chatPromise, timeoutPromise]);

      // Extract text from response
      let rawText = '';
      if (typeof response === 'string') {
        rawText = response;
      } else if (response?.message?.content) {
        if (Array.isArray(response.message.content)) {
          rawText = response.message.content.map(c => c.text || c).join('');
        } else {
          rawText = response.message.content;
        }
      } else if (response?.text) {
        rawText = response.text;
      }

      if (!rawText.trim()) return null;

      // === SANITIZE ===
      const sanitized = this.sanitizeAIOutput(rawText.trim(), direction);

      if (sanitized.rejected) {
        console.warn('AI output rejected:', sanitized.warnings, 'raw:', rawText);
        return null;
      }

      if (sanitized.warnings.length > 0) {
        console.info('AI output sanitized:', sanitized.warnings);
      }

      return sanitized.text || null;
    } catch (err) {
      console.warn('AI fallback error:', err);
      return null;
    } finally {
      this.busy = false;
    }
  }

  // =============================================
  // ROUND-TRIP VERIFICATION
  // =============================================

  /**
   * Verify AI output by round-trip translation using the rule-based engine.
   * JP→Arka: translate AI's Arka back to JP via engine, compare with original JP.
   * Arka→JP: translate AI's JP back to Arka via engine, compare with original Arka.
   *
   * Returns { score: 0-1, level: 'pass'|'warn'|'fail', details: string, backTranslation: string }
   */
  verifyAIOutput(originalText, aiOutput, direction) {
    if (!this.engine || !this.engine.ready) {
      return { score: 0, level: 'warn', details: 'エンジン未準備のため検証スキップ', backTranslation: '' };
    }

    let backResult, backText;
    let originalNorm, backNorm;

    try {
      if (direction === 'jp-to-arka') {
        // AI produced Arka → translate back to JP via engine
        backResult = this.engine.translateArkaToJapanese(aiOutput);
        backText = backResult.translation || '';
        // Compare original JP with back-translated JP
        originalNorm = this._normalizeForComparison(originalText, 'jp');
        backNorm = this._normalizeForComparison(backText, 'jp');
      } else {
        // AI produced JP → translate back to Arka via engine
        backResult = this.engine.translateJapaneseToArka(aiOutput);
        backText = backResult.translation || '';
        // Compare original Arka with back-translated Arka
        originalNorm = this._normalizeForComparison(originalText, 'arka');
        backNorm = this._normalizeForComparison(backText, 'arka');
      }
    } catch (e) {
      return { score: 0, level: 'warn', details: '逆翻訳処理中にエラー: ' + e.message, backTranslation: '' };
    }

    // Calculate similarity
    const score = this._semanticSimilarity(originalNorm, backNorm, direction);

    let level, details;
    if (score >= 0.6) {
      level = 'pass';
      details = `逆翻訳一致率 ${Math.round(score * 100)}% — 翻訳品質良好`;
    } else if (score >= 0.3) {
      level = 'warn';
      details = `逆翻訳一致率 ${Math.round(score * 100)}% — 一部の意味が欠落している可能性`;
    } else {
      level = 'fail';
      details = `逆翻訳一致率 ${Math.round(score * 100)}% — 翻訳が出鱈目な可能性あり`;
    }

    return { score, level, details, backTranslation: backText };
  }

  /**
   * Normalize text for comparison: strip punctuation, normalize whitespace, lowercase.
   */
  _normalizeForComparison(text, lang) {
    if (!text) return '';
    let t = text.toLowerCase();
    // Remove bracketed untranslatable markers
    t = t.replace(/[\[\[\]\]（）()]/g, '');
    t = t.replace(/翻訳不能/g, '');
    t = t.replace(/不明/g, '');
    // Remove common punctuation
    t = t.replace(/[。、！？!?,.:;…・—–\-\/\\'"「」『』《》【】〔〕〈〉]/g, '');
    // Normalize whitespace
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  /**
   * Compute semantic similarity between original and back-translated text.
   * Uses word-level overlap (Jaccard-like) with content-word weighting.
   */
  _semanticSimilarity(original, backTranslated, direction) {
    if (!original || !backTranslated) return 0;
    if (original === backTranslated) return 1.0;

    // Tokenize differently based on language
    const origTokens = this._tokenize(original, direction === 'jp-to-arka' ? 'jp' : 'arka');
    const backTokens = this._tokenize(backTranslated, direction === 'jp-to-arka' ? 'jp' : 'arka');

    if (origTokens.length === 0) return 0;

    // Count shared tokens (content words weighted more)
    const origSet = new Set(origTokens);
    const backSet = new Set(backTokens);

    let sharedWeight = 0;
    let totalWeight = 0;

    for (const token of origSet) {
      const w = this._tokenWeight(token, direction === 'jp-to-arka' ? 'jp' : 'arka');
      totalWeight += w;
      if (backSet.has(token)) {
        sharedWeight += w;
      } else {
        // Partial match: check if any back token contains or is contained by this token
        for (const bt of backSet) {
          if (token.length >= 2 && bt.length >= 2) {
            if (token.includes(bt) || bt.includes(token)) {
              sharedWeight += w * 0.5;
              break;
            }
          }
        }
      }
    }

    // Also penalize if back-translation has lots of untranslated markers
    const untranslated = (backTokens.join(' ').match(/翻訳不能|不明/g) || []).length;
    const penalty = Math.min(untranslated * 0.1, 0.4);

    const rawScore = totalWeight > 0 ? sharedWeight / totalWeight : 0;
    return Math.max(0, Math.min(1, rawScore - penalty));
  }

  /**
   * Tokenize text into content words.
   */
  _tokenize(text, lang) {
    if (lang === 'jp') {
      // For Japanese: split into character n-grams and identifiable substrings
      // Use a mix of kanji/katakana word extraction + character bigrams
      const tokens = [];
      // Extract kanji words (sequences of kanji)
      const kanjiWords = text.match(/[\u4E00-\u9FFF]+/g) || [];
      tokens.push(...kanjiWords);
      // Extract katakana words
      const kataWords = text.match(/[\u30A0-\u30FF]+/g) || [];
      tokens.push(...kataWords);
      // Extract hiragana bigrams for function word matching
      const hira = text.match(/[\u3040-\u309F]{2,}/g) || [];
      for (const h of hira) {
        if (h.length >= 2) tokens.push(h);
      }
      return tokens.filter(t => t.length >= 1);
    } else {
      // For Arka/Latin: split on spaces
      return text.split(/\s+/).filter(t => t.length >= 2);
    }
  }

  /**
   * Weight for content vs function words.
   */
  _tokenWeight(token, lang) {
    if (lang === 'jp') {
      // Kanji/Katakana = content words (higher weight)
      if (/[\u4E00-\u9FFF\u30A0-\u30FF]/.test(token)) return 2.0;
      // Hiragana = often particles/function words
      return 0.5;
    } else {
      // Arka: function words (格詞, 代名詞, etc.) get lower weight
      const funcWords = new Set(['e', 'a', 'al', 'i', 'it', 'ka', 'im', 'kon', 'ok', 'ol',
        'an', 'ti', 'lu', 'la', 'ans', 'ke', 'son', 'tal', 'fok', 'ar',
        'tu', 'le', 'nos', 'yan', 'del', 'man', 'on', 'en']);
      if (funcWords.has(token)) return 0.5;
      return 2.0;
    }
  }

  // Combined translation: rule-based first, then AI if needed
  async translateWithFallback(text, direction, ruleResult) {
    if (!this.enabled || !this.ready) {
      return { ...ruleResult, aiAssisted: false, aiResult: null };
    }

    const needs = this.needsFallback(ruleResult, text);

    if (!needs) {
      return { ...ruleResult, aiAssisted: false, aiResult: null };
    }

    const aiResult = await this.translateWithAI(text, direction);

    if (aiResult) {
      return {
        ...ruleResult,
        aiAssisted: true,
        aiResult: aiResult,
      };
    }

    return { ...ruleResult, aiAssisted: false, aiResult: null };
  }
}
