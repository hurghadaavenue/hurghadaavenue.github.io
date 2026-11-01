/*!
 * responsive-fix.js
 * Drop-in patch for pages built with absolutely-positioned layouts
 * (WYSIWYG Web Builder style: #container + wb_* blocks + fixed breakpoints).
 *
 * Add ONE line before </body> on each page:
 *   <script src="responsive-fix.js" defer></script>
 *
 * What it does
 *  1. CSS: stops horizontal scrolling, keeps header images in proportion,
 *     enlarges small touch targets, lets the pager wrap, makes text readable on phones.
 *  2. JS:  measures every absolutely-positioned block at its real content height
 *     and moves everything below it (and the footer) up or down to match,
 *     so text can never overlap the next section. Re-runs on resize,
 *     orientation change, font load and image load.
 */
(function () {
  'use strict';

  /* ---------- 1. CSS patch ---------- */
  var CSS = [
    'html,body{overflow-x:hidden;max-width:100%}',
    'img{max-width:100%}',
    '[id^="wb_en-header"] img,[id^="wb_ar-"] img,[id^="wb_en-"] img{object-fit:contain}',
    'a.ui-button{min-width:44px;min-height:44px}',
    '[class*="counter-unuts"] .navbar-nav{flex-wrap:wrap;justify-content:center}',
    '[class*="counter-unuts"] .navbar-nav>li>a{padding:10px 12px !important}',
    '[id*="tpage-description"]{overflow-wrap:anywhere}',
    '@media (max-width:639px){',
    '  [id*="tpage-description"],[id*="tpage-description"] li,[id*="tpage-description"] p{font-size:18px !important;line-height:1.7 !important}',
    '  [id*="tpage-description"] ul{padding-inline-start:8px}',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.setAttribute('data-responsive-fix', '');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ---------- 2. Reflow patch ---------- */
  function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  // Re-positions absolutely-positioned nodes so grown/shrunk blocks push or pull the ones below.
  // Returns the original and new lowest edge so the caller can place whatever follows.
  function layout(nodes) {
    nodes.forEach(function (el) {
      if (el.__rf) {
        el.style.removeProperty('top');
        el.style.removeProperty('height');
        el.__rf = false;
      }
    });

    var info = [];
    nodes.forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.position !== 'absolute' || cs.display === 'none') return;
      var h = px(cs.height);
      var prev = el.style.height;
      el.style.height = 'auto';
      var natural = el.offsetHeight;
      el.style.height = prev;

      var isText = !!el.querySelector('p,li,h1,h2,h3');
      var delta = natural - h;
      if (!isText && delta < 0) delta = 0;      // only text blocks may shrink
      if (Math.abs(delta) < 3) delta = 0;       // ignore sub-pixel noise

      info.push({ el: el, top: px(cs.top), left: px(cs.left), w: px(cs.width), h: h, delta: delta });
    });

    var origBottom = 0, newBottom = 0;
    info.forEach(function (i) {
      var shift = 0;
      info.forEach(function (e) {
        if (e === i || !e.delta) return;
        var overlapsX = i.left < e.left + e.w && i.left + i.w > e.left;
        var isBelow = i.top >= e.top + e.h - 2;
        if (overlapsX && isBelow) shift += e.delta;
      });

      var top = Math.max(0, i.top + shift);
      var height = Math.max(0, i.h + i.delta);

      if (shift) { i.el.style.top = top + 'px'; i.el.__rf = true; }
      if (i.delta) { i.el.style.height = height + 'px'; i.el.__rf = true; }

      origBottom = Math.max(origBottom, i.top + i.h);
      newBottom = Math.max(newBottom, top + height);
    });

    return { origBottom: origBottom, newBottom: newBottom };
  }

  function findFooter() {
    var kids = document.body.children;
    for (var k = 0; k < kids.length; k++) {
      var id = kids[k].id || '';
      if (/mainfooter/.test(id) && !/overlay|Container/.test(id)) return kids[k];
    }
    return null;
  }

  function run() {
    var container = document.getElementById('container');
    if (!container) return;

    var main = layout(Array.prototype.slice.call(container.querySelectorAll(':scope > [id^="wb_"]')));

    var footer = findFooter();
    if (!footer) return;

    if (footer.__rf) {
      footer.style.removeProperty('top');
      footer.style.removeProperty('height');
      footer.__rf = false;
    }
    var fcs = getComputedStyle(footer);
    var footerTop = px(fcs.top), footerH = px(fcs.height);

    // keep the original gap between content and footer
    var gap = Math.max(0, footerTop - main.origBottom);
    var newTop = main.newBottom + gap;
    if (Math.abs(newTop - footerTop) > 2) {
      footer.style.top = newTop + 'px';
      footer.__rf = true;
    }

    // make sure footer content is never clipped
    var f = layout(Array.prototype.slice.call(footer.querySelectorAll('[id^="wb_"]')));
    var pad = Math.max(0, footerH - f.origBottom);
    var newH = Math.max(footerH, f.newBottom + pad);
    if (Math.abs(newH - footerH) > 2) {
      footer.style.height = newH + 'px';
      footer.__rf = true;
    }
  }

  var timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }

  run();
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
