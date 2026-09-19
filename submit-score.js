(() => {
  if (!/^\/mzl\/[^/]+\/index\.html$/i.test(location.pathname)) return;
  if (window.__goodPubhealthScoreSubmitter) return;
  window.__goodPubhealthScoreSubmitter = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window.top || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source !== 'good-pubhealth-boy' || message.type !== 'submitScore') return;
    if (message.packagePath !== new URL('.', location.href).pathname) return;

    const requestId = typeof message.requestId === 'string' ? message.requestId.slice(0, 100) : '';
    const reply = (ok, error = '') => window.top.postMessage(
      `gpbb:submitResult:${JSON.stringify({ requestId, ok, error })}`, location.origin,
    );
    const { title, score, durationSeconds } = message;
    if (!requestId || typeof title !== 'string' || !title.trim() ||
        !Number.isInteger(score) || score < 0 || score > 100 ||
        !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400) {
      reply(false, '提交数据无效，请检查成绩和用时。');
      return;
    }
    if (typeof window.ScoreUpload !== 'function' || typeof window.parent.API?.dataUpload !== 'function') {
      reply(false, '课程尚未准备好成绩上传接口，请稍后重试。');
      return;
    }

    const previousStart = localStorage.getItem('startDate');
    try {
      localStorage.setItem('startDate', String(Date.now() - durationSeconds * 1000));
      window.ScoreUpload(title.trim(), score);
      reply(true);
    } catch (error) {
      reply(false, error?.message || '课程上传接口调用失败。');
    } finally {
      if (previousStart === null) localStorage.removeItem('startDate');
      else localStorage.setItem('startDate', previousStart);
    }
  });
})();
