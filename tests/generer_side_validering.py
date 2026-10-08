# -*- coding: utf-8 -*-
"""Skriver validering.html ud fra tests/_validacao.json.

Et beregnersite beder dig stole på et tal, du ikke selv kan kontrollere. Denne
side fjerner behovet for tillid: de samme tal køres gennem to uafhængige
implementeringer, og begge resultater står offentligt side om side.

    & "C:/Users/vinyn/miniconda3/python.exe" tests/generer_validering.py
    & "C:/Users/vinyn/miniconda3/python.exe" tests/generer_side_validering.py

Bruger metodologi.html som skabelon, så siden arver sitets header, footer og
stylesheet.
"""
from __future__ import annotations

import datetime
import io
import json
import os
import re
import subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
MAANEDER = ("januar", "februar", "marts", "april", "maj", "juni", "juli",
            "august", "september", "oktober", "november", "december")
I_DAG = datetime.date.today()
DATO = "%d. %s %d" % (I_DAG.day, MAANEDER[I_DAG.month - 1], I_DAG.year)

D = json.load(io.open(os.path.join(AQUI, "_validacao.json"), encoding="utf-8"))
CASOS, FORBEHOLD = D["casos"], D["ressalvas"]

NAVNE = {
  "Teste t para uma amostra": "T-test, én stikprøve",
  "Teste t de Welch, duas amostras": "Welch t-test, to stikprøver",
  "Teste Z para uma média": "Z-test for et gennemsnit",
  "Teste de uma proporção": "Test af én andel",
  "Teste A/B de duas proporções": "A/B-test af to andele",
  "Qui-quadrado de independência": "Chi i anden, uafhængighed",
  "ANOVA de um fator": "Envejs ANOVA",
  "Kruskal-Wallis": "Kruskal-Wallis",
  "Correlação de Pearson": "Pearsons korrelation",
  "Mann-Whitney U": "Mann-Whitney U",
  "Wilcoxon pareado": "Wilcoxon for parrede data",
  "Intervalo de confiança da média": "Konfidensinterval for gennemsnit",
  "Intervalo de Wilson para proporção": "Wilson-interval for en andel",
  "Tamanho de amostra para pesquisa": "Stikprøvestørrelse til undersøgelse",
}
GRANDEZA = {
  "estatística t": "t-værdi", "estatística z": "z-værdi", "estatística F": "F-værdi",
  "estatística H": "H-værdi", "estatística U": "U-værdi", "estatística W": "W-værdi",
  "qui-quadrado": "chi i anden", "coeficiente r": "r-koefficient", "valor-p": "p-værdi",
  "limite inferior": "nedre grænse", "limite superior": "øvre grænse",
  "n necessário": "nødvendigt n",
}
SIDER = {
  "teste-t.html": "t-test.html", "teste-z.html": "z-test.html",
  "teste-proporcao.html": "proportionstest.html", "teste-ab.html": "ab-test.html",
  "qui-quadrado.html": "chi-test.html", "k-amostras.html": "anova.html",
  "correlacao.html": "korrelation.html", "wilcoxon.html": "wilcoxon.html",
  "intervalo-confianca.html": "konfidensinterval.html",
  "tamanho-amostra.html": "stikprovestorrelse.html",
}
INDGANG = {
  "t1": "gennemsnit 5,2 · spredning 1,1 · n 15 · hypotese μ₀ = 5",
  "t2": "gruppe A (n 10) og gruppe B (n 10), ulige varianser",
  "z": "gennemsnit 100 · kendt σ 15 · n 25 · hypotese μ₀ = 95",
  "prop": "60 succeser ud af 200 · hypotese p₀ = 0,25",
  "ab": "A: 50/500 · B: 70/500 · tosidet",
  "chi": "tabel 2×3: [10, 20, 30] og [20, 20, 20]",
  "anova": "tre grupper med 10 observationer",
  "kw": "samme tre grupper, uden antagelse om normalfordeling",
  "pearson": "ti par (x, y)",
  "mw": "gruppe A og gruppe B, 10 observationer i hver",
  "wsr": "ti målinger før og efter",
  "ic": "gennemsnit 7,43 · spredning 0,70 · n 10 · 95 %",
  "wilson": "30 succeser ud af 100 · 95 %",
  "nsurvey": "fejlmargin 3 % · konfidens 95 % · p 0,5",
}



