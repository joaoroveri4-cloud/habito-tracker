// ===============================================================
// HÁBITO TRACKER - JARDINAGEM VIRTUAL DE HÁBITOS
// Aplicação Vanilla JS com integração ao Firebase Firestore
// ===============================================================

import { firebaseConfig } from './firebase-config.js';
import { 
  inicializarDesafios, 
  criarDesafio, 
  atualizarProgressoDesafiosPorHabito, 
  renderizarRanking, 
  renderizarSecaoDesafios, 
  estadoDesafios 
} from './challenges.js';

// Firebase v10 via CDN ES Modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ===============================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ===============================================================
const estado = {
  habitos: [],
  filtroAtual: 'all', // 'all', 'pending', 'completed'
  tema: localStorage.getItem('habito_tracker_theme') || 'light',
  modoDemoLocal: false,
  habitoParaExcluirId: null
};

// ===============================================================
// INICIALIZAÇÃO DO FIREBASE COM FALLBACK INTELIGENTE
// ===============================================================
let db = null;
const COLECAO_HABITOS = 'habitos';

function inicializarFirebase() {
  const isPlaceholder = !firebaseConfig.apiKey || 
                        firebaseConfig.apiKey === 'SUA_API_KEY_AQUI' ||
                        firebaseConfig.projectId === 'SEU_PROJECT_ID';

  const banner = document.getElementById('firebase-status-banner');
  const bannerText = document.getElementById('banner-text');

  if (isPlaceholder) {
    console.warn('[Hábito Tracker] Credenciais do Firebase não preenchidas. Ativando modo demonstração local com LocalStorage.');
    estado.modoDemoLocal = true;
    
    if (banner && bannerText) {
      banner.classList.remove('hidden');
      banner.classList.add('banner-warning');
      bannerText.innerHTML = '⚡ <strong>Modo Demonstração Local:</strong> Insira suas credenciais reais no arquivo <code>firebase-config.js</code> para sincronização na nuvem com o Firestore.';
    }
    
    carregarHabitosLocais();
    inicializarDesafios(null, true);
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('[Hábito Tracker] Firebase Firestore conectado com sucesso!');
    
    if (banner && bannerText) {
      banner.classList.remove('hidden');
      banner.classList.add('banner-success');
      bannerText.innerHTML = '✅ <strong>Conectado ao Firebase Firestore:</strong> Seus hábitos e desafios estão sendo sincronizados em tempo real na nuvem.';
      setTimeout(() => banner.classList.add('hidden'), 5000);
    }

    iniciarEscutaFirestore();
    inicializarDesafios(db, false);
  } catch (erro) {
    console.error('[Hábito Tracker] Erro ao inicializar Firebase:', erro);
    estado.modoDemoLocal = true;
    
    if (banner && bannerText) {
      banner.classList.remove('hidden');
      banner.classList.add('banner-warning');
      bannerText.innerHTML = '⚠️ <strong>Erro na conexão com Firebase:</strong> Usando armazenamento local temporário. Verifique seu <code>firebase-config.js</code>.';
    }
    
    carregarHabitosLocais();
    inicializarDesafios(null, true);
  }
}

// ===============================================================
// SERVIÇO DE DADOS (FIRESTORE & LOCAL STORAGE)
// ===============================================================

/**
 * Escuta mudanças em tempo real na coleção 'habitos' do Firestore
 */
function iniciarEscutaFirestore() {
  const q = query(collection(db, COLECAO_HABITOS), orderBy('criadoEm', 'desc'));

  onSnapshot(q, (snapshot) => {
    const lista = [];
    snapshot.forEach((documento) => {
      const dados = documento.data();
      lista.push({
        id: documento.id,
        ...dados
      });
    });

    estado.habitos = processarStreaksHabitos(lista);
    renderizarInterface();
    ocultarCarregamento();
  }, (erro) => {
    console.error('Erro no snapshot do Firestore:', erro);
    exibirToast('Erro ao sincronizar com o Firestore', 'error');
    ocultarCarregamento();
  });
}

/**
 * Carrega hábitos do LocalStorage no modo demo/fallback
 */
function carregarHabitosLocais() {
  const dadosSalvos = localStorage.getItem('habito_tracker_dados');
  if (dadosSalvos) {
    try {
      const lista = JSON.parse(dadosSalvos);
      estado.habitos = processarStreaksHabitos(lista);
    } catch (e) {
      estado.habitos = [];
    }
  } else {
    // Dados iniciais de demonstração
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    estado.habitos = [
      {
        id: 'demo-1',
        nome: 'Beber 2L de Água',
        emoji: '💧',
        streak: 5,
        totalMarcacoes: 12,
        dataUltimaMarcacao: ontem.toISOString(),
        dataMarcacaoAnterior: null,
        streakAnterior: 4,
        criadoEm: new Date(Date.now() - 15 * 86400000).toISOString(),
        uid: ''
      },
      {
        id: 'demo-2',
        nome: 'Leitura diária (15 min)',
        emoji: '📚',
        streak: 8,
        totalMarcacoes: 22,
        dataUltimaMarcacao: hoje.toISOString(),
        dataMarcacaoAnterior: ontem.toISOString(),
        streakAnterior: 7,
        criadoEm: new Date(Date.now() - 30 * 86400000).toISOString(),
        uid: ''
      },
      {
        id: 'demo-3',
        nome: 'Meditação Matinal',
        emoji: '🧘',
        streak: 1,
        totalMarcacoes: 3,
        dataUltimaMarcacao: null,
        dataMarcacaoAnterior: null,
        streakAnterior: 0,
        criadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
        uid: ''
      }
    ];
    salvarHabitosLocais();
  }

  renderizarInterface();
  ocultarCarregamento();
}

