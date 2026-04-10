// ===== ARKA TRANSLATOR APP =====

(function () {
  'use strict';

  const engine = new ArkaEngine();
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

  // --- Translation Direction ---
  const swapBtn = document.getElementById('swap-direction');
  const sourceLang = document.getElementById('source-lang');
  const targetLang = document.getElementById('target-lang');
  const inputText = document.getElementById('input-text');
  const outputText = document.getElementById('output-text');

  swapBtn.addEventListener('click', () => {
    direction = direction === 'arka-to-jp' ? 'jp-to-arka' : 'arka-to-jp';
    sourceLang.textContent = direction === 'arka-to-jp' ? 'アルカ語' : '日本語';
    targetLang.textContent = direction === 'arka-to-jp' ? '日本語' : 'アルカ語';
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

    // Show translation
    if (sentenceMatchHtml) {
      outputText.innerHTML = sentenceMatchHtml + `<div class="gloss-translation"><span class="gloss-label">語釈:</span> ${escapeHtml(result.translation || '')}</div>`;
    } else {
      outputText.textContent = result.translation || '翻訳できませんでした';
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
