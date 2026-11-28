// Signs a person out after 24 hours without any activity. The clock is kept in the browser (shared by all open tabs),
// so it also applies when the page was closed overnight and is opened again later.
(function () {
  var KEY = "fk_last_active", MAX = 24 * 3600 * 1000, timer = null, cb = null, dbc = null, last = 0, wired = false;
  var read = function () { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } };
  var write = function (t) { try { localStorage.setItem(KEY, String(t)); } catch (e) {} };
  var stale = function () { var t = read(); return t > 0 && Date.now() - t > MAX; };
  var touch = function () { var n = Date.now(); if (n - last <= 30000 && n - read() <= 30000) return; last = n; write(n); };
  async function check() {
    if (!dbc || !stale()) return;
    var d = dbc, f = cb; IDLE.stop();
    try { await d.auth.signOut(); } catch (e) {}
    write(0); if (f) f("idle");
  }
  var IDLE = window.IDLE = {
    MAX: MAX, stale: stale,
    // call once a person is signed in; onOut("idle") runs after they have been signed out
    start: function (db, onOut) {
      dbc = db; cb = onOut; if (stale()) { check(); return; }
      write(Date.now()); last = Date.now();
      if (!wired) { wired = true; ["pointerdown", "keydown", "touchstart", "scroll", "click"].forEach(function (e) { window.addEventListener(e, touch, { passive: true, capture: true }); });
        document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); }); window.addEventListener("focus", check); }
      clearInterval(timer); timer = setInterval(check, 60000);
    },
    stop: function () { clearInterval(timer); timer = null; dbc = null; cb = null; }
  };
})();
