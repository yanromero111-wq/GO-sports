// Registro dos esportes. Para adicionar um esporte novo: crie sports/<id>.js exportando `create(ctx)`
// e adicione os metadados aqui (e o id em shared/progression.js > SPORTS).
export const SPORT_META = {
  tennis: {
    cameraTutorial: [{ em: '🏃', text: 'Dê passos para os lados: seu personagem acompanha você na quadra.' }, { em: '🎾', text: 'Faça o movimento da raquete com o braço quando a bola chegar.' }, { em: '☝️', text: 'Para sacar, faça um movimento rápido de cima para baixo.' }],
    maxLocal: 2,
    lengths: [{ id: 1, label: '1 game' }, { id: 2, label: 'Melhor de 3 games', def: true }, { id: 3, label: 'Melhor de 5 games' }],
    hint: 'Balance o celular para rebater · toque para lançar e saque',
    tutorial: [
      { em: '🏃', text: 'Seu personagem corre sozinho até a bola.' },
      { em: '🎾', text: 'Balance o celular como uma raquete quando a bola chegar.' },
      { em: '⏱️', text: 'Bater cedo manda a bola cruzada; bater tarde, na paralela.' },
      { em: '☝️', text: 'Para sacar: toque no touchpad (ou A) para jogar a bola e balance!' },
    ],
  },
  volleyball: {
    cameraTutorial: [{ em: '⤵️', text: 'Bola vindo: mova os braços rápido para cima (manchete).' }, { em: '💥', text: 'No alto: bata o braço de cima para baixo para cortar.' }, { em: '🛡️', text: 'Rival cortando: levante os braços rápido para bloquear.' }],
    maxLocal: 2,
    lengths: [{ id: 7, label: 'Até 7 pontos' }, { id: 11, label: 'Até 11 pontos', def: true }, { id: 15, label: 'Até 15 pontos' }],
    hint: 'Balance por baixo para manchete e por cima para cortar',
    tutorial: [
      { em: '⤵️', text: 'Quando a bola vier: balance POR BAIXO para a manchete.' },
      { em: '🙌', text: 'Seu colega levanta a bola automaticamente.' },
      { em: '💥', text: 'No alto, balance POR CIMA com força para cortar!' },
      { em: '🛡️', text: 'Balance para cima quando o rival cortar para bloquear.' },
    ],
  },
  bowling: {
    cameraTutorial: [{ em: '↔️', text: 'Dê passos para os lados para escolher a posição na pista.' }, { em: '🎳', text: 'Balance o braço por baixo, de trás para frente, para jogar a bola.' }, { em: '💪', text: 'Movimento mais rápido = bola mais forte.' }],
    maxLocal: 4,
    lengths: [{ id: 3, label: '3 frames' }, { id: 5, label: '5 frames', def: true }, { id: 10, label: '10 frames' }],
    hint: '← → posição · ↑ ↓ ângulo · balance por baixo para jogar',
    tutorial: [
      { em: '👉', text: 'Arraste no touchpad (ou setas) para mudar a posição e o ângulo.' },
      { em: '🎳', text: 'Balance o celular de trás para frente, por baixo, para soltar a bola.' },
      { em: '🔄', text: 'Gire o pulso durante o movimento para dar efeito (curva).' },
      { em: '💪', text: 'Mais força = bola mais rápida.' },
    ],
  },
  golf: {
    cameraTutorial: [{ em: '↔️', text: 'Dê passos para os lados para mirar.' }, { em: '🏌️', text: 'Balance os braços como um taco; a velocidade define a distância.' }, { em: '⛳', text: 'No green, faça um movimento curtinho e lento.' }],
    maxLocal: 4,
    lengths: [{ id: 3, label: '3 buracos', def: true }, { id: 6, label: '6 buracos' }, { id: 9, label: '9 buracos' }],
    hint: '← → mirar · ↑ ↓ trocar taco · balance para a tacada',
    tutorial: [
      { em: '🎯', text: 'Mire com ← → no touchpad ou setas. A linha mostra a direção.' },
      { em: '🏌️', text: 'Balance o celular como um taco: a força define a distância.' },
      { em: '🔄', text: 'Pulso girado demais faz a bola curvar (gancho/slice).' },
      { em: '⛳', text: 'No green, a tacada é bem mais leve. Menos tacadas vence!' },
    ],
  },
  baseball: {
    cameraTutorial: [{ em: '⚾', text: 'Rebatendo: gire os braços como um taco quando a bola chegar.' }, { em: '↔️', text: 'Arremessando: dê um passo para o lado para mirar.' }, { em: '💨', text: 'Faça o movimento de arremesso com o braço.' }],
    maxLocal: 2,
    lengths: [{ id: 1, label: '1 entrada' }, { id: 2, label: '2 entradas', def: true }, { id: 3, label: '3 entradas' }],
    hint: 'Rebatendo: balance na hora certa · Arremessando: mire e balance',
    tutorial: [
      { em: '⚾', text: 'Rebatendo: balance o celular quando a bola chegar na base.' },
      { em: '⏱️', text: 'Cedo = bola puxada; tarde = bola para o lado oposto. Força = distância.' },
      { em: '🎯', text: 'Arremessando: mire com o touchpad/setas e balance para lançar.' },
      { em: '🔄', text: 'Gire o pulso para fazer a bola curvar.' },
    ],
  },
  boxing: {
    cameraTutorial: [{ em: '👊', text: 'Soque para a frente de verdade (as duas mãos funcionam).' }, { em: '🛡️', text: 'Mãos na frente do rosto = guarda.' }, { em: '↔️', text: 'Incline a cabeça e o corpo para o lado para desviar.' }],
    maxLocal: 2,
    lengths: [{ id: 1, label: '1 round' }, { id: 2, label: '2 rounds', def: true }, { id: 3, label: '3 rounds' }],
    hint: 'Soque balançando · segure GUARDA para defender · incline para desviar',
    actions: [{ id: 'guard', label: '🛡️ GUARDA (segure)', color: '#3a86ff' }],
    tutorial: [
      { em: '👊', text: 'Balance para frente para socar (alterna as mãos).' },
      { em: '↪️', text: 'Balance para o lado = gancho · para cima = uppercut.' },
      { em: '🛡️', text: 'Segure GUARDA no celular (ou erga o celular) para defender.' },
      { em: '↔️', text: 'Incline o celular para os lados para desviar. Teclado: J/K socos, L guarda, A/D desvio.' },
    ],
  },
  basketball: {
    cameraTutorial: [{ em: '🏀', text: 'Faça o movimento de arremesso: braços rápido para cima.' }, { em: '📏', text: 'Mais rápido = mais longe. Veja a dica depois de cada arremesso.' }],
    maxLocal: 4,
    lengths: [{ id: 3, label: '3 posições' }, { id: 5, label: '5 posições', def: true }],
    hint: 'Balance para cima para arremessar · força certa = cesta!',
    tutorial: [
      { em: '🏀', text: 'Balance o celular para cima, como num arremesso.' },
      { em: '📏', text: 'A força define a distância. Veja a dica depois de cada arremesso.' },
      { em: '↔️', text: 'Balançar torto para os lados desvia a bola.' },
      { em: '⭐', text: 'A última bola de cada posição vale 2 pontos!' },
    ],
  },
  pingpong: {
    cameraTutorial: [{ em: '🏃', text: 'Dê passinhos para os lados para acompanhar a bola.' }, { em: '🏓', text: 'Faça o movimento da raquete com o braço quando a bola chegar.' }],
    maxLocal: 2,
    lengths: [{ id: 5, label: 'Até 5 pontos' }, { id: 7, label: 'Até 7 pontos', def: true }, { id: 11, label: 'Até 11 pontos' }],
    hint: 'Balance para rebater · gire o pulso para dar efeito',
    tutorial: [
      { em: '🏓', text: 'Seu personagem se posiciona sozinho.' },
      { em: '⚡', text: 'Balance o celular quando a bola chegar. A bola é rápida!' },
      { em: '🔄', text: 'Gire o pulso durante o golpe para dar efeito.' },
      { em: '☝️', text: 'Para sacar, toque no touchpad (ou A) e balance.' },
    ],
  },
  archery: {
    cameraTutorial: [{ em: '🫲', text: 'Estique o braço ESQUERDO apontando para o alvo: ele é a mira.' }, { em: '↔️', text: 'Afaste as mãos (puxe a corda com a mão direita) para esticar o arco.' }, { em: '🎯', text: 'Junte as mãos de novo para soltar a flecha.' }],
    maxLocal: 4,
    lengths: [{ id: 3, label: '3 séries', def: true }, { id: 4, label: '4 séries' }, { id: 6, label: '6 séries' }],
    hint: 'Segure PUXAR, mire apontando o celular e solte para atirar',
    actions: [{ id: 'draw', label: '🏹 PUXAR (segure e solte)', color: '#8e7dff' }],
    tutorial: [
      { em: '✊', text: 'Segure PUXAR no celular (ou botão direito do mouse / F) para esticar a corda.' },
      { em: '📱', text: 'Aponte o celular (ou mova o mouse) para mirar.' },
      { em: '🌬️', text: 'Atenção ao vento e à distância: mire um pouco acima e contra o vento.' },
      { em: '🎯', text: 'Solte o botão para atirar. Centro = 10 pontos!' },
    ],
  },
};

export const loadSport = (id) => import(`./${id}.js`);