function salvarHabitosLocais() {
  localStorage.setItem('habito_tracker_dados', JSON.stringify(estado.habitos));
}

// ===============================================================
// REGRAS DE NEGÓCIO: NÍVEIS, STREAKS & NÍVEL GLOBAL DO USUÁRIO
// ===============================================================

function obterInformacoesNivel(streak) {
  const dias = Math.max(0, streak || 0);

  if (dias <= 3) {
    return {
      nivel: 1,
      plantaIcone: '🌱',
      nomeNivel: 'Broto',
      descricao: 'Nível 1 (0-3 dias)'
    };
  } else if (dias <= 7) {
    return {
      nivel: 2,
      plantaIcone: '🌿',
      nomeNivel: 'Muda',
      descricao: 'Nível 2 (4-7 dias)'
    };
  } else if (dias <= 14) {
    return {
      nivel: 3,
      plantaIcone: '🪴',
      nomeNivel: 'Planta',
      descricao: 'Nível 3 (8-14 dias)'
    };
  } else {
    return {
      nivel: 4,
      plantaIcone: '🌳',
      nomeNivel: 'Árvore Frondosa',
      descricao: 'Nível 4 (15+ dias)'
    };
  }
}

function calcularNivelGlobal(habitos) {
  const totalDiasStreaks = habitos.reduce((acumulado, h) => {
    return acumulado + (Math.max(0, Number(h.streak) || 0));
  }, 0);

  let nivel = 1;
  let icone = '🌱';
  let nomeNivel = 'Jardineiro Broto';
  let descricao = 'Você está iniciando sua jornada de cultivo diário.';
  let proximoNivelDias = 10;
  let porcentagemProgresso = 0;

  if (totalDiasStreaks <= 10) {
    nivel = 1;
    icone = '🌱';
    nomeNivel = 'Jardineiro Broto';
    descricao = 'Cultive seus hábitos diariamente para ver seu jardim expandir!';
    proximoNivelDias = 10;
    porcentagemProgresso = Math.min(100, Math.round((totalDiasStreaks / 10) * 100));
  } else if (totalDiasStreaks <= 30) {
    nivel = 2;
    icone = '🌿';
    nomeNivel = 'Jardineiro Dedicado';
    descricao = 'Seu jardim está ganhando vida com consistência e dedicação!';
    proximoNivelDias = 30;
    porcentagemProgresso = Math.min(100, Math.round(((totalDiasStreaks - 10) / (30 - 10)) * 100));
  } else if (totalDiasStreaks <= 70) {
    nivel = 3;
    icone = '🪴';
    nomeNivel = 'Mestre Cultivador';
    descricao = 'Impressionante! Seus hábitos estão florescendo com firmeza!';
    proximoNivelDias = 70;
    porcentagemProgresso = Math.min(100, Math.round(((totalDiasStreaks - 30) / (70 - 30)) * 100));
  } else {
    nivel = 4;
    icone = '🌳';
    nomeNivel = 'Guardião da Floresta';
    descricao = 'Mestre supremo dos hábitos! Uma verdadeira floresta de realizações!';
    proximoNivelDias = totalDiasStreaks;
    porcentagemProgresso = 100;
  }

  return {
    nivel,
    icone,
    nomeNivel,
    descricao,
    totalDiasStreaks,
    proximoNivelDias,
    porcentagemProgresso
  };
}

function normalizarData(dataInput) {
  if (!dataInput) return null;
  
  let data;
  if (dataInput instanceof Timestamp) {
    data = dataInput.toDate();
  } else if (typeof dataInput === 'string' || typeof dataInput === 'number') {
    data = new Date(dataInput);
  } else if (dataInput instanceof Date) {
    data = dataInput;
  } else if (dataInput.seconds) {
    data = new Date(dataInput.seconds * 1000);
  } else {
    return null;
  }

  if (isNaN(data.getTime())) return null;

  const normalizada = new Date(data);
  normalizada.setHours(0, 0, 0, 0);
  return normalizada;
}

function calcularDiferencaDias(data1, data2) {
  const d1 = normalizarData(data1);
  const d2 = normalizarData(data2);
  if (!d1 || !d2) return Infinity;
  
  const diferencaMs = d2.getTime() - d1.getTime();
  return Math.round(diferencaMs / (1000 * 60 * 60 * 24));
}

