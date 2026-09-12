// ===============================================================
// HÁBITO TRACKER - MÓDULO DE DESAFIOS ENTRE AMIGOS & RANKING
// Módulo isolado: challenges.js
// ===============================================================

import { firebaseConfig } from './firebase-config.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ===============================================================
// ESTADO DO MÓDULO DE DESAFIOS
// ===============================================================
export const estadoDesafios = {
  usuarioAtual: {
    id: localStorage.getItem('habito_user_id') || 'user_jardineiro_eu',
    nome: localStorage.getItem('habito_user_name') || 'Você (Jardineiro)',
    avatar: '🌱'
  },
  amigos: [],
  desafios: [],
  filtroDesafios: 'todos', // 'todos', 'ativos', 'pendentes', 'concluidos'
  rankingExpandido: false,
  modoDemoLocal: true,
  desafioParaRevisar: null
};

// Coleções do Firestore
const COLECAO_DESAFIOS = 'desafios';
const COLECAO_AMIZADES = 'amizades';
let dbInstance = null;

/**
 * Inicializa o serviço de desafios integrado ao Firestore ou com fallback local
 */
export function inicializarDesafios(db, modoDemo) {
  dbInstance = db;
  estadoDesafios.modoDemoLocal = modoDemo;

  // Garante ID de usuário persistente
  if (!localStorage.getItem('habito_user_id')) {
    const novoId = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('habito_user_id', novoId);
    estadoDesafios.usuarioAtual.id = novoId;
  }

  if (modoDemo || !db) {
    carregarDesafiosLocais();
  } else {
    iniciarEscutaFirestoreDesafios();
  }
}

/**
 * Carrega dados iniciais simulados para demonstração e testes locais
 */
function carregarDesafiosLocais() {
  const desafiosSalvos = localStorage.getItem('habito_tracker_desafios');
  const amigosSalvos = localStorage.getItem('habito_tracker_amigos');

  if (amigosSalvos) {
    try {
      estadoDesafios.amigos = JSON.parse(amigosSalvos);
    } catch (e) {
      estadoDesafios.amigos = [];
    }
  } else {
    // Amigos iniciais charmosos para ranking e desafios
    estadoDesafios.amigos = [
      { id: 'amigo_ana', nome: 'Ana Clara', email: 'ana@exemplo.com', avatar: '🌸', streakTotal: 34, nivelGlobal: 3 },
      { id: 'amigo_marcos', nome: 'Marcos Silva', email: 'marcos@exemplo.com', avatar: '🌲', streakTotal: 28, nivelGlobal: 2 },
      { id: 'amigo_julia', nome: 'Júlia Botan', email: 'julia@exemplo.com', avatar: '🌺', streakTotal: 19, nivelGlobal: 2 },
      { id: 'amigo_leo', nome: 'Leonardo Lima', email: 'leo@exemplo.com', avatar: '🌿', streakTotal: 8, nivelGlobal: 1 }
    ];
    salvarAmigosLocais();
  }

  if (desafiosSalvos) {
    try {
      estadoDesafios.desafios = JSON.parse(desafiosSalvos);
    } catch (e) {
      estadoDesafios.desafios = [];
    }
  } else {
    const hoje = new Date();
    const dataFim7 = new Date();
    dataFim7.setDate(hoje.getDate() + 5);

    // Desafio de exemplo ativo
    estadoDesafios.desafios = [
      {
        id: 'desafio_demo_1',
        usuarioA: estadoDesafios.usuarioAtual.id,
        nomeUsuarioA: estadoDesafios.usuarioAtual.nome,
        usuarioB: 'amigo_ana',
        nomeUsuarioB: 'Ana Clara',
        habito: 'Beber 2L de Água',
        emojiHabito: '💧',
        dataInicio: new Date(Date.now() - 2 * 86400000).toISOString(),
        dataFim: dataFim7.toISOString(),
        duracao: 7,
        objetivo: 'streak',
        metaMarcacoes: 7,
        progressoA: 2,
        progressoB: 2,
        statusA: 'ativo',
        statusB: 'ativo',
        resultado: 'em_andamento',
        vencedor: null,
        linkConvite: 'convite_' + Math.random().toString(36).substring(2, 9),
        dataCriacao: new Date(Date.now() - 2 * 86400000).toISOString()
      },
      {
        id: 'desafio_demo_2',
        usuarioA: 'amigo_marcos',
        nomeUsuarioA: 'Marcos Silva',
        usuarioB: estadoDesafios.usuarioAtual.id,
        nomeUsuarioB: estadoDesafios.usuarioAtual.nome,
        habito: 'Leitura diária (15 min)',
        emojiHabito: '📚',
        dataInicio: new Date().toISOString(),
        dataFim: new Date(Date.now() + 14 * 86400000).toISOString(),
        duracao: 14,
        objetivo: 'marcacoes',
        metaMarcacoes: 10,
        progressoA: 1,
        progressoB: 0,
        statusA: 'ativo',
        statusB: 'pendente',
        resultado: 'pendente',
        vencedor: null,
        linkConvite: 'convite_' + Math.random().toString(36).substring(2, 9),
        dataCriacao: new Date().toISOString()
      }
    ];
    salvarDesafiosLocais();
  }

  processarStatusDesafios();
}

