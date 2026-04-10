// ===== ARKA TRANSLATOR APP =====

(function () {
  'use strict';

  const engine = new ArkaEngine();
  const aiFallback = new ArkaAIFallback(engine);
  let direction = 'arka-to-jp'; // or 'jp-to-arka'
  let dictSearchTimeout = null;

  // --- Theme Toggle ---
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', currentTheme);
  updateThemeIcon();

  themeToggle && themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
  });

  function updateThemeIcon() {
    if (!themeToggle) return;
    themeToggle.innerHTML = currentTheme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // --- Tab Navigation ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
    });
  });

  // --- Load Dictionary ---
  async function loadDictionary() {
    try {
      const resp = await fetch('dictionary.json');
      const data = await resp.json();
      await engine.init(data);
      const totalWords = engine.wordMap.size;
      const totalSentences = engine.sentenceMemory.length;
      document.getElementById('dict-count').textContent = `辞書: ${totalWords.toLocaleString()}語 / 対訳: ${totalSentences}文`;
      document.getElementById('loading-overlay').classList.add('hidden');
    } catch (err) {
      console.error('Dictionary load failed:', err);
      document.querySelector('.loading-text').textContent = '辞書の読み込みに失敗しました';
    }
  }

  loadDictionary();

  // --- AI Fallback Setup ---
  const aiToggle = document.getElementById('ai-toggle');
  const aiToggleWrap = document.getElementById('ai-toggle-wrap');

  // Check Puter.js availability after a short delay
  setTimeout(() => {
    if (aiFallback.checkReady()) {
      aiToggleWrap.classList.add('available');
      aiToggleWrap.title = '辞書で翻訳できない部分をAIが補助します';
    } else {
      aiToggleWrap.classList.add('unavailable');
      aiToggleWrap.title = 'AI補助は現在利用できません';
      aiToggle.disabled = true;
    }
  }, 2000);

  aiToggle.addEventListener('change', () => {
    aiFallback.setEnabled(aiToggle.checked);
    if (aiToggle.checked) {
      aiFallback.checkReady();
    }
  });

  // --- Translation Direction ---
  const swapBtn = document.getElementById('swap-direction');
  const sourceLang = document.getElementById('source-lang');
  const targetLang = document.getElementById('target-lang');
  const inputText = document.getElementById('input-text');
  const outputText = document.getElementById('output-text');

  swapBtn.addEventListener('click', () => {
    direction = direction === 'arka-to-jp' ? 'jp-to-arka' : 'arka-to-jp';
    const variantId = engine.getVariant();
    const variantInfo = ArkaVariants && ArkaVariants.VARIANTS[variantId];
    const arkaLabel = variantInfo ? variantInfo.label : 'アルカ語';
    sourceLang.textContent = direction === 'arka-to-jp' ? arkaLabel : '日本語';
    targetLang.textContent = direction === 'arka-to-jp' ? '日本語' : arkaLabel;
    inputText.placeholder = direction === 'arka-to-jp'
      ? 'アルカ語のテキストを入力…'
      : '日本語のテキストを入力…';
    // Clear output
    outputText.innerHTML = '<span class="placeholder-text">翻訳結果がここに表示されます</span>';
    document.getElementById('breakdown-section').style.display = 'none';
    // Swap animation
    swapBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => { swapBtn.style.transform = ''; }, 300);
  });

  // --- Variant Selector ---
  const variantPills = document.querySelectorAll('.variant-pill');
  const variantWarningEl = document.getElementById('variant-warning');

  variantPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const variantId = pill.dataset.variant;
      variantPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      engine.setVariant(variantId);

      // Update source label to reflect variant
      const variantInfo = ArkaVariants.VARIANTS[variantId];
      if (direction === 'arka-to-jp') {
        sourceLang.textContent = variantInfo ? variantInfo.label : 'アルカ語';
      } else {
        targetLang.textContent = variantInfo ? variantInfo.label : 'アルカ語';
      }

      // Clear warning
      variantWarningEl.style.display = 'none';
      variantWarningEl.innerHTML = '';
    });
  });

  // --- Translate ---
  const translateBtn = document.getElementById('translate-btn');
  const breakdownSection = document.getElementById('breakdown-section');
  const breakdownGrid = document.getElementById('breakdown-grid');

  translateBtn.addEventListener('click', doTranslate);
  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doTranslate();
    }
  });

  function doTranslate() {
    if (!engine.ready) return;
    const text = inputText.value.trim();
    if (!text) return;

    let result;
    if (direction === 'arka-to-jp') {
      result = engine.translateArkaToJapanese(text);
    } else {
      result = engine.translateJapaneseToArka(text);
    }

    // Render the rule-based result immediately
    renderTranslation(result, text);

    // If AI fallback is enabled and result looks incomplete, query AI asynchronously
    if (aiFallback.enabled && aiFallback.ready && aiFallback.needsFallback(result, text)) {
      showAILoading();
      const dir = direction === 'arka-to-jp' ? 'arka-to-jp' : 'jp-to-arka';
      aiFallback.translateWithAI(text, dir).then(aiResult => {
        if (aiResult) {
          appendAIResult(aiResult, dir);
        } else {
          appendAIRejected();
        }
      }).catch((err) => {
        console.warn('AI fallback failed:', err);
        appendAIError();
      });
    }
  }

  function showAILoading() {
    // Add loading indicator below output
    let aiSection = document.getElementById('ai-result-section');
    if (!aiSection) {
      aiSection = document.createElement('div');
      aiSection.id = 'ai-result-section';
      aiSection.className = 'ai-result-section';
      outputText.parentNode.appendChild(aiSection);
    }
    aiSection.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span> AI翻訳を取得中…</div>';
    aiSection.style.display = 'block';
  }

  function hideAILoading() {
    const aiSection = document.getElementById('ai-result-section');
    if (aiSection) aiSection.style.display = 'none';
  }

  function getOrCreateAISection() {
    let aiSection = document.getElementById('ai-result-section');
    if (!aiSection) {
      aiSection = document.createElement('div');
      aiSection.id = 'ai-result-section';
      aiSection.className = 'ai-result-section';
      outputText.parentNode.appendChild(aiSection);
    }
    return aiSection;
  }

  function appendAIError() {
    const aiSection = getOrCreateAISection();
    aiSection.innerHTML = `
      <div class="ai-result-header">
        <span class="ai-badge ai-badge-warn">🤖 AI補助</span>
        <span class="ai-note">AI翻訳に接続できませんでした。初回利用時はPuter.jsのログインが必要です。</span>
      </div>
    `;
    aiSection.style.display = 'block';
    setTimeout(() => { aiSection.style.display = 'none'; }, 6000);
  }

  function appendAIRejected() {
    const aiSection = getOrCreateAISection();
    aiSection.innerHTML = `
      <div class="ai-result-header">
        <span class="ai-badge ai-badge-warn">🤖 AI補助</span>
        <span class="ai-note">AIの応答が検証を通過できませんでした（不要な言語または形式が混入）</span>
      </div>
    `;
    aiSection.style.display = 'block';
    setTimeout(() => { aiSection.style.display = 'none'; }, 6000);
  }

  function appendAIResult(aiText, dir) {
    const aiSection = getOrCreateAISection();

    // Double-check: run one more client-side validation
    const validated = validateAIDisplay(aiText, dir);
    if (!validated) {
      appendAIRejected();
      return;
    }

    aiSection.innerHTML = `
      <div class="ai-result-header">
        <span class="ai-badge">🤖 AI補助翻訳</span>
        <span class="ai-note">辞書にない語をAIが補完（検証済み）</span>
      </div>
      <div class="ai-result-text">${escapeHtml(validated)}</div>
    `;
    aiSection.style.display = 'block';
  }

  /**
   * Client-side final validation of AI output before display.
   * Returns cleaned text or null if rejected.
   */
  function validateAIDisplay(text, dir) {
    if (!text || text.length < 2) return null;

    // Strip any remaining forbidden script characters (extra safety)
    let cleaned = text;
    // Cyrillic, Arabic, Korean, Thai, Devanagari, etc.
    cleaned = cleaned.replace(/[\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0900-\u097F\u0590-\u05FF]/g, '');

    // Strip markdown residue
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/^#+\s+/gm, '');

    // Strip English sentences one more time
    const sentences = cleaned.split(/(?<=[.!?。！？])\s+/);
    const filtered = sentences.filter(s => {
      const lower = s.toLowerCase();
      const engWords = ['the ', ' is ', ' are ', ' this ', ' that ', ' have ', ' with ', ' from ',
        ' means ', ' translation ', ' note ', ' please ', ' which ', ' would '];
      let hits = 0;
      for (const w of engWords) { if (lower.includes(w)) hits++; }
      return hits < 2;
    });
    cleaned = filtered.join(' ').trim();

    // Direction-specific final checks
    if (dir === 'jp-to-arka') {
      const latin = (cleaned.match(/[a-zA-Z]/g) || []).length;
      const total = cleaned.replace(/\s/g, '').length;
      if (total === 0 || latin / total < 0.3) return null;
    } else {
      const jp = (cleaned.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || []).length;
      if (jp === 0) return null;
    }

    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned.length >= 2 ? cleaned : null;
  }

  function renderTranslation(result, text) {
    // Hide any previous AI result
    const aiSection = document.getElementById('ai-result-section');
    if (aiSection) aiSection.style.display = 'none';

    // Show sentence-level match if available (Arka→JP only)
    let sentenceMatchHtml = '';
    if (direction === 'arka-to-jp' && result.sentenceMatch) {
      const sm = result.sentenceMatch;
      const pct = Math.round(sm.score * 100);
      const typeLabel = sm.type === 'exact' ? '完全一致' : `類似一致 (${pct}%)`;
      const pageLabel = sm.match.page ? ` [p.${sm.match.page}]` : '';
      sentenceMatchHtml = `<div class="sentence-match">
        <div class="sentence-match-label">📖 対訳コーパス: ${typeLabel}${pageLabel}</div>
        <div class="sentence-match-text">${escapeHtml(sm.match.ja)}</div>
      </div>`;
    }

    // Build pronunciation guide HTML (for JP→Arka only; Arka→JP uses "原文読み" below)
    let pronHtml = '';
    if (direction === 'jp-to-arka' && result.pronunciation) {
      pronHtml = `<div class="pronunciation-guide"><span class="pron-label">🔊 発音:</span> ${escapeHtml(result.pronunciation)}</div>`;
    }

    // Build dialect/mode indicator
    let modeHtml = '';
    if (result.isKansai) {
      modeHtml += `<div class="dialect-badge southern">🌿 関西弁検出 → 南方方言(ルティア語)で出力</div>`;
    }
    if (result.isPoetic) {
      modeHtml += `<div class="dialect-badge poetic">✨ 詩的モード: 主語省略を保持</div>`;
    }

    // Show translation
    if (sentenceMatchHtml) {
      outputText.innerHTML = sentenceMatchHtml + `<div class="gloss-translation"><span class="gloss-label">語釈:</span> ${escapeHtml(result.translation || '')}</div>` + pronHtml;
    } else {
      let mainText = result.translation || '翻訳できませんでした';
      // For Arka output with newlines (poetry), preserve line breaks
      if (direction === 'jp-to-arka' && mainText.includes('\n')) {
        mainText = mainText.split('\n').map(l => escapeHtml(l)).join('<br>');
        outputText.innerHTML = modeHtml + `<div class="translation-text">${mainText}</div>` + pronHtml;
      } else {
        outputText.innerHTML = modeHtml + `<div class="translation-text">${escapeHtml(mainText)}</div>` + pronHtml;
      }
    }

    // Also show pronunciation for Arka→JP
    if (direction === 'arka-to-jp' && result.pronunciation) {
      outputText.innerHTML += `<div class="pronunciation-guide"><span class="pron-label">🔊 原文読み:</span> ${escapeHtml(result.pronunciation)}</div>`;
    }

    // Show variant warning if applicable
    if (result.variantWarning) {
      variantWarningEl.style.display = 'block';
      variantWarningEl.innerHTML = `<div class="warning-title">${escapeHtml(result.variantWarning.message)}</div><div class="warning-details">${escapeHtml(result.variantWarning.details)}</div>`;
    } else {
      variantWarningEl.style.display = 'none';
      variantWarningEl.innerHTML = '';
    }

    // Show breakdown
    if (result.breakdown && result.breakdown.length > 0) {
      breakdownSection.style.display = 'block';
      renderBreakdown(result.breakdown);
    } else {
      breakdownSection.style.display = 'none';
    }
  }

  function renderBreakdown(tokens) {
    breakdownGrid.innerHTML = '';
    for (const token of tokens) {
      const card = document.createElement('div');
      card.className = 'breakdown-card';

      let html = `<div class="breakdown-word">${escapeHtml(token.original)}</div>`;

      if (token.root && token.root !== token.original.toLowerCase()) {
        html += `<div class="breakdown-root">語幹: ${escapeHtml(token.root)}</div>`;
      }

      if (token.meaning && token.meaning !== '(不明)') {
        html += `<div class="breakdown-meaning">${escapeHtml(token.meaning)}</div>`;
      }

      if (token.suffixes && token.suffixes.length > 0) {
        const suffixStr = token.suffixes.map(s => `-${s.form} (${s.label})`).join(', ');
        html += `<div class="breakdown-suffix">${escapeHtml(suffixStr)}</div>`;
      }

      // Tooltip with full meaning
      if (token.entry) {
        const fullMeaning = token.entry.meaning || '';
        const posArr = (token.entry.pos || []).join(', ');
        const level = token.entry.level ? `Lv.${token.entry.level}` : '';
        html += `<div class="breakdown-tooltip">
          <strong>${escapeHtml(token.entry.word)}</strong> ${escapeHtml(posArr)} ${escapeHtml(level)}<br>
          ${escapeHtml(fullMeaning.slice(0, 200))}${fullMeaning.length > 200 ? '…' : ''}
        </div>`;
      }

      card.innerHTML = html;
      breakdownGrid.appendChild(card);
    }
  }

  // --- Clear Input ---
  document.getElementById('clear-input').addEventListener('click', () => {
    inputText.value = '';
    outputText.innerHTML = '<span class="placeholder-text">翻訳結果がここに表示されます</span>';
    breakdownSection.style.display = 'none';
    inputText.focus();
  });

  // --- Copy Output ---
  document.getElementById('copy-output').addEventListener('click', () => {
    const text = outputText.textContent;
    if (text && !text.includes('翻訳結果がここに表示されます')) {
      navigator.clipboard.writeText(text).catch(() => {
        // Fallback: create temporary textarea
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    }
  });

  // --- Dictionary Search ---
  const dictSearch = document.getElementById('dict-search');
  const dictResults = document.getElementById('dict-results');
  const dictResultsInfo = document.getElementById('dict-results-info');
  const dictLevelFilter = document.getElementById('dict-level-filter');
  const dictPosFilter = document.getElementById('dict-pos-filter');

  dictSearch.addEventListener('input', debounceSearch);
  dictLevelFilter.addEventListener('change', debounceSearch);
  dictPosFilter.addEventListener('change', debounceSearch);

  function debounceSearch() {
    clearTimeout(dictSearchTimeout);
    dictSearchTimeout = setTimeout(performDictSearch, 200);
  }

  function performDictSearch() {
    if (!engine.ready) return;
    const query = dictSearch.value.trim();
    const level = dictLevelFilter.value;
    const pos = dictPosFilter.value;

    if (!query && level === 'all' && pos === 'all') {
      dictResults.innerHTML = '';
      dictResultsInfo.textContent = '';
      return;
    }

    const results = engine.searchDictionary(query || '', { level, pos, limit: 100 });
    dictResultsInfo.textContent = `${results.length}件の結果${results.length >= 100 ? ' (上限100件)' : ''}`;

    dictResults.innerHTML = '';
    for (const entry of results) {
      const el = document.createElement('div');
      el.className = 'dict-entry';

      const posHtml = (entry.pos || [])
        .filter((v, i, a) => a.indexOf(v) === i) // dedupe
        .map(p => `<span class="pos-tag">${escapeHtml(p)}</span>`)
        .join('');

      const levelStr = entry.level ? '★'.repeat(Math.min(entry.level, 5)) : '';

      el.innerHTML = `
        <div class="dict-entry-header">
          <span class="dict-entry-word">${escapeHtml(entry.word)}</span>
          <div class="dict-entry-pos">${posHtml}</div>
          <span class="dict-entry-level">${levelStr}</span>
        </div>
        <div class="dict-entry-meaning">${escapeHtml(entry.meaning || '')}</div>
      `;
      dictResults.appendChild(el);
    }
  }

  // --- Grammar Reference ---
  function buildGrammarContent() {
    const grammarEl = document.getElementById('grammar-content');
    const sections = getGrammarSections();

    grammarEl.innerHTML = '';
    sections.forEach((section, idx) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'grammar-section' + (idx === 0 ? ' open' : '');

      const headerEl = document.createElement('div');
      headerEl.className = 'grammar-header';
      headerEl.innerHTML = `
        <h3>${escapeHtml(section.title)}</h3>
        <svg class="grammar-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      `;
      headerEl.addEventListener('click', () => {
        sectionEl.classList.toggle('open');
      });

      const bodyEl = document.createElement('div');
      bodyEl.className = 'grammar-body';
      bodyEl.innerHTML = section.content;

      sectionEl.appendChild(headerEl);
      sectionEl.appendChild(bodyEl);
      grammarEl.appendChild(sectionEl);
    });
  }

  function getGrammarSections() {
    return [
      {
        title: '基本語順',
        content: `
          <p class="grammar-note">アルカ語はSVO (主語-動詞-目的語) の語順です。形容詞は名詞の後に置きます（後置修飾）。</p>
          <table class="grammar-table">
            <thead><tr><th>構造</th><th>アルカ語</th><th>日本語</th></tr></thead>
            <tbody>
              <tr><td>SVO</td><td class="arka-cell">an klam ti</td><td class="jp-cell">私はあなたを愛する</td></tr>
              <tr><td>後置修飾</td><td class="arka-cell">miik har</td><td class="jp-cell">赤いリンゴ</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">7品詞: 名詞、動詞、形副詞(形容詞/副詞)、純詞、格詞、接続詞、感動詞</p>
        `
      },
      {
        title: '代名詞 (中立位相/seet)',
        content: `
          <table class="grammar-table">
            <thead><tr><th>アルカ語</th><th>日本語</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">an</td><td class="jp-cell">私</td><td>1人称単数</td></tr>
              <tr><td class="arka-cell">ti</td><td class="jp-cell">あなた</td><td>2人称単数</td></tr>
              <tr><td class="arka-cell">lu</td><td class="jp-cell">彼/彼女/この人</td><td>3人称近称</td></tr>
              <tr><td class="arka-cell">la</td><td class="jp-cell">あの人</td><td>3人称遠称</td></tr>
              <tr><td class="arka-cell">el</td><td class="jp-cell">人/one</td><td>不定人称</td></tr>
              <tr><td class="arka-cell">ans</td><td class="jp-cell">私たち</td><td>1人称複数</td></tr>
              <tr><td class="arka-cell">tiis</td><td class="jp-cell">あなたたち</td><td>2人称複数</td></tr>
              <tr><td class="arka-cell">luus</td><td class="jp-cell">この人たち</td><td>3人称近称複数</td></tr>
              <tr><td class="arka-cell">laas</td><td class="jp-cell">あの人たち</td><td>3人称遠称複数</td></tr>
            </tbody>
          </table>
          <table class="grammar-table" style="margin-top:var(--space-4)">
            <thead><tr><th>所有形</th><th>日本語</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">ant</td><td class="jp-cell">私の</td></tr>
              <tr><td class="arka-cell">tiil</td><td class="jp-cell">あなたの</td></tr>
              <tr><td class="arka-cell">luut</td><td class="jp-cell">この人の</td></tr>
              <tr><td class="arka-cell">laat</td><td class="jp-cell">あの人の</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '指示詞',
        content: `
          <table class="grammar-table">
            <thead><tr><th>アルカ語</th><th>日本語</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">tu</td><td class="jp-cell">これ/この</td></tr>
              <tr><td class="arka-cell">le</td><td class="jp-cell">あれ/あの</td></tr>
              <tr><td class="arka-cell">tuus</td><td class="jp-cell">これら</td></tr>
              <tr><td class="arka-cell">lees</td><td class="jp-cell">あれら</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '時制 (テンス)',
        content: `
          <table class="grammar-table">
            <thead><tr><th>形式</th><th>意味</th><th>例</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">無標</td><td class="jp-cell">現在/無時制</td><td>an klam (私は愛する)</td></tr>
              <tr><td class="arka-cell">-at</td><td class="jp-cell">過去</td><td>an klamat (私は愛した)</td></tr>
              <tr><td class="arka-cell">sil</td><td class="jp-cell">未来</td><td>an sil klam (私は愛するだろう)</td></tr>
              <tr><td class="arka-cell">ses</td><td class="jp-cell">経験過去</td><td>an ses klam (私は愛したことがある)</td></tr>
              <tr><td class="arka-cell">lut</td><td class="jp-cell">常時/汎時制</td><td>an lut klam (私はいつも愛する)</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">-atは開音節動詞にはそのまま付加、閉音節動詞にも-atを付加します。</p>
        `
      },
      {
        title: 'アスペクト (相)',
        content: `
          <table class="grammar-table">
            <thead><tr><th>接尾辞</th><th>名称</th><th>意味</th><th>例</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">-or</td><td>経過相</td><td class="jp-cell">～している</td><td>klamor (愛している)</td></tr>
              <tr><td class="arka-cell">-ik</td><td>完了相</td><td class="jp-cell">～した</td><td>klamik (愛し終えた)</td></tr>
              <tr><td class="arka-cell">-es</td><td>継続相</td><td class="jp-cell">～してある</td><td>klames (愛してある)</td></tr>
              <tr><td class="arka-cell">-and</td><td>反復相</td><td class="jp-cell">～し続ける</td><td>klamand (愛し続ける)</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '否定',
        content: `
          <table class="grammar-table">
            <thead><tr><th>形式</th><th>意味</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">en + 動詞</td><td class="jp-cell">～ない</td><td>一般の否定</td></tr>
              <tr><td class="arka-cell">et / de</td><td class="jp-cell">～である / ～でない</td><td>コピュラ</td></tr>
              <tr><td class="arka-cell">til / si</td><td class="jp-cell">持つ / 持たない</td><td>所有</td></tr>
              <tr><td class="arka-cell">xa / mi</td><td class="jp-cell">存在する / 存在しない</td><td>存在</td></tr>
              <tr><td class="arka-cell">lax / ris</td><td class="jp-cell">欲しい / 欲しくない</td><td>願望</td></tr>
              <tr><td class="arka-cell">sen / vil</td><td class="jp-cell">できる / できない</td><td>可能</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '格詞 (前置詞)',
        content: `
          <table class="grammar-table">
            <thead><tr><th>格詞</th><th>日本語</th><th>用例</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">e</td><td class="jp-cell">～の (属格)</td><td>omi e felez (教室の扉)</td></tr>
              <tr><td class="arka-cell">a / al</td><td class="jp-cell">～に/～へ (与格)</td><td>母音前ではal</td></tr>
              <tr><td class="arka-cell">i / it</td><td class="jp-cell">～から (奪格)</td><td>母音前ではit</td></tr>
              <tr><td class="arka-cell">ka</td><td class="jp-cell">～で/～に (場所)</td><td>場所の格</td></tr>
              <tr><td class="arka-cell">im</td><td class="jp-cell">～のとき/～に (時間)</td><td>時間の格</td></tr>
              <tr><td class="arka-cell">kon</td><td class="jp-cell">～で (道具)</td><td>道具の格</td></tr>
              <tr><td class="arka-cell">ok</td><td class="jp-cell">～と一緒に</td><td>共格</td></tr>
              <tr><td class="arka-cell">ol</td><td class="jp-cell">もし (条件)</td><td>条件の格</td></tr>
              <tr><td class="arka-cell">kont</td><td class="jp-cell">～しながら</td><td>同時行為</td></tr>
              <tr><td class="arka-cell">frem</td><td class="jp-cell">～の近くに</td><td>近接</td></tr>
              <tr><td class="arka-cell">pot</td><td class="jp-cell">～の中に</td><td>内部</td></tr>
              <tr><td class="arka-cell">yun</td><td class="jp-cell">～のように</td><td>比況</td></tr>
              <tr><td class="arka-cell">xed</td><td class="jp-cell">～なしで</td><td>欠如</td></tr>
              <tr><td class="arka-cell">emo</td><td class="jp-cell">～から判断して</td><td>判断根拠</td></tr>
              <tr><td class="arka-cell">le</td><td class="jp-cell">(関係節接続)</td><td>関係節</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '派生形態 (動副詞・分詞)',
        content: `
          <p class="grammar-note">アルカ語では動詞や形容詞に接尾辞を付けて副詞や名詞を派生します。</p>
          <table class="grammar-table">
            <thead><tr><th>接尾辞</th><th>名称</th><th>意味</th><th>例</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">-el</td><td>動副詞</td><td class="jp-cell">～して/～く(副詞的)</td><td>mald→maldel (騒いで), vam→vamel (乱暴に), han→hanel (広く)</td></tr>
              <tr><td class="arka-cell">-an</td><td>主格分詞</td><td class="jp-cell">～する者/～した者</td><td>fals→falsan (生き延びた者)</td></tr>
              <tr><td class="arka-cell">-ol</td><td>対格分詞</td><td class="jp-cell">～されるもの</td><td>klam→klamol (愛されるもの)</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">es(継続相の繋辞)は動詞の前に置かれ、自動詞化や結果状態を表します。例: es rig (壊れている), es ekx (流れている)</p>
        `
      },
      {
        title: '純詞 (文頭・文末)',
        content: `
          <p class="grammar-note">純詞は文頭または文末に置かれ、文全体のニュアンスを表します。</p>
          <table class="grammar-table">
            <thead><tr><th>純詞</th><th>位置</th><th>意味</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">tio</td><td>文頭</td><td class="jp-cell">単なる/ただ～だけ</td></tr>
              <tr><td class="arka-cell">ala</td><td>文頭</td><td class="jp-cell">一体(修辞疑問/非難)</td></tr>
              <tr><td class="arka-cell">taik</td><td>文頭</td><td class="jp-cell">更には/その上</td></tr>
              <tr><td class="arka-cell">tan</td><td>文中/文頭</td><td class="jp-cell">やはり</td></tr>
              <tr><td class="arka-cell">hot</td><td>文中</td><td class="jp-cell">～しか</td></tr>
              <tr><td class="arka-cell">tis</td><td>文中</td><td class="jp-cell">～すら/～さえ</td></tr>
              <tr><td class="arka-cell">sei</td><td>文末</td><td class="jp-cell">～だろうか(推量)</td></tr>
              <tr><td class="arka-cell">in</td><td>文末</td><td class="jp-cell">～のようだ(視覚推量)</td></tr>
              <tr><td class="arka-cell">xan</td><td>文末</td><td class="jp-cell">～だったのか(気付き)</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: 'モーダル副詞',
        content: `
          <table class="grammar-table">
            <thead><tr><th>副詞</th><th>日本語</th><th>位置</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">lax / lan</td><td class="jp-cell">～したい</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">ris / rin</td><td class="jp-cell">～したくない</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">sen</td><td class="jp-cell">～できる</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">vil</td><td class="jp-cell">～できない</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">fal</td><td class="jp-cell">～すべき</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">xaf</td><td class="jp-cell">～しなければならない</td><td>動詞の後</td></tr>
              <tr><td class="arka-cell">sil</td><td class="jp-cell">～する(未来)</td><td>動詞の前</td></tr>
              <tr><td class="arka-cell">van / fan</td><td class="jp-cell">～するつもり</td><td>動詞の後</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '命令・依頼',
        content: `
          <table class="grammar-table">
            <thead><tr><th>形式</th><th>日本語</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">re + 動詞</td><td class="jp-cell">～しろ</td><td>命令</td></tr>
              <tr><td class="arka-cell">den + 動詞</td><td class="jp-cell">～するな</td><td>禁止</td></tr>
              <tr><td class="arka-cell">mir + 動詞</td><td class="jp-cell">～してください</td><td>丁寧な依頼</td></tr>
              <tr><td class="arka-cell">fon + 動詞</td><td class="jp-cell">～しないでください</td><td>丁寧な禁止</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '受身・使役',
        content: `
          <table class="grammar-table">
            <thead><tr><th>形式</th><th>日本語</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">動詞 + yu</td><td class="jp-cell">～される (受身)</td><td>主語と目的語が入れ替わる</td></tr>
              <tr><td class="arka-cell">sols + 目的語 + 動詞</td><td class="jp-cell">～させる (使役)</td><td>使役構文</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '挨拶表現',
        content: `
          <table class="grammar-table">
            <thead><tr><th>アルカ語</th><th>日本語</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">soonoyun</td><td class="jp-cell">こんにちは/おはよう等</td><td>汎用挨拶</td></tr>
              <tr><td class="arka-cell">sentant</td><td class="jp-cell">ありがとう</td><td>相手が自発的にしてくれたことへ</td></tr>
              <tr><td class="arka-cell">seeretis</td><td class="jp-cell">ありがとう</td><td>依頼したことへ</td></tr>
              <tr><td class="arka-cell">vantant</td><td class="jp-cell">ごめんなさい</td><td>謝罪</td></tr>
              <tr><td class="arka-cell">passo</td><td class="jp-cell">大丈夫/いいよ</td><td>許容</td></tr>
              <tr><td class="arka-cell">ilpasso</td><td class="jp-cell">大丈夫/問題ない</td><td>強調</td></tr>
            </tbody>
          </table>
        `
      },
      // ===== 幻日独自ルール =====
      {
        title: '位相 (レジスター) 概要',
        content: `
          <p class="grammar-note">アルカ語には「位相 (レジスター)」と呼ばれる、話者の性別・年齢・性格に応じた話し方の体系があります。位相によって代名詞・文末純詞・副詞が異なります。</p>
          <table class="grammar-table">
            <thead><tr><th>位相名</th><th>読み</th><th>話者の特徴</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">seet</td><td class="jp-cell">セート</td><td>中立 (標準語)</td></tr>
              <tr><td class="arka-cell">milia</td><td class="jp-cell">ミリア</td><td>女性語（丁寧・柔らかい）</td></tr>
              <tr><td class="arka-cell">yuul</td><td class="jp-cell">ユール</td><td>男性語（粗い・力強い）</td></tr>
              <tr><td class="arka-cell">yunk</td><td class="jp-cell">ユンク</td><td>鳥籠姫位相（上品・控えめ）</td></tr>
              <tr><td class="arka-cell">mayu</td><td class="jp-cell">マユ</td><td>古語（ぞんざい・古風）</td></tr>
              <tr><td class="arka-cell">rente</td><td class="jp-cell">レンテ</td><td>幼児語（幼い話し方）</td></tr>
              <tr><td class="arka-cell">yunte</td><td class="jp-cell">ユンテ</td><td>甘え語</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">小説『紫苑の書』では登場人物ごとに異なる位相で話します。位相を見分けることで話者の人物像がわかります。</p>
        `
      },
      {
        title: '位相別 代名詞',
        content: `
          <p class="grammar-note">位相ごとに一人称・二人称が異なります。三人称 (lu/la) は全位相共通です。</p>
          <table class="grammar-table">
            <thead><tr><th>位相</th><th>一人称</th><th>一人称所有</th><th>二人称</th><th>二人称所有</th></tr></thead>
            <tbody>
              <tr><td>seet (中立)</td><td class="arka-cell">an</td><td class="arka-cell">ant</td><td class="arka-cell">ti</td><td class="arka-cell">tiil</td></tr>
              <tr><td>milia (女性)</td><td class="arka-cell">non</td><td class="arka-cell">noan</td><td class="arka-cell">tyu</td><td class="arka-cell">—</td></tr>
              <tr><td>yuul (男性)</td><td class="arka-cell">ami</td><td class="arka-cell">amit</td><td class="arka-cell">tol</td><td class="arka-cell">—</td></tr>
              <tr><td>yunk (鳥籠姫)</td><td class="arka-cell">yuna</td><td class="arka-cell">yunol</td><td class="arka-cell">moe</td><td class="arka-cell">moen</td></tr>
              <tr><td>mayu (古語)</td><td class="arka-cell">noel</td><td class="arka-cell">notte</td><td class="arka-cell">xian</td><td class="arka-cell">xiant</td></tr>
              <tr><td>rente (幼児)</td><td class="arka-cell">ansiel</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td></tr>
              <tr><td>yunte (甘え)</td><td class="arka-cell">lain</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td></tr>
            </tbody>
          </table>
          <table class="grammar-table" style="margin-top:var(--space-4)">
            <thead><tr><th>位相</th><th>一人称複数</th><th>所有</th><th>二人称複数</th><th>所有</th></tr></thead>
            <tbody>
              <tr><td>seet (中立)</td><td class="arka-cell">ans</td><td class="arka-cell">anso</td><td class="arka-cell">tiis</td><td class="arka-cell">tiiso</td></tr>
              <tr><td>yuul (男性)</td><td class="arka-cell">sean</td><td class="arka-cell">seant</td><td class="arka-cell">flent</td><td class="arka-cell">flandol</td></tr>
              <tr><td>yunk (鳥籠姫)</td><td class="arka-cell">kolet</td><td class="arka-cell">ekol</td><td class="arka-cell">felie</td><td class="arka-cell">felial</td></tr>
              <tr><td>mayu (古語)</td><td class="arka-cell">xenon</td><td class="arka-cell">xenoan</td><td class="arka-cell">telul</td><td class="arka-cell">telet</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '敬語接頭辞 (an- / mi-)',
        content: `
          <p class="grammar-note">アルカ語には日本語の敬語に相当する接頭辞があります。感動詞（挨拶）や文末純詞に付けて丁寧度を上げます。</p>
          <table class="grammar-table">
            <thead><tr><th>接頭辞</th><th>種別</th><th>適用対象</th><th>効果</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">an-</td><td>丁寧語</td><td>感動詞・文末純詞</td><td>「です・ます」レベルの丁寧化</td></tr>
              <tr><td class="arka-cell">mi-</td><td>敬語</td><td>名詞・感動詞</td><td>「お～」「御～」を付ける尊敬表現</td></tr>
            </tbody>
          </table>
          <p class="grammar-note" style="margin-top:var(--space-3)"><strong>an- の例:</strong></p>
          <table class="grammar-table">
            <thead><tr><th>基本形</th><th>丁寧形 (an-)</th><th>日本語</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">sentant</td><td class="arka-cell">ansentant</td><td class="jp-cell">ありがとう → ありがとうございます</td></tr>
              <tr><td class="arka-cell">soonoyun</td><td class="arka-cell">ansoonoyun</td><td class="jp-cell">やあ → こんにちは（丁寧）</td></tr>
              <tr><td class="arka-cell">vantant</td><td class="arka-cell">anvantant</td><td class="jp-cell">ごめん → 申し訳ございません</td></tr>
              <tr><td class="arka-cell">sete</td><td class="arka-cell">ansete</td><td class="jp-cell">～よね → ～ですよね</td></tr>
            </tbody>
          </table>
          <p class="grammar-note" style="margin-top:var(--space-3)"><strong>mi- の例:</strong></p>
          <table class="grammar-table">
            <thead><tr><th>基本形</th><th>敬語形 (mi-)</th><th>日本語</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">seere</td><td class="arka-cell">miseere</td><td class="jp-cell">感謝 → 御礼申し上げます</td></tr>
              <tr><td class="arka-cell">kekko</td><td class="arka-cell">mikekko</td><td class="jp-cell">ようこそ → いらっしゃいませ</td></tr>
              <tr><td class="arka-cell">solvat</td><td class="arka-cell">misolvat</td><td class="jp-cell">待たせた → お待たせ致しました</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">an- は主に感動詞と文末純詞に付きます。mi- は名詞にも付けて「お水 (miyuul)」のように使えます。</p>
        `
      },
      {
        title: '位相別 文末純詞',
        content: `
          <p class="grammar-note">文末純詞は位相ごとに異なる形を持ちます。同じ機能でも位相によって語形が変わります。</p>
          <table class="grammar-table">
            <thead><tr><th>機能</th><th>seet (中立)</th><th>milia (女性)</th><th>yuul (男性)</th><th>yunk (鳥籠姫)</th><th>mayu (古語)</th><th>rente (幼児)</th></tr></thead>
            <tbody>
              <tr><td>推量「～かな」</td><td class="arka-cell">sei</td><td class="arka-cell">eyo</td><td class="arka-cell">fixet</td><td class="arka-cell">—</td><td class="arka-cell">enxe</td><td class="arka-cell">—</td></tr>
              <tr><td>同意「～だよね」</td><td class="arka-cell">kok</td><td class="arka-cell">sete</td><td class="arka-cell">ranxel</td><td class="arka-cell">malia / axem</td><td class="arka-cell">sanna</td><td class="arka-cell">—</td></tr>
              <tr><td>情報「～なのだ」</td><td class="arka-cell">tisee</td><td class="arka-cell">tisse</td><td class="arka-cell">flenzel</td><td class="arka-cell">yuulia</td><td class="arka-cell">xiima</td><td class="arka-cell">—</td></tr>
              <tr><td>否定確認</td><td class="arka-cell">dec</td><td class="arka-cell">deeln</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">deel</td></tr>
              <tr><td>確認</td><td class="arka-cell">dac</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">au</td></tr>
              <tr><td>不満</td><td class="arka-cell">—</td><td class="arka-cell">puppu</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td></tr>
              <tr><td>詠嘆</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">—</td><td class="arka-cell">aan</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">yunte (甘え位相) 固有: nonno (返事促し「～だよね？」)</p>
          <p class="grammar-note">milia固有: tissen (tisse + 強調)「～なのよね」</p>
        `
      },
      {
        title: '位相特有のモーダル副詞',
        content: `
          <p class="grammar-note">いくつかのモーダル副詞は特定の位相でのみ使われます。</p>
          <table class="grammar-table">
            <thead><tr><th>副詞</th><th>意味</th><th>位相</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">dia</td><td class="jp-cell">～しよう (勧誘)</td><td>rente</td><td>幼児が使う「～しよう」</td></tr>
              <tr><td class="arka-cell">das</td><td class="jp-cell">～しよう (勧誘)</td><td>全般</td><td>仲間内の勧誘</td></tr>
              <tr><td class="arka-cell">myun</td><td class="jp-cell">～してほしい (弱依頼)</td><td>milia</td><td>女性語の柔らかい依頼</td></tr>
              <tr><td class="arka-cell">sant</td><td class="jp-cell">～してほしい (弱依頼)</td><td>全般</td><td>控えめな依頼</td></tr>
              <tr><td class="arka-cell">kit</td><td class="jp-cell">～し始める</td><td>全般</td><td>開始のアスペクト</td></tr>
              <tr><td class="arka-cell">terk</td><td class="jp-cell">～しに出掛ける</td><td>全般</td><td>移動目的</td></tr>
              <tr><td class="arka-cell">em</td><td class="jp-cell">～するようになる</td><td>全般</td><td>変化</td></tr>
              <tr><td class="arka-cell">ca</td><td class="jp-cell">～し始める</td><td>全般</td><td>変化の開始</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '幼児語 (rente位相) の特殊変化',
        content: `
          <p class="grammar-note">rente (幼児語) では一部の音が変化します。幼い発音を模したものです。</p>
          <table class="grammar-table">
            <thead><tr><th>標準形</th><th>rente形</th><th>意味</th><th>変化の説明</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">de (否定コピュラ)</td><td class="arka-cell">te</td><td class="jp-cell">～ではない</td><td>d→t (軟音化)</td></tr>
              <tr><td class="arka-cell">nan (何)</td><td class="arka-cell">nos</td><td class="jp-cell">何？</td><td>独自形</td></tr>
              <tr><td class="arka-cell">lein (なぜ)</td><td class="arka-cell">sab</td><td class="jp-cell">なぜ？</td><td>milia位相由来</td></tr>
              <tr><td class="arka-cell">onna (どこ)</td><td class="arka-cell">nanna</td><td class="jp-cell">どこ？</td><td>独自形</td></tr>
              <tr><td class="arka-cell">an (私)</td><td class="arka-cell">ansiel</td><td class="jp-cell">わたし/ぼく</td><td>人名由来の一人称</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">rente位相は小説で幼い子供キャラクターが使います。大人が使うと可愛さ演出になります。</p>
        `
      },
      {
        title: '形式主語 tu と文法語',
        content: `
          <p class="grammar-note">tuは指示詞「これ」のほか、形式主語 (英語のit) として使われます。天候や状況を表す非人称構文で頻出します。</p>
          <table class="grammar-table">
            <thead><tr><th>構文</th><th>アルカ語</th><th>日本語</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td>形式主語</td><td class="arka-cell">tu et …</td><td class="jp-cell">（それは）…である</td><td>状況や事実を述べる</td></tr>
              <tr><td>例</td><td class="arka-cell">tu et durne e 5 sel</td><td class="jp-cell">5日が経った</td><td>小説冒頭の文</td></tr>
            </tbody>
          </table>
          <p class="grammar-note" style="margin-top:var(--space-3)"><strong>重要な文法語:</strong></p>
          <table class="grammar-table">
            <thead><tr><th>語</th><th>品詞</th><th>意味</th><th>用法</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">sein</td><td>格詞</td><td class="jp-cell">複数</td><td>名詞の複数形を示す (sein mix = 多くの～)</td></tr>
              <tr><td class="arka-cell">sol</td><td>格詞</td><td class="jp-cell">主格標識</td><td>主語を明示する (sol an = 私が)</td></tr>
              <tr><td class="arka-cell">atu</td><td>副詞</td><td class="jp-cell">そこ/あそこ</td><td>場所の照応詞</td></tr>
              <tr><td class="arka-cell">xok</td><td>副詞</td><td class="jp-cell">そう/そのように</td><td>様態の照応詞</td></tr>
              <tr><td class="arka-cell">vei</td><td>副詞</td><td class="jp-cell">きっと/おそらく</td><td>推量副詞</td></tr>
              <tr><td class="arka-cell">tuo</td><td>副詞</td><td class="jp-cell">ここ/こっち</td><td>近称場所副詞</td></tr>
              <tr><td class="arka-cell">soan</td><td>副詞</td><td class="jp-cell">それ/そのこと</td><td>事柄の照応詞</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '接続詞と連結表現',
        content: `
          <p class="grammar-note">文と文を繋ぐ接続詞です。複数の文を連結する際に重要です。</p>
          <table class="grammar-table">
            <thead><tr><th>接続詞</th><th>日本語</th><th>用法</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">yan</td><td class="jp-cell">そして</td><td>順接・並列</td></tr>
              <tr><td class="arka-cell">ax</td><td class="jp-cell">しかし</td><td>逆接</td></tr>
              <tr><td class="arka-cell">son</td><td class="jp-cell">だから/それゆえ</td><td>因果 (原因→結果)</td></tr>
              <tr><td class="arka-cell">ku</td><td class="jp-cell">それで/すると</td><td>時間的・因果的接続</td></tr>
              <tr><td class="arka-cell">le</td><td class="jp-cell">（関係節）</td><td>関係詞 (英語のthat/which)</td></tr>
              <tr><td class="arka-cell">man</td><td class="jp-cell">もし/～なら</td><td>条件文の接続</td></tr>
              <tr><td class="arka-cell">ke</td><td class="jp-cell">そして/さらに</td><td>追加・列挙</td></tr>
              <tr><td class="arka-cell">ento</td><td class="jp-cell">つまり</td><td>説明・言い換え</td></tr>
              <tr><td class="arka-cell">na</td><td class="jp-cell">なぜなら</td><td>理由</td></tr>
            </tbody>
          </table>
        `
      },
      {
        title: '🔊 発音ルール (アルカ音韻)',
        content: `
          <p class="grammar-note">アルカ語にはラテン文字ベースのローマ字表記がありますが、英語とは異なる独自の発音規則があります。翻訳結果の横に表示されるカタカナ読みはこのルールに基づいています。</p>
          <table class="grammar-table">
            <thead><tr><th>表記</th><th>発音 (IPA)</th><th>日本語近似音</th><th>備考</th></tr></thead>
            <tbody>
              <tr><td class="arka-cell">x</td><td>[ʃ]</td><td class="jp-cell">シャ行 (シ・シャ・シュ・ショ)</td><td>英語 "sh" と同じ音。xion = シオン</td></tr>
              <tr><td class="arka-cell">c</td><td>[r] (ふるえ音)</td><td class="jp-cell">巻き舌ラ行</td><td>スペイン語の巻き舌 r に近い。日本語のラ行より強いふるえ</td></tr>
              <tr><td class="arka-cell">j</td><td>[ʒ]</td><td class="jp-cell">ジャ行 (ジ・ジャ・ジュ・ジョ)</td><td>英語 "pleasure" の zh 音</td></tr>
              <tr><td class="arka-cell">tx</td><td>[tʃ]</td><td class="jp-cell">チャ行 (チ・チャ・チュ・チョ)</td><td>英語 "church" の ch 音</td></tr>
              <tr><td class="arka-cell">ts</td><td>[ts]</td><td class="jp-cell">ツ行 (ツ・ツァ・ツィ)</td><td>日本語の「つ」とほぼ同じ</td></tr>
              <tr><td class="arka-cell">r</td><td>[ɹ]</td><td class="jp-cell">英語的ラ行</td><td>英語の r に近い。c (巻き舌) とは異なる</td></tr>
              <tr><td class="arka-cell">h</td><td>[h] / [ç] / [ɸ]</td><td class="jp-cell">ハ行</td><td>後続母音で変化: hi=[çi], hu=[ɸu]</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">例: <strong>xion</strong> →「ション」、<strong>cort</strong> →「ツォルト」(巻き舌)、<strong>txu</strong> →「チュ」、<strong>jent</strong> →「ジェント」</p>
          <p class="grammar-note">この翻訳システムでは、翻訳結果に自動的にカタカナ発音ガイドが表示されます。</p>
        `
      },
      {
        title: '🌿 南方方言 (ルティア語)',
        content: `
          <p class="grammar-note">ルティア語はアルカ語の南方方言で、アルシェやルティア地方で話されています。関西弁の入力を検出すると、自動的にルティア語風に変換します。</p>
          <table class="grammar-table">
            <thead><tr><th>変化規則</th><th>標準アルカ</th><th>ルティア語</th><th>解説</th></tr></thead>
            <tbody>
              <tr><td>子音前の c → l</td><td class="arka-cell">cort</td><td class="arka-cell">lort</td><td class="jp-cell">ふるえ音 c が子音の前で側音 l に変化</td></tr>
              <tr><td>語末の c → l</td><td class="arka-cell">dec</td><td class="arka-cell">del</td><td class="jp-cell">語末でも c → l</td></tr>
              <tr><td>語末 d → t</td><td class="arka-cell">meld</td><td class="arka-cell">melt</td><td class="jp-cell">語末の有声閉鎖音が無声化</td></tr>
              <tr><td>語末 b → p</td><td class="arka-cell">tab</td><td class="arka-cell">tap</td><td class="jp-cell">同上</td></tr>
              <tr><td>語末 g → k</td><td class="arka-cell">mog</td><td class="arka-cell">mok</td><td class="jp-cell">同上</td></tr>
            </tbody>
          </table>
          <p class="grammar-note"><strong>韻律的特徴:</strong> ルティア語は平坦なイントネーション・音節拍リズム・静かな声質が特徴です。標準アルカのモーラ拍と比べ、均等に音節を区切って発話します。</p>
          <p class="grammar-note"><strong>翻訳での利用:</strong> 関西弁が検出されると「🌿 関西弁検出 → 南方方言で出力」と表示され、翻訳結果がルティア語の音韻変化を反映します。</p>
        `
      },
      {
        title: '🧠 主語推定 (日本語→アルカ)',
        content: `
          <p class="grammar-note">日本語は主語を省略する言語ですが、アルカ語はSVO語順で主語が必要です。このシステムは文脈から主語を推定して自動補完します。</p>
          <table class="grammar-table">
            <thead><tr><th>日本語の文脈</th><th>推定主語</th><th>アルカ語</th><th>理由</th></tr></thead>
            <tbody>
              <tr><td class="jp-cell">命令形 (～しろ / ～して)</td><td>2人称</td><td class="arka-cell">ti (あなた)</td><td>命令は相手に向けられる</td></tr>
              <tr><td class="jp-cell">感情表現 (嬉しい / 悲しい)</td><td>1人称</td><td class="arka-cell">an (私)</td><td>感情は話者のもの</td></tr>
              <tr><td class="jp-cell">～たい (願望)</td><td>1人称</td><td class="arka-cell">an (私)</td><td>願望は話者のもの</td></tr>
              <tr><td class="jp-cell">～ましょう (勧誘)</td><td>1人称複数</td><td class="arka-cell">ans (私たち)</td><td>勧誘は「一緒に」の意</td></tr>
              <tr><td class="jp-cell">名詞文 (…は…だ)</td><td>主題から抽出</td><td class="arka-cell">—</td><td>「は」の前を主語に</td></tr>
              <tr><td class="jp-cell">それ以外</td><td>1人称</td><td class="arka-cell">an (私)</td><td>デフォルト（話者視点）</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">詩的モードでは、意図的な主語省略を尊重してアルカ語でも主語を補完しません。</p>
        `
      },
      {
        title: '✨ 詩的モード (短文・省略表現)',
        content: `
          <p class="grammar-note">短い文やポエム、歌詞、俳句などでは、主語省略が美的効果として意図的に使われます。このシステムは詩的テキストを自動検出し、主語補完を抑制します。</p>
          <p class="grammar-note"><strong>検出条件 (いずれか):</strong></p>
          <table class="grammar-table">
            <thead><tr><th>条件</th><th>詳細</th></tr></thead>
            <tbody>
              <tr><td>短文</td><td class="jp-cell">15文字以下の入力</td></tr>
              <tr><td>改行あり</td><td class="jp-cell">複数行にわたるテキスト (詩の各行)</td></tr>
              <tr><td>詩的パターン</td><td class="jp-cell">「…」「——」、体言止め、名詞のみの行など</td></tr>
            </tbody>
          </table>
          <p class="grammar-note"><strong>詩的モードの効果:</strong></p>
          <table class="grammar-table">
            <thead><tr><th>機能</th><th>通常モード</th><th>詩的モード</th></tr></thead>
            <tbody>
              <tr><td>主語補完</td><td class="jp-cell">自動で an/ti 等を補完</td><td class="jp-cell">補完しない（省略を維持）</td></tr>
              <tr><td>複数行</td><td class="jp-cell">一文として処理</td><td class="jp-cell">各行を独立して翻訳</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">詩的モードが有効な場合、「✨ 詩的モード: 主語省略を保持」と表示されます。</p>
        `
      },
      {
        title: '数詞体系',
        content: `
          <p class="grammar-note">アルカ語は10進法です。基数詞は名詞の後に置かれます。</p>
          <table class="grammar-table">
            <thead><tr><th>数</th><th>アルカ語</th><th>数</th><th>アルカ語</th></tr></thead>
            <tbody>
              <tr><td>0</td><td class="arka-cell">nol</td><td>6</td><td class="arka-cell">mel</td></tr>
              <tr><td>1</td><td class="arka-cell">an</td><td>7</td><td class="arka-cell">vil</td></tr>
              <tr><td>2</td><td class="arka-cell">al</td><td>8</td><td class="arka-cell">tol</td></tr>
              <tr><td>3</td><td class="arka-cell">ful</td><td>9</td><td class="arka-cell">nil</td></tr>
              <tr><td>4</td><td class="arka-cell">par</td><td>10</td><td class="arka-cell">ren</td></tr>
              <tr><td>5</td><td class="arka-cell">gal</td><td>100</td><td class="arka-cell">lan</td></tr>
            </tbody>
          </table>
          <p class="grammar-note">例: 15 = ren gal, 23 = al ren ful, 100 = lan</p>
          <p class="grammar-note">序数詞: 数詞 + -il (例: anil = 1番目)</p>
        `
      }
    ];
  }

  buildGrammarContent();

  // --- Utility ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