function foiMarcadoHoje(dataUltimaMarcacao) {
  if (!dataUltimaMarcacao) return false;
  const hoje = new Date();
  const diferenca = calcularDiferencaDias(dataUltimaMarcacao, hoje);
  return diferenca === 0;
}

function processarStreaksHabitos(lista) {
  const hoje = new Date();

  return lista.map((habito) => {
    let streakCalculado = Number(habito.streak) || 0;
    
    if (habito.dataUltimaMarcacao) {
      const diasSemMarcar = calcularDiferencaDias(habito.dataUltimaMarcacao, hoje);
      if (diasSemMarcar >= 2) {
        streakCalculado = 0;
      }
    } else {
      streakCalculado = 0;
    }

    return {
      ...habito,
      streak: streakCalculado,
      marcadoHoje: foiMarcadoHoje(habito.dataUltimaMarcacao)
    };
  });
}

// ===============================================================
// OPERAÇÕES CRUD & REGRAS DE MARCAÇÃO / DESMARCAÇÃO
// ===============================================================

async function criarHabito(nome, emoji) {
  const nomeLimpo = nome.trim();

  if (nomeLimpo.length < 3 || nomeLimpo.length > 50) {
    throw new Error('O nome do hábito deve ter entre 3 e 50 caracteres.');
  }

  const duplicado = estado.habitos.some(
    (h) => h.nome.toLowerCase() === nomeLimpo.toLowerCase()
  );

  if (duplicado) {
    throw new Error(`Você já possui um hábito chamado "${nomeLimpo}". Cultive nomes diferentes!`);
  }

  const novoHabito = {
    nome: nomeLimpo,
    emoji: emoji || '🌱',
    streak: 0,
    totalMarcacoes: 0,
    dataUltimaMarcacao: null,
    dataMarcacaoAnterior: null,
    streakAnterior: 0,
    criadoEm: estado.modoDemoLocal ? new Date().toISOString() : serverTimestamp(),
    uid: ''
  };

  if (!estado.modoDemoLocal && db) {
    await addDoc(collection(db, COLECAO_HABITOS), novoHabito);
  } else {
    const item = {
      id: 'local-' + Date.now(),
      ...novoHabito,
      criadoEm: new Date().toISOString()
    };
    estado.habitos.unshift(item);
    salvarHabitosLocais();
    renderizarInterface();
  }
}

async function atualizarHabito(id, novoNome, novoEmoji) {
  const nomeLimpo = novoNome.trim();

  if (nomeLimpo.length < 3 || nomeLimpo.length > 50) {
    throw new Error('O nome do hábito deve ter entre 3 e 50 caracteres.');
  }

  const duplicado = estado.habitos.some(
    (h) => h.id !== id && h.nome.toLowerCase() === nomeLimpo.toLowerCase()
  );

  if (duplicado) {
    throw new Error(`Já existe outro hábito chamado "${nomeLimpo}".`);
  }

  if (!estado.modoDemoLocal && db) {
    const docRef = doc(db, COLECAO_HABITOS, id);
    await updateDoc(docRef, {
      nome: nomeLimpo,
      emoji: novoEmoji
    });
  } else {
    const index = estado.habitos.findIndex((h) => h.id === id);
    if (index !== -1) {
      estado.habitos[index].nome = nomeLimpo;
      estado.habitos[index].emoji = novoEmoji;
      salvarHabitosLocais();
      renderizarInterface();
    }
  }
}

async function removerHabito(id) {
  if (!estado.modoDemoLocal && db) {
    const docRef = doc(db, COLECAO_HABITOS, id);
    await deleteDoc(docRef);
  } else {
    estado.habitos = estado.habitos.filter((h) => h.id !== id);
    salvarHabitosLocais();
    renderizarInterface();
  }
}

async function marcarHabitoHoje(id) {
  const habito = estado.habitos.find((h) => h.id === id);
  if (!habito) return;

  const hoje = new Date();

  if (foiMarcadoHoje(habito.dataUltimaMarcacao)) {
    exibirToast('Este hábito já foi regado hoje!', 'warning');
    return;
  }

  let novoStreak = 1;
  const streakAtual = Number(habito.streak) || 0;
  const totalAnterior = Number(habito.totalMarcacoes) || 0;
  const novoTotal = totalAnterior + 1;
  const dataAnterior = habito.dataUltimaMarcacao || null;

  if (habito.dataUltimaMarcacao) {
    const dias = calcularDiferencaDias(habito.dataUltimaMarcacao, hoje);
    if (dias === 1) {
      novoStreak = streakAtual + 1;
    } else {
      novoStreak = 1;
    }
  } else {
    novoStreak = 1;
  }

  if (!estado.modoDemoLocal && db) {
    const docRef = doc(db, COLECAO_HABITOS, id);
    await updateDoc(docRef, {
      streak: novoStreak,
      streakAnterior: streakAtual,
      totalMarcacoes: novoTotal,
      dataUltimaMarcacao: serverTimestamp(),
      dataMarcacaoAnterior: dataAnterior
    });
  } else {
    const index = estado.habitos.findIndex((h) => h.id === id);
    if (index !== -1) {
      estado.habitos[index].streakAnterior = streakAtual;
      estado.habitos[index].streak = novoStreak;
      estado.habitos[index].totalMarcacoes = novoTotal;
      estado.habitos[index].dataMarcacaoAnterior = dataAnterior;
      estado.habitos[index].dataUltimaMarcacao = hoje.toISOString();
      estado.habitos[index].marcadoHoje = true;
      salvarHabitosLocais();
      renderizarInterface();
    }
  }

  // Atualiza também os desafios ativos que envolvem este hábito
  atualizarProgressoDesafiosPorHabito(habito.nome, novoStreak, novoTotal);

  verificarMilestone(habito.nome, habito.emoji, novoStreak);
}

