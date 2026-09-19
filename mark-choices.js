(() => {
  if (!/^\/mzl\/[^/]+\/index\.html$/i.test(location.pathname)) return;
  if (window.__goodPubhealthChoiceMarker) return;

  const questionIndexes = new WeakMap();
  const badges = new Map();
  let selections = null;
  let groupOffsets = null;
  let enabled = false;
  let stage = null;
  let layer = null;

  function clearBadges() {
    for (const badge of badges.values()) badge.parent?.removeChild(badge);
    badges.clear();
  }

  function questionNumbers(clip) {
    if (questionIndexes.has(clip)) return questionIndexes.get(clip);
    const numbers = new Set();
    for (const [name, action] of Object.entries(clip)) {
      if (!/^frame_\d+$/.test(name) || typeof action !== 'function') continue;
      const source = String(action).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
      for (const match of source.matchAll(/\bcurrent_jfnum\s*=\s*(\d+)/g)) numbers.add(Number(match[1]));
      for (const match of source.matchAll(/\bstartsteps\(\s*(\d+)\s*\)/g)) numbers.add(Number(match[1]));
    }
    const result = [...numbers];
    questionIndexes.set(clip, result);
    return result;
  }

  function choiceTargets(clip) {
    const groups = new Map();
    for (const [name, target] of Object.entries(clip)) {
      const match = name.match(/^(xz_k1_|xz_u\d+_|xz_|xz|hot_)(\d+)$/);
      if (!match || typeof target?.getStage !== 'function' || target.getStage() !== stage) continue;
      if (!groups.has(match[1])) groups.set(match[1], new Map());
      groups.get(match[1]).set(Number(match[2]), target);
    }
    const candidates = [...groups.values()].filter((group) => group.size >= 2);
    candidates.sort((left, right) => {
      const clicks = (group) => [...group.values()].filter((target) => target.hasEventListener?.('click')).length;
      return clicks(right) - clicks(left) || right.size - left.size;
    });
    return candidates[0] || null;
  }

  function makeBadge() {
    const badge = new createjs.Container();
    const circle = new createjs.Shape();
    circle.graphics.beginFill('#2563eb').drawCircle(0, 0, 20);
    const tick = new createjs.Text('✓', 'bold 27px Arial', '#fff');
    tick.textAlign = 'center';
    tick.textBaseline = 'middle';
    tick.y = 1;
    badge.addChild(circle, tick);
    badge.mouseEnabled = false;
    badge.mouseChildren = false;
    return badge;
  }

  function markChoice(target, seen) {
    const bounds = target.getBounds() || target.nominalBounds;
    if (!bounds) return;
    let point;
    try {
      point = target.localToLocal(bounds.x + Math.min(bounds.width - 12, 22), bounds.y + 16, stage);
    } catch {
      return;
    }
    let badge = badges.get(target);
    if (!badge) {
      badge = makeBadge();
      badges.set(target, badge);
      layer.addChild(badge);
    }
    const size = Math.min(bounds.width, bounds.height);
    badge.scaleX = badge.scaleY = Math.min(1, Math.max(0.6, size / 40));
    badge.x = point.x;
    badge.y = point.y;
    seen.add(target);
  }

  function update() {
    if (!enabled || !selections || !window.stage || !window.createjs) {
      clearBadges();
      return;
    }
    if (stage !== window.stage || layer?.parent !== window.stage) {
      clearBadges();
      stage = window.stage;
      layer = new createjs.Container();
      layer.mouseEnabled = false;
      layer.mouseChildren = false;
      stage.addChild(layer);
    }

    const group = String(window.curSceneId || 1);
    const availableGroups = Object.keys(selections);
    const answerGroup = selections[group] ? group : availableGroups.length === 1 ? availableGroups[0] : group;
    const answers = selections[answerGroup];
    const seen = new Set();
    if (answers) {
      const stack = [...stage.children];
      while (stack.length) {
        const clip = stack.pop();
        if (clip === layer || !clip?.visible || clip._off || clip.alpha === 0) continue;
        if (clip.children) stack.push(...clip.children);
        if (!clip.children?.length) continue;
        const targets = choiceTargets(clip);
        if (!targets) continue;
        const numbers = questionNumbers(clip);
        if (!numbers.length) continue;
        const current = Number(window.current_jfnum);
        const index = numbers.includes(current) ? current : numbers.length === 1 ? numbers[0] : null;
        const offset = Number(groupOffsets?.[answerGroup] || 0);
        const usesGlobalIndexes = offset > 0 && numbers.length > 1 && Math.min(...numbers) === offset;
        const answerIndex = index === null ? null : index - (usesGlobalIndexes ? offset : 0);
        if (answerIndex === null || !answers[answerIndex]?.length) continue;
        for (const number of answers[answerIndex]) {
          const target = targets.get(number);
          if (target) markChoice(target, seen);
        }
      }
    }
    for (const [target, badge] of badges) {
      if (!seen.has(target)) {
        badge.parent?.removeChild(badge);
        badges.delete(target);
      }
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.top || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source !== 'good-pubhealth-boy' || message.type !== 'setChoiceMarks') return;
    if (message.packagePath !== new URL('.', location.href).pathname) return;
    selections = message.selections;
    groupOffsets = message.groupOffsets;
    enabled = message.enabled === true;
    update();
  });

  window.__goodPubhealthChoiceMarker = true;
  window.top.postMessage('gpbb:choiceMarkerReady', location.origin);
  setInterval(update, 400);
})();
