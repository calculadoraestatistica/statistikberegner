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

/* ----- 11) Leitura de listas digitadas (parseList) -----
   As calculadoras de lista (wilcoxon, k-amostras, correlacao) partiam o texto
   com split(/[\s,;]+/), tratando toda vírgula como separador de valores. Quem
   digitava à brasileira perdia os dados sem aviso e recebia a conclusão
   invertida. Estes casos cobrem as duas leituras da vírgula, e em especial os
   formatos que já funcionavam antes e não podem quebrar. */

function listaIgual(entrada, esperado, label) {
  var obtido = S.parseList(entrada);
  if (obtido.length !== esperado.length) {
    failed++;
    failures.push('FAIL ' + label + ': esperado ' + JSON.stringify(esperado) +
                  ', obtido ' + JSON.stringify(obtido));
    return;
  }
  for (var i = 0; i < esperado.length; i++) {
    if (Math.abs(obtido[i] - esperado[i]) > 1e-12) {
      failed++;
      failures.push('FAIL ' + label + ': esperado ' + JSON.stringify(esperado) +
                    ', obtido ' + JSON.stringify(obtido));
      return;
    }
  }
  passed++;
}

// formatos que o site já aceitava: a vírgula separa valores
listaIgual('12, 15, 14, 18, 11, 16', [12, 15, 14, 18, 11, 16], 'parseList: CSV com espaço (botão Ver exemplo)');
listaIgual('85, 88, 82, 90, 87', [85, 88, 82, 90, 87], 'parseList: CSV do exemplo de k-amostras');
listaIgual('12,15,14,18,11,16', [12, 15, 14, 18, 11, 16], 'parseList: CSV sem espaço');
listaIgual('5.1 5.4 4.9', [5.1, 5.4, 4.9], 'parseList: ponto decimal');
listaIgual('5.1,5.4,4.9', [5.1, 5.4, 4.9], 'parseList: CSV com ponto decimal');
listaIgual('1\n2\n3', [1, 2, 3], 'parseList: um por linha');
listaIgual('10 20 30', [10, 20, 30], 'parseList: inteiros com espaço');

// lista por vírgula COM espaço em branco em algum outro lugar. Esta é a forma
// que a primeira versão do conserto quebrava: /(\d),(\d)/g consome o dígito
// dos dois lados, só protegia vírgulas alternadas, e "85,88,82 90,87" devolvia
// [85.88, 90.87], cinco valores virando dois, sem erro nenhum na tela.
listaIgual('85,88,82\n90,87', [85, 88, 82, 90, 87], 'parseList: CSV com quebra de linha no meio');
listaIgual('12,15,14 18,11,16', [12, 15, 14, 18, 11, 16], 'parseList: dois grupos CSV com espaço');
listaIgual('1,2,3 4', [1, 2, 3, 4], 'parseList: CSV com valor solto');
listaIgual('12, 15, 14, 18, 11,16', [12, 15, 14, 18, 11, 16], 'parseList: exemplo do site com um espaço a menos');
listaIgual('85,88,82 90,87,91', [85, 88, 82, 90, 87, 91], 'parseList: dois grupos CSV de três');

// o que estava quebrado: a vírgula é o decimal
listaIgual('5,1 5,4 4,9 5,3 5,2', [5.1, 5.4, 4.9, 5.3, 5.2], 'parseList: decimal com espaço');
listaIgual('2,1\n3,9\n6,2\n7,8\n9,5', [2.1, 3.9, 6.2, 7.8, 9.5], 'parseList: decimal um por linha');
listaIgual('5,1;5,4;4,9', [5.1, 5.4, 4.9], 'parseList: decimal com ponto e vírgula');
listaIgual('5,1\t5,4\t4,9', [5.1, 5.4, 4.9], 'parseList: decimal com tabulação (Excel)');
listaIgual('1.234,56 2.000,10', [1234.56, 2000.1], 'parseList: milhar pt-BR');
listaIgual('-1,5 -2,5 3', [-1.5, -2.5, 3], 'parseList: negativos com decimal');
listaIgual('5,1', [5.1], 'parseList: valor único decimal');
listaIgual('1.234,56', [1234.56], 'parseList: valor único com milhar');
listaIgual('12,\n15,\n14', [12, 15, 14], 'parseList: vírgula no fim da linha');
listaIgual('2,1\r\n3,9', [2.1, 3.9], 'parseList: CRLF');
listaIgual('5,1 5.4 4,9', [5.1, 5.4, 4.9], 'parseList: vírgula e ponto misturados');

// entradas degeneradas
listaIgual('', [], 'parseList: vazio');
listaIgual('   ', [], 'parseList: só espaços');
listaIgual(null, [], 'parseList: null');
listaIgual(undefined, [], 'parseList: undefined');
listaIgual('abc def', [], 'parseList: texto sem número');
listaIgual('5,1 abc 4,9', [5.1, 4.9], 'parseList: número com lixo no meio');
listaIgual(',,,', [], 'parseList: só vírgulas');

/* parseLines: correlacao lê por LINHA, e o espaço NÃO separa valores.
   A página promete "cada linha de X corresponde à mesma linha de Y", e coluna
   de planilha traz milhar separado por espaço. Com o leitor de lista genérico,
   "1 234" virava dois valores; como X e Y têm o mesmo formato, os dois dobravam
   juntos, os tamanhos continuavam casando, nenhum erro aparecia, e o r saltava
   de 0,19 para 0,99. */