async function desmarcarHabitoHoje(id) {
  const habito = estado.habitos.find((h) => h.id === id);
  if (!habito) return;

  if (!foiMarcadoHoje(habito.dataUltimaMarcacao)) {
    exibirToast('Pode desmarcar apenas a marcação de hoje.', 'warning');
    return;
  }

  let streakRevertido = 0;
  if (habito.streakAnterior !== undefined && habito.streakAnterior !== null) {
    streakRevertido = Number(habito.streakAnterior);
  } else {
    streakRevertido = Math.max(0, (Number(habito.streak) || 1) - 1);
  }

  const novoTotal = Math.max(0, (Number(habito.totalMarcacoes) || 1) - 1);
  const dataRevertida = habito.dataMarcacaoAnterior || null;

  if (!estado.modoDemoLocal && db) {
    const docRef = doc(db, COLECAO_HABITOS, id);
    await updateDoc(docRef, {
      streak: streakRevertido,
      totalMarcacoes: novoTotal,
      dataUltimaMarcacao: dataRevertida,
      dataMarcacaoAnterior: null
    });
  } else {
    const index = estado.habitos.findIndex((h) => h.id === id);
    if (index !== -1) {
      estado.habitos[index].streak = streakRevertido;
      estado.habitos[index].totalMarcacoes = novoTotal;
      estado.habitos[index].dataUltimaMarcacao = dataRevertida;
      estado.habitos[index].dataMarcacaoAnterior = null;
      estado.habitos[index].marcadoHoje = false;
      salvarHabitosLocais();
      renderizarInterface();
    }
  }

  // Recalcula desafios
  atualizarProgressoDesafiosPorHabito(habito.nome, streakRevertido, novoTotal);

  exibirToast(`↩️ Marcação de hoje desfeita para "${habito.nome}".`, 'info');
}

// ===============================================================
// SISTEMA DE MILESTONES (CONQUISTAS MOTIVACIONAIS)
// ===============================================================
function verificarMilestone(nomeHabito, emojiHabito, streak) {
  let titulo = '';
  let mensagem = '';
  let icone = '🎉';

  if (streak === 7) {
    titulo = 'Uma semana completa! 🎉';
    mensagem = 'Incrível! 7 dias consecutivos nutrindo seu hábito. Sua plantinha virou uma muda forte!';
    icone = '🌿';
  } else if (streak === 14) {
    titulo = 'Duas semanas de consistência! 🔥';
    mensagem = '14 dias sem falhar! Seu hábito está enraizado e crescendo como uma linda planta!';
    icone = '🪴';
  } else if (streak === 30) {
    titulo = 'Um mês inteiro! Você é incrível! 🏆';
    mensagem = '30 dias de maestria! Seu hábito floresceu em uma grande árvore frondosa!';
    icone = '🌳';
  }

  if (titulo) {
    abrirModalMilestone(titulo, mensagem, icone, nomeHabito, emojiHabito);
  } else {
    exibirToast(`💧 Hábito regado com sucesso! Streak: ${streak} dia(s)`, 'success');
  }
}

function abrirModalMilestone(titulo, mensagem, icone, nome, emoji) {
  const modal = document.getElementById('modal-milestone');
  document.getElementById('milestone-title').textContent = titulo;
  document.getElementById('milestone-message').textContent = mensagem;
  document.getElementById('milestone-icon').textContent = icone;
  document.getElementById('milestone-habit-emoji').textContent = emoji || '🌱';
  document.getElementById('milestone-habit-name').textContent = nome;

  modal.classList.remove('hidden');
}

function fecharModalMilestone() {
  document.getElementById('modal-milestone').classList.add('hidden');
}

// ===============================================================
// RENDERIZAÇÃO DA INTERFACE & DOM
// ===============================================================

function renderizarInterface() {
  renderizarNivelGlobal();
  renderizarEstatisticas();
  renderizarCardsHabitos();
  renderizarRanking(estado.habitos);
  renderizarSecaoDesafios();
  atualizarSelectsModalDesafio();
}

