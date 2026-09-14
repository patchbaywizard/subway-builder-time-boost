const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../time-boost/index.js'), 'utf8');
function setup() {
  const rules = { MAX_TICKS_PER_UPDATE: 1000, TICKS_PER_UPDATE: { ultrafast: { gameState: 48, trainCoords: 24, popMovement: 24, popMovementGeojson: 48 } }, GAME_SECONDS_PER_SECOND: { slow: 1, normal: 25, fast: 250, ultrafast: 500 } };
  let now = 0; let elapsed = 0; let paused = false; let timer;
  const hooks = {}; const keys = new Set(); let dialog = false; let component; let speed = 'normal'; let pauseCalls = 0;
  const api = {
    utils: { getConstants: () => rules, React: {
      createElement: (type, props, children) => ({ type, props, children }),
      useState: () => [0, () => {}], useEffect: fn => fn()
    } },
    modifyConstants: patch => {
      Object.assign(rules.GAME_SECONDS_PER_SECOND, patch.GAME_SECONDS_PER_SECOND);
      Object.assign(rules.TICKS_PER_UPDATE.ultrafast, patch.TICKS_PER_UPDATE?.ultrafast);
    },
    gameState: { getGameSpeed: () => speed, getElapsedSeconds: () => elapsed, isPaused: () => paused },
    actions: { setSpeed: value => queueMicrotask(() => { speed = value; fire('onSpeedChanged', value); }), setPause: () => pauseCalls++ },
    ui: { registerComponent: (placement, config) => { assert.equal(placement, 'bottom-bar'); component = config.component; }, showNotification() {} },
    hooks: Object.fromEntries(['onPauseChanged','onSpeedChanged','onGameEnd','onGameInit','onGameLoaded'].map(name => [name, fn => {
      (hooks[name] ??= new Set()).add(fn); return () => hooks[name].delete(fn);
    }]))
  };
  const context = vm.createContext({ window: { SubwayBuilderAPI: api,
    addEventListener: (name, fn) => keys.add(fn), removeEventListener: (name, fn) => keys.delete(fn)
  }, document: { querySelector: () => dialog }, console,
    performance: { now: () => now }, setInterval: fn => { timer = fn; return 1; }, clearInterval() {}
  });
  function press(key, extra = {}) {
    let blocked = false;
    const event = { key, preventDefault() {}, stopImmediatePropagation() { blocked = true; }, ...extra };
    keys.forEach(fn => fn(event));
    return blocked;
  }
  function fire(name, value) { hooks[name]?.forEach(fn => fn(value)); }
  function click(label) { component().children.find(b => b.children === label).props.onClick(); }
  function load() { vm.runInContext(code, context); component(); }
  load();
  return { advance(ms, seconds) { now += ms; elapsed += seconds; timer(); },
    readout() { return component().children.find(b => b.props.key === 'actual').children; },
    pause(value) { paused = value; fire('onPauseChanged'); }, rules, fire, click, load, api, hooks, press, keys, setDialog(value) { dialog = value; }, get speed() { return speed; }, get pauseCalls() { return pauseCalls; } };
}
test('absolute rates, deferred speed, pause preservation, and reset', async () => {
  const s = setup(); assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
  s.click('Boost 1'); await Promise.resolve();
  assert.equal(s.speed, 'ultrafast'); assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 1800);
  s.click('Boost 2'); await Promise.resolve(); s.click('Boost 2'); await Promise.resolve();
  assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 3600);
  for (const [label, rate] of [['Boost 3', 14400], ['Boost 4', 21600], ['Boost 5', 28800], ['Boost 3', 14400]]) {
    s.click(label); await Promise.resolve();
    assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, rate);
    assert.equal(s.speed, 'ultrafast');
  }
  assert.equal(s.pauseCalls, 0); assert.equal(s.rules.GAME_SECONDS_PER_SECOND.fast, 250);
  s.click('Reset'); assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
});
test('native slower tier and lifecycle restore the original rate', async () => {
  const s = setup();
  for (const event of ['onSpeedChanged','onGameEnd','onGameInit','onGameLoaded']) {
    s.click('Boost 2'); await Promise.resolve(); s.fire(event, 'fast');
    assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
  }
});
test('reload restores baseline and does not duplicate hooks', async () => {
  const s = setup(); s.click('Boost 2'); await Promise.resolve(); s.load();
  assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
  Object.values(s.hooks).forEach(set => assert.equal(set.size, 1));
  s.click('Boost 1'); await Promise.resolve(); s.click('Reset');
  assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
});
test('reset respects a newer override from another mod', async () => {
  const s = setup(); s.click('Boost 2'); await Promise.resolve();
  s.rules.GAME_SECONDS_PER_SECOND.ultrafast = 750; s.click('Reset');
  assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 750);
});

test('boost levels use bounded batches and restore cadence', async () => {
  const s = setup();
  for (const [label, batch] of [['Boost 2', 120], ['Boost 3', 480], ['Boost 4', 720], ['Boost 5', 960]]) {
    s.click(label); await Promise.resolve();
    assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.gameState, batch);
    assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.popMovementGeojson, batch);
    assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.trainCoords, 24);
    assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.popMovement, 24);
  }
  s.click('Reset');
  assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.gameState, 48);
  assert.equal(s.rules.TICKS_PER_UPDATE.ultrafast.popMovementGeojson, 48);
});

test('bracket extension steps up and down without swallowing native tiers', async () => {
  const s = setup();
  assert.equal(s.press(']'), false);
  s.api.actions.setSpeed('ultrafast'); await Promise.resolve();
  for (const rate of [1800, 3600, 14400, 21600, 28800, 28800]) {
    assert.equal(s.press(']'), true); await Promise.resolve();
    assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, rate);
  }
  for (const rate of [21600, 14400, 3600, 1800, 500]) {
    assert.equal(s.press('['), true); await Promise.resolve();
    assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, rate);
  }
  assert.equal(s.press('['), false);
  assert.equal(s.pauseCalls, 0);
});
test('brackets ignore typing, dialogs, composition, modifiers and clean up on reload', async () => {
  const s = setup(); s.api.actions.setSpeed('ultrafast'); await Promise.resolve();
  for (const extra of [{ctrlKey:true}, {metaKey:true}, {altKey:true}, {shiftKey:true}, {isComposing:true}, {defaultPrevented:true}, {target:{isContentEditable:true}}, {target:{closest:()=>true}}]) {
    assert.equal(s.press(']', extra), false);
  }
  s.setDialog(true); assert.equal(s.press(']'), false); s.setDialog(false);
  s.press(']', {repeat:true}); assert.equal(s.rules.GAME_SECONDS_PER_SECOND.ultrafast, 500);
  s.load(); assert.equal(s.keys.size, 1);
});

test('meter reports elapsed game time rather than the selected level and resets on pause', async () => {
  const s = setup(); s.click('Boost 5'); await Promise.resolve();
  s.advance(0, 0); s.advance(3000, 21600);
  assert.equal(s.readout(), 'Actual 2.00 hr/s');
  s.pause(true); assert.equal(s.readout(), 'Paused');
  s.advance(10000, 0); s.pause(false);
  assert.equal(s.readout(), 'Measuring…');
  s.advance(0, 0); s.advance(3000, 10800);
  assert.equal(s.readout(), 'Actual 1.00 hr/s');
  s.click('Boost 4'); assert.equal(s.readout(), 'Measuring…');
});
