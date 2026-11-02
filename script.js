(function () {
  // Terminal typing animation
  var el = document.getElementById('typed');
  if (el) {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var lines = [
      { prompt: '$ ', text: 'whoami', kind: 'cmd' },
      { prompt: '', text: 'Lakshit', kind: 'out' },
      { prompt: '$ ', text: 'focus', kind: 'cmd' },
      { prompt: '', text: 'software, ai & building useful things', kind: 'out' }
    ];

    function renderStatic() {
      var html = '';
      lines.forEach(function (l) {
        if (l.kind === 'cmd') html += '<span class="prompt">' + l.prompt + '</span>' + l.text + '\n';
        else html += '<span class="out">' + l.text + '</span>\n';
      });
      html += '<span class="prompt">$ </span><span class="cursor">&nbsp;</span>';
      el.innerHTML = html;
    }

    if (reduced) {
      renderStatic();
    } else {
      var lineIndex = 0, charIndex = 0;
      var built = '';

      function step() {
        if (lineIndex >= lines.length) {
          el.innerHTML = built + '<span class="prompt">$ </span><span class="cursor">&nbsp;</span>';
          return;
        }
        var l = lines[lineIndex];
        var full = l.prompt + l.text;
        charIndex++;
        var partial = full.slice(0, charIndex);
        var cls = l.kind === 'cmd' ? 'prompt' : 'out';
        var prefix = l.kind === 'cmd' && charIndex >= l.prompt.length
          ? '<span class="' + cls + '">' + l.prompt + '</span>' + partial.slice(l.prompt.length)
          : '<span class="' + cls + '">' + partial + '</span>';
        el.innerHTML = built + prefix + '<span class="cursor">&nbsp;</span>';

        if (charIndex >= full.length) {
          built += (l.kind === 'cmd'
            ? '<span class="' + cls + '">' + l.prompt + '</span>' + l.text.slice(0)
            : '<span class="' + cls + '">' + l.text + '</span>') + '\n';
          lineIndex++;
          charIndex = 0;
          setTimeout(step, 220);
        } else {
          setTimeout(step, 24 + Math.random() * 30);
        }
      }

      setTimeout(step, 400);
    }
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        if (history.pushState) {
          history.pushState(null, null, targetId);
        }
      }
    });
  });

  // Active section scroll-spy
  var navLinks = document.querySelectorAll('nav.topbar ul a, .side-link');
  var sections = document.querySelectorAll('section[id], header[id]');

  function updateActiveSection() {
    var scrollPos = (window.pageYOffset || document.documentElement.scrollTop) + 120;
    var currentId = '';

    sections.forEach(function (sec) {
      var rect = sec.getBoundingClientRect();
      var top = rect.top + (window.pageYOffset || document.documentElement.scrollTop);
      var height = sec.offsetHeight;
      if (scrollPos >= top - 20 && scrollPos < top + height) {
        currentId = sec.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      if (link.getAttribute('href') === '#' + currentId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveSection, { passive: true });
  updateActiveSection();

  // Copy-to-clipboard handler
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        var original = btn.textContent;
        btn.textContent = 'copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      }).catch(function () {
        prompt('Copy email:', text);
      });
    });
  });

  // Wallpaper blur & Anime theme toggle handler
  var STORAGE_KEY = 'itznan_wallpaper_theme';
  var wallpaperToggles = document.querySelectorAll('.js-wallpaper-toggle');
  var metaTheme = document.getElementById('meta-theme-color');

  function setWallpaperState(enabled) {
    if (enabled) {
      document.body.classList.add('wallpaper-active');
      document.documentElement.setAttribute('data-theme', 'anime-wallpaper');
      if (metaTheme) metaTheme.setAttribute('content', '#060709');
      try { localStorage.setItem(STORAGE_KEY, 'enabled'); } catch (e) {}
    } else {
      document.body.classList.remove('wallpaper-active');
      document.documentElement.removeAttribute('data-theme');
      if (metaTheme) metaTheme.setAttribute('content', '#0A0C0E');
      try { localStorage.setItem(STORAGE_KEY, 'disabled'); } catch (e) {}
    }

    wallpaperToggles.forEach(function (btn) {
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      var statusSpan = btn.querySelector('.wp-status');
      if (statusSpan) {
        statusSpan.textContent = enabled ? 'On' : 'Off';
      }
      if (enabled) {
        btn.classList.add('active');
        btn.setAttribute('title', 'Disable wallpaper theme');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('title', 'Enable wallpaper theme');
      }
    });
  }

  // Restore state from localStorage (defaults to ON)
  var savedState = null;
  try {
    savedState = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}

  var isInitialEnabled = savedState !== 'disabled';
  setWallpaperState(isInitialEnabled);

  wallpaperToggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var currentlyActive = document.body.classList.contains('wallpaper-active') ||
                            document.documentElement.getAttribute('data-theme') === 'anime-wallpaper';
      setWallpaperState(!currentlyActive);
    });
  });
})();