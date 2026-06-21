/* ==========================================================================
   tests/test_calculadoras.js — Suite de regressão numérica para stats.js
   Roda em Node sem dependências. Cada teste compara o valor calculado por
   stats.js com um valor de referência produzido por software estatístico
   consagrado (scipy.stats / statsmodels) com tolerância numérica.

   Uso:
       node tests/test_calculadoras.js

   Cobre as funções-chave: normalCDF, zCritical, tInv, chiSquareCDF,
   testes t (1 amostra, Welch), qui-quadrado, ANOVA, correlação de Pearson,
   teste A/B (uni e bicaudal), teste z, teste de uma proporção e Wilson.
   ========================================================================== */
'use strict';

var S = require('../js/stats.js');

var passed = 0, failed = 0;
var failures = [];

function approx(actual, expected, tol, label) {
  var diff = Math.abs(actual - expected);
  if (!isFinite(actual) || diff > tol) {
    failed++;
    failures.push('FAIL ' + label + ': esperado ' + expected + ', obtido ' + actual + ' (diff=' + diff + ', tol=' + tol + ')');
  } else {
    passed++;
  }
}

function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; failures.push('FAIL ' + label); }
}

/* ----- 1) Funções fundamentais ----- */

approx(S.normalCDF(0), 0.5, 1e-6, 'normalCDF(0)');
approx(S.normalCDF(1.96), 0.975, 1e-4, 'normalCDF(1.96)');
approx(S.normalCDF(-1.96), 0.025, 1e-4, 'normalCDF(-1.96)');

approx(S.zCritical(0.95), 1.959964, 1e-4, 'zCritical(0.95)');
approx(S.zCritical(0.99), 2.575829, 1e-4, 'zCritical(0.99)');

approx(S.tInv(0.975, 10), 2.228139, 1e-3, 'tInv(0.975, df=10)');
approx(S.tInv(0.975, 30), 2.042272, 1e-3, 'tInv(0.975, df=30)');

approx(S.chiSquareCDF(9.4877, 4), 0.95, 1e-3, 'chiSquareCDF(9.4877, df=4)');

/* ----- 2) Teste t de uma amostra ----- */
// scipy: t = (5.2-5)/(1.1/sqrt(15)) = 0.7041788, p bi = 0.4928691
var t1 = S.tTest({ mode: 'one', mean: 5.2, sd: 1.1, n: 15, mu0: 5, confidence: 0.95, tails: 2 });
approx(t1.t, 0.7041788, 1e-5, 'tTest one-sample: t');
approx(t1.pValue, 0.4928691, 1e-4, 'tTest one-sample: pValue');
assert(t1.significant === false, 'tTest one-sample: não significativo');

/* ----- 3) Teste t de Welch (duas amostras) ----- */
// scipy ttest_ind_from_stats(10,2,20, 12,2.5,22, equal_var=False)
//   t = -2.8745279, df = 39.3956, p = 0.006493
var t2 = S.tTest({ mode: 'two', mean1: 10, sd1: 2, n1: 20, mean2: 12, sd2: 2.5, n2: 22, confidence: 0.95, tails: 2 });
approx(t2.t, -2.8745279, 1e-5, 'tTest Welch: t');
approx(t2.df, 39.3956, 1e-3, 'tTest Welch: df');
approx(t2.pValue, 0.006493, 1e-5, 'tTest Welch: pValue');
assert(t2.significant === true, 'tTest Welch: significativo a 95%');

/* ----- 4) Qui-quadrado de independência ----- */
// scipy.chi2_contingency([[20,30],[30,20]], correction=False)
//   chi2 = 4.0, dof = 1, p = 0.04550026...
var chi = S.chiSquareTest({ table: [[20, 30], [30, 20]], confidence: 0.95 });
approx(chi.chi2, 4.0, 1e-9, 'chiSquareTest 2x2: chi2');
approx(chi.df, 1, 1e-9, 'chiSquareTest 2x2: df');
approx(chi.pValue, 0.0455003, 1e-5, 'chiSquareTest 2x2: pValue');

// scipy.chi2_contingency([[10,20,30],[20,20,20]], correction=False)
//   chi2 = 5.333333..., dof = 2, p = 0.069483...
var chi2 = S.chiSquareTest({ table: [[10, 20, 30], [20, 20, 20]], confidence: 0.95 });
approx(chi2.chi2, 5.3333333, 1e-5, 'chiSquareTest 2x3: chi2');
approx(chi2.df, 2, 1e-9, 'chiSquareTest 2x3: df');
approx(chi2.pValue, 0.0694835, 1e-5, 'chiSquareTest 2x3: pValue');

