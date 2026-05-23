// ── LCC MAIN ─────────────────────────────────────────────────────────────────
(function() {

  var GS_URL   = 'https://script.google.com/macros/s/AKfycbysICk6LbEkYG8eXKYYri_JfDALNN3RVt5lTrfAaB9_eONj7ojjRpZgOtjfM8BcxFXP4Q/exec';
  var MAKE_URL = 'https://hook.us2.make.com/x7vtpem5ldvrv34y5hmcy6bdxsoy8xlc';
  var SECONDS  = 25;

  // ── Unique user ID ──────────────────────────────
  var uid = localStorage.getItem('lcc_uid') || '';
  if (!uid) {
    uid = 'u' + Date.now() + Math.random().toString(36).substr(2,6);
    localStorage.setItem('lcc_uid', uid);
  }

  function utmSource() {
    try { return new URLSearchParams(location.search).get('utm_source') || 'direct'; }
    catch(e) { return 'direct'; }
  }

  // ── 24hr dedup ──────────────────────────────────
  function alreadyViewedToday() {
    var t = parseInt(localStorage.getItem('lcc_v_' + uid) || '0', 10);
    return (Date.now() - t) < 86400000;
  }
  function markViewed() {
    localStorage.setItem('lcc_v_' + uid, Date.now().toString());
  }

  // ── Status check via JSONP ───────────────────────
  function checkStatusJSONP(cb) {
    var name  = 'lcc_s' + Date.now();
    var timer = null;
    var done  = false;
    var s     = document.createElement('script');

    window[name] = function(d) {
      done = true; clearTimeout(timer); delete window[name];
      if (s.parentNode) s.parentNode.removeChild(s);
      var raw    = ((d && d.status) || 'active').toString().toLowerCase().trim();
      var status = (raw === 'pause') ? 'paused' : raw;
      console.log('[LCC] Status (JSONP):', status);
      cb(status);
    };

    s.src     = GS_URL + '?action=status&callback=' + name + '&t=' + Date.now();
    s.onerror = function() {
      if (!done) { done = true; clearTimeout(timer); cb('active'); }
    };
    document.head.appendChild(s);

    timer = setTimeout(function() {
      if (!done) {
        done = true;
        console.warn('[LCC] Status check timed out');
        cb('active');
      }
    }, 5000);
  }

  // ── Show paused lock screen ──────────────────────
  function showPaused() {
    var p = document.getElementById('lcc-paused');
    if (p) { p.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    var f = document.getElementById('lcc-float');
    if (f) f.style.display = 'none';
    var b = document.getElementById('lcc-bar-wrap');
    if (b) b.style.display = 'none';
  }

  // ── Progress bar & 25s timer ─────────────────────
  var elapsed   = 0;       // ms accumulated while focused
  var lastTick  = null;    // Date.now() at last tick
  var viewDone  = false;
  var barEl     = null;
  var running   = false;
  var tickId    = null;

  // ── Focus check ──────────────────────────────────
  // Returns true only when the tab is fully in focus and visible
  function isFullyFocused() {
    return !document.hidden && document.hasFocus();
  }

  // ── Timer via setInterval ────────────────────────
  // Time only counted in discrete ticks — never accumulates in background
  function tick() {
    if (!running) return;

    if (!isFullyFocused()) {
      // Lost focus mid-tick — pause without counting this interval
      pauseTimer();
      return;
    }

    var now  = Date.now();
    var delta = now - lastTick;  // ms since last tick
    lastTick  = now;

    // Cap delta to 300ms — prevents a single stale tick from rushing the bar
    // (e.g. if setInterval fires late after a brief freeze)
    elapsed += Math.min(delta, 300);

    var secondsSoFar = elapsed / 1000;
    var pct = Math.min((secondsSoFar / SECONDS) * 100, 100);
    if (barEl) barEl.style.width = pct.toFixed(2) + '%';

    if (secondsSoFar >= SECONDS) {
      running = false;
      elapsed = SECONDS * 1000;
      if (barEl) barEl.style.width = '100%';
      clearInterval(tickId); tickId = null;
      if (!viewDone) {
        viewDone = true;
        if (typeof fbq !== 'undefined') {
          fbq('track', 'ViewContent', {
            content_name: 'Nail Fungus Treatment Page',
            content_category: 'Healthcare - Laser Treatment',
            currency: 'CAD'
          });
        }
        logView();
        showPopup();
      }
    }
  }

  function startTimer() {
    if (running || viewDone) return;
    if (!isFullyFocused()) return;  // don't start if not focused
    running  = true;
    lastTick = Date.now();
    tickId   = setInterval(tick, 250);
  }

  function pauseTimer() {
    if (!running) return;
    running = false;
    if (tickId) { clearInterval(tickId); tickId = null; }
    // elapsed already accumulated in tick() — no extra math needed
  }

  // ── Focus/visibility events ──────────────────────
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) { pauseTimer(); }
    else if (!viewDone && document.hasFocus()) { startTimer(); }
  });

  window.addEventListener('blur', function() { pauseTimer(); });
  window.addEventListener('focus', function() {
    if (!viewDone && !document.hidden) startTimer();
  });

  // ── Log view (image pixel — zero CORS) ──────────
  function logView() {
    if (alreadyViewedToday()) return;
    markViewed();
    var src = GS_URL
      + '?action=view'
      + '&userId=' + encodeURIComponent(uid)
      + '&source='  + encodeURIComponent(utmSource())
      + '&t='       + Date.now();
    var img  = new Image();
    img.src  = src;
    console.log('[LCC] View logged');
  }

  // ── Show popup ───────────────────────────────────
  function showPopup() {
    var p = document.getElementById('lcc-popup');
    if (p) { p.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  }

  // ── Form submit ──────────────────────────────────
  function submitForm() {
    var n   = (document.getElementById('fname')     || {}).value || '';
    var em  = (document.getElementById('femail')    || {}).value || '';
    var p   = (document.getElementById('fphone')    || {}).value || '';
    var loc = (document.getElementById('flocation') || {}).value || '';

    if (!n.trim() || !em.trim() || !p.trim()) {
      alert('Please fill in your name, email, and phone number.');
      return;
    }
    var btn = document.querySelector('.form-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: 'Nail Fungus Consultation',
        content_category: 'Healthcare',
        currency: 'CAD'
      });
    }

    fetch(MAKE_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: n.trim(), email: em.trim(), phone: p.trim(),
        location: loc, source: utmSource(),
        timestamp: new Date().toISOString()
      })
    }).catch(function() {});

    document.getElementById('form-fields').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
  }

  // Attach submit button via JS — avoids CSP blocking inline onclick attributes
  var submitBtn = document.getElementById('form-submit-btn');
  if (submitBtn) submitBtn.addEventListener('click', submitForm);

  // ── Scroll fade-in ───────────────────────────────
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up').forEach(function(el) { obs.observe(el); });

  // ── BOOT ─────────────────────────────────────────
  barEl = document.getElementById('lcc-bar');

  setTimeout(function() {
    if (!viewDone && isFullyFocused()) startTimer();
  }, 500);

  checkStatusJSONP(function(status) {
    if (status === 'paused') {
      showPaused();
      pauseTimer();
      viewDone = true;
    }
  });

})();