function renderizarNivelGlobal() {
  const infoGlobal = calcularNivelGlobal(estado.habitos);

  document.getElementById('global-level-icon').textContent = infoGlobal.icone;
  document.getElementById('global-level-tag').textContent = `Nível ${infoGlobal.nivel}`;
  document.getElementById('global-level-name').textContent = infoGlobal.nomeNivel;
  document.getElementById('global-level-desc').textContent = infoGlobal.descricao;
  document.getElementById('global-total-days').innerHTML = `${infoGlobal.totalDiasStreaks} <small>dias</small>`;

  const statusTexto = infoGlobal.nivel === 4 
    ? 'Parabéns! Nível máximo de mestre atingido! 🌳' 
    : `${infoGlobal.totalDiasStreaks} / ${infoGlobal.proximoNivelDias} dias para o próximo nível`;

  document.getElementById('global-progress-status').textContent = statusTexto;
  document.getElementById('global-progress-pct').textContent = `${infoGlobal.porcentagemProgresso}%`;
  document.getElementById('global-progress-bar').style.width = `${infoGlobal.porcentagemProgresso}%`;
}

function renderizarEstatisticas() {
  const total = estado.habitos.length;
  const maiorStreak = total > 0 
    ? Math.max(...estado.habitos.map((h) => Number(h.streak) || 0)) 
    : 0;

  const marcadosHoje = estado.habitos.filter((h) => foiMarcadoHoje(h.dataUltimaMarcacao)).length;

  document.getElementById('stat-total-habits').textContent = total;
  document.getElementById('stat-max-streak').innerHTML = `${maiorStreak} <small>dias</small>`;
  document.getElementById('stat-completed-today').textContent = `${marcadosHoje} / ${total}`;
  document.getElementById('habits-count-badge').textContent = `${total} ${total === 1 ? 'hábito' : 'hábitos'}`;

  const porcentagem = total > 0 ? Math.round((marcadosHoje / total) * 100) : 0;
  document.getElementById('progress-percentage').textContent = `${porcentagem}%`;
  document.getElementById('daily-progress-bar').style.width = `${porcentagem}%`;
}

