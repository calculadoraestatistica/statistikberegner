# -*- coding: utf-8 -*-
"""Gera a tabela de validação publicada em validering.html (versão dinamarquesa).

Roda cada calculadora do site com uma entrada concreta e compara o resultado
com o de uma implementação independente (SciPy). Publica os dois números e a
diferença, para o leitor conferir em vez de acreditar.

    & "C:/Users/vinyn/miniconda3/python.exe" tests/generer_validering.py

Escreve tests/_validacao.json, que o gerador da página consome. Refaça sempre
que mexer em js/stats.js.
"""
from __future__ import annotations

import io
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import stats as sp

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# ── Entradas, iguais para os dois lados ────────────────────────────────────
A = [7.2, 6.8, 7.9, 8.1, 6.5, 7.4, 8.8, 7.1, 6.9, 7.6]
B = [8.4, 9.1, 8.0, 8.9, 9.5, 8.2, 9.8, 8.6, 9.0, 8.3]
C = [6.1, 6.7, 5.9, 6.4, 7.0, 6.2, 6.8, 6.5, 6.0, 6.6]
ANTES = [128, 135, 142, 131, 139, 144, 126, 137, 133, 140]
DEPOIS = [121, 130, 133, 129, 131, 138, 124, 128, 130, 134]
XC = [2.1, 3.4, 4.8, 5.2, 6.7, 7.1, 8.3, 9.0, 9.8, 10.4]
YC = [14.2, 18.9, 23.1, 25.8, 31.0, 33.4, 38.2, 41.1, 44.7, 48.0]

CASOS = [
    dict(id="t1", pagina="teste-t.html", nome="Teste t para uma amostra",
         entrada="média 5,2 · desvio 1,1 · n 15 · hipótese μ₀ = 5",
         js="S.tTest({mode:'one',mean:5.2,sd:1.1,n:15,mu0:5,confidence:0.95,tails:2})"),
    dict(id="t2", pagina="teste-t.html", nome="Teste t de Welch, duas amostras",
         entrada="grupo A (n 10) e grupo B (n 10), variâncias desiguais",
         js="S.tTest({mode:'two',mean1:%r,sd1:%r,n1:10,mean2:%r,sd2:%r,n2:10,confidence:0.95,tails:2})"
            % (float(np.mean(A)), float(np.std(A, ddof=1)), float(np.mean(B)), float(np.std(B, ddof=1)))),
    dict(id="z", pagina="teste-z.html", nome="Teste Z para uma média",
         entrada="média 100 · σ conhecido 15 · n 25 · hipótese μ₀ = 95",
         js="S.zTest({mean:100,sigma:15,n:25,mu0:95,confidence:0.95,tails:2})"),
    dict(id="prop", pagina="teste-proporcao.html", nome="Teste de uma proporção",
         entrada="60 sucessos em 200 · hipótese p₀ = 0,25",
         js="S.oneProportionTest({x:60,n:200,p0:0.25,confidence:0.95,tails:2})"),
    dict(id="ab", pagina="teste-ab.html", nome="Teste A/B de duas proporções",
         entrada="A: 50/500 · B: 70/500 · bicaudal",
         js="S.abTest({xA:50,nA:500,xB:70,nB:500,confidence:0.95,tails:2})"),
    dict(id="chi", pagina="qui-quadrado.html", nome="Qui-quadrado de independência",
         entrada="tabela 2×3: [10, 20, 30] e [20, 20, 20]",
         js="S.chiSquareTest({table:[[10,20,30],[20,20,20]],confidence:0.95})"),
    dict(id="anova", pagina="k-amostras.html", nome="ANOVA de um fator",
         entrada="três grupos de 10 observações",
         js="S.anovaTest({groups:[%s,%s,%s],confidence:0.95})" % (A, B, C)),
    dict(id="kw", pagina="k-amostras.html", nome="Kruskal-Wallis",
         entrada="mesmos três grupos, sem supor normalidade",
         js="S.kruskalWallisTest({groups:[%s,%s,%s],confidence:0.95})" % (A, B, C)),
    dict(id="pearson", pagina="correlacao.html", nome="Correlação de Pearson",
         entrada="dez pares (x, y)",
         js="S.pearsonCorrelation({x:%s,y:%s,confidence:0.95,tails:2})" % (XC, YC)),
    dict(id="mw", pagina="wilcoxon.html", nome="Mann-Whitney U",
         entrada="grupo A e grupo B, 10 observações cada",
         js="S.mannWhitneyTest({group1:%s,group2:%s,confidence:0.95,tails:2})" % (A, B)),
    dict(id="wsr", pagina="wilcoxon.html", nome="Wilcoxon pareado",
         entrada="dez medidas antes e depois",
         js="S.wilcoxonSignedRankTest({before:%s,after:%s,confidence:0.95,tails:2})" % (ANTES, DEPOIS)),
    dict(id="ic", pagina="intervalo-confianca.html", nome="Intervalo de confiança da média",
         entrada="média 7,43 · desvio 0,70 · n 10 · 95%",
         js="S.confidenceInterval({mode:'mean',mean:%r,sd:%r,n:10,confidence:0.95})"
            % (float(np.mean(A)), float(np.std(A, ddof=1)))),
    dict(id="wilson", pagina="intervalo-confianca.html", nome="Intervalo de Wilson para proporção",
         entrada="30 sucessos em 100 · 95%",
         js="S.wilsonInterval(30,100,0.95)"),
    dict(id="nsurvey", pagina="tamanho-amostra.html", nome="Tamanho de amostra para pesquisa",
         entrada="margem de erro 3% · confiança 95% · p 0,5",
         js="S.surveySampleSize({marginError:0.03,confidence:0.95,proportion:0.5})"),
]


