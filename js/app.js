/* ==========================================================================
   app.js — Comportamento compartilhado por todas as páginas
   - Menu responsivo (celular)
   - Ano no rodapé
   - Carregamento dos anúncios (somente se houver ID do AdSense em config.js)
   - Utilitários de número/formatação expostos para os scripts das calculadoras
   ========================================================================== */
(function () {
  'use strict';

  /* --- Menu responsivo --------------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --- Ano no rodapé ----------------------------------------------------- */
  var y = document.querySelectorAll('[data-year]');
  for (var i = 0; i < y.length; i++) {
    y[i].textContent = new Date().getFullYear();
  }

  /* --- Anúncios (AdSense) ------------------------------------------------ */
  /* A biblioteca do AdSense é carregada diretamente no <head> de cada página.
     Este bloco apenas cria as unidades de anúncio manuais nos espaços
     .ad-slot quando um ID do AdSense estiver definido em config.js. */
  var cfg = window.SITE_CONFIG || {};
  if (cfg.adsenseClient) {
    var slots = document.querySelectorAll('.ad-slot');
    for (var s = 0; s < slots.length; s++) {
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', cfg.adsenseClient);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      var unit = slots[s].getAttribute('data-ad-slot');
      if (unit) ins.setAttribute('data-ad-slot', unit);
      slots[s].appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  /* --- Utilitários de número / formatação (pt-BR) ----------------------- */

  // Converte texto em número aceitando vírgula ou ponto como decimal.
  function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    var s = String(v).trim().replace(/\s/g, '').replace(/%/g, '');
    if (s === '') return NaN;
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
      s = s.replace(/\./g, '').replace(',', '.');   // 1.234,56 -> 1234.56
    } else if (s.indexOf(',') > -1) {
      s = s.replace(',', '.');                       // 1,5 -> 1.5
    }
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function fmtInt(n) {
    return Math.round(n).toLocaleString('da-DK');
  }

  function fmtNum(n, dec) {
    if (dec === undefined) dec = 4;
    if (!isFinite(n)) return '—';
    return n.toLocaleString('da-DK', {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    });
  }

  function fmtPct(p, dec) {
    if (dec === undefined) dec = 2;
    if (!isFinite(p)) return '—';
    return (p * 100).toLocaleString('da-DK', {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    }) + '%';
  }

  // Formata p-valor: muito pequeno vira "< 0,0001".
  function fmtP(p) {
    if (!isFinite(p)) return '—';
    if (p < 0.0001) return '< 0,0001';
    return p.toLocaleString('da-DK', {
      minimumFractionDigits: 4, maximumFractionDigits: 4
    });
  }

  function radioValue(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  window.Fmt = {
    parseNum: parseNum, int: fmtInt, num: fmtNum, pct: fmtPct,
    p: fmtP, radio: radioValue
  };
  window.parseNum = parseNum;
})();