function renderizarCardsHabitos() {
  const grid = document.getElementById('habits-grid');
  const emptyState = document.getElementById('empty-state');

  let habitosFiltrados = [...estado.habitos];
  if (estado.filtroAtual === 'pending') {
    habitosFiltrados = habitosFiltrados.filter((h) => !foiMarcadoHoje(h.dataUltimaMarcacao));
  } else if (estado.filtroAtual === 'completed') {
    habitosFiltrados = habitosFiltrados.filter((h) => foiMarcadoHoje(h.dataUltimaMarcacao));
  }

  if (estado.habitos.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = '';

  if (habitosFiltrados.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>Nenhum hábito corresponde a este filtro no momento.</p>
      </div>
    `;
    return;
  }

  habitosFiltrados.forEach((habito) => {
    const nivelInfo = obterInformacoesNivel(habito.streak);
    const marcado = foiMarcadoHoje(habito.dataUltimaMarcacao);

    const card = document.createElement('div');
    card.className = `habit-card ${marcado ? 'completed-today' : ''}`;
    card.id = `habit-card-${habito.id}`;

    card.innerHTML = `
      <div class="habit-card-top">
        <div class="habit-icon-group">
          <div class="habit-plant-avatar" title="Nível ${nivelInfo.nivel}: ${nivelInfo.nomeNivel}">
            ${nivelInfo.plantaIcone}
            <span class="habit-emoji-badge" title="Ícone do hábito">${habito.emoji || '🎯'}</span>
          </div>
          <div class="habit-meta">
            <h3 class="habit-name">${sanitizarTexto(habito.nome)}</h3>
            <span class="habit-level-badge">
              ${nivelInfo.plantaIcone} Nível ${nivelInfo.nivel} &bull; ${nivelInfo.nomeNivel}
            </span>
          </div>
        </div>

        <div class="habit-actions-secondary">
          <button class="btn-card-action btn-edit-habit" data-id="${habito.id}" title="Editar hábito" aria-label="Editar">
            ✏️
          </button>
          <button class="btn-card-action btn-card-delete btn-delete-habit" data-id="${habito.id}" title="Excluir hábito" aria-label="Excluir">
            🗑️
          </button>
        </div>
      </div>

      <div class="habit-card-stats">
        <div class="stat-item">
          <span class="stat-item-label">Sequência Atual</span>
          <span class="stat-item-val">
            <span class="${habito.streak > 0 ? 'streak-flame' : ''}">🔥</span>
            ${habito.streak || 0} ${habito.streak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
        <div class="stat-item" style="text-align: right;">
          <span class="stat-item-label">Total Regado</span>
          <span class="stat-item-val">
            <span>💧</span> ${habito.totalMarcacoes || 0}x
          </span>
        </div>
      </div>

      <div class="habit-button-group">
        <button 
          class="btn-check-habit ${marcado ? 'done' : ''}" 
          data-id="${habito.id}"
          ${marcado ? 'disabled' : ''}
        >
          ${marcado ? '<span>✅ Regado Hoje</span>' : '<span>🚿 Marcar como Feito Hoje</span>'}
        </button>

        ${marcado ? `
          <button class="btn-uncheck-habit" data-id="${habito.id}" title="Desfazer a marcação de hoje">
            <span>↩️ Desmarcar</span>
          </button>
        ` : ''}
      </div>
    `;

    grid.appendChild(card);
  });

  atribuirEventosCards();
}

function atribuirEventosCards() {
  document.querySelectorAll('.btn-check-habit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.classList.add('bounce-click');
      setTimeout(() => btn.classList.remove('bounce-click'), 600);

      try {
        await marcarHabitoHoje(id);
      } catch (erro) {
        console.error('Erro ao marcar hábito:', erro);
        exibirToast('Erro ao salvar no Firestore. Tente novamente.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-uncheck-habit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await desmarcarHabitoHoje(id);
      } catch (erro) {
        console.error('Erro ao desmarcar hábito:', erro);
        exibirToast('Erro ao desmarcar hábito.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-edit-habit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      abrirModalEdicao(id);
    });
  });

  document.querySelectorAll('.btn-delete-habit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      abrirModalExclusao(id);
    });
  });
}

function ocultarCarregamento() {
  const loading = document.getElementById('loading-state');
  if (loading) loading.classList.add('hidden');
}

// ===============================================================
// MODAIS & AÇÕES DE FORMULÁRIO
// ===============================================================

// Modal Adicionar Hábito
const modalAdd = document.getElementById('modal-add-habit');
const btnOpenAdd = document.getElementById('btn-open-modal-add');
const btnEmptyAdd = document.getElementById('btn-empty-add');
const btnCloseAdd = document.getElementById('btn-close-modal-add');
const btnCancelAdd = document.getElementById('btn-cancel-modal-add');
const formAdd = document.getElementById('form-add-habit');

function abrirModalAdicionar() {
  formAdd.reset();
  document.getElementById('error-habit-name').textContent = '';
  document.getElementById('selected-emoji-add').value = '📚';
  
  document.querySelectorAll('#emoji-options-add .emoji-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.getAttribute('data-emoji') === '📚');
  });

  modalAdd.classList.remove('hidden');
  setTimeout(() => document.getElementById('input-habit-name').focus(), 100);
}

function fecharModalAdicionar() {
  modalAdd.classList.add('hidden');
}

// Modal Editar
const modalEdit = document.getElementById('modal-edit-habit');
const btnCloseEdit = document.getElementById('btn-close-modal-edit');
const btnCancelEdit = document.getElementById('btn-cancel-modal-edit');
const formEdit = document.getElementById('form-edit-habit');

function abrirModalEdicao(id) {
  const habito = estado.habitos.find((h) => h.id === id);
  if (!habito) return;

  document.getElementById('input-edit-id').value = id;
  document.getElementById('input-edit-name').value = habito.nome;
  document.getElementById('selected-emoji-edit').value = habito.emoji || '📚';
  document.getElementById('error-edit-name').textContent = '';

  document.querySelectorAll('#emoji-options-edit .emoji-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.getAttribute('data-emoji') === habito.emoji);
  });

  modalEdit.classList.remove('hidden');
  setTimeout(() => document.getElementById('input-edit-name').focus(), 100);
}

function fecharModalEdicao() {
  modalEdit.classList.add('hidden');
}

// Modal Exclusão
const modalDelete = document.getElementById('modal-delete-habit');
const btnCancelDelete = document.getElementById('btn-cancel-modal-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

function abrirModalExclusao(id) {
  const habito = estado.habitos.find((h) => h.id === id);
  if (!habito) return;

  estado.habitoParaExcluirId = id;
  document.getElementById('modal-delete-text').textContent = 
    `Tem certeza de que deseja remover a plantinha "${habito.nome}"? O progresso e as ${habito.totalMarcacoes || 0} regas serão perdidos permanentemente.`;
  modalDelete.classList.remove('hidden');
}

function fecharModalExclusao() {
  modalDelete.classList.add('hidden');
  estado.habitoParaExcluirId = null;
}

// Modal Criar Desafio
const modalChallenge = document.getElementById('modal-create-challenge');
const btnOpenChallenge = document.getElementById('btn-open-modal-challenge');
const btnEmptyChallenge = document.getElementById('btn-empty-create-chal');
const btnCloseChallenge = document.getElementById('btn-close-modal-challenge');
const btnCancelChallenge = document.getElementById('btn-cancel-modal-challenge');
const formChallenge = document.getElementById('form-create-challenge');

function abrirModalCriarDesafio() {
  formChallenge.reset();
  document.getElementById('error-create-challenge').textContent = '';
  document.getElementById('group-target-marks').classList.add('hidden');
  atualizarSelectsModalDesafio();
  modalChallenge.classList.remove('hidden');
}

function fecharModalCriarDesafio() {
  modalChallenge.classList.add('hidden');
}

function atualizarSelectsModalDesafio() {
  const selectAmigo = document.getElementById('select-challenge-friend');
  const selectHabito = document.getElementById('select-challenge-habit');
  if (!selectAmigo || !selectHabito) return;

  // Preenche amigos
  selectAmigo.innerHTML = '<option value="">Escolha um amigo da sua rede...</option>';
  estadoDesafios.amigos.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.avatar || '🌱'} ${a.nome} (Nível ${a.nivelGlobal || 1})`;
    selectAmigo.appendChild(opt);
  });

  // Preenche hábitos
  selectHabito.innerHTML = '<option value="">Selecione um dos seus hábitos...</option>';
  estado.habitos.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h.nome;
    opt.setAttribute('data-emoji', h.emoji || '🌱');
    opt.textContent = `${h.emoji || '🌱'} ${h.nome}`;
    selectHabito.appendChild(opt);
  });
}

