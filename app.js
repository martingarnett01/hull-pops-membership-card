(function () {
  'use strict';

  var STORAGE_KEY = 'hullpops.memberEmail';
  var PARAM = 'm'; // ?m=<base64url email> — keeps the card in the URL so a home-screen copy still has it

  var $ = function (id) { return document.getElementById(id); };
  var views = { install: $('view-install'), enter: $('view-enter'), confirm: $('view-confirm'), card: $('view-card') };
  var pendingEmail = '';
  var deferredInstall = null;

  // ---------- storage (wrapped: private mode / some in-app browsers throw) ----------
  function save(email) { try { localStorage.setItem(STORAGE_KEY, email); } catch (e) {} }
  function load() { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
  function clear() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  // ---------- URL helpers ----------
  function b64urlEncode(s) {
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }
  function emailFromUrl() {
    try {
      var v = new URLSearchParams(location.search).get(PARAM);
      return v ? normalise(b64urlDecode(v)) : '';
    } catch (e) { return ''; }
  }
  function setUrl(email) {
    var url = location.pathname + (email ? '?' + PARAM + '=' + b64urlEncode(email) : '');
    try { history.replaceState(null, '', url); } catch (e) {}
  }

  // ---------- validation ----------
  function normalise(s) { return String(s || '').trim().toLowerCase(); }

  var COMMON_TYPOS = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com',
    'gmail.co': 'gmail.com', 'gmail.co.uk': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmai.co.uk': 'hotmail.co.uk',
    'hotmail.co': 'hotmail.co.uk', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com',
    'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.co.uk',
    'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com', 'btinternet.con': 'btinternet.com'
  };

  function validate(email) {
    if (!email) return 'Please enter your email address.';
    if (/\s/.test(email)) return 'Email addresses can’t contain spaces.';
    if (!/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(email)) return 'That doesn’t look like a full email address.';
    if (!/^[\x21-\x7e]+$/.test(email)) return 'Please use only standard letters, numbers and symbols.';
    return '';
  }

  // ---------- views ----------
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    window.scrollTo(0, 0);
  }

  function renderQR(email) {
    var qr = new QRCode(-1, QRErrorCorrectLevel.M);
    qr.addData(email);
    qr.make();
    var n = qr.getModuleCount(), q = 4, size = n + q * 2, path = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
      }
    }
    $('qr').innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + path + '"/></svg>';
  }

  function showCard(email) {
    renderQR(email);
    $('card-email').textContent = email;
    setUrl(email);
    $('card-install').hidden = !needsInstall();
    show('card');
    keepAwake();
  }

  // ---------- browser vs Home Screen ----------
  // Opened from the Home Screen = "standalone". In a normal phone browser we ask people to add it first,
  // because on iPhone the Home Screen copy has its own storage and wouldn't see an email typed in Safari.
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.navigator.standalone === true;
  }
  var UA = navigator.userAgent;
  function isIOS() { return /iphone|ipad|ipod/i.test(UA) || (/macintosh/i.test(UA) && navigator.maxTouchPoints > 1); }
  function isAndroid() { return /android/i.test(UA); }
  function isInApp() { return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest/i.test(UA); }

  var SKIP_KEY = 'hullpops.skipInstall';
  function skipped() { try { return sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; } }
  function setSkipped() { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {} }

  function needsInstall() { return (isIOS() || isAndroid()) && !isStandalone(); }

  function renderInstall() {
    var inApp = isInApp();
    $('inapp-steps').hidden = !inApp;
    $('inapp-open').textContent = isIOS() ? 'Open in Safari' : 'Open in browser';
    $('ios-steps').hidden = inApp || !isIOS();
    $('android-prompt').hidden = inApp || !isAndroid() || !deferredInstall;
    $('android-steps').hidden = inApp || !isAndroid() || !!deferredInstall;
  }
  function showInstall() { renderInstall(); show('install'); }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    renderInstall();
  });
  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    ['ios-steps', 'android-prompt', 'android-steps', 'inapp-steps'].forEach(function (id) { $(id).hidden = true; });
    $('installed-msg').hidden = false;
  });
  $('install-btn').addEventListener('click', function () {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.finally(function () { deferredInstall = null; renderInstall(); });
  });
  $('skip-install').addEventListener('click', function () {
    setSkipped();
    var email = $('card-email').textContent;
    if (email) { show('card'); } else { show('enter'); $('email').focus(); }
  });
  $('card-install').addEventListener('click', showInstall);

  // Keep the screen on while the card is showing (helps at the till). Silently skipped where unsupported.
  var wakeLock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator) || views.card.hidden) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') keepAwake();
  });

  // ---------- events ----------
  $('email-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('email'), err = $('email-error');
    var email = normalise(input.value);
    var msg = validate(email);
    if (msg) {
      err.textContent = msg; err.hidden = false;
      input.setAttribute('aria-invalid', 'true'); input.focus();
      return;
    }
    var domain = email.split('@')[1];
    if (COMMON_TYPOS[domain]) {
      var fixed = email.split('@')[0] + '@' + COMMON_TYPOS[domain];
      if (window.confirm('Did you mean ' + fixed + '?')) email = fixed;
    }
    err.hidden = true; input.removeAttribute('aria-invalid');
    pendingEmail = email;
    $('confirm-email').textContent = email;
    show('confirm');
  });

  $('email').addEventListener('input', function () {
    $('email-error').hidden = true;
    this.removeAttribute('aria-invalid');
  });

  $('confirm-yes').addEventListener('click', function () {
    save(pendingEmail);
    showCard(pendingEmail);
  });
  $('confirm-no').addEventListener('click', function () {
    $('email').value = pendingEmail;
    show('enter');
    $('email').focus();
  });

  $('change-email').addEventListener('click', function () {
    var current = $('card-email').textContent;
    if (!window.confirm('Remove the card for ' + current + '?')) return;
    clear(); setUrl('');
    $('card-email').textContent = '';
    if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    $('email').value = current;
    show('enter');
    $('email').focus();
  });

  // ---------- start ----------
  var fromUrl = emailFromUrl();
  var initial = (fromUrl && !validate(fromUrl)) ? fromUrl : load();
  if (initial && !validate(initial)) {
    save(initial);
    showCard(initial);
  } else if (needsInstall() && !skipped()) {
    showInstall();
  } else {
    show('enter');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