function linhasIgual(entrada, esperado, label) {
  var obtido = S.parseLines(entrada);
  var ok = obtido.length === esperado.length;
  for (var i = 0; ok && i < esperado.length; i++) {
    if (Math.abs(obtido[i] - esperado[i]) > 1e-12) ok = false;
  }
  if (ok) { passed++; return; }
  failed++;
  failures.push('FAIL ' + label + ': esperado ' + JSON.stringify(esperado) +
                ', obtido ' + JSON.stringify(obtido));
}

linhasIgual('1\n2\n3\n4\n5', [1, 2, 3, 4, 5], 'parseLines: um por linha');
linhasIgual('2,1\n3,9\n6,2\n7,8\n9,5', [2.1, 3.9, 6.2, 7.8, 9.5], 'parseLines: decimal por linha');
linhasIgual('1 234\n5 678\n9 012', [1234, 5678, 9012], 'parseLines: milhar separado por espaço');
linhasIgual('1.234,56\n2.000,10', [1234.56, 2000.1], 'parseLines: milhar com ponto e decimal');
linhasIgual('1,2,3,4,5', [1, 2, 3, 4, 5], 'parseLines: CSV numa linha só');
linhasIgual('12\n14\n16\n18\n20', [12, 14, 16, 18, 20], 'parseLines: exemplo do botão');
linhasIgual('', [], 'parseLines: vazio');
linhasIgual('  \n  ', [], 'parseLines: só espaços');

// os placeholders impressos em correlacao.html precisam dar séries do mesmo tamanho
assert(S.parseLines('1\n2\n3\n4\n5').length === S.parseLines('2,1\n3,9\n6,2\n7,8\n9,5').length,
       'parseLines: os dois placeholders de correlacao têm o mesmo n');

/* parseNum de stats.js não pode divergir do de js/app.js, que é uma cópia. */
function parseNumApp(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  var s = String(v).trim().replace(/\s/g, '').replace(/%/g, '');
  if (s === '') return NaN;
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf(',') > -1) {
    s = s.replace(',', '.');
  }
  var n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}
var amostrasNum = ['5,1', '5.1', '1.234,56', '1,234.56', '-2,5', '0', '', '  7 ',
                   '12%', 'abc', '1.234', '1,5,7', '+3,25', '.5', ',5', '1e3'];
for (var an = 0; an < amostrasNum.length; an++) {
  var aV = S.parseNum(amostrasNum[an]), bV = parseNumApp(amostrasNum[an]);
  assert((isNaN(aV) && isNaN(bV)) || aV === bV,
         'parseNum concorda com app.js em ' + JSON.stringify(amostrasNum[an]));
}

/* ----- 12) O defeito da vírgula decimal, ponta a ponta -----
   Reproduz o caminho completo: texto digitado -> parseList -> teste. Os valores
   de referência vêm do SciPy. Antes do conserto o site devolvia, para as mesmas
   entradas, F=0,5664 com p=0,5742 e U=54 com p=0,2668, ou seja, a conclusão
   oposta. */

var grupoTxt = ['5,1 5,4 4,9 5,3 5,2', '6,2 6,5 6,0 6,4 6,3', '7,1 7,4 6,9 7,3 7,2'];
var gruposLidos = [S.parseList(grupoTxt[0]), S.parseList(grupoTxt[1]), S.parseList(grupoTxt[2])];
assert(gruposLidos[0].length === 5 && gruposLidos[1].length === 5 && gruposLidos[2].length === 5,
       'ponta a ponta: cada grupo digitado com vírgula decimal tem 5 valores');
// scipy.stats.f_oneway -> F=135.58558559, p=5.79152926e-09
var anovaPt = S.anovaTest({ groups: gruposLidos, confidence: 0.95 });
approx(anovaPt.F, 135.5855856, 1e-5, 'ponta a ponta: ANOVA F com vírgula decimal');
approx(anovaPt.pValue, 5.791529e-9, 1e-13, 'ponta a ponta: ANOVA p com vírgula decimal');
assert(anovaPt.dfB === 2 && anovaPt.dfW === 12, 'ponta a ponta: ANOVA gl 2/12');
assert(anovaPt.significant === true, 'ponta a ponta: ANOVA acusa diferença significativa');

// scipy.stats.mannwhitneyu(..., alternative='two-sided') -> U=0
var mwA = S.parseList('12,5 15,5 11,5 18,5 14,5 16,5');
var mwB = S.parseList('20,5 22,5 19,5 25,5 21,5 23,5');
assert(mwA.length === 6 && mwB.length === 6, 'ponta a ponta: Mann-Whitney lê 6 e 6');
var mw = S.mannWhitneyTest({ group1: mwA, group2: mwB, confidence: 0.95 });
approx(mw.U, 0, 1e-12, 'ponta a ponta: Mann-Whitney U com vírgula decimal');
assert(mw.significant === true, 'ponta a ponta: Mann-Whitney acusa diferença significativa');

// scipy.stats.pearsonr([1,2,3,4,5],[2.1,3.9,6.2,7.8,9.5]) -> r=0.99813216
var corX = S.parseList('1\n2\n3\n4\n5');
var corY = S.parseList('2,1\n3,9\n6,2\n7,8\n9,5');
var corr = S.pearsonCorrelation({ x: corX, y: corY });
approx(corr.r, 0.9981322, 1e-6, 'ponta a ponta: Pearson r dos placeholders da página');
assert(corr.n === 5, 'ponta a ponta: Pearson n=5 dos placeholders da página');

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