def tael_kontroller() -> int:
    """Hvor mange kontroller suiten faktisk koerer.

    Tallet stod skrevet i haanden som 41, saa siden blev ved med at udgive 41,
    efter at suiten voksede. Nu kommer det fra testens egen udskrift.
    """
    try:
        ud = subprocess.run(
            ["node", os.path.join(AQUI, "test_calculadoras.js")],
            capture_output=True, text=True, encoding="utf-8", timeout=120).stdout
        m = re.search(r"(\d+)\s*/\s*(\d+)\s+assercoes|(\d+)\s*/\s*(\d+)\s+asserções", ud)
        if m:
            return int(m.group(2) or m.group(4))
    except (OSError, subprocess.SubprocessError):
        pass
    return 0

def num(v):
    if v is None:
        return "&mdash;"
    if v == int(v) and abs(v) < 1e6:
        return str(int(v))
    s = "%.10g" % v if abs(v) >= 1e-4 else "%.3e" % v
    return s.replace(".", ",")


def dif(v):
    if v is None:
        return "&mdash;"
    if v == 0:
        return "0 (identisk)"
    return ("%.0e" % v).replace("e-", "e&minus;")


raekker = []
for c in CASOS:
    foerst = True
    side = SIDER.get(c["pagina"], c["pagina"])
    for l in c["linhas"]:
        navn = ('<th scope="row" rowspan="%d"><a href="/%s">%s</a><span class="val__in">%s</span></th>'
                % (len(c["linhas"]), side, NAVNE.get(c["nome"], c["nome"]),
                   INDGANG.get(c["id"], ""))) if foerst else ""
        raekker.append("<tr>%s<td>%s</td><td>%s</td><td>%s</td><td class=\"val__dif\">%s</td></tr>"
                       % (navn, GRANDEZA.get(l["grandeza"], l["grandeza"]),
                          num(l["site"]), num(l["ref"]), dif(l["dif"])))

i_alt = sum(len(c["linhas"]) for c in CASOS)
afvig = sum(1 for c in CASOS for l in c["linhas"] if l["dif"] is None or l["dif"] > 1e-6)

forbehold = "".join(
  '<tr><th scope="row"><a href="/wilcoxon.html">%s</a></th><td>%s</td><td>%s</td><td>%s</td></tr>'
  % (NAVNE.get(f["nome"], f["nome"]),
     "10 pr. gruppe" if "Mann" in f["nome"] else "10 par",
     num(f["p_usado"]), num(f["p_alternativo"]))
  for f in FORBEHOLD)