function salvarDesafiosLocais() {
  localStorage.setItem('habito_tracker_desafios', JSON.stringify(estadoDesafios.desafios));
}

function salvarAmigosLocais() {
  localStorage.setItem('habito_tracker_amigos', JSON.stringify(estadoDesafios.amigos));
}

/**
 * Escuta coleção de Desafios em tempo real no Firestore
 */
function iniciarEscutaFirestoreDesafios() {
  if (!dbInstance) return;

  const q = query(collection(dbInstance, COLECAO_DESAFIOS), orderBy('dataCriacao', 'desc'));

  onSnapshot(q, (snapshot) => {
    const lista = [];
    snapshot.forEach((documento) => {
      lista.push({
        id: documento.id,
        ...documento.data()
      });
    });

    estadoDesafios.desafios = lista;
    processarStatusDesafios();
  }, (erro) => {
    console.error('[Desafios] Erro ao sincronizar desafios do Firestore:', erro);
  });
}

// ===============================================================
// REGRAS DE NEGÓCIO: CRIAÇÃO, RESPOSTA E COMPETIÇÃO
// ===============================================================

/**
 * Cria um novo desafio com validações estritas
 */
export async function criarDesafio({ amigoId, nomeAmigo, habitoNome, emojiHabito, duracao, objetivo, metaMarcacoes }) {
  const meuId = estadoDesafios.usuarioAtual.id;
  const duracaoNum = Number(duracao) || 7;
  const metaNum = objetivo === 'marcacoes' ? (Number(metaMarcacoes) || duracaoNum) : duracaoNum;

  // Validação: Impedir autodesafio
  if (amigoId === meuId) {
    throw new Error('Você não pode criar um desafio contra você mesmo! Convide um amigo.');
  }

  if (!amigoId || !habitoNome) {
    throw new Error('Selecione um amigo e um hábito válido para criar o desafio.');
  }

  // Validação: Evitar desafios duplicados ativos no mesmo hábito entre os mesmos usuários
  const duplicado = estadoDesafios.desafios.some((d) => {
    const mesmosUsuarios = (d.usuarioA === meuId && d.usuarioB === amigoId) || 
                           (d.usuarioA === amigoId && d.usuarioB === meuId);
    const mesmoHabito = d.habito.toLowerCase() === habitoNome.toLowerCase();
    const estaAtivo = d.resultado === 'em_andamento' || d.resultado === 'pendente';
    return mesmosUsuarios && mesmoHabito && estaAtivo;
  });

  if (duplicado) {
    throw new Error(`Já existe um desafio ativo ou pendente de "${habitoNome}" com este amigo.`);
  }

  const agora = new Date();
  const dataFim = new Date();
  dataFim.setDate(agora.getDate() + duracaoNum);

  const linkHash = 'chal_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  const novoDesafio = {
    usuarioA: meuId,
    nomeUsuarioA: estadoDesafios.usuarioAtual.nome,
    usuarioB: amigoId,
    nomeUsuarioB: nomeAmigo || 'Amigo',
    habito: habitoNome,
    emojiHabito: emojiHabito || '🌱',
    dataInicio: agora.toISOString(),
    dataFim: dataFim.toISOString(),
    duracao: duracaoNum,
    objetivo: objetivo || 'streak', // 'streak' ou 'marcacoes'
    metaMarcacoes: metaNum,
    progressoA: 0,
    progressoB: 0,
    statusA: 'ativo',
    statusB: 'pendente',
    resultado: 'pendente',
    vencedor: null,
    linkConvite: linkHash,
    dataCriacao: estadoDesafios.modoDemoLocal ? agora.toISOString() : serverTimestamp()
  };

  if (!estadoDesafios.modoDemoLocal && dbInstance) {
    const docRef = await addDoc(collection(dbInstance, COLECAO_DESAFIOS), novoDesafio);
    return { id: docRef.id, ...novoDesafio };
  } else {
    const desafioLocal = {
      id: 'desafio_' + Date.now(),
      ...novoDesafio,
      dataCriacao: agora.toISOString()
    };
    estadoDesafios.desafios.unshift(desafioLocal);
    salvarDesafiosLocais();
    processarStatusDesafios();
    return desafioLocal;
  }
}

