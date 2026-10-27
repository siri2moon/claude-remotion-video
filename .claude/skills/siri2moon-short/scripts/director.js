// Injected into the page before any of its scripts run (capture.mjs).
// - A virtual clock: performance.now and requestAnimationFrame only move when capture calls
//   __cap.step(ms), so every frame is exactly 1/30 s apart however long a screenshot takes.
//   Date.now stays real, so server timestamps (e.g. Lucifer's engine) still line up.
// - __cap.initR3F(): for React Three Fiber apps served by Vite (Lucifer office), hooks the
//   R3F root so __cap.pose = { pos, target, fov } holds the camera on a scripted path.
// - __cap.scroll: for ordinary pages (blog posts), scrollY driven per frame.
(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const cap = { on: false, t: 0, queue: new Map(), nextId: 1e9, pose: null, scroll: null };
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

  /** Vite-served module the page already loaded, by a fragment of its URL (same instance as the app's). */
  cap.importLoaded = async (fragment) => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes(fragment));
    if (!url) throw new Error(`no loaded module matches ${fragment}`);
    return import(url);
  };

  cap.initR3F = async () => {
    const fiber = await cap.importLoaded('/.vite/deps/@react-three_fiber.js');
    const root = fiber._roots.get(document.querySelector('canvas'));
    const state = root.store.getState();
    const cam = state.camera;
    cap.r3f = state;
    const lookAt = cam.lookAt.bind(cam);
    cap.applyPose = () => {
      const p = cap.pose;
      if (!p) return;
      cam.position.set(...p.pos);
      if (p.fov && cam.fov !== p.fov) {
        cam.fov = p.fov;
        cam.updateProjectionMatrix();
      }
      lookAt(...p.target);
      cam.updateMatrixWorld();
    };
    // Orbit controls re-aim the camera at their own target every frame; keep ours instead.
    cam.lookAt = (...args) => (cap.pose ? cap.applyPose() : lookAt(...args));
    return true;
  };

  /** Absolute top of the first element matching a selector (for scroll keys). */
  cap.top = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  };

  cap.start = () => {
    cap.t = realNow();
    cap.on = true;
  };

  /** Advance the virtual clock and run one animation frame. */
  cap.step = (ms) => {
    cap.t += ms;
    cap.applyPose?.();
    if (cap.scroll != null) window.scrollTo({ top: cap.scroll, behavior: 'instant' });
    const callbacks = [...cap.queue.values()];
    cap.queue.clear();
    for (const cb of callbacks) cb(cap.t);
  };
})();