MAIN = """<main id="conteudo">

  <div class="page-head">
    <div class="container">
      <nav class="breadcrumb" aria-label="Brødkrumme">
        <ol><li><a href="/">Forside</a></li><li>Numerisk validering</li></ol>
      </nav>
      <h1>Numerisk validering</h1>
      <p class="lead">Ethvert beregnersite beder dig stole på et tal, du ikke selv kan
        kontrollere. Denne side findes, så du ikke behøver: hver beregner køres mod en
        uafhængig implementering, og begge resultater er offentliggjort side om side.</p>
    </div>
  </div>

  <div class="container narrow">
    <article class="prose">

      <p class="val__selo"><strong>%(i_alt)d kontrollerede størrelser, %(afvig)d afvigelser.</strong>
        Senest kørt %(dato)s.</p>

      <h2>Sådan kontrolleres tallene</h2>
      <p>Beregnerne på dette site er skrevet i JavaScript og kører i din egen browser. Det er
        godt for dit privatliv, fordi ingen data forlader din maskine, og skidt for din tillid,
        fordi du ikke kan vide, om regnestykket er rigtigt.</p>
      <p>Kontrollen løser det ved at sammenligne med <a href="https://scipy.org/" rel="noopener"
        target="_blank">SciPy</a>, det statistikbibliotek, der har været brugt i forskning og
        industri i over tyve år. De samme tal går ind i begge implementeringer. Når de to når
        frem til det samme, skulle fejlen findes begge steder og på samme måde.</p>
      <p>Intet her er skrevet i hånden. Tabellen bliver genereret af et script, der kører begge
        implementeringer, så den ikke kan komme bagud i forhold til koden uden at nogen opdager det.</p>

      <h2>Resultatet</h2>
      <div class="table-wrap"><table class="data val">
        <caption>Hver størrelse regnet to gange, med samme input, af to uafhængige programmer.</caption>
        <thead><tr><th scope="col">Beregner og input</th><th scope="col">Størrelse</th>
        <th scope="col">Dette site</th><th scope="col">SciPy</th>
        <th scope="col">Forskel</th></tr></thead>
        <tbody>%(raekker)s</tbody></table></div>
      <p class="val__nota">Forskelle i størrelsesordenen 10⁻⁹ eller mindre er afrundingsstøj og
        ikke uenighed: en computer gemmer decimaltal med begrænset præcision, og to forskellige
        rutiner rammer det samme tal med sidste ciffer forskelligt. I praksis ændrer en forskel
        af den størrelse ingen beslutning.</p>

      <h2>Hvor dette site er mindre præcist, og hvorfor</h2>
      <p>I to ikke-parametriske test bruger dette site <strong>normalapproksimationen</strong>,
        som er lærebogsmetoden og det, de fleste programmer viser som standard. Ved små
        stikprøver findes der en bedre mulighed: den <strong>eksakte fordeling</strong>, som
        SciPy og R vælger automatisk, når antallet af observationer er lavt.</p>
      <p>Begge værdier står nedenfor. Forskellen viser sig fra tredje decimal og bliver større,
        jo mindre stikprøven er.</p>
      <div class="table-wrap"><table class="data val">
        <caption>Forskellen mellem de to metoder på de samme data.</caption>
        <thead><tr><th scope="col">Test</th><th scope="col">Stikprøve</th>
        <th scope="col">p-værdi på dette site</th><th scope="col">Eksakt p-værdi</th></tr></thead>
        <tbody>%(forbehold)s</tbody></table></div>
      <p>I praksis: ligger din p-værdi tæt på den grænse, du beslutter ud fra, og har du under
        tyve observationer, så kontrollér i R eller Python, før du konkluderer. Ved store
        stikprøver nærmer de to metoder sig hinanden, og forskellen forsvinder.</p>

      <h2>Ud over denne side</h2>
      <p>Sitet har også en regressionssuite med %(kontroller)d kontroller, der holder de interne funktioner
        op mod referenceværdier ved hver ændring i koden. Den kører i Node uden afhængigheder og
        fejler, hvis et regnestykke flytter sig. Tabellen ovenfor er den del, der kan
        offentliggøres; suiten er sikkerhedsnettet for den, der retter i koden.</p>

      <h2>Sådan gør du det selv</h2>
      <p>Du behøver ikke tro på denne side. Input til hver linje står i første kolonne og kan
        kopieres ind i det program, du foretrækker. I Python er en Welch t-test med de samme tal
        én linje:</p>
      <pre><code>from scipy import stats
stats.ttest_ind(gruppe_a, gruppe_b, equal_var=False)</code></pre>
      <p>Finder du en afvigelse, der ikke er afrundingsstøj? Skriv til
        <a href="/kontakt.html">sitets kontakt</a> med de tal, du brugte. Regnefejl er den
        værste slags fejl, dette site kan have, og den slags rettelser går forrest.</p>

      <h2>Se også</h2>
      <ul>
        <li><a href="/metodologi.html">Metodologi</a> &mdash; formlerne bag hver beregner.</li>
        <li><a href="/kilder.html">Kilder</a> &mdash; bøgerne og referencerne bag formlerne.</li>
        <li><a href="/aendringer.html">Ændringslog</a> &mdash; hvad der er ændret på sitet.</li>
      </ul>

    </article>
  </div>

</main>""" % dict(i_alt=i_alt, afvig=afvig, dato=DATO, raekker="".join(raekker),
                  forbehold=forbehold, kontroller=tael_kontroller())

skabelon = io.open(os.path.join(RAIZ, "metodologi.html"), encoding="utf-8").read()
ny = skabelon[:skabelon.index("<main")] + MAIN + skabelon[skabelon.index("</main>") + 7:]

TITEL = "Numerisk validering af beregnerne | Statistikberegner"
BESKR = ("Hver beregner på dette site holdt op mod SciPy, med begge resultater offentliggjort "
         "side om side og metodeforskellene oplyst.")
ny = re.sub(r"<title>.*?</title>", "<title>%s</title>" % TITEL, ny, flags=re.S)
ny = re.sub(r'(<meta name="description" content=")[^"]*(")', r"\1%s\2" % BESKR, ny)
ny = re.sub(r'(rel="canonical" href="https?://[^/"]+/)[^"]*(")', r"\1validering.html\2", ny)
ny = re.sub(r"<!-- manutencao -->.*?</script>\n", "", ny, flags=re.S)

io.open(os.path.join(RAIZ, "validering.html"), "w", encoding="utf-8").write(ny)
print("validering.html skrevet: %d størrelser, %d afvigelser" % (i_alt, afvig))