def rodar_js() -> dict:
    """Executa as calculadoras do site no Node e devolve os resultados."""
    linhas = ["var S=require('%s');" % os.path.join(RAIZ, "js", "stats.js").replace("\\", "/"),
              "var out={};"]
    for c in CASOS:
        linhas.append("out[%r]=%s;" % (c["id"], c["js"]))
    linhas.append("process.stdout.write(JSON.stringify(out));")
    js = "\n".join(linhas)
    p = subprocess.run(["node", "-e", js], capture_output=True, text=True, encoding="utf-8")
    if p.returncode:
        print(p.stderr)
        sys.exit(1)
    return json.loads(p.stdout)


def referencias() -> dict:
    """Os mesmos cálculos por SciPy, independente do código do site."""
    r = {}

    t = (5.2 - 5) / (1.1 / math.sqrt(15))
    r["t1"] = {"estatística t": t, "valor-p": 2 * sp.t.sf(abs(t), 14)}

    w = sp.ttest_ind(A, B, equal_var=False)
    r["t2"] = {"estatística t": float(w.statistic), "valor-p": float(w.pvalue)}

    z = (100 - 95) / (15 / math.sqrt(25))
    r["z"] = {"estatística z": z, "valor-p": 2 * sp.norm.sf(abs(z))}

    ph, p0, n = 60 / 200, 0.25, 200
    zp = (ph - p0) / math.sqrt(p0 * (1 - p0) / n)
    r["prop"] = {"estatística z": zp, "valor-p": 2 * sp.norm.sf(abs(zp))}

    pa, pb = 50 / 500, 70 / 500
    pp = (50 + 70) / 1000
    za = (pb - pa) / math.sqrt(pp * (1 - pp) * (1 / 500 + 1 / 500))
    r["ab"] = {"estatística z": za, "valor-p": 2 * sp.norm.sf(abs(za))}

    chi2, pv, gl, _ = sp.chi2_contingency([[10, 20, 30], [20, 20, 20]], correction=False)
    r["chi"] = {"qui-quadrado": float(chi2), "valor-p": float(pv)}

    f = sp.f_oneway(A, B, C)
    r["anova"] = {"estatística F": float(f.statistic), "valor-p": float(f.pvalue)}

    k = sp.kruskal(A, B, C)
    r["kw"] = {"estatística H": float(k.statistic), "valor-p": float(k.pvalue)}

    pr = sp.pearsonr(XC, YC)
    r["pearson"] = {"coeficiente r": float(pr[0]), "valor-p": float(pr[1])}

    # O site usa aproximação normal sem correção de continuidade. Comparar com
    # o padrão do SciPy (exato para amostra pequena) seria comparar métodos
    # diferentes e acusar erro onde não há. A ressalva sobre o exato fica
    # registrada em RESSALVAS e aparece na página.
    mu = sp.mannwhitneyu(A, B, alternative="two-sided", method="asymptotic",
                         use_continuity=False)
    r["mw"] = {"estatística U": float(mu.statistic), "valor-p": float(mu.pvalue)}

    ws = sp.wilcoxon(ANTES, DEPOIS, alternative="two-sided", method="approx",
                     correction=False)
    r["wsr"] = {"estatística W": float(ws.statistic), "valor-p": float(ws.pvalue)}

    m, s, nn = float(np.mean(A)), float(np.std(A, ddof=1)), 10
    marg = sp.t.ppf(0.975, nn - 1) * s / math.sqrt(nn)
    r["ic"] = {"limite inferior": m - marg, "limite superior": m + marg}

    lo, hi = sp.binomtest(30, 100).proportion_ci(confidence_level=0.95, method="wilson")
    r["wilson"] = {"limite inferior": float(lo), "limite superior": float(hi)}

    zc = sp.norm.ppf(0.975)
    r["nsurvey"] = {"n necessário": math.ceil(zc * zc * 0.25 / (0.03 ** 2))}
    return r


