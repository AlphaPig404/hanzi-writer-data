(function () {
  const STROKE_SIZE = 100;
  const STROKE_PADDING = 8;
  const STROKE_COLOR = '#4a7fd4';

  const charInput = document.getElementById('char-input');
  const analyzeBtn = document.getElementById('analyze-btn');
  const clearBtn = document.getElementById('clear-btn');
  const animateBtn = document.getElementById('animate-btn');
  const exportAllBtn = document.getElementById('export-all-btn');
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

  function createStrokeSvg(strokes, size, padding) {
    const transformData = HanziWriter.getScalingTransform(size, size, padding);
    const paths = strokes
      .map(function (d) {
        return (
          '<path d="' +
          d +
          '" fill="' +
          STROKE_COLOR +
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
      createMiziGe(size) +
      '<g transform="' +
      transformData.transform +
      '">' +
      paths +
      '</g>';
    return svg;
  }

  function renderStrokeItem(strokes, index, char) {
    const item = document.createElement('div');
    item.className = 'stroke-item';

    const box = document.createElement('div');
    box.className = 'stroke-box';
    const svg = createStrokeSvg(strokes, STROKE_SIZE, STROKE_PADDING);
    box.appendChild(svg);

    const label = document.createElement('div');
    label.className = 'stroke-label';
    label.textContent = '第 ' + (index + 1) + ' 笔';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'stroke-export';
    exportBtn.textContent = '导出图片';
    exportBtn.addEventListener('click', function () {
      exportSvgAsPng(svg, char + '_stroke_' + (index + 1) + '.png');
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
      strokeColor: STROKE_COLOR,
      showOutline: true,
      outlineColor: '#ccc',
      charDataLoader: charDataLoader,
    });
  }

  function exportSvgAsPng(svgElement, filename) {
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = function () {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = STROKE_SIZE * scale;
      canvas.height = STROKE_SIZE * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(function (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert('导出失败，请重试');
    };

    img.src = url;
  }

  async function analyzeCharacter() {
    const char = charInput.value.trim();
    if (!char) {
      showError('请输入一个汉字');
      return;
    }

    const chars = [...char];
    if (chars.length !== 1) {
      showError('请只输入一个汉字');
      return;
    }

    if (!/\p{Script=Han}/u.test(char)) {
      showError('请输入有效的汉字');
      return;
    }

    hideError();
    setLoading(true);
    result.classList.add('hidden');

    try {
      const charData = await loadCharacterData(char);
      currentChar = char;
      currentCharData = charData;

      strokeCount.textContent = charData.strokes.length;
      pinyinEl.textContent = getPinyin(char);

      renderMainChar(char);
      renderStrokesGrid(charData, char);

      result.classList.remove('hidden');
    } catch (err) {
      showError(err.message || '加载失败，该汉字可能不在字库中');
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    charInput.value = '';
    hideError();
    result.classList.add('hidden');
    strokesGrid.innerHTML = '';
    mainChar.innerHTML = '';
    writer = null;
    currentChar = '';
    currentCharData = null;
    charInput.focus();
  }

  function exportAllStrokes() {
    if (!currentCharData || !currentChar) return;

    const svgs = strokesGrid.querySelectorAll('.stroke-box svg');
    svgs.forEach(function (svg, i) {
      setTimeout(function () {
        exportSvgAsPng(svg, currentChar + '_stroke_' + (i + 1) + '.png');
      }, i * 300);
    });
  }

  analyzeBtn.addEventListener('click', analyzeCharacter);
  clearBtn.addEventListener('click', clearAll);
  exportAllBtn.addEventListener('click', exportAllStrokes);

  animateBtn.addEventListener('click', function () {
    if (writer) {
      writer.animateCharacter();
    }
  });

  charInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') analyzeCharacter();
  });

  charInput.addEventListener('input', function () {
    const val = charInput.value;
    const hanzi = [...val].filter(function (c) {
      return /\p{Script=Han}/u.test(c);
    });
    charInput.value = hanzi.slice(-1).join('');
  });

  charInput.value = '张';
  analyzeCharacter();
})();
