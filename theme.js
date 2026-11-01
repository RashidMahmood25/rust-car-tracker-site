/* Rust Car Tracker — Dark (night) / Light (day) mode: switches the hero video, the map and the whole theme; the choice is remembered in localStorage. */
(function(){
    const root = document.documentElement, btn = document.getElementById('themeToggle');
    const vN = document.getElementById('vidNight'), vD = document.getElementById('vidDay');
    function apply(t){
      root.setAttribute('data-theme', t);
      btn.textContent = t === 'light' ? '🌙' : '☀️';
      if (vN && vD) {
        const day = t === 'light';
        vD.style.display = day ? '' : 'none';
        vN.style.display = day ? 'none' : '';
        try { (day ? vD : vN).play(); (day ? vN : vD).pause(); } catch(e) {}
      }
      if (window.__applyMapTheme) window.__applyMapTheme(t);
    }
    let saved = 'dark';
    try { saved = localStorage.getItem('rct-theme') || 'dark'; } catch(e) {}
    apply(saved === 'light' ? 'light' : 'dark');
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('rct-theme', next); } catch(e) {}
    });
  })();
