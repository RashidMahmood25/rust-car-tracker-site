/* Rust Car Tracker — Blog section: the latest posts from our own blog
   (AutoTech Pakistan) load live and free through Blogger's feed. */
(function () {
  var grid = document.getElementById('blogGrid');
  if (!grid) return;
  var done = false;
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fallback() {
    if (done) return; done = true;
    grid.innerHTML = '<p class="tool-info">The latest posts could not be loaded right now. <a href="https://www.autotechpakistan.abrdns.com" target="_blank" rel="noopener" style="color:var(--lime)">Visit the blog →</a></p>';
  }
  window.rwBlogFeed = function (json) {
    try {
      var entries = (json.feed && json.feed.entry) || [];
      if (!entries.length) { fallback(); return; }
      done = true;
      grid.innerHTML = entries.map(function (e) {
        var link = 'https://www.autotechpakistan.abrdns.com';
        (e.link || []).forEach(function (l) { if (l.rel === 'alternate') link = l.href; });
        var date = new Date(e.published.$t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        var img = e['media$thumbnail'] ? e['media$thumbnail'].url.replace(/\/s72-c\//, '/s400/') : '';
        var sum = (e.summary ? e.summary.$t : '').replace(/<[^>]*>/g, '').slice(0, 110);
        return '<a class="post" href="' + esc(link) + '" target="_blank" rel="noopener">' +
          (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '') +
          '<div class="p-body"><div class="p-date">' + esc(date) + '</div><h4>' + esc(e.title.$t) + '</h4><p>' + esc(sum) + '…</p></div></a>';
      }).join('');
    } catch (err) { fallback(); }
  };
  var s = document.createElement('script');
  s.src = 'https://www.autotechpakistan.abrdns.com/feeds/posts/default?alt=json-in-script&callback=rwBlogFeed&max-results=4';
  s.onerror = fallback;
  document.body.appendChild(s);
  setTimeout(fallback, 8000);
})();