/* ----- 5) ANOVA de uma via ----- */
// scipy.f_oneway:
//   g1=[6,8,4,5,3,4], g2=[8,12,9,11,6,8], g3=[13,9,11,8,7,12]
//   F = 9.264706, p = 0.0023988
var anova = S.anovaTest({
  groups: [[6, 8, 4, 5, 3, 4], [8, 12, 9, 11, 6, 8], [13, 9, 11, 8, 7, 12]],
  confidence: 0.95
});
approx(anova.F, 9.264706, 1e-4, 'ANOVA: F');
approx(anova.pValue, 0.0023988, 1e-5, 'ANOVA: pValue');
assert(anova.significant === true, 'ANOVA: significativo');

/* ----- 6) Correlação de Pearson ----- */
// scipy.pearsonr(x=[1..10], y=[2,4,5,4,5,7,8,9,10,12])
//   r = 0.9719076, slope = 1.006061, intercept = 1.066667
var x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var y = [2, 4, 5, 4, 5, 7, 8, 9, 10, 12];
var cor = S.pearsonCorrelation({ x: x, y: y, confidence: 0.95, tails: 2 });
approx(cor.r, 0.9719076, 1e-5, 'pearsonCorrelation: r');
assert(cor.pValue < 0.001, 'pearsonCorrelation: pValue < 0.001');
approx(cor.slope, 1.006061, 1e-5, 'pearsonCorrelation: slope');
approx(cor.intercept, 1.066667, 1e-5, 'pearsonCorrelation: intercept');

var corPerf = S.pearsonCorrelation({ x: [1, 2, 3, 4, 5], y: [2, 4, 6, 8, 10], confidence: 0.95 });
approx(corPerf.r, 1.0, 1e-9, 'pearsonCorrelation: r perfeito');

/* ----- 7) Teste A/B (duas proporções) ----- */
// xA=50/500=10%, xB=70/500=14%
// scipy: z = 1.9462474, p bi = 0.0516250, p uni = 0.0258125
var ab = S.abTest({ xA: 50, nA: 500, xB: 70, nB: 500, confidence: 0.95, tails: 2 });
approx(ab.z, 1.9462474, 1e-5, 'abTest bicaudal: z');
approx(ab.pValue, 0.0516250, 1e-5, 'abTest bicaudal: pValue');
assert(ab.winner === 'B', 'abTest: winner = B');

var abOne = S.abTest({ xA: 50, nA: 500, xB: 70, nB: 500, confidence: 0.95, tails: 1 });
approx(abOne.pValue, 0.0258125, 1e-5, 'abTest unicaudal (B>A): pValue ~ bicaudal/2');

// Regressão para o bug corrigido (junho/2026): quando A supera B (z<0), o
// p-valor unicaudal agora usa |z|, consistente com zPValue. Antes desta
// correção, abReverse.pValue retornava ~0.9742 (1-normalCDF(z) com z<0),
// inflando o p-valor e indicando incorretamente baixíssima evidência.
var abReverse = S.abTest({ xA: 70, nA: 500, xB: 50, nB: 500, confidence: 0.95, tails: 1 });
approx(abReverse.pValue, 0.0258125, 1e-5, 'abTest unicaudal (A>B): pValue usa |z| (regressão do fix de jun/2026)');
assert(abReverse.winner === 'A', 'abTest reverso: winner = A');

/* ----- 8) Teste z para uma média ----- */
// mean=100, sigma=15, n=25, mu0=95 -> z = 1.6667, p bi = 0.0955807
var z1 = S.zTest({ mean: 100, sigma: 15, n: 25, mu0: 95, confidence: 0.95, tails: 2 });
approx(z1.z, 1.6666667, 1e-5, 'zTest: z');
approx(z1.pValue, 0.0955807, 1e-5, 'zTest: pValue');

/* ----- 9) Teste de uma proporção ----- */
// scipy: phat=0.3, p0=0.25, n=200 -> z = 1.6329932, p bi = 0.1024704
var op = S.oneProportionTest({ x: 60, n: 200, p0: 0.25, confidence: 0.95, tails: 2 });
approx(op.z, 1.6329932, 1e-5, 'oneProportionTest: z');
approx(op.pValue, 0.1024704, 1e-5, 'oneProportionTest: pValue');

/* ----- 10) Intervalo de Wilson ----- */
// statsmodels.proportion_confint(30, 100, alpha=0.05, method='wilson')
//   = (0.21894885, 0.39584855)
var wi = S.wilsonInterval(30, 100, 0.95);
approx(wi.low, 0.2189489, 1e-5, 'wilsonInterval: low');
approx(wi.high, 0.3958485, 1e-5, 'wilsonInterval: high');

/* ----- Relatório final ----- */

var total = passed + failed;
console.log('');
console.log('==========================================================');
console.log('Testes de regressão — stats.js');
console.log('==========================================================');
if (failed > 0) {
  console.log('FALHAS:');
  for (var i = 0; i < failures.length; i++) console.log('  ' + failures[i]);
  console.log('');
}
console.log(passed + '/' + total + ' asserções passaram.');
if (failed > 0) {
  console.log('RESULTADO: FALHOU (' + failed + ' falhas)');
  process.exit(1);
} else {
  console.log('RESULTADO: OK');
  process.exit(0);
}
