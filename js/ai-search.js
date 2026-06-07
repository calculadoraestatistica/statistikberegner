/* ==========================================================================
   ai-search.js — Roteador semantico de calculadoras.
   - Busca rapida BM25 (instantanea, ~50 KB, roda no momento).
   - Busca refinada por embeddings (Transformers.js, modelo ~30 MB baixado
     uma vez e cacheado pelo browser).
   - 100% no navegador: nenhuma pergunta sai do dispositivo.
   ========================================================================== */
(function (global) {
  'use strict';

  var MODEL_ID = 'Xenova/multilingual-e5-small';
  var TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
  // Limite de score (cosseno normalizado): top + alternativas dentro desta
  // distancia do melhor sao mostradas como "tambem podem servir".
  var NEAR_TOP_GAP = 0.04;
  var ALT_MAX = 3;
  // Para BM25 (sem escala normalizada), alternativas tem que ter score >= 70%
  // do top para serem mostradas.
  var BM25_ALT_RATIO = 0.70;

  var state = {
    extractor: null,
    catalog: null,
    embeddings: null,
    bm25: null,
    catalogPromise: null,
    loadingPromise: null,
    ready: false
  };

  function fmtPct(s) { return Math.round(s * 100) + '%'; }

  /* ------------------------------------------------------------------------
     Checagem de conexao — usada para decidir se rodamos preload em background.
     Respeita Save-Data e pula 2G/3G.
     ------------------------------------------------------------------------ */
  function isConnectionFast() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return true; // desconhecido — assume OK
    if (c.saveData) return false;
    var t = c.effectiveType;
    if (t === 'slow-2g' || t === '2g' || t === '3g') return false;
    return true;
  }

  /* ------------------------------------------------------------------------
     Catalogo (carregado uma vez)
     ------------------------------------------------------------------------ */
  function ensureCatalog() {
    if (state.catalogPromise) return state.catalogPromise;
    state.catalogPromise = (async function () {
      var r = await fetch('/data/calculadoras.json');
      state.catalog = await r.json();
      buildBM25Index();
      return state.catalog;
    })();
    return state.catalogPromise;
  }

  /* ------------------------------------------------------------------------
     BM25 — indice em memoria, construido a partir do catalogo
     ------------------------------------------------------------------------ */
  function normalize(s) {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(function (t) { return t && t.length > 1; });
  }
  // stop-words DA pequenas e comuns
  var STOP = (function () {
    var w = ['og','i','at','en','et','den','det','de','er','til','for','af','med','om','pa','paa','fra',
             'som','har','have','havde','var','vaere','vil','skal','kan','kunne','blive','blev','bliver',
             'jeg','du','vi','han','hun','min','mit','mine','din','dit','dine','vores','sin','sit',
             'hvad','hvor','hvordan','hvornaar','hvilken','hvilke','hvis','men','eller','sa','saa',
             'her','der','dette','denne','disse','noget','nogen','alle','ikke','vaeret','blevet'];
    var m = {}; w.forEach(function (x) { m[x] = 1; }); return m;
  })();
  function tokenize(s) {
    return normalize(s).filter(function (t) { return !STOP[t]; });
  }
  function buildBM25Index() {
    if (state.bm25) return state.bm25;
    var docs = state.catalog.map(function (item) {
      // Pesa mais o titulo e as perguntas-exemplo: duplica esses campos.
      var text = [
        item.titulo, item.titulo,
        item.resumo,
        item.tags.join(' '),
        item.perguntas_exemplo.join(' '), item.perguntas_exemplo.join(' ')
      ].join(' ');
      return tokenize(text);
    });
    var df = {}, total = 0;
    docs.forEach(function (toks) {
      total += toks.length;
      var seen = {};
      toks.forEach(function (t) {
        if (!seen[t]) { df[t] = (df[t] || 0) + 1; seen[t] = 1; }
      });
    });
    state.bm25 = { docs: docs, df: df, avgDl: total / docs.length, N: docs.length };
    return state.bm25;
  }
  function bm25Score(qToks, doc, bm) {
    var k1 = 1.5, b = 0.75;
    var tf = {}; doc.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    var dl = doc.length, score = 0;
    for (var i = 0; i < qToks.length; i++) {
      var qt = qToks[i], n = bm.df[qt]; if (!n) continue;
      var idf = Math.log(1 + (bm.N - n + 0.5) / (n + 0.5));
      var f = tf[qt] || 0;
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / bm.avgDl));
    }
    return score;
  }
  async function searchBM25(query) {
    await ensureCatalog();
    var qToks = tokenize(query);
    if (!qToks.length) return null;
    var bm = state.bm25;
    var scored = state.catalog.map(function (item, i) {
      return Object.assign({}, item, { score: bm25Score(qToks, bm.docs[i], bm) });
    }).sort(function (a, b) { return b.score - a.score; });
    scored = scored.filter(function (s) { return s.score > 0; });
    if (!scored.length) return null;
    var top = scored[0];
    var alts = [];
    for (var i = 1; i < scored.length && alts.length < ALT_MAX; i++) {
      if (scored[i].score / top.score >= BM25_ALT_RATIO) alts.push(scored[i]);
      else break;
    }
    return { top: top, alternativas: alts, all: scored, method: 'bm25' };
  }

  /* ------------------------------------------------------------------------
     Embeddings — carga do modelo (sob demanda ou via preload)
     ------------------------------------------------------------------------ */
  function cosineNormalized(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  async function ensureReady(progressCb) {
    if (state.loadingPromise) return state.loadingPromise;
    state.loadingPromise = (async function () {
      progressCb && progressCb({ stage: 'data', progress: 0.05, message: 'Henter katalog...' });

      // Tenta carregar embeddings; se ausente, segue so com BM25 (fallback silencioso).
      var catRes = await ensureCatalog();
      try {
        var embRes = await fetch('/data/embeddings.json').then(function (r) {
          if (!r.ok) throw new Error('embeddings.json indisponivel');
          return r.json();
        });
        state.embeddings = embRes.items;
      } catch (e) {
        state.embeddings = null;
        progressCb && progressCb({ stage: 'data', progress: 1, message: 'AI ikke tilgaengelig - bruger tekstsoegning.' });
        state.ready = true;
        return null;
      }

      progressCb && progressCb({ stage: 'model', progress: 0.1, message: 'Indlæser AI (~30 MB første gang, derefter cachet)...' });

      var mod = await import(TRANSFORMERS_URL);
      var seenProgress = {};
      state.extractor = await mod.pipeline('feature-extraction', MODEL_ID, {
        quantized: true,
        progress_callback: function (p) {
          if (!progressCb) return;
          if (p.status === 'progress' && typeof p.progress === 'number') {
            seenProgress[p.file] = p.progress;
            var avg = 0, n = 0;
            for (var k in seenProgress) { avg += seenProgress[k]; n++; }
            avg = n ? avg / n : 0;
            progressCb({ stage: 'model', progress: 0.1 + 0.85 * (avg / 100), message: 'Henter AI... ' + Math.round(avg) + '%' });
          } else if (p.status === 'done' || p.status === 'ready') {
            progressCb({ stage: 'model', progress: 0.97, message: 'Næsten færdig...' });
          }
        }
      });

      state.ready = true;
      progressCb && progressCb({ stage: 'ready', progress: 1, message: 'AI klar.' });
      return state.extractor;
    })();
    return state.loadingPromise;
  }

  // Preload silencioso para chamar via requestIdleCallback nas paginas certas.
  // Respeita Save-Data e pula conexoes 2G/3G — esses usuarios so baixam
  // se realmente clicarem para usar a busca.
  function preload() {
    if (state.loadingPromise || state.ready) return;
    if (!isConnectionFast()) return;
    ensureReady(function(){}).catch(function () { /* falha silenciosa */ });
  }

  /* ------------------------------------------------------------------------
     Busca semantica (embeddings)
     ------------------------------------------------------------------------ */
  async function searchAI(query) {
    if (!state.embeddings || !state.extractor) return null;  // fallback silencioso pra BM25
    var q = (query || '').trim();
    if (!q) return null;
    var out = await state.extractor('query: ' + q, { pooling: 'mean', normalize: true });
    var qv = Array.from(out.data);
    var scored = state.embeddings.map(function (e, i) {
      return Object.assign({}, state.catalog[i], { score: cosineNormalized(qv, e.embedding) });
    }).sort(function (a, b) { return b.score - a.score; });
    var top = scored[0];
    var alts = [];
    for (var i = 1; i < scored.length && alts.length < ALT_MAX; i++) {
      if (top.score - scored[i].score <= NEAR_TOP_GAP) alts.push(scored[i]);
      else break;
    }
    return { top: top, alternativas: alts, all: scored, method: 'ai' };
  }

  /* ------------------------------------------------------------------------
     API publica
     ------------------------------------------------------------------------ */
  global.CalcAISearch = {
    ensureReady: ensureReady,
    preload: preload,
    searchAI: searchAI,
    searchBM25: searchBM25,
    isReady: function () { return state.ready; },
    isConnectionFast: isConnectionFast,
    fmtPct: fmtPct
  };

})(window);
