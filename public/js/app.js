(function () {
  'use strict';

  /* ---------- Lazy images: fade in once loaded ---------- */
  document.querySelectorAll('img.lazy').forEach(function (img) {
    var done = function () { img.classList.add('loaded'); };
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener('load', done); img.addEventListener('error', done); }
  });

  /* ---------- Lightbox ---------- */
  var wrap = document.querySelector('[data-lightbox]');
  if (wrap) {
    var images = [];
    try { images = JSON.parse(wrap.dataset.images || '[]'); } catch (e) { /* ignore */ }
    var title = wrap.dataset.title || 'Trip';
    var index = 0, opener = null, touchX = null;

    var lb = document.createElement('div');
    lb.className = 'lb';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', title + ' photo viewer');
    lb.innerHTML =
      '<button type="button" class="lb-btn lb-close" aria-label="Close"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="lb-stage"><img class="lb-img" alt=""></div>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next photo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<div class="lb-count" aria-live="polite"></div>';
    document.body.appendChild(lb);

    var imgEl = lb.querySelector('.lb-img'), countEl = lb.querySelector('.lb-count');
    var btnClose = lb.querySelector('.lb-close'), btnPrev = lb.querySelector('.lb-prev'), btnNext = lb.querySelector('.lb-next');
    if (images.length < 2) { btnPrev.hidden = true; btnNext.hidden = true; }

    function show(i) {
      index = (i + images.length) % images.length;
      imgEl.src = images[index];
      imgEl.alt = title + ' – photo ' + (index + 1) + ' of ' + images.length;
      countEl.textContent = (index + 1) + ' / ' + images.length;
      [index + 1, index - 1].forEach(function (n) { // preload neighbours
        if (images.length > 1) new Image().src = images[(n + images.length) % images.length];
      });
    }
    function open(i, from) {
      opener = from || document.activeElement;
      show(i);
      lb.hidden = false;
      document.body.classList.add('lb-open');
      btnClose.focus();
    }
    function close() {
      lb.hidden = true;
      document.body.classList.remove('lb-open');
      if (opener && opener.focus) opener.focus();
    }

    wrap.addEventListener('click', function (e) {
      var t = e.target.closest('[data-index]');
      if (t && wrap.contains(t)) open(Number(t.dataset.index) || 0, t);
    });
    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { show(index - 1); });
    btnNext.addEventListener('click', function () { show(index + 1); });
    lb.addEventListener('click', function (e) { // backdrop click
      if (e.target === lb || e.target.classList.contains('lb-stage')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      else if (e.key === 'Tab') { // focus trap
        var f = Array.prototype.filter.call(lb.querySelectorAll('button'), function (b) { return !b.hidden; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    });

    // swipe
    lb.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ---------- Admin: image preview + client-side checks ---------- */
  var input = document.getElementById('images');
  var preview = document.getElementById('preview');
  if (input && preview) {
    var msg = document.getElementById('image-msg');
    var urls = [];
    var problem = function (files) {
      if (files.length < 2 || files.length > 10) return 'Choose between 2 and 10 images.';
      for (var i = 0; i < files.length; i++) {
        if (!/^image\/(jpeg|png|webp)$/.test(files[i].type)) return '"' + files[i].name + '" is not a JPG, PNG or WebP image.';
        if (files[i].size > 5 * 1024 * 1024) return '"' + files[i].name + '" is larger than 5 MB.';
      }
      return '';
    };
    input.addEventListener('change', function () {
      urls.forEach(URL.revokeObjectURL);
      urls = [];
      preview.textContent = '';
      Array.prototype.forEach.call(input.files, function (file, i) {
        var u = URL.createObjectURL(file);
        urls.push(u);
        var li = document.createElement('li');
        var im = document.createElement('img');
        im.src = u;
        im.alt = 'Preview of image ' + (i + 1);
        li.appendChild(im);
        if (i === 0) { var b = document.createElement('span'); b.className = 'badge'; b.textContent = 'Cover'; li.appendChild(b); }
        preview.appendChild(li);
      });
      var p = problem(input.files);
      msg.hidden = !p; msg.textContent = p;
    });
    document.getElementById('trip-form').addEventListener('submit', function (e) {
      var p = problem(input.files);
      if (p) { e.preventDefault(); msg.hidden = false; msg.textContent = p; input.focus(); }
    });
  }

  /* ---------- Confirm before destructive actions ---------- */
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) { if (!window.confirm(form.dataset.confirm)) e.preventDefault(); });
  });
})();
