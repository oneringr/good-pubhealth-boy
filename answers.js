(() => {
  const widgetId = 'good-pubhealth-boy-answer-widget';
  const coursePath = /^\/mengoo\/CourseLearning\/?$/i;
  if (document.getElementById(widgetId)) return;

  // These labels are outlines in the course animation, so they cannot be read as DOM text.
  const optionCatalog = {
    '/mzl/GWA10366021kh/': [
      ['对照组', '低剂量组', '中剂量组', '高剂量组'],
      [
        '有LD50的受试物，根据LD50值和剂量-反应关系曲线斜率设计高剂量组的剂量。',
        '如果28天或90天经口毒性试验未观察到有害作用，以最大未观察到有害作用剂量作为高剂量。',
        '如果28天或90天经口毒性试验观察到有害作用，以最小观察到有害剂量作用的剂量为高剂量组。',
      ],
      [
        '不溶于水的受试物可使用橄榄油或玉米油等植物油。',
        '不溶于水也不溶于油的受试物可使用羧甲基纤维素、淀粉等配成混悬液或糊状物。',
        '首选溶媒为玉米油。',
        '配制好的受试物可长期存放在4度。',
      ],
      [
        '受试物给予的时间通常在器官形成期。',
        '每日给药时间不用一致。',
        '灌胃体积一般要超过10mg/kg体重。',
        '如果给予受试物为油性溶液，最大灌胃体积可达到20ml/kg。',
      ],
      [
        '皮肤、被毛、眼睛、黏膜、呼吸、神经行为、四肢活动。',
        '中毒体征，包括发生时间、表现程度和持续时间。',
        '是否虚弱或濒临死亡。',
        '是否有流产或早产征兆。',
      ],
    ],
  };

  let currentCourseId = null;
  let cachedAnswers = null;
  let loadingAnswers = null;
  let submissionInfo = null;
  let loadingSubmissionInfo = null;
  let pendingSubmission = null;
  let visibilityQueued = false;

  const host = document.createElement('div');
  host.id = widgetId;
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;display:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { font: 14px/1.5 system-ui, sans-serif; color: #1f2937; }
      * { box-sizing: border-box; }
      button { font: inherit; cursor: pointer; }
      #actions { display: flex; align-items: center; gap: 10px; }
      #trigger, #submit-trigger {
        display: grid; place-items: center; width: 54px; height: 54px;
        border: 0; border-radius: 16px; color: #fff;
        box-shadow: 0 5px 18px #0f172a40;
      }
      #trigger { background: #2563eb; }
      #trigger:hover { background: #1d4ed8; }
      #submit-trigger, #submit-button { background: #dc2626; }
      #submit-trigger:hover, #submit-button:hover { background: #b91c1c; }
      #trigger:focus-visible, #submit-trigger:focus-visible, #close:focus-visible, #submit-close:focus-visible, #submit-button:focus-visible {
        outline: 3px solid #f59e0b; outline-offset: 3px;
      }
      #panel {
        position: fixed; right: 20px; bottom: 86px;
        width: min(400px, calc(100vw - 32px)); max-height: min(70vh, 620px);
        overflow: hidden; border: 1px solid #dbe2ea;
        border-radius: 16px; background: #fff;
        box-shadow: 0 12px 35px #0f172a40;
      }
      #panel[hidden] { display: none; }
      header { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid #e2e8f0; cursor: move; touch-action: none; user-select: none; }
      h2 { flex: 1; margin: 0; font-size: 17px; line-height: 1.4; }
      #close, #submit-close { flex: none; width: 28px; height: 28px; border: 0; border-radius: 6px; background: #f1f5f9; color: #334155; font-size: 20px; line-height: 1; }
      #content { max-height: calc(min(70vh, 620px) - 62px); padding: 12px 18px 18px; overflow-y: auto; }
      #course-title { margin: 0 0 6px; font-weight: 600; }
      #summary, #note { margin: 0 0 12px; color: #64748b; font-size: 12px; }
      #status { margin: 0; color: #475569; }
      #status.error { color: #b91c1c; }
      ol { margin: 0; padding-left: 22px; }
      li { padding: 8px 0; border-bottom: 1px solid #eef2f7; }
      li:last-child { border-bottom: 0; }
      .question { display: block; font-weight: 600; }
      .answer { display: block; margin-top: 4px; color: #1d4ed8; }
      .unknown { color: #64748b; }
      .options { margin-top: 8px; }
      .option { margin-top: 4px; padding: 5px 8px; border-radius: 7px; background: #f8fafc; color: #475569; font-size: 12px; }
      .option.correct { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
      #submit-overlay { position: fixed; inset: 0; display: grid; place-items: safe center; padding: 16px; overflow-y: auto; background: #0f172a66; }
      #submit-overlay[hidden] { display: none; }
      #submit-dialog { width: min(380px, 100%); max-height: calc(100vh - 32px); border-radius: 16px; background: #fff; box-shadow: 0 18px 55px #0f172a55; overflow-y: auto; }
      #submit-dialog header { cursor: default; }
      #submit-dialog form { display: grid; gap: 8px; padding: 18px; }
      #submit-dialog label { font-weight: 600; }
      #submit-dialog input:not([type="checkbox"]), #submit-dialog select { width: 100%; min-height: 40px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1f2937; font: inherit; }
      #submit-dialog input[type="checkbox"] { width: 16px; height: 16px; margin: 0 5px 0 0; vertical-align: -2px; accent-color: #dc2626; }
      .submit-section { display: grid; gap: 8px; padding: 10px 0; border-top: 1px solid #e2e8f0; }
      .submit-section[hidden] { display: none; }
      .submit-section small, #submit-progress-unavailable { color: #64748b; font-size: 12px; }
      .submit-section input:disabled, .submit-section select:disabled { background: #f1f5f9 !important; }
      #submit-course { margin: 0 0 5px; color: #475569; }
      #submit-title-row { display: grid; gap: 8px; }
      #submit-title-row[hidden] { display: none; }
      #submit-progress-unavailable[hidden] { display: none; }
      #submit-status { min-height: 21px; margin: 3px 0; color: #475569; }
      #submit-status.error { color: #b91c1c; }
      #submit-button { min-height: 42px; border: 0; border-radius: 8px; color: #fff; font-weight: 600; }
      #submit-button:disabled { opacity: .55; cursor: wait; }
    </style>
    <section id="panel" role="region" aria-label="当前课程答案" hidden>
      <header><h2>当前课程答案</h2><button id="close" type="button" aria-label="关闭答案面板">×</button></header>
      <div id="content">
        <p id="course-title"></p>
        <p id="summary"></p>
        <p id="note"></p>
        <p id="status" role="status" aria-live="polite"></p>
        <ol id="answer-list"></ol>
      </div>
    </section>
    <div id="submit-overlay" hidden>
      <section id="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-heading">
        <header><h2 id="submit-heading">直接提交</h2><button id="submit-close" type="button" aria-label="关闭提交窗口">×</button></header>
        <form id="submit-form">
          <p id="submit-course">正在读取当前实验…</p>
          <div id="submit-score-section" class="submit-section" hidden>
            <label><input id="submit-score-enabled" type="checkbox" checked /> <span id="submit-score-label">提交成绩和用时</span></label>
            <div id="submit-title-row" hidden><label for="submit-title">实验项目</label><select id="submit-title"></select></div>
            <label for="submit-score">成绩（0–100）</label>
            <input id="submit-score" type="number" min="0" max="100" step="1" />
            <label for="submit-minutes">用时（分钟）</label>
            <input id="submit-minutes" type="number" min="0.1" max="1440" step="0.1" />
            <small id="submit-score-progress-note" hidden>课件的成绩请求同时上报“完成”状态。实测同类课件的课程介绍页会显示 100%；请以平台记录为准。</small>
          </div>
          <div id="submit-progress-section" class="submit-section" hidden>
            <label><input id="submit-progress-enabled" type="checkbox" checked /> 提交课件进度</label>
            <label for="submit-progress">进度（0–100%）</label>
            <input id="submit-progress" type="number" min="0" max="100" step="1" />
            <small>课件进度保存后，页面的“学习进度”可能不会同步变化。</small>
          </div>
          <p id="submit-progress-unavailable" hidden>当前课件未提供进度提交接口。</p>
          <p id="submit-status" role="status" aria-live="polite"></p>
          <button id="submit-button" type="submit" disabled>提交所选数据</button>
        </form>
      </section>
    </div>
    <div id="actions"><button id="submit-trigger" type="button" title="直接提交" aria-label="直接提交" aria-haspopup="dialog">
      <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20V4M5 11l7-7 7 7"></path>
      </svg>
    </button><button id="trigger" type="button" title="查看当前课程答案" aria-label="查看当前课程答案" aria-expanded="false" aria-controls="panel">
      <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path>
      </svg>
    </button></div>`;
  document.body.appendChild(host);

  const trigger = shadow.querySelector('#trigger');
  const panel = shadow.querySelector('#panel');
  const status = shadow.querySelector('#status');
  const answerList = shadow.querySelector('#answer-list');
  const submitOverlay = shadow.querySelector('#submit-overlay');
  const submitForm = shadow.querySelector('#submit-form');
  const submitButton = shadow.querySelector('#submit-button');
  const submitStatus = shadow.querySelector('#submit-status');
  const dragHandle = shadow.querySelector('header');
  let drag = null;

  function clampPanelPosition() {
    if (!panel.style.left) return;
    const bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(0, Math.min(bounds.left, window.innerWidth - bounds.width))}px`;
    panel.style.top = `${Math.max(0, Math.min(bounds.top, window.innerHeight - bounds.height))}px`;
  }

  dragHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('#close')) return;
    const bounds = panel.getBoundingClientRect();
    drag = { id: event.pointerId, offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    panel.style.left = `${bounds.left}px`;
    panel.style.top = `${bounds.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    dragHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  dragHandle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    panel.style.left = `${Math.max(0, Math.min(event.clientX - drag.offsetX, window.innerWidth - width))}px`;
    panel.style.top = `${Math.max(0, Math.min(event.clientY - drag.offsetY, window.innerHeight - height))}px`;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    dragHandle.addEventListener(type, () => { drag = null; });
  }
  window.addEventListener('resize', clampPanelPosition);

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (cachedAnswers) sendChoiceMarks(cachedAnswers, false);
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function showSubmitStatus(message, isError = false) {
    submitStatus.textContent = message;
    submitStatus.classList.toggle('error', isError);
  }

  function closeSubmitDialog(restoreFocus = false) {
    const wasOpen = !submitOverlay.hidden;
    submitOverlay.hidden = true;
    if (restoreFocus && wasOpen) shadow.querySelector('#submit-trigger').focus();
  }

  function syncVisibility() {
    const onCourse = coursePath.test(location.pathname);
    host.style.display = onCourse ? 'block' : 'none';
    if (!onCourse) {
      currentCourseId = null;
      closePanel();
      closeSubmitDialog();
      return;
    }
    const courseId = new URLSearchParams(location.search).get('id');
    if (courseId !== currentCourseId) {
      closePanel();
      closeSubmitDialog();
      currentCourseId = courseId;
      cachedAnswers = null;
      loadingAnswers = null;
      submissionInfo = null;
      loadingSubmissionInfo = null;
      if (pendingSubmission) clearTimeout(pendingSubmission.timeout);
      pendingSubmission = null;
    }
  }

  function queueVisibilityCheck() {
    if (visibilityQueued) return;
    visibilityQueued = true;
    setTimeout(() => {
      visibilityQueued = false;
      syncVisibility();
    }, 100);
  }

  function getPackageUrl() {
    const player = document.querySelector('iframe[src*="/scormplayer/connect.html"]');
    if (!player?.src) return null;
    const encoded = new URL(player.src).searchParams.get('eurl');
    if (!encoded) return null;
    try {
      const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      const url = new URL(decoded);
      return url.origin === location.origin ? url : null;
    } catch {
      return null;
    }
  }

  function courseFrameWindow() {
    try {
      const player = document.querySelector('iframe[src*="/scormplayer/connect.html"]');
      return player?.contentWindow?.document.getElementById('myFrame')?.contentWindow || null;
    } catch {
      return null;
    }
  }

  function sendChoiceMarks(data, enabled, target = courseFrameWindow()) {
    target?.postMessage({
      source: 'good-pubhealth-boy',
      type: 'setChoiceMarks',
      packagePath: data.packagePath,
      selections: data.selections,
      groupOffsets: data.groupOffsets,
      enabled,
    }, location.origin);
  }

  async function waitForPackageUrl() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const url = getPackageUrl();
      if (url) return url;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('当前页面尚未加载 H5 课程，请稍后重试。');
  }

  async function fetchText(url) {
    const response = await fetch(url.href, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`读取课程文件失败（HTTP ${response.status}）。`);
    return response.text();
  }

  async function readSubmissionInfo() {
    const indexUrl = await waitForPackageUrl();
    const baseUrl = new URL('.', indexUrl);
    const indexHtml = new DOMParser().parseFromString(await fetchText(indexUrl), 'text/html');
    const courseTitle = indexHtml.querySelector('title')?.textContent.trim() || '当前课程';
    const scripts = [...indexHtml.querySelectorAll('script[src]')]
      .map((script) => new URL(script.getAttribute('src'), indexUrl))
      .filter((url) => url.origin === location.origin && url.pathname.startsWith(baseUrl.pathname) &&
        /\.js$/i.test(url.pathname));
    const courseScripts = scripts.filter((url) => !/\/(?:createjs|jquery|MengooCx)[^/]*\.js$/i.test(url.pathname));
    const scoreHelpers = scripts.filter((url) => /\/MengooCx[^/]*\.js$/i.test(url.pathname));
    const [sources, helpers] = await Promise.all([
      Promise.all(courseScripts.map(fetchText)),
      Promise.all(scoreHelpers.map(fetchText)),
    ]);
    const titles = [];
    for (const source of sources) {
      for (const match of source.matchAll(/\bScoreUpload\s*\(\s*(["'])([^"']+)\1\s*,/g)) {
        const title = match[2].trim();
        if (title && !titles.includes(title)) titles.push(title);
      }
    }
    const supportsProgress = sources.some((source) => source.includes('/api/open/ProcessUpload'));
    const scoreCompletesProgress = Boolean(titles.length && helpers.some((source) =>
      /\bfunction\s+ScoreUpload\s*\([^)]*\)\s*\{[\s\S]{0,350}\b(?:var|let|const)\s+status\s*=\s*["']1["']/.test(source)));
    if (!titles.length && !supportsProgress) throw new Error('当前课程没有可用的提交接口。');
    return { courseTitle, titles, supportsProgress, scoreCompletesProgress, packagePath: baseUrl.pathname };
  }

  function parseQuestions(source) {
    const groups = new Map();
    for (const match of source.matchAll(/\b(?:var|let|const)\s+tigan(\d*)\s*=\s*(\[[\s\S]*?\])\s*;/g)) {
      const rows = JSON.parse(match[2]);
      if (!Array.isArray(rows)) throw new Error('课程题干格式无法识别。');
      groups.set(match[1] || '1', rows.map((row) => String(row[0] || '未命名题目')));
    }
    if (!groups.size) throw new Error('当前课程没有可识别的题干文件。');
    return groups;
  }

  function parseInputChecks(frame) {
    const checks = [...frame.matchAll(/\b([A-Za-z_$][\w$]*)\.value\s*(>=|<=|===|==)\s*(["'])([^"']+)\3/g)];
    if (!checks.length) return null;
    const fields = new Map();
    for (const [, fieldName, operator, , value] of checks) {
      if (!fields.has(fieldName)) fields.set(fieldName, {});
      const field = fields.get(fieldName);
      if (operator === '>=') field.min = value;
      if (operator === '<=') field.max = value;
      if (operator === '==' || operator === '===') field.exact = value;
    }
    const ordered = [...fields.entries()].sort((a, b) => {
      const aNumber = Number(a[0].match(/\d+$/)?.[0] || 0);
      const bNumber = Number(b[0].match(/\d+$/)?.[0] || 0);
      return aNumber - bNumber;
    });
    const parts = ordered.map(([, field], index) => {
      let value = field.exact;
      if (!value && field.min && field.max) value = `${field.min}～${field.max}`;
      if (!value) value = field.min ? `不少于 ${field.min}` : `不多于 ${field.max}`;
      return `第 ${index + 1} 空：${value}`;
    });
    return parts.length ? `填写：${parts.join('；')}` : null;
  }

  function matchingDelimiter(source, start, open, close) {
    let depth = 0;
    let quote = null;
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (char === '\\') i++;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if (char === open) {
        depth++;
      } else if (char === close && --depth === 0) {
        return i;
      }
    }
    return -1;
  }

  function enclosingConditions(frame, position) {
    const conditions = [];
    for (const match of frame.matchAll(/\bif\s*\(/g)) {
      if (match.index > position) break;
      const open = frame.indexOf('(', match.index);
      const end = matchingDelimiter(frame, open, '(', ')');
      if (end < 0) continue;
      const bodyStart = frame.indexOf('{', end + 1);
      if (bodyStart < 0 || frame.slice(end + 1, bodyStart).trim()) continue;
      const bodyEnd = matchingDelimiter(frame, bodyStart, '{', '}');
      if (bodyStart < position && position < bodyEnd) {
        conditions.push(frame.slice(open + 1, end));
      }
    }
    return conditions;
  }

  function answerFromCondition(conditions, question) {
    const condition = conditions.at(-1) || '';
    const choices = [...condition.matchAll(/\b([A-Za-z_$][\w$]*)\.currentFrame\s*==\s*([01])/g)];
    if (choices.length) {
      const selected = choices.filter((match) => match[2] === '1')
        .map((match) => Number(match[1].match(/\d+$/)?.[0]))
        .filter(Number.isFinite);
      if (selected.length) return `正确选项：第 ${selected.join('、')} 项`;
    }
    const number = condition.match(/\b(?:now_num|num)\s*==\s*(\d+)/);
    if (number) return `正确选项：第 ${number[1]} 项`;
    const input = condition.match(/\b[A-Za-z_$][\w$]*\.value\s*==?=?\s*["']?([\d.]+%?)/);
    if (input) return `填写：${input[1]}`;
    const count = condition.match(/\bnumcs\s*==\s*(\d+)/);
    if (count) return `设置数量：${count[1]}`;
    const item = condition.match(/\bpdtznume\s*==\s*(\d+)/);
    if (item && conditions.some((value) => /\b(?:nowdown\s*==\s*pdtznume|pdtznume\s*==\s*nowdown)\b/.test(value))) {
      if (/试剂的选择|模板是/.test(question)) {
        const reagent = question.split(/[－—]/).at(-1).trim();
        return `选择并放入对应位置：第 ${item[1]} 项（${reagent}）`;
      }
      return `正确选项：第 ${item[1]} 项（拖入 EP 管）`;
    }
    return null;
  }

  function parseScoredInputs(frame) {
    const values = new Map();
    for (const match of frame.matchAll(/\bif\s*\(\s*s_zhi(\d+)\s*==\s*([\d.]+)\s*\)\s*\{\s*tk_fz\[\1\]\s*=\s*[1-9]\d*/g)) {
      values.set(Number(match[1]), match[2]);
    }
    if (!values.size) return null;
    return `填写：${[...values].sort((a, b) => a[0] - b[0])
      .map(([index, value]) => `第 ${index + 1} 空 ${value}`).join('；')}`;
  }

  function parseAnswerScripts(sources, groups) {
    const answers = new Map();
    const offsets = new Map();
    let offset = 0;
    for (const [group, questions] of groups) {
      offsets.set(group, offset);
      offset += questions.length;
    }
    for (const { url, source } of sources) {
      const part = url.pathname.match(/\/part(\d+)\.js$/i);
      const group = groups.size === 1 ? '1' : part?.[1] || '1';
      const questions = groups.get(group);
      if (!questions) continue;
      const base = offsets.get(group);
      const frames = [...source.matchAll(/\bthis\.frame_\d+\s*=\s*function\s*\(\)\s*\{/g)];
      for (let i = 0; i < frames.length; i++) {
        const frame = source.slice(frames[i].index, frames[i + 1]?.index ?? source.length)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '');
        const number = frame.match(/\bcurrent_jfnum\s*=\s*(\d+)/);
        if (number) {
          const localIndex = Number(number[1]);
          const choice = frame.match(/\bright_arr\s*=\s*(\[[\d,\s]+\])/);
          if (choice && localIndex < questions.length) {
            const selected = JSON.parse(choice[1]).flatMap((value, index) => value === 1 ? [index + 1] : []);
            if (selected.length) answers.set(base + localIndex, `正确选项：第 ${selected.join('、')} 项`);
          } else if (localIndex < questions.length) {
            const inputAnswer = parseInputChecks(frame);
            if (inputAnswer) answers.set(base + localIndex, inputAnswer);
          }
        }
        for (const match of frame.matchAll(/\b(jfarr|jf_num)\[(\d+)\]\s*=\s*([1-9]\d*)\s*;?/g)) {
          const localIndex = Number(match[2]) - (match[1] === 'jfarr' ? 1 : 0);
          if (localIndex < 0 || localIndex >= questions.length) continue;
          const conditions = enclosingConditions(frame, match.index);
          let answer = answerFromCondition(conditions, questions[localIndex]);
          if (!answer && !conditions.length && /完成实验|完成操作/.test(questions[localIndex])) {
            answer = '完成该步骤后自动计分';
          }
          if (answer) answers.set(base + localIndex, answer);
        }
        if (questions.length === 6 && /\btk_fz\[/.test(frame)) {
          const inputs = parseScoredInputs(frame);
          if (inputs) answers.set(base + 5, inputs);
        }
      }
    }
    return answers;
  }

  async function readCourseAnswers() {
    const indexUrl = await waitForPackageUrl();
    const baseUrl = new URL('.', indexUrl);
    const indexHtml = new DOMParser().parseFromString(await fetchText(indexUrl), 'text/html');
    const title = indexHtml.querySelector('title')?.textContent.trim() || '当前课程';
    const scripts = [...indexHtml.querySelectorAll('script[src]')]
      .map((script) => new URL(script.getAttribute('src'), indexUrl))
      .filter((url) => url.origin === location.origin && url.pathname.startsWith(baseUrl.pathname));
    const questionUrl = scripts.find((url) => /\/Tigan\.txt$/i.test(url.pathname));
    if (!questionUrl) throw new Error('当前课程没有可识别的题干文件。');
    const answerUrls = scripts.filter((url) => /\.js$/i.test(url.pathname) &&
      !/\/(?:createjs|jquery|MengooCx)[^/]*\.js$/i.test(url.pathname));
    if (!answerUrls.length) throw new Error('当前课程没有可识别的判分脚本。');
    const [questionSource, ...answerSources] = await Promise.all([
      fetchText(questionUrl),
      ...answerUrls.map(fetchText),
    ]);
    const groups = parseQuestions(questionSource);
    const questions = [...groups].flatMap(([group, rows]) => rows.map((text) =>
      groups.size === 1 ? text : `第 ${group} 部分 · ${text}`));
    const answers = parseAnswerScripts(answerSources.map((source, index) => ({ url: answerUrls[index], source })), groups);
    const options = optionCatalog[baseUrl.pathname] || [];
    const selections = {};
    const groupOffsets = {};
    let offset = 0;
    for (const [group, rows] of groups) {
      groupOffsets[group] = offset;
      selections[group] = {};
      rows.forEach((_question, index) => {
        const selected = selectedOptionNumbers(answers.get(offset + index));
        if (selected.length) selections[group][index] = selected;
      });
      offset += rows.length;
    }
    return { title, questions, answers, options, selections, groupOffsets, packagePath: baseUrl.pathname };
  }

  function selectedOptionNumbers(answer) {
    const match = answer?.match(/^正确选项：第 ([\d、]+) 项/);
    return match ? match[1].split('、').map(Number) : [];
  }

  function renderAnswers(data) {
    shadow.querySelector('#course-title').textContent = data.title;
    shadow.querySelector('#summary').textContent =
      `已识别 ${data.answers.size} / ${data.questions.length} 道题的答案`;
    shadow.querySelector('#note').textContent =
      '选项序号从 1 开始，按动画内部顺序编号；填空显示判分值，操作题显示计分条件。';
    showStatus('');
    answerList.replaceChildren();
    data.questions.forEach((question, index) => {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.className = 'question';
      title.textContent = question;
      const answer = document.createElement('span');
      answer.className = data.answers.has(index) ? 'answer' : 'answer unknown';
      const rawAnswer = data.answers.get(index);
      const choices = data.options[index];
      const selected = selectedOptionNumbers(rawAnswer);
      answer.textContent = selected.length && choices
        ? `${rawAnswer}（${selected.map((number) => String.fromCharCode(64 + number)).join('、')}）`
        : rawAnswer || '暂未识别到答案';
      item.append(title, answer);
      if (choices?.length) {
        const options = document.createElement('div');
        options.className = 'options';
        options.setAttribute('role', 'list');
        choices.forEach((choice, choiceIndex) => {
          const option = document.createElement('div');
          option.className = selected.includes(choiceIndex + 1) ? 'option correct' : 'option';
          option.setAttribute('role', 'listitem');
          option.textContent = `${String.fromCharCode(65 + choiceIndex)}. ${choice}`;
          options.appendChild(option);
        });
        item.appendChild(options);
      }
      answerList.appendChild(item);
    });
    if (!panel.hidden) sendChoiceMarks(data, true);
  }

  async function openPanel() {
    closeSubmitDialog();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (cachedAnswers) {
      renderAnswers(cachedAnswers);
      return;
    }
    showStatus('正在读取当前课程…');
    answerList.replaceChildren();
    shadow.querySelector('#course-title').textContent = '';
    shadow.querySelector('#summary').textContent = '';
    shadow.querySelector('#note').textContent = '';
    const requestedCourse = currentCourseId;
    try {
      loadingAnswers ||= readCourseAnswers();
      const data = await loadingAnswers;
      if (currentCourseId !== requestedCourse) return;
      cachedAnswers = data;
      renderAnswers(data);
    } catch (error) {
      if (currentCourseId === requestedCourse) showStatus(error.message || '读取答案失败，请重试。', true);
    } finally {
      loadingAnswers = null;
    }
  }

  function updateSubmissionFields() {
    const scoreEnabled = Boolean(submissionInfo?.titles.length && shadow.querySelector('#submit-score-enabled').checked);
    const progressEnabled = Boolean(submissionInfo?.supportsProgress && shadow.querySelector('#submit-progress-enabled').checked);
    for (const id of ['submit-title', 'submit-score', 'submit-minutes']) {
      shadow.querySelector(`#${id}`).disabled = !scoreEnabled;
    }
    shadow.querySelector('#submit-title').required = scoreEnabled && submissionInfo.titles.length > 1;
    shadow.querySelector('#submit-score').required = scoreEnabled;
    shadow.querySelector('#submit-minutes').required = scoreEnabled;
    shadow.querySelector('#submit-progress').disabled = !progressEnabled;
    shadow.querySelector('#submit-progress').required = progressEnabled;
    submitButton.disabled = Boolean(pendingSubmission) || !(scoreEnabled || progressEnabled);
  }

  function renderSubmissionInfo(info) {
    shadow.querySelector('#submit-course').textContent = `课程：${info.courseTitle}`;
    const select = shadow.querySelector('#submit-title');
    select.replaceChildren();
    if (info.titles.length > 1) select.add(new Option('请选择实验项目', ''));
    for (const title of info.titles) select.add(new Option(title, title));
    shadow.querySelector('#submit-title-row').hidden = info.titles.length === 1;
    shadow.querySelector('#submit-score-section').hidden = !info.titles.length;
    shadow.querySelector('#submit-progress-section').hidden = !info.supportsProgress;
    shadow.querySelector('#submit-progress-unavailable').hidden = info.supportsProgress || info.scoreCompletesProgress;
    shadow.querySelector('#submit-score-label').textContent = info.scoreCompletesProgress
      ? '提交成绩、用时和完成进度' : '提交成绩和用时';
    shadow.querySelector('#submit-score-progress-note').hidden = !info.scoreCompletesProgress;
    shadow.querySelector('#submit-score-enabled').checked = Boolean(info.titles.length);
    shadow.querySelector('#submit-progress-enabled').checked = info.supportsProgress;
    updateSubmissionFields();
    showSubmitStatus('');
  }

  async function openSubmitDialog() {
    closePanel();
    submitOverlay.hidden = false;
    submitForm.reset();
    submitButton.disabled = true;
    shadow.querySelector('#submit-course').textContent = '正在读取当前实验…';
    shadow.querySelector('#submit-title-row').hidden = true;
    shadow.querySelector('#submit-score-section').hidden = true;
    shadow.querySelector('#submit-progress-section').hidden = true;
    shadow.querySelector('#submit-progress-unavailable').hidden = true;
    showSubmitStatus('');
    shadow.querySelector('#submit-score').focus();
    if (submissionInfo) {
      renderSubmissionInfo(submissionInfo);
      return;
    }
    const requestedCourse = currentCourseId;
    try {
      loadingSubmissionInfo ||= readSubmissionInfo();
      const info = await loadingSubmissionInfo;
      if (currentCourseId !== requestedCourse) return;
      submissionInfo = info;
      renderSubmissionInfo(info);
    } catch (error) {
      if (currentCourseId === requestedCourse) {
        showSubmitStatus(error.message || '读取提交项目失败，请重试。', true);
      }
    } finally {
      loadingSubmissionInfo = null;
    }
  }

  submitForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!submissionInfo || pendingSubmission || !submitForm.reportValidity()) return;
    const scoreEnabled = submissionInfo.titles.length && shadow.querySelector('#submit-score-enabled').checked;
    const progressEnabled = submissionInfo.supportsProgress && shadow.querySelector('#submit-progress-enabled').checked;
    if (!scoreEnabled && !progressEnabled) return;
    let scoreSubmission = null;
    let progressPercent = null;
    if (scoreEnabled) {
      const score = shadow.querySelector('#submit-score').valueAsNumber;
      const minutes = shadow.querySelector('#submit-minutes').valueAsNumber;
      const title = shadow.querySelector('#submit-title').value;
      const durationSeconds = Math.round(minutes * 60);
      if (!Number.isInteger(score) || score < 0 || score > 100 ||
          !Number.isFinite(minutes) || durationSeconds < 1 || durationSeconds > 86400 ||
          !submissionInfo.titles.includes(title)) {
        showSubmitStatus('请填写 0–100 的整数成绩和有效用时，并选择实验项目。', true);
        return;
      }
      scoreSubmission = { title, score, durationSeconds };
    }
    if (progressEnabled) {
      progressPercent = shadow.querySelector('#submit-progress').valueAsNumber;
      if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
        showSubmitStatus('请填写 0–100 的整数进度。', true);
        return;
      }
    }
    const target = courseFrameWindow();
    if (!target) {
      showSubmitStatus('课程动画尚未加载，请稍后重试。', true);
      return;
    }
    const requestId = crypto.randomUUID();
    pendingSubmission = {
      requestId,
      timeout: setTimeout(() => {
        if (pendingSubmission?.requestId !== requestId) return;
        pendingSubmission = null;
        updateSubmissionFields();
        showSubmitStatus('未收到课程的提交回执，请先查看记录，再决定是否重试。', true);
      }, 20000),
    };
    submitButton.disabled = true;
    showSubmitStatus('正在向课程提交所选数据…');
    target.postMessage({
      source: 'good-pubhealth-boy',
      type: 'submitData',
      requestId,
      packagePath: submissionInfo.packagePath,
      scoreSubmission,
      progressPercent,
    }, location.origin);
  });

  shadow.querySelector('#submit-score-enabled').addEventListener('change', updateSubmissionFields);
  shadow.querySelector('#submit-progress-enabled').addEventListener('change', updateSubmissionFields);

  trigger.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  shadow.querySelector('#submit-trigger').addEventListener('click', openSubmitDialog);
  shadow.querySelector('#submit-close').addEventListener('click', () => closeSubmitDialog(true));
  submitOverlay.addEventListener('click', (event) => {
    if (event.target === submitOverlay) closeSubmitDialog(true);
  });
  shadow.querySelector('#close').addEventListener('click', closePanel);
  shadow.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!submitOverlay.hidden) closeSubmitDialog(true);
      else closePanel();
    }
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== courseFrameWindow()) return;
    if (event.data === 'gpbb:choiceMarkerReady' && cachedAnswers && !panel.hidden) {
      sendChoiceMarks(cachedAnswers, true, event.source);
    }
    if (typeof event.data === 'string' && event.data.startsWith('gpbb:submitResult:')) {
      let result;
      try { result = JSON.parse(event.data.slice('gpbb:submitResult:'.length)); } catch { return; }
      if (result.requestId !== pendingSubmission?.requestId) return;
      clearTimeout(pendingSubmission.timeout);
      pendingSubmission = null;
      updateSubmissionFields();
      showSubmitStatus(result.message || '提交失败，请重试。', !result.ok);
    }
  });
  new MutationObserver(queueVisibilityCheck).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('popstate', queueVisibilityCheck);
  syncVisibility();
})();
