// Page-side test hooks (never in the repo): grab the game, run a callback before each view render.
const INSTALL = async () => {
  // The app may import a module with Vite's ?t= stamp; import it by the exact URL its importer uses.
  const exact = async (path, importer) => {
    const src = await (await fetch(importer)).text();
    const m = new RegExp(`["'](${path.replace(/[.]/g, '\\.')}(\\?[^"']*)?)["']`).exec(src);
    return m ? m[1] : path;
  };
  const gameUrl = await exact('/src/games/splitways/game.ts', '/src/games/splitways/tv/SplitWaysStage.tsx');
  const rendererUrl = await exact('/src/games/splitways/render/renderer.ts', gameUrl);
  window.__urls = { gameUrl, rendererUrl };
  const g = await import(gameUrl);
  const r = await import(rendererUrl);
  const proto = g.SplitWaysGame.prototype;
  const render = proto.render;
  proto.render = function (...a) {
    window.__game = this;
    return render.apply(this, a);
  };
  const rv = r.GameRenderer.prototype.renderView;
  r.GameRenderer.prototype.renderView = function (i, scene, camera, speed) {
    if (window.__beforeView) window.__beforeView(i, scene, camera, this);
    return rv.call(this, i, scene, camera, speed);
  };
  return `hooks installed ${gameUrl} ${rendererUrl}`;
};

/** Adds extra parked cars at grid slots; returns once loaded. extras: [{car, paint, slot}] */
const ADD_EXTRAS = async (extras) => {
  const src = await (await fetch(window.__urls.gameUrl)).text();
  const cvUrl = /["'](\/src\/games\/splitways\/scene\/carVisual\.ts(\?[^"']*)?)["']/.exec(src)?.[1] ?? '/src/games/splitways/scene/carVisual.ts';
  const cv = await import(cvUrl);
  const game = window.__game;
  const lib = await cv.CarModelLibrary.load(extras.map((e) => e.car));
  const spawns = game.track.gridSpawns(6);
  window.__extras = extras.map((e) => {
    const v = lib.create(e.car, e.paint);
    const s = e.spawn ?? spawns[e.slot];
    v.root.position.set(s.x, s.y - 0.5 + (e.lift ?? 0), s.z);
    v.root.rotation.y = s.yaw;
    game.scene.add(v.root);
    return v;
  });
  return window.__extras.length;
};

/**
 * Camera override: pos/look in a frame built from a reference (x,z,yaw,y): f = forward, r = right.
 * spec: { ref:{x,y,z,yaw}, eye:[f,r,up], at:[f,r,up], fov }
 */
const SET_CAMERA = (spec) => {
  if (!spec) {
    window.__beforeView = null;
    return 'off';
  }
  window.__beforeView = (i, scene, camera, renderer) => {
    if (i !== 0 || scene !== window.__game.scene) return;
    const { ref, eye, at, fov } = spec;
    const fx = Math.sin(ref.yaw), fz = Math.cos(ref.yaw);
    // +X is the car's left; right = -left.
    const rx = -fz, rz = fx;
    const p = (v) => [ref.x + fx * v[0] + rx * v[1], ref.y + v[2], ref.z + fz * v[0] + rz * v[1]];
    camera.position.set(...p(eye));
    camera.lookAt(...p(at));
    if (fov) camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const game = window.__game;
    const h = renderer.rects?.[0]?.height ?? 1080;
    const floor = renderer.preset.carLodFloor;
    game.shadows.beforeView(camera.position.clone().lerp(new camera.position.constructor(...p(at)), 0.7));
    for (const d of game.drivers) d.visual.selectLod(camera, h, floor, 0);
    for (const v of window.__extras ?? []) v.selectLod(camera, h, floor, 0);
  };
  return 'on';
};

module.exports = { INSTALL, ADD_EXTRAS, SET_CAMERA };