/**
 * Aceitar um desafio recebido
 */
export async function aceitarDesafio(desafioId) {
  const desafio = estadoDesafios.desafios.find((d) => d.id === desafioId);
  if (!desafio) throw new Error('Desafio não encontrado.');

  const agora = new Date();
  const dataFim = new Date();
  dataFim.setDate(agora.getDate() + (Number(desafio.duracao) || 7));

  if (!estadoDesafios.modoDemoLocal && dbInstance) {
    const docRef = doc(dbInstance, COLECAO_DESAFIOS, desafioId);
    await updateDoc(docRef, {
      statusB: 'ativo',
      resultado: 'em_andamento',
      dataInicio: agora.toISOString(),
      dataFim: dataFim.toISOString()
    });
  } else {
    desafio.statusB = 'ativo';
    desafio.resultado = 'em_andamento';
    desafio.dataInicio = agora.toISOString();
    desafio.dataFim = dataFim.toISOString();
    salvarDesafiosLocais();
    processarStatusDesafios();
  }
}

/**
 * Rejeitar ou cancelar um desafio
 */
export async function rejeitarDesafio(desafioId) {
  const desafio = estadoDesafios.desafios.find((d) => d.id === desafioId);
  if (!desafio) throw new Error('Desafio não encontrado.');

  if (!estadoDesafios.modoDemoLocal && dbInstance) {
    const docRef = doc(dbInstance, COLECAO_DESAFIOS, desafioId);
    await updateDoc(docRef, {
      resultado: 'rejeitado',
      statusB: 'rejeitado'
    });
  } else {
    desafio.resultado = 'rejeitado';
    desafio.statusB = 'rejeitado';
    salvarDesafiosLocais();
    processarStatusDesafios();
  }
}

/**
 * Atualiza o progresso do usuário em todos os desafios ativos vinculados ao hábito marcado
 */
export async function atualizarProgressoDesafiosPorHabito(habitoNome, novoStreak, novoTotal) {
  const meuId = estadoDesafios.usuarioAtual.id;
  const hoje = new Date();

  for (const d of estadoDesafios.desafios) {
    if (d.resultado !== 'em_andamento') continue;
    if (d.habito.toLowerCase() !== habitoNome.toLowerCase()) continue;

    const souUsuarioA = d.usuarioA === meuId;
    const souUsuarioB = d.usuarioB === meuId;
    if (!souUsuarioA && !souUsuarioB) continue;

    const valorProgresso = d.objetivo === 'streak' ? novoStreak : novoTotal;
    const campoProgresso = souUsuarioA ? 'progressoA' : 'progressoB';

    d[campoProgresso] = valorProgresso;

    // Verifica se atingiu a meta ou finalizou o prazo
    verificarConclusaoDesafio(d, hoje);

    if (!estadoDesafios.modoDemoLocal && dbInstance) {
      const docRef = doc(dbInstance, COLECAO_DESAFIOS, d.id);
      await updateDoc(docRef, {
        [campoProgresso]: valorProgresso,
        resultado: d.resultado,
        vencedor: d.vencedor
      });
    }
  }

  if (estadoDesafios.modoDemoLocal) {
    salvarDesafiosLocais();
    processarStatusDesafios();
  }
}

/**
 * Processa se o desafio expirou ou se alguém alcançou a meta máxima
 */
