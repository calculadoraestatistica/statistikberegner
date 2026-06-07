/* ==========================================================================
   stats.js — Núcleo estatístico da Calculadora Estatística
   Funções puras, sem DOM. Funciona no navegador e no Node (para testes).

   Implementações numéricas baseadas em algoritmos clássicos:
   - erfcc / normalCDF ............ Numerical Recipes (erro relativo < 1,2e-7)
   - normalInv .................... algoritmo de Peter Acklam (erro ~1e-9)
   - gammaln ...................... aproximação de Lanczos
   - betai / betacf ............... função beta incompleta (Numerical Recipes)
   - tCDF ......................... CDF da t de Student via beta incompleta
   ========================================================================== */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------------------
     1) Funções especiais
     ---------------------------------------------------------------------- */

  // ln( Gamma(x) ) — aproximação de Lanczos
  function gammaln(x) {
    var cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  // Fração contínua para a função beta incompleta
  function betacf(a, b, x) {
    var MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // Função beta incompleta regularizada I_x(a, b)
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) +
                      a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) {
      return bt * betacf(a, b, x) / a;
    }
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /* ----------------------------------------------------------------------
     2) Distribuição normal padrão
     ---------------------------------------------------------------------- */

  function normalPDF(z) {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  // erfc(x) — aproximação de Chebyshev (Numerical Recipes)
  function erfcc(x) {
    var z = Math.abs(x);
    var t = 1 / (1 + 0.5 * z);
    var ans = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 +
      t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? ans : 2 - ans;
  }

  // CDF da normal padrão: P(Z <= z)
  function normalCDF(z) {
    return 0.5 * erfcc(-z / Math.SQRT2);
  }

  // Inversa da CDF normal — algoritmo de Peter Acklam, refinado por Halley
  function normalInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02,
             -2.759285104469687e+02, 1.383577518672690e+02,
             -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02,
             -1.556989798598866e+02, 6.680131188771972e+01,
             -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01,
             -2.400758277161838e+00, -2.549732539343734e+00,
             4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01,
             2.445134137142996e+00, 3.754408661907416e+00];
    var plow = 0.02425, phigh = 1 - plow, q, r, x;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
          ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= phigh) {
      q = p - 0.5; r = q * q;
      x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
          (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
    var e = normalCDF(x) - p;
    var u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
    return x;
  }

  /* ----------------------------------------------------------------------
     3) Distribuição t de Student
     ---------------------------------------------------------------------- */

  // CDF da t de Student: P(T <= t) com df graus de liberdade
  function tCDF(t, df) {
    var x = df / (df + t * t);
    var ib = betai(df / 2, 0.5, x);
    return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }

  // p-valor bicaudal de uma estatística t: P(|T| >= |t|)
  function tTwoTailedP(t, df) {
    return betai(df / 2, 0.5, df / (df + t * t));
  }

  // Inversa da CDF da t de Student (bissecção)
  function tInv(p, df) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var lo = -1e4, hi = 1e4, mid;
    for (var i = 0; i < 200; i++) {
      mid = 0.5 * (lo + hi);
      if (tCDF(mid, df) < p) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  /* ----------------------------------------------------------------------
     4) Utilidades de teste de hipótese
     ---------------------------------------------------------------------- */

  // z crítico para um nível de confiança (intervalo bilateral)
  function zCritical(confidence) {
    return normalInv(1 - (1 - confidence) / 2);
  }

  // p-valor a partir de uma estatística z
  function zPValue(z, tails) {
    var pTwo = 2 * (1 - normalCDF(Math.abs(z)));
    return tails === 1 ? pTwo / 2 : pTwo;
  }

  /* ----------------------------------------------------------------------
     5) Testes de alto nível — recebem objeto, devolvem objeto de resultado
        Em caso de entrada inválida devolvem { error: 'mensagem' }.
     ---------------------------------------------------------------------- */

  // -- Teste A/B / comparação de duas proporções ---------------------------
  function abTest(o) {
    var nA = o.nA, xA = o.xA, nB = o.nB, xB = o.xB;
    var confidence = o.confidence, tails = o.tails || 2;
    if (!(nA > 0) || !(nB > 0)) return { error: 'Antallet af besøgende skal være større end nul.' };
    if (xA < 0 || xB < 0) return { error: 'Antallet af konverteringer kan ikke være negativt.' };
    if (xA > nA || xB > nB) return { error: 'Konverteringerne kan ikke overstige antallet af besøgende.' };

    var pA = xA / nA, pB = xB / nB;
    var pooled = (xA + xB) / (nA + nB);
    var sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
    if (sePooled === 0) {
      return { error: 'Ingen variation i dataene (0 % eller 100 % i begge grupper): testen kan ikke anvendes.' };
    }
    var z = (pB - pA) / sePooled;
    var alpha = 1 - confidence;
    var pValue = zPValue(z, tails);
    if (tails === 1) {
      // unicaudal: p-valor para a hipótese de que B supera A
      pValue = 1 - normalCDF(z);
    }
    var significant = pValue < alpha;

    var absDiff = pB - pA;
    var relUplift = pA > 0 ? absDiff / pA : null;
    // IC para a diferença — erro-padrão não combinado (não assume H0)
    var seUnpooled = Math.sqrt(pA * (1 - pA) / nA + pB * (1 - pB) / nB);
    var zc = zCritical(confidence);
    return {
      pA: pA, pB: pB, pooled: pooled,
      z: z, pValue: pValue, alpha: alpha, confidence: confidence, tails: tails,
      significant: significant,
      absDiff: absDiff, relUplift: relUplift,
      ciLow: absDiff - zc * seUnpooled,
      ciHigh: absDiff + zc * seUnpooled,
      winner: absDiff > 0 ? 'B' : (absDiff < 0 ? 'A' : 'empate')
    };
  }

  // -- Tamanho de amostra para teste A/B (duas proporções) -----------------
  // Fórmula de Fleiss (aproximação normal). p1, p2 em proporção (0–1).
  function abSampleSize(o) {
    var p1 = o.p1, p2 = o.p2;
    var confidence = o.confidence, power = o.power, tails = o.tails || 2;
    if (!(p1 > 0) || !(p1 < 1) || !(p2 > 0) || !(p2 < 1)) {
      return { error: 'Konverteringsraterne skal være mellem 0 % og 100 %.' };
    }
    if (p1 === p2) return { error: 'Den forventede rate skal være forskellig fra den nuværende rate.' };
    var alpha = 1 - confidence;
    var za = tails === 2 ? normalInv(1 - alpha / 2) : normalInv(1 - alpha);
    var zb = normalInv(power);
    var pbar = (p1 + p2) / 2;
    var num = za * Math.sqrt(2 * pbar * (1 - pbar)) +
              zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    var perVariant = Math.ceil((num * num) / Math.pow(p2 - p1, 2));
    return { perVariant: perVariant, total: perVariant * 2, p1: p1, p2: p2 };
  }

  // -- Teste t de Student --------------------------------------------------
  // o.mode: 'one' | 'two' | 'paired'
  function tTest(o) {
    var tails = o.tails || 2, confidence = o.confidence, mu0 = o.mu0 || 0;
    var t, df, se, estimate, estimateLabel;

    if (o.mode === 'one') {
      if (!(o.n >= 2)) return { error: 'Stikprøven skal indeholde mindst 2 observationer.' };
      if (!(o.sd > 0)) return { error: 'Standardafvigelsen skal være større end nul.' };
      se = o.sd / Math.sqrt(o.n);
      t = (o.mean - mu0) / se;
      df = o.n - 1;
      estimate = o.mean; estimateLabel = 'media';
    } else if (o.mode === 'paired') {
      if (!(o.n >= 2)) return { error: 'Stikprøven skal indeholde mindst 2 par.' };
      if (!(o.sdDiff > 0)) return { error: 'Standardafvigelsen for forskellene skal være større end nul.' };
      se = o.sdDiff / Math.sqrt(o.n);
      t = (o.meanDiff - mu0) / se;
      df = o.n - 1;
      estimate = o.meanDiff; estimateLabel = 'diferenca';
    } else { // 'two' — teste de Welch (não assume variâncias iguais)
      if (!(o.n1 >= 2) || !(o.n2 >= 2)) return { error: 'Hver stikprøve skal indeholde mindst 2 observationer.' };
      if (!(o.sd1 > 0) || !(o.sd2 > 0)) return { error: 'Standardafvigelserne skal være større end nul.' };
      var v1 = o.sd1 * o.sd1 / o.n1, v2 = o.sd2 * o.sd2 / o.n2;
      se = Math.sqrt(v1 + v2);
      t = (o.mean1 - o.mean2 - mu0) / se;
      df = Math.pow(v1 + v2, 2) /
           (v1 * v1 / (o.n1 - 1) + v2 * v2 / (o.n2 - 1));
      estimate = o.mean1 - o.mean2; estimateLabel = 'diferenca';
    }

    var pTwo = tTwoTailedP(t, df);
    var pValue = tails === 1 ? pTwo / 2 : pTwo;
    var alpha = 1 - confidence;
    var tc = tInv(1 - alpha / 2, df);
    return {
      t: t, df: df, se: se, pValue: pValue, pTwoTailed: pTwo,
      alpha: alpha, confidence: confidence, tails: tails,
      significant: pValue < alpha,
      estimate: estimate, estimateLabel: estimateLabel,
      ciLow: estimate - tc * se, ciHigh: estimate + tc * se,
      tCritical: tc
    };
  }

  // -- Teste z para uma média (desvio padrão populacional conhecido) -------
  function zTest(o) {
    if (!(o.n >= 1)) return { error: 'Stikprøvestørrelsen skal være mindst 1.' };
    if (!(o.sigma > 0)) return { error: 'Populationens standardafvigelse skal være større end nul.' };
    var tails = o.tails || 2, confidence = o.confidence, mu0 = o.mu0 || 0;
    var se = o.sigma / Math.sqrt(o.n);
    var z = (o.mean - mu0) / se;
    var pValue = zPValue(z, tails);
    var alpha = 1 - confidence;
    var zc = zCritical(confidence);
    return {
      z: z, se: se, pValue: pValue, alpha: alpha,
      confidence: confidence, tails: tails,
      significant: pValue < alpha,
      estimate: o.mean, ciLow: o.mean - zc * se, ciHigh: o.mean + zc * se,
      zCritical: zc
    };
  }

  // -- Teste z para uma proporção -----------------------------------------
  function oneProportionTest(o) {
    if (!(o.n > 0)) return { error: 'Stikprøvestørrelsen skal være større end nul.' };
    if (o.x < 0 || o.x > o.n) return { error: 'Antallet af succeser skal være mellem 0 og n.' };
    if (!(o.p0 > 0) || !(o.p0 < 1)) return { error: 'Den hypotetiske proportion skal være mellem 0 % og 100 %.' };
    var tails = o.tails || 2, confidence = o.confidence;
    var phat = o.x / o.n;
    var se0 = Math.sqrt(o.p0 * (1 - o.p0) / o.n);
    var z = (phat - o.p0) / se0;
    var pValue = zPValue(z, tails);
    var alpha = 1 - confidence;
    var ci = wilsonInterval(o.x, o.n, confidence);
    return {
      phat: phat, z: z, pValue: pValue, alpha: alpha,
      confidence: confidence, tails: tails,
      significant: pValue < alpha,
      ciLow: ci.low, ciHigh: ci.high
    };
  }

  // Intervalo de Wilson (score) para uma proporção — mais preciso que o Wald
  function wilsonInterval(x, n, confidence) {
    var z = zCritical(confidence);
    var phat = x / n, z2 = z * z;
    var denom = 1 + z2 / n;
    var center = (phat + z2 / (2 * n)) / denom;
    var half = (z / denom) *
               Math.sqrt(phat * (1 - phat) / n + z2 / (4 * n * n));
    return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
  }

  // -- Intervalo de confiança ---------------------------------------------
  // o.mode: 'mean' | 'proportion'
  function confidenceInterval(o) {
    var confidence = o.confidence;
    if (o.mode === 'proportion') {
      if (!(o.n > 0)) return { error: 'Stikprøvestørrelsen skal være større end nul.' };
      if (o.x < 0 || o.x > o.n) return { error: 'Succeserne skal være mellem 0 og n.' };
      var ci = wilsonInterval(o.x, o.n, confidence);
      var phat = o.x / o.n;
      return {
        mode: 'proportion', estimate: phat,
        ciLow: ci.low, ciHigh: ci.high,
        marginError: (ci.high - ci.low) / 2
      };
    }
    // média
    if (!(o.n >= 2)) return { error: 'Stikprøven skal indeholde mindst 2 observationer.' };
    if (!(o.sd > 0)) return { error: 'Standardafvigelsen skal være større end nul.' };
    var se = o.sd / Math.sqrt(o.n);
    var crit, dist;
    if (o.sdKnown) { crit = zCritical(confidence); dist = 'z'; }
    else { crit = tInv(1 - (1 - confidence) / 2, o.n - 1); dist = 't'; }
    var me = crit * se;
    return {
      mode: 'mean', estimate: o.mean, se: se, marginError: me,
      ciLow: o.mean - me, ciHigh: o.mean + me, distribution: dist,
      critical: crit, df: o.n - 1
    };
  }

  // -- Tamanho de amostra para pesquisas (estimar uma proporção) ----------
  function surveySampleSize(o) {
    var confidence = o.confidence, E = o.marginError;
    var p = (o.proportion === undefined || o.proportion === null) ? 0.5 : o.proportion;
    if (!(E > 0) || !(E < 1)) return { error: 'Fejlmarginen skal være mellem 0 % og 100 %.' };
    if (!(p >= 0) || !(p <= 1)) return { error: 'Den forventede proportion skal være mellem 0 % og 100 %.' };
    var z = zCritical(confidence);
    var n0 = (z * z * p * (1 - p)) / (E * E);
    var n = n0;
    if (o.population && o.population > 0) {
      n = n0 / (1 + (n0 - 1) / o.population);
    }
    return { n: Math.ceil(n), nInfinite: Math.ceil(n0), z: z };
  }

  /* ----------------------------------------------------------------------
     6) Função gama incompleta — distribuições qui-quadrado e F
     ---------------------------------------------------------------------- */

  // Série para a função gama incompleta inferior regularizada
  function gser(a, x) {
    var ITMAX = 300, EPS = 3e-12;
    var gln = gammaln(a);
    if (x <= 0) return 0;
    var ap = a, sum = 1 / a, del = sum;
    for (var n = 0; n < ITMAX; n++) {
      ap++; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }

  // Fração contínua para a função gama incompleta superior
  function gcf(a, x) {
    var ITMAX = 300, EPS = 3e-12, FPMIN = 1e-300;
    var gln = gammaln(a);
    var b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (var i = 1; i <= ITMAX; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
  }

  // P(a,x): função gama incompleta inferior regularizada
  function gammp(a, x) {
    if (x <= 0 || a <= 0) return 0;
    if (x < a + 1) return gser(a, x);
    return 1 - gcf(a, x);
  }

  // CDF da distribuição qui-quadrado com df graus de liberdade
  function chiSquareCDF(x, df) {
    if (x <= 0) return 0;
    return gammp(df / 2, x / 2);
  }

  // CDF da distribuição F com df1 e df2 graus de liberdade
  function fCDF(f, df1, df2) {
    if (f <= 0) return 0;
    return betai(df1 / 2, df2 / 2, df1 * f / (df1 * f + df2));
  }

  /* ----------------------------------------------------------------------
     7) Postos (ranks) — base dos testes não-paramétricos
     ---------------------------------------------------------------------- */

  // Devolve os postos 1-based (posto médio nos empates) e a soma de (t³−t)
  function ranksWithTies(values) {
    var n = values.length;
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return values[a] - values[b]; });
    var r = new Array(n), tieSum = 0, i = 0;
    while (i < n) {
      var j = i;
      while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
      var avg = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[order[k]] = avg;
      var t = j - i + 1;
      tieSum += t * t * t - t;
      i = j + 1;
    }
    return { ranks: r, tieSum: tieSum };
  }

  /* ----------------------------------------------------------------------
     8) Qui-quadrado, ANOVA e testes não-paramétricos
     ---------------------------------------------------------------------- */

  // Teste qui-quadrado de independência. o.table: matriz [linhas][colunas].
  function chiSquareTest(o) {
    var table = o.table, confidence = o.confidence;
    var R = table.length;
    if (R < 2) return { error: 'Tabellen skal have mindst 2 rækker.' };
    var C = table[0].length;
    if (C < 2) return { error: 'Tabellen skal have mindst 2 kolonner.' };
    var rowT = [], colT = [], grand = 0;
    for (var i = 0; i < R; i++) {
      if (table[i].length !== C) return { error: 'Alle rækker skal have samme antal kolonner.' };
      rowT[i] = 0;
      for (var j = 0; j < C; j++) {
        var v = table[i][j];
        if (!isFinite(v) || v < 0) return { error: 'Udfyld alle celler med ikke-negative tal.' };
        rowT[i] += v;
        colT[j] = (colT[j] || 0) + v;
        grand += v;
      }
    }
    if (grand <= 0) return { error: 'Tabellen må ikke være tom.' };
    var chi2 = 0, minExpected = Infinity;
    for (var i = 0; i < R; i++) {
      for (var j = 0; j < C; j++) {
        var e = rowT[i] * colT[j] / grand;
        if (e === 0) return { error: 'Der er en hel række eller kolonne med total nul.' };
        if (e < minExpected) minExpected = e;
        chi2 += (table[i][j] - e) * (table[i][j] - e) / e;
      }
    }
    var df = (R - 1) * (C - 1);
    var pValue = 1 - chiSquareCDF(chi2, df);
    var alpha = 1 - confidence;
    var k = Math.min(R - 1, C - 1);
    return {
      chi2: chi2, df: df, pValue: pValue, alpha: alpha, confidence: confidence,
      significant: pValue < alpha, n: grand, rows: R, cols: C,
      cramerV: Math.sqrt(chi2 / (grand * k)), minExpected: minExpected
    };
  }

  // ANOVA de uma via. o.groups: array de arrays de números.
  function anovaTest(o) {
    var groups = o.groups, confidence = o.confidence;
    var k = groups.length;
    if (k < 2) return { error: 'Angiv mindst 2 grupper.' };
    var N = 0, grandSum = 0, means = [], ns = [];
    for (var i = 0; i < k; i++) {
      var g = groups[i];
      if (g.length < 2) return { error: 'Hver gruppe skal indeholde mindst 2 værdier.' };
      var s = 0;
      for (var j = 0; j < g.length; j++) s += g[j];
      ns[i] = g.length; means[i] = s / g.length;
      N += g.length; grandSum += s;
    }
    var grandMean = grandSum / N;
    var ssB = 0, ssW = 0;
    for (var i = 0; i < k; i++) {
      ssB += ns[i] * (means[i] - grandMean) * (means[i] - grandMean);
      for (var j = 0; j < groups[i].length; j++) {
        var d = groups[i][j] - means[i];
        ssW += d * d;
      }
    }
    var dfB = k - 1, dfW = N - k;
    if (dfW <= 0) return { error: 'Utilstrækkelige frihedsgrader til testen.' };
    var msB = ssB / dfB, msW = ssW / dfW;
    if (msW === 0) return { error: 'Variansen inden for grupperne er nul — testen kan ikke anvendes.' };
    var F = msB / msW;
    var pValue = 1 - fCDF(F, dfB, dfW);
    var alpha = 1 - confidence;
    return {
      F: F, dfB: dfB, dfW: dfW, ssB: ssB, ssW: ssW, msB: msB, msW: msW,
      pValue: pValue, alpha: alpha, confidence: confidence,
      significant: pValue < alpha, k: k, N: N,
      etaSquared: ssB / (ssB + ssW), means: means, ns: ns, grandMean: grandMean
    };
  }

  // Kruskal-Wallis (alternativa não-paramétrica à ANOVA). o.groups: arrays.
  function kruskalWallisTest(o) {
    var groups = o.groups, confidence = o.confidence;
    var k = groups.length;
    if (k < 2) return { error: 'Angiv mindst 2 grupper.' };
    var all = [], idx = [];
    for (var i = 0; i < k; i++) {
      if (groups[i].length < 1) return { error: 'Hver gruppe skal indeholde mindst 1 værdi.' };
      for (var j = 0; j < groups[i].length; j++) { all.push(groups[i][j]); idx.push(i); }
    }
    var N = all.length;
    if (N < 3) return { error: 'Angiv flere observationer for at køre testen.' };
    var rk = ranksWithTies(all);
    var rankSum = [], ns = [];
    for (var i = 0; i < k; i++) { rankSum[i] = 0; ns[i] = 0; }
    for (var m = 0; m < N; m++) { rankSum[idx[m]] += rk.ranks[m]; ns[idx[m]]++; }
    var H = 0;
    for (var i = 0; i < k; i++) H += rankSum[i] * rankSum[i] / ns[i];
    H = 12 / (N * (N + 1)) * H - 3 * (N + 1);
    var corr = 1 - rk.tieSum / (N * N * N - N);
    if (corr > 0) H = H / corr;
    var df = k - 1;
    var pValue = 1 - chiSquareCDF(H, df);
    var alpha = 1 - confidence;
    return {
      H: H, df: df, pValue: pValue, alpha: alpha, confidence: confidence,
      significant: pValue < alpha, k: k, N: N
    };
  }

  // Mann-Whitney U (Wilcoxon da soma de postos) — duas amostras independentes.
  function mannWhitneyTest(o) {
    var g1 = o.group1, g2 = o.group2;
    var confidence = o.confidence, tails = o.tails || 2;
    var n1 = g1.length, n2 = g2.length;
    if (n1 < 1 || n2 < 1) return { error: 'Hver gruppe skal indeholde mindst 1 værdi.' };
    var rk = ranksWithTies(g1.concat(g2));
    var R1 = 0;
    for (var i = 0; i < n1; i++) R1 += rk.ranks[i];
    var U1 = R1 - n1 * (n1 + 1) / 2;
    var U2 = n1 * n2 - U1;
    var U = Math.min(U1, U2);
    var N = n1 + n2;
    var muU = n1 * n2 / 2;
    var sigmaU = Math.sqrt((n1 * n2 / 12) *
      ((N + 1) - rk.tieSum / (N * (N - 1))));
    if (!(sigmaU > 0)) return { error: 'Ingen variation i dataene — testen kan ikke anvendes.' };
    var z = (U - muU) / sigmaU;
    var pValue = tails === 1 ? (1 - normalCDF(Math.abs(z)))
                             : 2 * (1 - normalCDF(Math.abs(z)));
    var alpha = 1 - confidence;
    return {
      U: U, U1: U1, U2: U2, z: z, pValue: pValue, alpha: alpha,
      confidence: confidence, tails: tails, significant: pValue < alpha,
      n1: n1, n2: n2, medianFlag: true
    };
  }

  // Wilcoxon dos postos sinalizados — amostras pareadas (antes/depois).
  function wilcoxonSignedRankTest(o) {
    var before = o.before, after = o.after;
    var confidence = o.confidence, tails = o.tails || 2;
    if (before.length !== after.length) {
      return { error: 'De to kolonner skal have samme antal værdier.' };
    }
    var diffs = [];
    for (var i = 0; i < before.length; i++) {
      var d = after[i] - before[i];
      if (d !== 0) diffs.push(d);
    }
    var n = diffs.length;
    if (n < 1) return { error: 'Alle forskelle er nul — der er intet at teste.' };
    var absD = [];
    for (var i = 0; i < n; i++) absD.push(Math.abs(diffs[i]));
    var rk = ranksWithTies(absD);
    var wPlus = 0, wMinus = 0;
    for (var i = 0; i < n; i++) {
      if (diffs[i] > 0) wPlus += rk.ranks[i];
      else wMinus += rk.ranks[i];
    }
    var W = Math.min(wPlus, wMinus);
    var muW = n * (n + 1) / 4;
    var sigmaW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - rk.tieSum / 48);
    if (!(sigmaW > 0)) return { error: 'Ingen variation i forskellene — testen kan ikke anvendes.' };
    var z = (W - muW) / sigmaW;
    var pValue = tails === 1 ? (1 - normalCDF(Math.abs(z)))
                             : 2 * (1 - normalCDF(Math.abs(z)));
    var alpha = 1 - confidence;
    return {
      W: W, wPlus: wPlus, wMinus: wMinus, z: z, pValue: pValue, alpha: alpha,
      confidence: confidence, tails: tails, significant: pValue < alpha, n: n
    };
  }

  /* ----------------------------------------------------------------------
     9) Correlação de Pearson e regressão linear simples
     ---------------------------------------------------------------------- */

  // Correlação de Pearson com teste de significância e IC via z de Fisher.
  // o.x e o.y: arrays de números do mesmo tamanho.
  function pearsonCorrelation(o) {
    var x = o.x, y = o.y, confidence = o.confidence || 0.95, tails = o.tails || 2;
    if (!Array.isArray(x) || !Array.isArray(y)) {
      return { error: 'Angiv de to talrækker som arrays af tal.' };
    }
    if (x.length !== y.length) {
      return { error: 'De to talrækker skal have samme antal observationer.' };
    }
    var n = x.length;
    if (n < 3) return { error: 'Der kræves mindst 3 parrede observationer.' };

    var sx = 0, sy = 0;
    for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    var mx = sx / n, my = sy / n;
    var sxx = 0, syy = 0, sxy = 0;
    for (var j = 0; j < n; j++) {
      var dx = x[j] - mx, dy = y[j] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    if (sxx === 0 || syy === 0) {
      return { error: 'En af talrækkerne har ingen variation (alle værdier er ens) — korrelation udefineret.' };
    }
    var r = sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
    // Clamp por seguranca numerica
    if (r > 1) r = 1;
    if (r < -1) r = -1;
    var r2 = r * r;

    // Regressão linear simples y = a + b*x
    var slope = sxy / sxx;
    var intercept = my - slope * mx;

    // Teste t para H0: rho = 0
    var df = n - 2;
    var t, pValue;
    if (Math.abs(r) >= 1) {
      t = Infinity * Math.sign(r);
      pValue = 0;
    } else {
      t = r * Math.sqrt(df) / Math.sqrt(1 - r2);
      var pTwo = tTwoTailedP(t, df);
      pValue = tails === 1 ? pTwo / 2 : pTwo;
    }
    var alpha = 1 - confidence;

    // IC para r via transformacao z de Fisher (precisa de n >= 4)
    var ciLow = null, ciHigh = null;
    if (n >= 4 && Math.abs(r) < 1) {
      var zr = 0.5 * Math.log((1 + r) / (1 - r));
      var seZ = 1 / Math.sqrt(n - 3);
      var zc = zCritical(confidence);
      var zlo = zr - zc * seZ, zhi = zr + zc * seZ;
      var th = function (z) { var e = Math.exp(2 * z); return (e - 1) / (e + 1); };
      ciLow = th(zlo); ciHigh = th(zhi);
    }

    // Classificação descritiva da força da correlação (Cohen, ajustado)
    var absR = Math.abs(r), forca, sinal = r > 0 ? 'positiv' : (r < 0 ? 'negativ' : 'nul');
    if (absR < 0.1)      forca = 'praktisk talt nul';
    else if (absR < 0.3) forca = 'svag';
    else if (absR < 0.5) forca = 'moderat';
    else if (absR < 0.7) forca = 'stærk';
    else if (absR < 0.9) forca = 'meget stærk';
    else                 forca = 'næsten perfekt';

    return {
      n: n, r: r, r2: r2, df: df, t: t, pValue: pValue,
      alpha: alpha, confidence: confidence, tails: tails,
      significant: pValue < alpha,
      ciLow: ciLow, ciHigh: ciHigh,
      slope: slope, intercept: intercept,
      meanX: mx, meanY: my,
      sdX: Math.sqrt(sxx / (n - 1)), sdY: Math.sqrt(syy / (n - 1)),
      forca: forca, sinal: sinal,
      sxx: sxx, syy: syy, sxy: sxy
    };
  }

  /* ----------------------------------------------------------------------
     Exportação
     ---------------------------------------------------------------------- */
  var Stats = {
    gammaln: gammaln, betai: betai, gammp: gammp,
    normalPDF: normalPDF, normalCDF: normalCDF, normalInv: normalInv,
    tCDF: tCDF, tInv: tInv, tTwoTailedP: tTwoTailedP,
    chiSquareCDF: chiSquareCDF, fCDF: fCDF, ranksWithTies: ranksWithTies,
    zCritical: zCritical, zPValue: zPValue,
    abTest: abTest, abSampleSize: abSampleSize,
    tTest: tTest, zTest: zTest,
    oneProportionTest: oneProportionTest, wilsonInterval: wilsonInterval,
    confidenceInterval: confidenceInterval, surveySampleSize: surveySampleSize,
    chiSquareTest: chiSquareTest, anovaTest: anovaTest,
    kruskalWallisTest: kruskalWallisTest,
    mannWhitneyTest: mannWhitneyTest, wilcoxonSignedRankTest: wilcoxonSignedRankTest,
    pearsonCorrelation: pearsonCorrelation
  };

  global.Stats = Stats;
  if (typeof module !== 'undefined' && module.exports) module.exports = Stats;

})(typeof window !== 'undefined' ? window : globalThis);
