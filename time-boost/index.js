// Time Boost — developed and maintained by patchbaywizard.
// https://github.com/patchbaywizard/subway-builder-time-boost
(function () {
  'use strict';
  const api = window.SubwayBuilderAPI;
  const key = '__hopscotchTimeBoost';
  // A console re-run or mod hot reload must not capture our override as baseline.
  window[key]?.dispose();
  if (!api?.modifyConstants || !api?.utils?.React || !api?.ui?.registerComponent) {
    console.error('[Time Boost] Required modding API unavailable. Update Subway Builder.');
    return;
  }
  const base = api.utils.getConstants()?.GAME_SECONDS_PER_SECOND?.ultrafast;
  if (!Number.isFinite(base) || base <= 0) {
    api.ui.showNotification('This game version does not expose live speed rules. Please update.', 'error', 'Time Boost');
    return;
  }
  const originalBatch = { ...api.utils.getConstants().TICKS_PER_UPDATE?.ultrafast };
  let ownedBatch = null;
  const React = api.utils.React;
  const h = React.createElement;
  // Levels express increasing simulation requests, not guaranteed throughput.
  const presets = [1800, 3600, 14400, 21600, 28800].map(
    (rate, index) => ({ level: index + 1, rate })
  );
  const listeners = new Set();
  const off = [];
  let sample = null;
  let measured = null;
  let meterTimer = null;
  function resetMeter() { sample = null; measured = null; }
  function measure() {
    const now = performance.now();
    const elapsed = api.gameState?.getElapsedSeconds?.();
    if (api.gameState?.isPaused?.() || !Number.isFinite(elapsed)) {
      resetMeter(); emit(); return;
    }
    if (!sample || elapsed < sample.elapsed) sample = { now, elapsed };
    if (now - sample.now >= 3000) {
      measured = (elapsed - sample.elapsed) / 3600 / ((now - sample.now) / 1000);
      sample = { now, elapsed };
    }
    emit();
  }
  let selected = null;
  let ownedRate = null;
  function emit() { listeners.forEach(fn => fn()); }
  function restore() {
    resetMeter();
    // Avoid overwriting a newer override from another mod.
    if (ownedRate !== null && api.utils.getConstants().GAME_SECONDS_PER_SECOND.ultrafast === ownedRate) {
      api.modifyConstants({ GAME_SECONDS_PER_SECOND: { ultrafast: base } });
    }
    if (ownedBatch !== null) {
      const current = api.utils.getConstants().TICKS_PER_UPDATE?.ultrafast;
      const patch = {};
      for (const field of ['gameState', 'popMovementGeojson']) {
        if (current?.[field] === ownedBatch[field]) patch[field] = originalBatch[field];
      }
      if (Object.keys(patch).length) api.modifyConstants({ TICKS_PER_UPDATE: { ultrafast: patch } });
      ownedBatch = null;
    }
    selected = null;
    ownedRate = null;
    emit();
  }
  function boost(preset) {
    resetMeter();
    const rate = preset.rate;
    const patch = { GAME_SECONDS_PER_SECOND: { ultrafast: rate } };
    if (Number.isInteger(originalBatch.gameState) && Number.isInteger(originalBatch.popMovementGeojson)) {
      // Fixed 0.5-game-second ticks: aim for ~60 updates/sec instead of
      // sub-millisecond timers. Keep train and passenger cadence unchanged.
      const cap = api.utils.getConstants().MAX_TICKS_PER_UPDATE;
      const limit = Number.isInteger(cap) && cap > 0 ? cap : 1000;
      const batch = Math.min(limit, Math.max(originalBatch.gameState, Math.ceil(rate / 30)));
      ownedBatch = {
        gameState: batch,
        popMovementGeojson: Math.min(limit, Math.max(batch, originalBatch.popMovementGeojson))
      };
      patch.TICKS_PER_UPDATE = { ultrafast: ownedBatch };
    }
    api.modifyConstants(patch);
    ownedRate = rate;
    selected = preset;
    api.actions.setSpeed('ultrafast');
    // Deliberately preserve pause state, just like a speed selector.
    emit();
  }
  function handleSpeedKey(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key !== '[' && event.key !== ']') return;
    const target = event.target;
    if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return;
    const speed = api.gameState?.getGameSpeed?.();
    // Leave all native transitions to the game. Intercept only our extension.
    if (selected === null && (event.key !== ']' || speed !== 'ultrafast')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    const index = selected === null ? -1 : presets.indexOf(selected);
    if (event.key === ']') boost(presets[Math.min(index + 1, presets.length - 1)]);
    else if (index > 0) boost(presets[index - 1]);
    else restore(); // The next '[' is handled natively: ultrafast -> fast.
  }
  function Controls() {
    const [, update] = React.useState(0);
    React.useEffect(() => {
      const listener = () => update(n => n + 1);
      listeners.add(listener);
      window.addEventListener('keydown', handleSpeedKey, true);
      if (meterTimer !== null) clearInterval(meterTimer);
      meterTimer = setInterval(measure, 500);
      return () => {
        listeners.delete(listener);
        clearInterval(meterTimer);
        meterTimer = null;
        window.removeEventListener('keydown', handleSpeedKey, true);
      };
    }, []);
    const Button = api.utils.components?.Button || 'button';
    return h('div', {
      role: 'group', 'aria-label': 'Time Boost',
      style: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }
    }, [
      ...presets.map(preset => h(Button, {
        key: preset.level, size: 'sm', variant: selected === preset ? 'default' : 'outline',
        'aria-pressed': selected === preset,
        title: `Boost level ${preset.level}. Use the actual speed readout to compare performance. Preserves pause.`,
        onClick: () => boost(preset),
        style: { height: 28, padding: '0 8px', whiteSpace: 'nowrap', fontSize: 12 }
      }, `Boost ${preset.level}`)),
      h(Button, {
        key: 'restore', size: 'sm', variant: 'ghost', disabled: selected === null,
        title: 'Restore the original ultrafast speed', onClick: restore,
        style: { height: 28, padding: '0 8px', fontSize: 12 }
      }, 'Reset'),
      h('span', {
        key: 'actual', title: 'Measured game hours per real second over the last three seconds. Buttons select boost levels.',
        style: { fontSize: 12, whiteSpace: 'nowrap' }
      }, api.gameState?.isPaused?.() ? 'Paused' : measured === null ? 'Measuring…' : `Actual ${measured.toFixed(2)} hr/s`)

    ]);
  }
  api.ui.registerComponent('bottom-bar', { id: 'hopscotch-time-boost', component: Controls });
  function hook(name, callback) {
    if (typeof api.hooks?.[name] === 'function') {
      const unsubscribe = api.hooks[name](callback);
      if (typeof unsubscribe === 'function') off.push(unsubscribe);
    }
  }
  hook('onSpeedChanged', speed => { if (speed !== 'ultrafast') restore(); });
  hook('onPauseChanged', () => { resetMeter(); emit(); });
  hook('onGameEnd', restore);
  hook('onGameInit', restore);
  hook('onGameLoaded', restore);
  window[key] = { dispose() { clearInterval(meterTimer); meterTimer = null; window.removeEventListener('keydown', handleSpeedKey, true); restore(); off.forEach(fn => fn()); listeners.clear(); } };
  console.log('[Time Boost] Loaded: Boost levels 1–5 with actual speed readout.');
})();
