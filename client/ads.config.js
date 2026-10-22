// ===================== CONFIGURAÇÃO DE ANÚNCIOS =====================
// Cole aqui seus IDs do Google AdSense depois que sua conta for aprovada.
// Veja o passo a passo em TUTORIAL_PUBLICAR.md (seção "Anúncios").
export const ADS_CONFIG = {
  // Seu ID de editor do AdSense, no formato 'ca-pub-0000000000000000'. Vazio = sem anúncios reais.
  ADSENSE_CLIENT: '',

  // ID do bloco de anúncio de banner (AdSense > Anúncios > Por bloco de anúncio > Display). Opcional.
  BANNER_SLOT: '',

  // Enquanto o site não estiver aprovado para "Anúncios para jogos H5" (Ad Placement API), deixe true.
  // Com true o Google mostra anúncios de teste nos intervalos e vídeos premiados.
  TEST_MODE: true,

  // Limites de frequência dos anúncios entre partidas (intersticiais).
  INTERSTITIAL_EVERY_N_MATCHES: 3, // no máximo 1 a cada N partidas
  INTERSTITIAL_MIN_SECONDS: 180, // e no mínimo este intervalo de tempo

  // Em desenvolvimento (sem ADSENSE_CLIENT), mostra espaços e anúncios simulados para testar o fluxo.
  SIMULATE_WHEN_NO_ID: true,

  // Preparado para o futuro "Remover anúncios" (compra única). O perfil guarda entitlements.noAds.
  REMOVE_ADS_PRODUCT_ID: 'remove_ads',
};
