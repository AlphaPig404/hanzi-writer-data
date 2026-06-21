(function () {
  const STROKE_SIZE = 100;
  const STROKE_PADDING = 8;
  const EXPORT_SIZE = 550;
  const EXPORT_PADDING = 44;
  const STROKE_COLOR = '#000';
  const MAIN_CHAR_COLOR = '#fff';
  const HANZI_WRITER_SRC =
    'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
  const PINYIN_PRO_SRC =
    'https://cdn.jsdelivr.net/npm/pinyin-pro@3.26.0/dist/index.js';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = function () {
        reject(new Error('脚本加载失败: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function ensureLibs() {
    return loadScript(HANZI_WRITER_SRC).then(function () {
      return loadScript(PINYIN_PRO_SRC);
    });
  }

  function init() {
  const charInput = document.getElementById('char-input');
  if (!charInput) return;

  const analyzeBtn = document.getElementById('analyze-btn');
  const clearBtn = document.getElementById('clear-btn');
  const animateBtn = document.getElementById('animate-btn');
  const exportAllBtn = document.getElementById('export-all-btn');
  const exportCharBtn = document.getElementById('export-char-btn');
  const levelResult = document.getElementById('level-result');
  const levelTitle = document.getElementById('level-title');
  const levelJson = document.getElementById('level-json');
  const copyLevelBtn = document.getElementById('copy-level-btn');
  const errorMsg = document.getElementById('error-msg');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const mainChar = document.getElementById('main-char');
  const strokeCount = document.getElementById('stroke-count');
  const pinyinEl = document.getElementById('pinyin');
  const strokesGrid = document.getElementById('strokes-grid');

  let writer = null;
  let currentChar = '';
  let currentCharData = null;
  let levelsConfig = null;

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
  }

  function hideError() {
    errorMsg.classList.add('hidden');
  }

  function setLoading(isLoading) {
    loading.classList.toggle('hidden', !isLoading);
    analyzeBtn.disabled = isLoading;
  }

  function charDataLoader(char, onComplete, onError) {
    fetch('data/' + encodeURIComponent(char) + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('未找到该汉字的数据');
        return res.json();
      })
      .then(onComplete)
      .catch(onError);
  }

  function loadCharacterData(char) {
    return new Promise(function (resolve, reject) {
      charDataLoader(char, resolve, reject);
    });
  }

  function getPinyin(char) {
    try {
      if (typeof pinyinPro !== 'undefined') {
        return pinyinPro.pinyin(char, { toneType: 'none' });
      }
    } catch (e) {
      /* ignore */
    }
    return '—';
  }

  function createMiziGe(size) {
    const half = size / 2;
    const lines = [
      { x1: 0, y1: half, x2: size, y2: half },
      { x1: half, y1: 0, x2: half, y2: size },
      { x1: 0, y1: 0, x2: size, y2: size },
      { x1: size, y1: 0, x2: 0, y2: size },
    ];
    return lines
      .map(function (l) {
        return (
          '<line x1="' +
          l.x1 +
          '" y1="' +
          l.y1 +
          '" x2="' +
          l.x2 +
          '" y2="' +
          l.y2 +
          '" stroke="#ddd" stroke-width="0.5" stroke-dasharray="3,3"/>'
        );
      })
      .join('');
  }

  function createStrokeSvg(strokes, size, padding, color, showMiziGe) {
    color = color || STROKE_COLOR;
    const transformData = HanziWriter.getScalingTransform(size, size, padding);
    const paths = strokes
      .map(function (d) {
        return (
          '<path d="' +
          d +
          '" fill="' +
          color +
          '" stroke="none"/>'
        );
      })
      .join('');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.innerHTML =
      (showMiziGe ? createMiziGe(size) : '') +
      '<g transform="' +
      transformData.transform +
      '">' +
      paths +
      '</g>';
    return svg;
  }

  function exportStrokesAsPng(strokes, filename, color) {
    const svg = createStrokeSvg(
      strokes,
      EXPORT_SIZE,
      EXPORT_PADDING,
      color,
      false
    );
    exportSvgAsPng(svg, filename, EXPORT_SIZE);
  }

  function renderStrokeItem(strokes, index, char) {
    const item = document.createElement('div');
    item.className = 'stroke-item';

    const box = document.createElement('div');
    box.className = 'stroke-box';
    const svg = createStrokeSvg(strokes, STROKE_SIZE, STROKE_PADDING, STROKE_COLOR, true);
    box.appendChild(svg);

    const label = document.createElement('div');
    label.className = 'stroke-label';
    label.textContent = '第 ' + (index + 1) + ' 笔';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'stroke-export';
    exportBtn.textContent = '导出图片';
    exportBtn.addEventListener('click', function () {
      exportStrokesAsPng(strokes, char + '_stroke_' + (index + 1) + '.png', STROKE_COLOR);
    });

    item.appendChild(box);
    item.appendChild(label);
    item.appendChild(exportBtn);
    return item;
  }

  function renderStrokesGrid(charData, char) {
    strokesGrid.innerHTML = '';
    for (let i = 0; i < charData.strokes.length; i++) {
      strokesGrid.appendChild(
        renderStrokeItem([charData.strokes[i]], i, char)
      );
    }
  }

  function renderMainChar(char) {
    mainChar.innerHTML = '';
    writer = HanziWriter.create(mainChar, char, {
      width: 150,
      height: 150,
      padding: 10,
      strokeColor: MAIN_CHAR_COLOR,
      showOutline: true,
      outlineColor: '#fff',
      charDataLoader: charDataLoader,
    });
  }

  function exportSvgAsPng(svgElement, filename, size) {
    size = size || EXPORT_SIZE;
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.querySelectorAll('line').forEach(function (line) {
      line.remove();
    });

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      canvas.toBlob(function (blob) {
        if (!blob) {
          alert('导出失败，请重试');
          return;
        }
        downloadBlob(blob, filename);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert('导出失败，请重试');
    };

    img.src = url;
  }

  function loadLevelsConfig() {
    if (levelsConfig) {
      return Promise.resolve(levelsConfig);
    }
    return fetch('levels_compact.json')
      .then(function (res) {
        if (!res.ok) throw new Error('无法加载关卡配置');
        return res.json();
      })
      .then(function (data) {
        levelsConfig = data;
        return data;
      });
  }

  function hideLevelResult() {
    levelResult.classList.add('hidden');
    levelJson.textContent = '';
  }

  function getLevelChar(levelData) {
    if (!levelData || !levelData.levelName) return null;
    const parts = levelData.levelName.split('|');
    const char = parts[parts.length - 1].trim();
    return char && /\p{Script=Han}/u.test(char) ? char : null;
  }

  function showLevelResult(levelNum, levelData) {
    levelTitle.textContent = '第 ' + levelNum + ' 关 · ' + (levelData.levelName || '');
    levelJson.textContent = JSON.stringify(levelData, null, 2);
    levelResult.classList.remove('hidden');
  }

  function copyLevelJson() {
    const text = levelJson.textContent;
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        copyLevelBtn.textContent = '已复制';
        setTimeout(function () {
          copyLevelBtn.textContent = '复制 JSON';
        }, 1500);
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      copyLevelBtn.textContent = '已复制';
      setTimeout(function () {
        copyLevelBtn.textContent = '复制 JSON';
      }, 1500);
    } catch (e) {
      alert('复制失败，请手动选择 JSON 内容复制');
    }
    document.body.removeChild(ta);
  }

  function validateInput() {
    const value = charInput.value.trim();

    if (!value) {
      return { ok: false, message: '请输入汉字或关卡号' };
    }

    if (/^\d+$/.test(value)) {
      const levelNum = parseInt(value, 10);
      if (levelNum < 1) {
        return { ok: false, message: '关卡号须大于 0' };
      }
      return { ok: true, type: 'level', levelNum: levelNum };
    }

    const chars = [...value];
    if (chars.length !== 1) {
      return { ok: false, message: '请只输入一个汉字，或输入关卡号' };
    }

    if (!/\p{Script=Han}/u.test(value)) {
      return { ok: false, message: '请输入有效的汉字或关卡号' };
    }

    return { ok: true, type: 'char', char: value };
  }

  async function showLevel(levelNum) {
    const config = await loadLevelsConfig();
    const total = config.meta && config.meta.totalLevels
      ? config.meta.totalLevels
      : config.levels.length;

    if (levelNum > total) {
      throw new Error('关卡号超出范围（1–' + total + '）');
    }

    const levelData = config.levels[levelNum - 1];
    if (!levelData) {
      throw new Error('未找到第 ' + levelNum + ' 关');
    }

    showLevelResult(levelNum, levelData);

    const char = getLevelChar(levelData);
    if (!char) {
      throw new Error('无法从关卡配置中解析汉字');
    }

    await displayChar(char);
  }

  async function displayChar(char) {
    await ensureLibs();
    const charData = await loadCharacterData(char);
    currentChar = char;
    currentCharData = charData;

    strokeCount.textContent = charData.strokes.length;
    pinyinEl.textContent = getPinyin(char);

    renderMainChar(char);
    renderStrokesGrid(charData, char);

    result.classList.remove('hidden');
  }

  async function analyzeChar(char) {
    hideLevelResult();
    await displayChar(char);
  }

  async function handleSubmit() {
    const validation = validateInput();
    if (!validation.ok) {
      showError(validation.message);
      return;
    }

    hideError();
    setLoading(true);
    result.classList.add('hidden');
    hideLevelResult();

    try {
      if (validation.type === 'level') {
        await showLevel(validation.levelNum);
      } else {
        await analyzeChar(validation.char);
      }
    } catch (err) {
      showError(err.message || '查询失败');
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    charInput.value = '';
    hideError();
    result.classList.add('hidden');
    hideLevelResult();
    strokesGrid.innerHTML = '';
    mainChar.innerHTML = '';
    writer = null;
    currentChar = '';
    currentCharData = null;
    charInput.focus();
  }

  function exportMainChar() {
    if (!currentCharData || !currentChar) return;

    exportStrokesAsPng(
      currentCharData.strokes,
      currentChar + '.png',
      MAIN_CHAR_COLOR
    );
  }

  function exportAllStrokes() {
    if (!currentCharData || !currentChar) return;

    currentCharData.strokes.forEach(function (stroke, i) {
      setTimeout(function () {
        exportStrokesAsPng(
          [stroke],
          currentChar + '_stroke_' + (i + 1) + '.png',
          STROKE_COLOR
        );
      }, i * 300);
    });
  }

  analyzeBtn.addEventListener('click', handleSubmit);
  clearBtn.addEventListener('click', clearAll);
  exportAllBtn.addEventListener('click', exportAllStrokes);
  exportCharBtn.addEventListener('click', exportMainChar);
  copyLevelBtn.addEventListener('click', copyLevelJson);

  animateBtn.addEventListener('click', function () {
    if (writer) {
      writer.animateCharacter();
    }
  });

  charInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  });

  charInput.focus();
  }
})();
