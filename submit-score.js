(() => {
  if (!/^\/mzl\/[^/]+\/index\.html$/i.test(location.pathname)) return;
  if (window.__goodPubhealthScoreSubmitter) return;
  window.__goodPubhealthScoreSubmitter = true;

  function progressToken() {
    try {
      return typeof Auth !== 'undefined' && Auth.connected && Auth.userInfo?.access_token || '';
    } catch {
      return '';
    }
  }

  async function progressRequest(path, token, data) {
    const response = await fetch(`${path}?access_token=${encodeURIComponent(token)}`, data === undefined
      ? { credentials: 'same-origin' }
      : {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
    if (!response.ok) throw new Error(`进度接口返回 HTTP ${response.status}。`);
    return response.json();
  }

  async function saveProgress(percent) {
    const token = progressToken();
    if (!token) throw new Error('当前课件没有可用的进度令牌，请等待课件加载完成。');
    const current = await progressRequest('/api/open/Process', token);
    if (current.code !== 0 && !(current.code === -1 && current.msg === '暂无进度')) {
      throw new Error(current.msg || '读取当前课件进度失败。');
    }
    const previous = current.code === 0 ? current.data : null;
    const maxPv = Number.isInteger(previous?.maxPv) && previous.maxPv > 0 ? previous.maxPv : 100;
    const pv = Math.round(maxPv * percent / 100);
    const data = typeof previous?.data === 'string' ? previous.data : '';
    const uploaded = await progressRequest('/api/open/ProcessUpload', token, { maxPv, pv, data });
    if (uploaded.code !== 0) throw new Error(uploaded.msg || '保存课件进度失败。');
    const saved = await progressRequest('/api/open/Process', token);
    if (saved.code !== 0 || saved.data?.maxPv !== maxPv || saved.data?.pv !== pv) {
      throw new Error('平台未返回预期的课件进度，请查看课件后再决定是否重试。');
    }
    return Math.round(100 * pv / maxPv);
  }

  function sendScore({ title, score, durationSeconds }) {
    if (typeof window.ScoreUpload !== 'function' || typeof window.parent.API?.dataUpload !== 'function') {
      throw new Error('课程尚未准备好成绩上传接口，请稍后重试。');
    }
    const completesProgress = /\b(?:var|let|const)\s+status\s*=\s*["']1["']/.test(String(window.ScoreUpload));
    const previousStart = localStorage.getItem('startDate');
    try {
      localStorage.setItem('startDate', String(Date.now() - durationSeconds * 1000));
      window.ScoreUpload(title.trim(), score);
    } finally {
      if (previousStart === null) localStorage.removeItem('startDate');
      else localStorage.setItem('startDate', previousStart);
    }
    return completesProgress;
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window.top || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source !== 'good-pubhealth-boy' || message.type !== 'submitData') return;
    if (message.packagePath !== new URL('.', location.href).pathname) return;

    const requestId = typeof message.requestId === 'string' ? message.requestId.slice(0, 100) : '';
    const reply = (ok, text) => window.top.postMessage(
      `gpbb:submitResult:${JSON.stringify({ requestId, ok, message: text })}`, location.origin,
    );
    const score = message.scoreSubmission;
    const progress = message.progressPercent;
    const validScore = score === null || (typeof score === 'object' &&
      typeof score.title === 'string' && score.title.trim() &&
      Number.isInteger(score.score) && score.score >= 0 && score.score <= 100 &&
      Number.isInteger(score.durationSeconds) && score.durationSeconds >= 1 && score.durationSeconds <= 86400);
    const validProgress = progress === null || (Number.isInteger(progress) && progress >= 0 && progress <= 100);
    if (!requestId || (score === null && progress === null) || !validScore || !validProgress) {
      reply(false, '提交数据无效，请检查成绩、用时和进度。');
      return;
    }

    const results = [];
    const errors = [];
    if (score !== null) {
      try {
        const completesProgress = sendScore(score);
        results.push(completesProgress
          ? '成绩、用时和完成状态已发送，请在成绩记录及课程介绍页确认'
          : '成绩已发送，请在成绩记录中确认');
      } catch (error) {
        errors.push(`成绩提交失败：${error?.message || '课程上传接口调用失败'}`);
      }
    }
    if (progress !== null) {
      try {
        const savedPercent = await saveProgress(progress);
        results.push(`课件进度已保存为 ${savedPercent}%`);
      } catch (error) {
        errors.push(`进度提交失败：${error?.message || '进度接口调用失败'}`);
      }
    }
    reply(!errors.length, [...results, ...errors].join('；') + '。');
  });
})();
