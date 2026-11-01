(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");

  function savedTheme() {
    try {
      var value = localStorage.getItem("theme");
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function systemTheme() {
    return media.matches ? "dark" : "light";
  }

  function effectiveTheme() {
    return savedTheme() || systemTheme();
  }

  function applyTheme() {
    var saved = savedTheme();
    if (saved) root.setAttribute("data-theme", saved);
    else root.removeAttribute("data-theme");
    var mode = effectiveTheme();
    root.setAttribute("data-bs-theme", mode);
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    if (!saved) {
      button.setAttribute(
        "aria-label",
        mode === "dark"
          ? "Tema mengikuti perangkat (gelap). Ubah ke tema terang."
          : "Tema mengikuti perangkat (terang). Ubah ke tema gelap."
      );
    } else {
      button.setAttribute(
        "aria-label",
        mode === "dark" ? "Tema gelap aktif. Ubah ke tema terang." : "Tema terang aktif. Ubah ke tema gelap."
      );
    }
    button.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
  }

  function toggleTheme() {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    try {
      if (next === systemTheme()) localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch (error) {
      root.setAttribute("data-theme", next);
    }
    applyTheme();
  }

  var themeButton = document.getElementById("theme-toggle");
  if (themeButton) themeButton.addEventListener("click", toggleTheme);
  var onSchemeChange = function () {
    if (!savedTheme()) applyTheme();
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onSchemeChange);
  else if (typeof media.addListener === "function") media.addListener(onSchemeChange);
  applyTheme();

  var boxes = document.querySelectorAll(".checklist input[type='checkbox']");
  if (boxes.length) {
    var key = "ha-checks:" + location.pathname;
    var savedChecks = {};
    try {
      savedChecks = JSON.parse(localStorage.getItem(key) || "{}");
    } catch (error) {
      savedChecks = {};
    }
    Array.prototype.forEach.call(boxes, function (box, index) {
      box.checked = Boolean(savedChecks[index]);
      box.addEventListener("change", function () {
        savedChecks[index] = box.checked;
        try {
          localStorage.setItem(key, JSON.stringify(savedChecks));
        } catch (error) {
          /* storage can be unavailable */
        }
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function slugifyHeading(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "bagian";
  }

  function syncTocFromHeadings() {
    var body = document.querySelector(".article-body");
    var list = document.querySelector("[data-toc] .toc-list");
    if (!body || !list) return;
    var headings = body.querySelectorAll("h2");
    if (!headings.length) {
      var nav = document.querySelector("[data-toc]");
      if (nav) nav.hidden = true;
      return;
    }
    var used = {};
    var html = "";
    Array.prototype.forEach.call(headings, function (heading) {
      var title = heading.textContent.replace(/\s+/g, " ").trim();
      if (!title) return;
      var id = heading.id || slugifyHeading(title);
      var base = id;
      var n = 2;
      while (used[id] || document.getElementById(id) && document.getElementById(id) !== heading) {
        id = base + "-" + n;
        n += 1;
      }
      used[id] = true;
      heading.id = id;
      html += '<li><a href="#' + escapeHtml(id) + '">' + escapeHtml(title) + "</a></li>";
    });
    list.innerHTML = html;
  }

  syncTocFromHeadings();

  function headerOffset() {
    var header = document.querySelector(".site-header") || document.querySelector(".site-nav");
    return (header ? header.getBoundingClientRect().height : 70) + 8;
  }

  function syncScrollMargin() {
    var offset = headerOffset() + "px";
    var nodes = document.querySelectorAll("h2[id], h3[id], .faq-section[id], #authors");
    nodes.forEach(function (node) {
      node.style.scrollMarginTop = offset;
    });
  }

  // Keep scroll-margin matched to live header height so # jumps land
  // just under the sticky nav (Notion-style).
  syncScrollMargin();
  window.addEventListener("resize", syncScrollMargin);

  function scrollToId(id, updateHash) {
    if (!id) return false;
    var target = document.getElementById(id);
    if (!target) return false;
    syncScrollMargin();
    // Explicit scroll avoids native hash races with late image layout,
    // which can leave the viewport short of the real target (e.g. FAQ).
    var top = Math.max(
      0,
      window.pageYOffset + target.getBoundingClientRect().top - headerOffset()
    );
    window.scrollTo(0, top);
    if (updateHash && location.hash !== "#" + id) {
      try {
        history.pushState(null, "", "#" + id);
      } catch (error) {
        location.hash = id;
      }
    }
    return true;
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href === "#") return;
      var id = decodeURIComponent(href.slice(1));
      if (!document.getElementById(id)) return;
      event.preventDefault();
      scrollToId(id, true);
      // Re-assert after layout/images settle.
      window.setTimeout(function () {
        scrollToId(id, false);
      }, 100);
    },
    true
  );

  var hashScrollToken = 0;

  function scrollToHash() {
    if (!location.hash || location.hash.length < 2) return;
    var id = decodeURIComponent(location.hash.slice(1));
    if (!document.getElementById(id)) return;
    var token = (hashScrollToken += 1);
    var expectedHash = "#" + id;

    function stillCurrent() {
      return token === hashScrollToken && location.hash === expectedHash;
    }

    function tick() {
      if (!stillCurrent()) return;
      scrollToId(id, false);
    }

    tick();
    // Native address-bar jumps can undershoot while lazy images above the
    // target are still unresolved; re-assert as layout settles.
    [50, 100, 250, 500, 1000].forEach(function (ms) {
      window.setTimeout(tick, ms);
    });
    Array.prototype.forEach.call(document.images, function (img) {
      if (img.complete) return;
      img.addEventListener("load", tick, { once: true });
      img.addEventListener("error", tick, { once: true });
    });
  }

  window.setTimeout(scrollToHash, 0);
  window.addEventListener("load", scrollToHash);

  function openFaqFromHash() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash) return;
    var section = document.getElementById(hash);
    if (!section || !section.classList.contains("faq-section")) return;
    var panel = section.querySelector(".accordion-collapse");
    var button = section.querySelector(".faq-toggle");
    if (!panel || !window.bootstrap) return;
    var collapse = window.bootstrap.Collapse.getOrCreateInstance(panel, { toggle: false });
    collapse.show();
    if (button) button.classList.remove("collapsed");
  }

  openFaqFromHash();
  // Address-bar hash edits fire hashchange (not click/load). Without this,
  // native scroll can stop short at the previous section (e.g. Anggaran).
  window.addEventListener("hashchange", function () {
    openFaqFromHash();
    scrollToHash();
  });

  function initFaqPagination() {
    var root = document.getElementById("faq-accordion");
    if (!root) return;
    var perPage = parseInt(root.getAttribute("data-faq-per-page") || "5", 10);
    if (!perPage || perPage < 1) perPage = 5;

    Array.prototype.forEach.call(root.querySelectorAll(".faq-body"), function (body) {
      var items = body.querySelectorAll("[data-faq-item]");
      var pager = body.querySelector("[data-faq-pagination]");
      if (!items.length || !pager) return;

      var page = 1;
      var totalPages = Math.ceil(items.length / perPage);
      var prev = pager.querySelector("[data-faq-prev]");
      var next = pager.querySelector("[data-faq-next]");
      var status = pager.querySelector("[data-faq-status]");

      function render() {
        var start = (page - 1) * perPage;
        var end = start + perPage;
        Array.prototype.forEach.call(items, function (item, index) {
          item.hidden = index < start || index >= end;
        });
        if (totalPages <= 1) {
          pager.hidden = true;
          return;
        }
        pager.hidden = false;
        status.textContent = "Halaman " + page + " / " + totalPages;
        prev.disabled = page <= 1;
        next.disabled = page >= totalPages;
      }

      prev.addEventListener("click", function () {
        if (page > 1) {
          page -= 1;
          render();
        }
      });
      next.addEventListener("click", function () {
        if (page < totalPages) {
          page += 1;
          render();
        }
      });
      render();
    });
  }

  initFaqPagination();

  function safeUrl(url) {
    return typeof url === "string" && url.charAt(0) === "/" ? url : "#";
  }

  function foldMap(inputText) {
    var chars = Array.from(inputText);
    var folded = "";
    var indexAt = [];
    chars.forEach(function (ch, index) {
      var piece = ch.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
      for (var i = 0; i < piece.length; i += 1) indexAt.push(index);
      folded += piece;
    });
    return { chars: chars, folded: folded, indexAt: indexAt };
  }

  function fold(value) {
    return String(value).normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  }

  function highlight(text, terms) {
    if (!terms.length) return escapeHtml(text);
    var map = foldMap(text);
    var ranges = [];
    terms.forEach(function (term) {
      var from = 0;
      while (from < map.folded.length) {
        var found = map.folded.indexOf(term, from);
        if (found === -1) break;
        var end = found + term.length - 1;
        if (map.indexAt[found] !== undefined && map.indexAt[end] !== undefined) {
          ranges.push([map.indexAt[found], map.indexAt[end] + 1]);
        }
        from = found + Math.max(term.length, 1);
      }
    });
    if (!ranges.length) return escapeHtml(text);
    ranges.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1];
    });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (!last || range[0] > last[1]) merged.push(range.slice());
      else last[1] = Math.max(last[1], range[1]);
    });
    var htmlText = "";
    var cursor = 0;
    merged.forEach(function (range) {
      htmlText += escapeHtml(map.chars.slice(cursor, range[0]).join(""));
      htmlText += "<mark>" + escapeHtml(map.chars.slice(range[0], range[1]).join("")) + "</mark>";
      cursor = range[1];
    });
    htmlText += escapeHtml(map.chars.slice(cursor).join(""));
    return htmlText;
  }

  function snippet(content, terms) {
    var clean = String(content || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    var map = foldMap(clean);
    var at = -1;
    terms.some(function (term) {
      at = map.folded.indexOf(term);
      return at !== -1;
    });
    if (at === -1) return clean.slice(0, 180);
    var charAt = map.indexAt[at] || 0;
    var start = Math.max(0, charAt - 70);
    var end = Math.min(clean.length, charAt + 150);
    var slice = clean.slice(start, end).trim();
    return (start > 0 ? "… " : "") + slice + (end < clean.length ? " …" : "");
  }

  function rankDocuments(documents, query) {
    var terms = fold(query)
      .split(/\s+/)
      .filter(function (term) {
        return term.length >= 2;
      });
    if (!terms.length) return [];
    return documents
      .filter(function (doc) {
        var title = fold(doc.title);
        var content = fold(doc.content || "");
        return terms.every(function (term) {
          return title.indexOf(term) !== -1 || content.indexOf(term) !== -1;
        });
      })
      .map(function (doc) {
        var title = fold(doc.title);
        var content = fold(doc.content || "");
        var score = 0;
        terms.forEach(function (term) {
          if (title.indexOf(term) !== -1) score += 5;
          if (content.indexOf(term) !== -1) score += 1;
        });
        if (title.indexOf(fold(query)) !== -1) score += 6;
        return { doc: doc, score: score, terms: terms };
      })
      .sort(function (a, b) {
        return b.score - a.score || a.doc.order - b.doc.order;
      });
  }

  var indexUrl = document.body.dataset.searchIndex;
  var searchDocuments = null;
  var searchPromise = null;

  function loadSearchIndex() {
    if (searchDocuments) return Promise.resolve(searchDocuments);
    if (searchPromise) return searchPromise;
    if (!indexUrl) return Promise.resolve([]);
    searchPromise = fetch(indexUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("index");
        return response.json();
      })
      .then(function (data) {
        searchDocuments = data;
        return data;
      })
      .catch(function () {
        searchDocuments = [];
        return searchDocuments;
      });
    return searchPromise;
  }

  var LIVE_LIMIT = 3;
  var headerInput = document.getElementById("q");
  var suggestBox = document.getElementById("search-suggest");
  var searchForm = document.querySelector("[data-live-search]");

  function hideSuggest() {
    if (!suggestBox || !headerInput) return;
    suggestBox.hidden = true;
    suggestBox.innerHTML = "";
    headerInput.setAttribute("aria-expanded", "false");
  }

  function renderSuggest(query, found) {
    if (!suggestBox || !headerInput) return;
    var terms = found.length ? found[0].terms : [];
    var visible = found.slice(0, LIVE_LIMIT);
    var html = "";
    if (!visible.length) {
      html = '<p class="suggest-empty">Tidak ada hasil untuk "' + escapeHtml(query.trim()) + '".</p>';
    } else {
      html = visible
        .map(function (item) {
          var doc = item.doc;
          return (
            '<a role="option" href="' +
            safeUrl(doc.url) +
            '"><span class="suggest-section">' +
            escapeHtml(doc.section || "") +
            '</span><span class="suggest-title">' +
            highlight(doc.title, terms) +
            "</span></a>"
          );
        })
        .join("");
      if (found.length > LIVE_LIMIT) {
        html +=
          '<a class="search-more" role="option" href="' +
          safeUrl("/search/?q=" + encodeURIComponent(query.trim())) +
          '">Cari selengkapnya (' +
          found.length +
          " hasil)</a>";
      }
    }
    suggestBox.innerHTML = html;
    suggestBox.hidden = false;
    headerInput.setAttribute("aria-expanded", "true");
  }

  if (headerInput && suggestBox) {
    var liveTimer = 0;
    headerInput.addEventListener("input", function () {
      window.clearTimeout(liveTimer);
      var value = headerInput.value;
      liveTimer = window.setTimeout(function () {
        var terms = fold(value)
          .split(/\s+/)
          .filter(function (term) {
            return term.length >= 2;
          });
        if (!value.trim() || !terms.length) {
          hideSuggest();
          return;
        }
        loadSearchIndex().then(function (docs) {
          renderSuggest(value, rankDocuments(docs, value));
        });
      }, 120);
    });
    headerInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") hideSuggest();
    });
    document.addEventListener("click", function (event) {
      if (!searchForm) return;
      if (!searchForm.parentElement.contains(event.target)) hideSuggest();
    });
  }

  var searchRoot = document.getElementById("search-page");
  if (!searchRoot || !indexUrl) return;

  var status = document.getElementById("search-status");
  var results = document.getElementById("search-results");
  var directory = document.getElementById("search-directory");
  var input = document.getElementById("search-input");
  var documents = [];

  function renderDirectory() {
    var guides = documents.filter(function (doc) {
      return doc.url !== "/";
    });
    var groups = [];
    var bySection = new Map();
    guides.forEach(function (doc) {
      if (!bySection.has(doc.section)) {
        var group = { section: doc.section, items: [] };
        bySection.set(doc.section, group);
        groups.push(group);
      }
      bySection.get(doc.section).items.push(doc);
    });
    directory.innerHTML = groups
      .map(function (group) {
        var items = group.items
          .map(function (doc) {
            return (
              '<li><a href="' +
              safeUrl(doc.url) +
              '"><span>' +
              escapeHtml(doc.title) +
              "</span><time datetime=\"" +
              escapeHtml(doc.updated) +
              '">' +
              escapeHtml(doc.updated_display) +
              "</time></a></li>"
            );
          })
          .join("");
        return (
          '<section class="guide-index"><h2>' +
          escapeHtml(group.section) +
          "</h2><ul>" +
          items +
          "</ul></section>"
        );
      })
      .join("");
    results.innerHTML = "";
    status.textContent = guides.length + " artikel.";
  }

  function renderResults(query) {
    var terms = fold(query)
      .split(/\s+/)
      .filter(function (term) {
        return term.length >= 2;
      });
    if (query.trim().length > 0 && !terms.length) {
      directory.innerHTML = "";
      results.innerHTML = "";
      status.textContent = "Ketik minimal 2 huruf.";
      return;
    }
    if (!terms.length) {
      renderDirectory();
      return;
    }
    var found = rankDocuments(documents, query);
    directory.innerHTML = "";
    if (!found.length) {
      results.innerHTML = "";
      status.textContent = 'Tidak ada artikel untuk "' + query.trim() + '".';
      return;
    }
    status.textContent = found.length + ' artikel untuk "' + query.trim() + '".';
    results.innerHTML = found
      .map(function (item) {
        var doc = item.doc;
        return (
          '<li><a href="' +
          safeUrl(doc.url) +
          '"><span class="result-section">' +
          escapeHtml(doc.section) +
          '</span><span class="result-title">' +
          highlight(doc.title, terms) +
          '</span><p class="result-snippet">' +
          highlight(snippet(doc.content || "", terms), terms) +
          "</p></a></li>"
        );
      })
      .join("");
  }

  function syncQuery(value, updateUrl) {
    input.value = value;
    if (headerInput) headerInput.value = value;
    renderResults(value);
    if (updateUrl) {
      var url = new URL(location.href);
      if (value.trim()) url.searchParams.set("q", value.trim());
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
    }
  }

  loadSearchIndex()
    .then(function (data) {
      documents = data;
      syncQuery(new URLSearchParams(location.search).get("q") || "", false);
      var timer = 0;
      input.addEventListener("input", function () {
        window.clearTimeout(timer);
        var value = input.value;
        timer = window.setTimeout(function () {
          syncQuery(value, true);
        }, 120);
      });
    })
    .catch(function () {
      status.textContent = "Pencarian tidak dapat dimuat. Muat ulang halaman ini.";
    });
})();