// Submissão de Cadastro de Hábito
formAdd.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputNome = document.getElementById('input-habit-name');
  const emoji = document.getElementById('selected-emoji-add').value;
  const erroSpan = document.getElementById('error-habit-name');
  const btnSubmit = document.getElementById('btn-submit-add');

  erroSpan.textContent = '';

  try {
    ativarLoadingBotao(btnSubmit, true);
    await criarHabito(inputNome.value, emoji);
    fecharModalAdicionar();
    exibirToast('🌱 Nova semente plantada com sucesso!', 'success');
  } catch (erro) {
    erroSpan.textContent = erro.message;
  } finally {
    ativarLoadingBotao(btnSubmit, false, 'Plantar Hábito 🌱');
  }
});

// Submissão de Edição de Hábito
formEdit.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('input-edit-id').value;
  const inputNome = document.getElementById('input-edit-name');
  const emoji = document.getElementById('selected-emoji-edit').value;
  const erroSpan = document.getElementById('error-edit-name');
  const btnSubmit = document.getElementById('btn-submit-edit');

  erroSpan.textContent = '';

  try {
    ativarLoadingBotao(btnSubmit, true);
    await atualizarHabito(id, inputNome.value, emoji);
    fecharModalEdicao();
    exibirToast('✏️ Hábito atualizado com sucesso!', 'success');
  } catch (erro) {
    erroSpan.textContent = erro.message;
  } finally {
    ativarLoadingBotao(btnSubmit, false, 'Salvar Alterações');
  }
});

// Submissão de Criação de Desafio
formChallenge.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectAmigo = document.getElementById('select-challenge-friend');
  const inputCustom = document.getElementById('input-custom-friend-name');
  const selectHabito = document.getElementById('select-challenge-habit');
  const erroSpan = document.getElementById('error-create-challenge');
  const btnSubmit = document.getElementById('btn-submit-challenge');

  let amigoId = selectAmigo.value;
  let nomeAmigo = selectAmigo.options[selectAmigo.selectedIndex]?.text || '';

  if (!amigoId && inputCustom.value.trim()) {
    amigoId = 'amigo_custom_' + Date.now();
    nomeAmigo = inputCustom.value.trim();
    estadoDesafios.amigos.push({
      id: amigoId,
      nome: nomeAmigo,
      avatar: '🌟',
      streakTotal: 5,
      nivelGlobal: 1
    });
  }

  const habitoNome = selectHabito.value;
  const emojiHabito = selectHabito.selectedOptions[0]?.getAttribute('data-emoji') || '🌱';
  const duracao = document.querySelector('input[name="challengeDuration"]:checked')?.value || 7;
  const objetivo = document.querySelector('input[name="challengeObjective"]:checked')?.value || 'streak';
  const metaMarcacoes = document.getElementById('input-target-marks').value || duracao;

  erroSpan.textContent = '';

  try {
    ativarLoadingBotao(btnSubmit, true);
    const novoDesafio = await criarDesafio({
      amigoId,
      nomeAmigo,
      habitoNome,
      emojiHabito,
      duracao,
      objetivo,
      metaMarcacoes
    });

    fecharModalCriarDesafio();
    exibirToast(`⚔️ Desafio lançado para ${nomeAmigo}!`, 'success');
  } catch (erro) {
    erroSpan.textContent = erro.message;
  } finally {
    ativarLoadingBotao(btnSubmit, false, 'Lançar Desafio ⚔️');
  }
});

// Confirmação de Exclusão
btnConfirmDelete.addEventListener('click', async () => {
  if (!estado.habitoParaExcluirId) return;

  try {
    ativarLoadingBotao(btnConfirmDelete, true);
    await removerHabito(estado.habitoParaExcluirId);
    fecharModalExclusao();
    exibirToast('🗑️ Hábito removido do jardim.', 'info');
  } catch (erro) {
    console.error('Erro ao excluir hábito:', erro);
    exibirToast('Erro ao excluir. Tente novamente.', 'error');
  } finally {
    ativarLoadingBotao(btnConfirmDelete, false, 'Sim, Excluir');
  }
});

