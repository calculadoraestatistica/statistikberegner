/* ==========================================================================
   config.js — Configuração do site
   --------------------------------------------------------------------------
   MONETIZAÇÃO (Google AdSense)
   A biblioteca do Google AdSense é carregada diretamente no <head> de cada
   página (a tag <script> do AdSense, com o ID ca-pub-7516029395999799).
   Com os "Anúncios automáticos" ligados no painel do AdSense, o Google cuida
   sozinho do posicionamento dos anúncios — nada mais precisa ser feito aqui.

   O campo "adsenseClient" abaixo é usado APENAS para posicionamento MANUAL:
   quando preenchido, o site cria unidades de anúncio nos espaços
   <div class="ad-slot"> das páginas. Para usar o modo manual, crie unidades
   no painel do AdSense e preencha o atributo data-ad-slot de cada espaço.
   ========================================================================== */
window.SITE_CONFIG = {
  // ID do publisher no AdSense (ca-pub-...). Preencha só para anúncios manuais.
  adsenseClient: "",

  // Endereço público do site (usado em metadados).
  baseUrl: "https://statistikberegner.dk"
};
