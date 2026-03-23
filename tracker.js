// TrackFlow — Lightweight Analytics Tracker (~1KB minified)
// Usage: <script src="https://YOUR-SITE.netlify.app/tracker.js" data-site-id="SITE_ID" defer></script>
(function () {
  'use strict';

  // Respect Do Not Track
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var script = document.currentScript;
  if (!script) return;

  var siteId = script.getAttribute('data-site-id');
  if (!siteId) return;

  var endpoint = script.src.replace('/tracker.js', '/api/track');

  // Generate or retrieve session ID
  function getSessionId() {
    var sid = sessionStorage.getItem('_tf_sid');
    if (!sid) {
      sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('_tf_sid', sid);
    }
    return sid;
  }

  function sendPageview() {
    var data = {
      site_id: siteId,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
      screen_width: window.innerWidth,
      session_id: getSessionId(),
      timestamp: new Date().toISOString()
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(data));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
    }
  }

  // Track initial pageview
  sendPageview();

  // SPA support: track pushState/replaceState navigation
  var originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    sendPageview();
  };

  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    sendPageview();
  };

  window.addEventListener('popstate', sendPageview);
})();