// Seletor de Emojis
function configurarSeletoresEmoji() {
  document.querySelectorAll('#emoji-options-add .emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#emoji-options-add .emoji-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('selected-emoji-add').value = btn.getAttribute('data-emoji');
    });
  });

  document.querySelectorAll('#emoji-options-edit .emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#emoji-options-edit .emoji-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('selected-emoji-edit').value = btn.getAttribute('data-emoji');
    });
  });
}

// Filtros de Hábitos
document.querySelectorAll('#filter-pills .filter-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#filter-pills .filter-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    estado.filtroAtual = pill.getAttribute('data-filter');
    renderizarCardsHabitos();
  });
});

// Filtros de Desafios
document.querySelectorAll('#challenge-filter-pills .filter-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#challenge-filter-pills .filter-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    estadoDesafios.filtroDesafios = pill.getAttribute('data-chal-filter');
    renderizarSecaoDesafios();
  });
});

// Botão Expandir / Recolher Ranking
const btnToggleRanking = document.getElementById('btn-toggle-ranking-expand');
if (btnToggleRanking) {
  btnToggleRanking.addEventListener('click', () => {
    estadoDesafios.rankingExpandido = !estadoDesafios.rankingExpandido;
    btnToggleRanking.textContent = estadoDesafios.rankingExpandido ? 'Ver Top 3' : 'Expandir Ranking';
    renderizarRanking(estado.habitos);
  });
}

// Alternar campo de meta de marcações no modal de desafios
document.querySelectorAll('input[name="challengeObjective"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const groupTarget = document.getElementById('group-target-marks');
    if (e.target.value === 'marcacoes') {
      groupTarget.classList.remove('hidden');
    } else {
      groupTarget.classList.add('hidden');
    }
  });
});

// Tema Claro / Escuro
const btnTheme = document.getElementById('btn-toggle-theme');
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('habito_tracker_theme', tema);
  if (btnTheme) {
    btnTheme.querySelector('.theme-icon').textContent = tema === 'dark' ? '☀️' : '🌙';
  }
}

btnTheme.addEventListener('click', () => {
  estado.tema = estado.tema === 'dark' ? 'light' : 'dark';
  aplicarTema(estado.tema);
});

// Utilitários de UI
function exibirToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  let icone = 'ℹ️';
  if (tipo === 'success') icone = '✅';
  if (tipo === 'error') icone = '❌';
  if (tipo === 'warning') icone = '⚠️';

  toast.innerHTML = `
    <span class="toast-icon">${icone}</span>
    <span class="toast-text">${mensagem}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function ativarLoadingBotao(botao, carregando, textoOriginal = '') {
  const spinner = botao.querySelector('.btn-spinner');
  const texto = botao.querySelector('.btn-text');
  
  if (carregando) {
    botao.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (texto) texto.style.opacity = '0.5';
  } else {
    botao.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (texto) {
      texto.style.opacity = '1';
      if (textoOriginal) texto.textContent = textoOriginal;
    }
  }
}

function sanitizarTexto(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    fecharModalAdicionar();
    fecharModalEdicao();
    fecharModalExclusao();
    fecharModalCriarDesafio();
    fecharModalMilestone();
  }
});

[modalAdd, modalEdit, modalDelete, modalChallenge, document.getElementById('modal-milestone')].forEach((modal) => {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
});

// ===============================================================
// EVENTOS INICIAIS
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
  aplicarTema(estado.tema);
  configurarSeletoresEmoji();

  btnOpenAdd.addEventListener('click', abrirModalAdicionar);
  if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', abrirModalAdicionar);
  btnCloseAdd.addEventListener('click', fecharModalAdicionar);
  btnCancelAdd.addEventListener('click', fecharModalAdicionar);

  btnCloseEdit.addEventListener('click', fecharModalEdicao);
  btnCancelEdit.addEventListener('click', fecharModalEdicao);

  btnCancelDelete.addEventListener('click', fecharModalExclusao);

  if (btnOpenChallenge) btnOpenChallenge.addEventListener('click', abrirModalCriarDesafio);
  if (btnEmptyChallenge) btnEmptyChallenge.addEventListener('click', abrirModalCriarDesafio);
  if (btnCloseChallenge) btnCloseChallenge.addEventListener('click', fecharModalCriarDesafio);
  if (btnCancelChallenge) btnCancelChallenge.addEventListener('click', fecharModalCriarDesafio);

  const btnCloseMilestone = document.getElementById('btn-close-milestone');
  if (btnCloseMilestone) btnCloseMilestone.addEventListener('click', fecharModalMilestone);

  const btnCloseBanner = document.getElementById('btn-close-banner');
  if (btnCloseBanner) {
    btnCloseBanner.addEventListener('click', () => {
      document.getElementById('firebase-status-banner').classList.add('hidden');
    });
  }

  inicializarFirebase();
});