function verificarConclusaoDesafio(desafio, dataAtual = new Date()) {
  const dataFim = new Date(desafio.dataFim);
  const expirou = dataAtual > dataFim;
  const meta = Number(desafio.metaMarcacoes) || Number(desafio.duracao) || 7;

  const progA = Number(desafio.progressoA) || 0;
  const progB = Number(desafio.progressoB) || 0;

  if (desafio.objetivo === 'marcacoes') {
    if (progA >= meta && progB < meta) {
      desafio.resultado = 'finalizado';
      desafio.vencedor = desafio.usuarioA;
    } else if (progB >= meta && progA < meta) {
      desafio.resultado = 'finalizado';
      desafio.vencedor = desafio.usuarioB;
    } else if (progA >= meta && progB >= meta) {
      desafio.resultado = 'finalizado';
      desafio.vencedor = 'empate';
    }
  }

  if (expirou && desafio.resultado === 'em_andamento') {
    desafio.resultado = 'finalizado';
    if (progA > progB) {
      desafio.vencedor = desafio.usuarioA;
    } else if (progB > progA) {
      desafio.vencedor = desafio.usuarioB;
    } else {
      desafio.vencedor = 'empate';
    }
  }
}

/**
 * Atualiza todos os desafios verificando prazos e dispara a renderização
 */
export function processarStatusDesafios() {
  const agora = new Date();
  estadoDesafios.desafios.forEach((d) => {
    if (d.resultado === 'em_andamento') {
      verificarConclusaoDesafio(d, agora);
    }
  });

  renderizarSecaoDesafios();
  renderizarRanking();
  atualizarBadgeNotificacoes();
}

// ===============================================================
// RENDERIZAÇÃO DA INTERFACE: RANKING & DESAFIOS
// ===============================================================

/**
 * Renderiza a seção de ranking com pódio e lista
 */