# nome no resultado do site -> rótulo da referência
MAPA = {
    "t1": {"t": "estatística t", "pValue": "valor-p"},
    "t2": {"t": "estatística t", "pValue": "valor-p"},
    "z": {"z": "estatística z", "pValue": "valor-p"},
    "prop": {"z": "estatística z", "pValue": "valor-p"},
    "ab": {"z": "estatística z", "pValue": "valor-p"},
    "chi": {"chi2": "qui-quadrado", "pValue": "valor-p"},
    "anova": {"F": "estatística F", "pValue": "valor-p"},
    "kw": {"H": "estatística H", "pValue": "valor-p"},
    "pearson": {"r": "coeficiente r", "pValue": "valor-p"},
    "mw": {"U": "estatística U", "pValue": "valor-p"},
    "wsr": {"W": "estatística W", "pValue": "valor-p"},
    "ic": {"ciLow": "limite inferior", "ciHigh": "limite superior"},
    "wilson": {"low": "limite inferior", "high": "limite superior"},
    "nsurvey": {"n": "n necessário"},
}


def ressalvas() -> list:
    """Diferenças de método que o leitor precisa saber, com os dois números."""
    ex_mw = sp.mannwhitneyu(A, B, alternative="two-sided", method="exact")
    ap_mw = sp.mannwhitneyu(A, B, alternative="two-sided", method="asymptotic",
                            use_continuity=False)
    ex_ws = sp.wilcoxon(ANTES, DEPOIS, alternative="two-sided", method="exact")
    ap_ws = sp.wilcoxon(ANTES, DEPOIS, alternative="two-sided", method="approx",
                        correction=False)
    return [
        {"pagina": "wilcoxon.html", "nome": "Mann-Whitney U",
         "usado": "aproximação normal", "p_usado": float(ap_mw.pvalue),
         "alternativo": "distribuição exata", "p_alternativo": float(ex_mw.pvalue),
         "n": "10 por grupo"},
        {"pagina": "wilcoxon.html", "nome": "Wilcoxon pareado",
         "usado": "aproximação normal", "p_usado": float(ap_ws.pvalue),
         "alternativo": "distribuição exata", "p_alternativo": float(ex_ws.pvalue),
         "n": "10 pares"},
    ]


def main() -> int:
    site = rodar_js()
    ref = referencias()
    saida = []
    piores = 0

    for c in CASOS:
        res = site[c["id"]]
        linhas = []
        for chave_js, rotulo in MAPA[c["id"]].items():
            v_site = res.get(chave_js)
            v_ref = ref[c["id"]][rotulo]
            if v_site is None:
                linhas.append({"grandeza": rotulo, "site": None, "ref": v_ref, "dif": None})
                piores += 1
                continue
            dif = abs(float(v_site) - float(v_ref))
            rel = dif / abs(v_ref) if v_ref else dif
            if rel > 1e-6 and dif > 1e-9:
                piores += 1
            linhas.append({"grandeza": rotulo, "site": float(v_site),
                           "ref": float(v_ref), "dif": dif})
        saida.append({"id": c["id"], "pagina": c["pagina"], "nome": c["nome"],
                      "entrada": c["entrada"], "linhas": linhas})

    io.open(os.path.join(AQUI, "_validacao.json"), "w", encoding="utf-8").write(
        json.dumps({"casos": saida, "ressalvas": ressalvas(),
                    "scipy": sp.__name__ + " " + __import__("scipy").__version__},
                   ensure_ascii=False, indent=2))

    for b in saida:
        print("  %-38s %s" % (b["nome"], " · ".join(
            "%s dif %.2e" % (l["grandeza"], l["dif"]) if l["dif"] is not None else
            "%s AUSENTE" % l["grandeza"] for l in b["linhas"])))
    print()
    print("%d grandezas conferidas, %d divergentes" %
          (sum(len(b["linhas"]) for b in saida), piores))
    return 1 if piores else 0


if __name__ == "__main__":
    sys.exit(main())
