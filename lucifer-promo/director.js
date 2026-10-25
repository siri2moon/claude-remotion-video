// Injected into the Lucifer office page before any of its scripts run.
// - A virtual clock: performance.now and requestAnimationFrame only move when the capture
//   script calls __cap.step(ms), so every frame is exactly 1/30 s apart however long it takes
//   to render and screenshot. Date.now stays real, so the engine's timestamps still line up.
// - A virtual camera: __cap.pose = { pos, target, fov } overrides wherever the office's own
//   camera rig wants to look.
(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const cap = { on: false, t: 0, queue: new Map(), nextId: 1e9, pose: null, camera: null };
  window.__cap = cap;

  performance.now = () => (cap.on ? cap.t : realNow());
  window.requestAnimationFrame = (cb) => {
    if (!cap.on) return realRaf(cb);
    const id = ++cap.nextId;
    cap.queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (!cap.queue.delete(id)) realCaf(id);
  };

  /** Hook the office: the R3F root, the camera, the store and the agents' anchors. */
  cap.init = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name);
    const fiberUrl = urls.find((u) => u.includes('/.vite/deps/@react-three_fiber.js'));
    const fiber = await import(fiberUrl);
    const canvas = document.querySelector('canvas');
    const root = fiber._roots.get(canvas);
    const state = root.store.getState();
    cap.state = state;
    cap.camera = state.camera;
    cap.office = (await import('/src/state/office.ts')).useOffice;
    cap.labels = await import('/src/scene/labels.tsx');
    cap.engine = (await import('/src/state/engine.ts')).engineApi;

    const cam = state.camera;
    const lookAt = cam.lookAt.bind(cam);
    cap.apply = () => {
      const p = cap.pose;
      if (!p) return;
      cam.position.set(...p.pos);
      if (p.fov && cam.fov !== p.fov) {
        cam.fov = p.fov;
        cam.updateProjectionMatrix();
      }
      lookAt(...p.target);
      if (p.roll) cam.rotateZ(p.roll);
      cam.updateMatrixWorld();
    };
    // OrbitControls re-aims the camera at its own target every frame; keep ours instead.
    cam.lookAt = (...args) => (cap.pose ? cap.apply() : lookAt(...args));
    return true;
  };

  cap.start = () => {
    cap.t = realNow();
    cap.on = true;
  };

  /** Advance the virtual clock and run one animation frame. */
  cap.step = (ms) => {
    cap.t += ms;
    cap.apply?.();
    const callbacks = [...cap.queue.values()];
    cap.queue.clear();
    for (const cb of callbacks) cb(cap.t);
  };

  /** World positions of every agent, by id. */
  cap.agents = () => {
    const out = {};
    for (const [id, anchor] of cap.labels.agentAnchors) {
      anchor.updateWorldMatrix(true, false);
      const e = anchor.matrixWorld.elements;
      out[id] = [e[12], e[13], e[14]];
    }
    return out;
  };
})();