export function renderizarRanking(habitosDoUsuario = []) {
  const container = document.getElementById('ranking-list-container');
  const userPositionEl = document.getElementById('user-ranking-position');
  if (!container) return;

  // Calcula streak total do usuário logado
  const streakTotalUsuario = habitosDoUsuario.reduce((acc, h) => acc + (Number(h.streak) || 0), 0);
  
  // Monta tabela geral com usuário + amigos
  const listaCompleta = [
    {
      id: estadoDesafios.usuarioAtual.id,
      nome: estadoDesafios.usuarioAtual.nome,
      avatar: '🌱',
      streakTotal: streakTotalUsuario,
      isUser: true
    },
    ...estadoDesafios.amigos.map((a) => ({ ...a, isUser: false }))
  ];

  // Ordena por streak total decrescente
  listaCompleta.sort((a, b) => b.streakTotal - a.streakTotal);

  // Determina posição do usuário
  const posicaoUsuario = listaCompleta.findIndex((item) => item.isUser) + 1;
  if (userPositionEl) {
    userPositionEl.textContent = `Você está em ${posicaoUsuario}º lugar`;
  }

  const itensExibir = estadoDesafios.rankingExpandido ? listaCompleta : listaCompleta.slice(0, 3);

  container.innerHTML = '';

  itensExibir.forEach((item, index) => {
    const posicao = index + 1;
    let medalha = '';
    if (posicao === 1) medalha = '🏆';
    else if (posicao === 2) medalha = '🥈';
    else if (posicao === 3) medalha = '🥉';
    else medalha = `#${posicao}`;

    const card = document.createElement('div');
    card.className = `ranking-item-card ${item.isUser ? 'ranking-item-highlight' : ''}`;
    
    card.innerHTML = `
      <div class="ranking-position-badge ${posicao <= 3 ? 'medal-badge' : ''}">${medalha}</div>
      <div class="ranking-avatar">${item.avatar || '🌱'}</div>
      <div class="ranking-info">
        <div class="ranking-name-row">
          <strong>${item.nome} ${item.isUser ? '<span class="you-badge">(Você)</span>' : ''}</strong>
        </div>
        <span class="ranking-meta">${item.streakTotal} dias acumulados em streaks</span>
      </div>
      <div class="ranking-score">
        <span class="score-val">${item.streakTotal}d</span>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Renderiza os cards de desafios (ativos, pendentes e histórico)
 */
export function renderizarSecaoDesafios() {
  const grid = document.getElementById('challenges-grid');
  const emptyState = document.getElementById('challenges-empty-state');
  if (!grid) return;

  let filtrados = [...estadoDesafios.desafios];
  const filtro = estadoDesafios.filtroDesafios;

  if (filtro === 'ativos') {
    filtrados = filtrados.filter((d) => d.resultado === 'em_andamento');
  } else if (filtro === 'pendentes') {
    filtrados = filtrados.filter((d) => d.resultado === 'pendente');
  } else if (filtro === 'concluidos') {
    filtrados = filtrados.filter((d) => d.resultado === 'finalizado' || d.resultado === 'rejeitado');
  }

  if (filtrados.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  grid.innerHTML = '';

  const meuId = estadoDesafios.usuarioAtual.id;

  filtrados.forEach((desafio) => {
    const souA = desafio.usuarioA === meuId;
    const nomeOponente = souA ? desafio.nomeUsuarioB : desafio.nomeUsuarioA;
    const progressoMeu = souA ? (desafio.progressoA || 0) : (desafio.progressoB || 0);
    const progressoOponente = souA ? (desafio.progressoB || 0) : (desafio.progressoA || 0);

    const meta = Number(desafio.metaMarcacoes) || Number(desafio.duracao) || 7;
    const pctMeu = Math.min(100, Math.round((progressoMeu / meta) * 100));
    const pctOponente = Math.min(100, Math.round((progressoOponente / meta) * 100));

    const estouNaFrente = progressoMeu > progressoOponente;
    const empate = progressoMeu === progressoOponente;

    const dataFim = new Date(desafio.dataFim);
    const diasRestantes = Math.max(0, Math.ceil((dataFim.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    const card = document.createElement('div');
    card.className = `challenge-card status-${desafio.resultado}`;

    let statusBadge = '';
    if (desafio.resultado === 'pendente') {
      statusBadge = `<span class="challenge-tag tag-pending">⏳ Convite Pendente</span>`;
    } else if (desafio.resultado === 'em_andamento') {
      statusBadge = `<span class="challenge-tag tag-active">⚡ Em Andamento (${diasRestantes}d restantes)</span>`;
    } else if (desafio.resultado === 'finalizado') {
      const venci = desafio.vencedor === meuId;
      if (venci) {
        statusBadge = `<span class="challenge-tag tag-win">🏆 Você Venceu!</span>`;
      } else if (desafio.vencedor === 'empate') {
        statusBadge = `<span class="challenge-tag tag-tie">🤝 Empate</span>`;
      } else {
        statusBadge = `<span class="challenge-tag tag-loss">🥈 ${nomeOponente} Venceu</span>`;
      }
    } else if (desafio.resultado === 'rejeitado') {
      statusBadge = `<span class="challenge-tag tag-rejected">❌ Rejeitado</span>`;
    }

    // Ações contextuais
    let botoesAcao = '';
    if (desafio.resultado === 'pendente') {
      if (!souA) {
        botoesAcao = `
          <div class="challenge-actions-row">
            <button class="btn btn-primary btn-sm btn-accept-chal" data-id="${desafio.id}">Aceitar Desafio ⚔️</button>
            <button class="btn btn-secondary btn-sm btn-reject-chal" data-id="${desafio.id}">Recusar</button>
          </div>
        `;
      } else {
        botoesAcao = `
          <div class="challenge-actions-row">
            <button class="btn btn-secondary btn-sm btn-copy-link" data-link="${desafio.linkConvite}">
              <span>🔗 Copiar Link de Convite</span>
            </button>
          </div>
        `;
      }
    } else if (desafio.resultado === 'finalizado' || desafio.resultado === 'rejeitado') {
      botoesAcao = `
        <div class="challenge-actions-row">
          <button class="btn btn-secondary btn-sm btn-rematch" data-id="${desafio.id}">
            <span>🔄 Reeditar Desafio</span>
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="challenge-card-header">
        <div class="challenge-habit-title">
          <span class="chal-habit-emoji">${desafio.emojiHabito || '🌱'}</span>
          <div>
            <h4>${desafio.habito}</h4>
            <span class="chal-meta-sub">${desafio.duracao} dias &bull; ${desafio.objetivo === 'streak' ? 'Manter Streak' : `Meta: ${meta} regas`}</span>
          </div>
        </div>
        ${statusBadge}
      </div>

      <div class="challenge-vs-container">
        <!-- Competidor Você -->
        <div class="competitor-column ${estouNaFrente && desafio.resultado === 'em_andamento' ? 'leading' : ''}">
          <div class="competitor-header">
            <span class="comp-name">Você</span>
            <span class="comp-score">${progressoMeu} / ${meta}</span>
          </div>
          <div class="comp-track">
            <div class="comp-bar comp-bar-me" style="width: ${pctMeu}%;"></div>
          </div>
        </div>

        <div class="vs-divider">VS</div>

        <!-- Competidor Oponente -->
        <div class="competitor-column ${!estouNaFrente && !empate && desafio.resultado === 'em_andamento' ? 'leading' : ''}">
          <div class="competitor-header">
            <span class="comp-name">${nomeOponente}</span>
            <span class="comp-score">${progressoOponente} / ${meta}</span>
          </div>
          <div class="comp-track">
            <div class="comp-bar comp-bar-op" style="width: ${pctOponente}%;"></div>
          </div>
        </div>
      </div>

      ${botoesAcao}
    `;

    grid.appendChild(card);
  });

  atribuirEventosDesafios();
}

/**
 * Atribui os eventos de clique dos botões dos cards de desafios
 */
function atribuirEventosDesafios() {
  document.querySelectorAll('.btn-accept-chal').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await aceitarDesafio(id);
        mostrarToast('⚔️ Desafio aceito! Que vença o mais consistente!', 'success');
      } catch (e) {
        mostrarToast(e.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-reject-chal').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await rejeitarDesafio(id);
        mostrarToast('Desafio recusado.', 'info');
      } catch (e) {
        mostrarToast(e.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-copy-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const link = btn.getAttribute('data-link');
      const urlCompleta = `${window.location.origin}${window.location.pathname}?convite=${link}`;
      navigator.clipboard.writeText(urlCompleta);
      btn.innerHTML = '<span>✅ Link Copiado!</span>';
      mostrarToast('🔗 Link de convite copiado para a área de transferência!', 'success');
      setTimeout(() => {
        btn.innerHTML = '<span>🔗 Copiar Link de Convite</span>';
      }, 3000);
    });
  });

  document.querySelectorAll('.btn-rematch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const desafio = estadoDesafios.desafios.find((d) => d.id === id);
      if (desafio) {
        preencherEabrirModalDesafio(desafio);
      }
    });
  });
}

function preencherEabrirModalDesafio(desafioOriginal) {
  const modal = document.getElementById('modal-create-challenge');
  if (!modal) return;

  const selectAmigo = document.getElementById('select-challenge-friend');
  const selectHabito = document.getElementById('select-challenge-habit');
  const selectDuracao = document.getElementById('select-challenge-duration');
  const radioStreak = document.getElementById('radio-obj-streak');
  const radioMarcacoes = document.getElementById('radio-obj-marcacoes');

  const meuId = estadoDesafios.usuarioAtual.id;
  const amigoId = desafioOriginal.usuarioA === meuId ? desafioOriginal.usuarioB : desafioOriginal.usuarioA;

  if (selectAmigo) selectAmigo.value = amigoId;
  if (selectHabito) selectHabito.value = desafioOriginal.habito;
  if (selectDuracao) selectDuracao.value = desafioOriginal.duracao;

  if (desafioOriginal.objetivo === 'marcacoes') {
    if (radioMarcacoes) radioMarcacoes.checked = true;
  } else {
    if (radioStreak) radioStreak.checked = true;
  }

  modal.classList.remove('hidden');
}

/**
 * Atualiza o badge numérico no botão de desafios no header
 */
function atualizarBadgeNotificacoes() {
  const badge = document.getElementById('challenges-badge-count');
  if (!badge) return;

  const meuId = estadoDesafios.usuarioAtual.id;
  const pendentesParaMim = estadoDesafios.desafios.filter(
    (d) => d.usuarioB === meuId && d.resultado === 'pendente'
  ).length;

  if (pendentesParaMim > 0) {
    badge.textContent = pendentesParaMim;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function mostrarToast(msg, tipo = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<span class="toast-text">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
