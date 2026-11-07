(function () {
  'use strict';

  var STORAGE_KEY = 'hullpops.memberEmail';
  var PARAM = 'm'; // ?m=<base64url email> — keeps the card in the URL so a home-screen copy still has it

  var $ = function (id) { return document.getElementById(id); };
  var views = { enter: $('view-enter'), confirm: $('view-confirm'), card: $('view-card') };
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
    setupInstall();
    show('card');
    keepAwake();
  }

  // ---------- add to home screen ----------
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  }
  function setupInstall() {
    var box = $('install');
    if (isStandalone()) { box.hidden = true; return; }
    box.hidden = false;
    $('install-btn').hidden = !deferredInstall;
    $('ios-steps').hidden = !isIOS();
    $('other-steps').hidden = isIOS() || !!deferredInstall;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    if (!views.card.hidden) setupInstall();
  });
  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    $('install').hidden = true;
  });
  $('install-btn').addEventListener('click', function () {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.finally(function () { deferredInstall = null; setupInstall(); });
  });

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
    if (!window.confirm('Replace the card for ' + current + '?')) return;
    clear(); setUrl('');
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
  } else {
    show('enter');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
