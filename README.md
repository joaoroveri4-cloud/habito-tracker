# 🌱 Hábito Tracker - Jardinagem Virtual de Hábitos

> **Cultive seus hábitos, colha resultados.**  
Uma aplicação web interativa em **HTML5, CSS3 e JavaScript Vanilla** integrada ao **Firebase Cloud Firestore**, onde a consistência diária faz seus hábitos crescerem como plantinhas e eleva o seu nível global de jardineiro!

---

## ✨ Funcionalidades

- 🌱 **Jardinagem de Hábitos por Streaks**:
  - **Nível 1 (0 a 3 dias)**: 🌱 Broto
  - **Nível 2 (4 a 7 dias)**: 🌿 Muda
  - **Nível 3 (8 a 14 dias)**: 🪴 Planta
  - **Nível 4 (15+ dias)**: 🌳 Árvore Frondosa
- 👑 **Nível Global do Usuário (Medidor Geral no Topo)**:
  - Baseado na **soma total de dias em streak** de todos os seus hábitos ativos:
    - **Nível 1 (0 a 10 dias)**: 🌱 Jardineiro Broto
    - **Nível 2 (11 a 30 dias)**: 🌿 Jardineiro Dedicado
    - **Nível 3 (31 a 70 dias)**: 🪴 Mestre Cultivador
    - **Nível 4 (71+ dias)**: 🌳 Guardião da Floresta
  - Barra de progresso visual em tempo real até o próximo nível.
- 💧 **Marcação Diária Inteligente**:
  - Botão de rega com animação *bounce*.
  - Regra de streak: se marcou ontem, streak soma +1; se passou 2 ou mais dias sem marcar, o streak reinicia; bloqueio de marcação dupla no mesmo dia.
- ↩️ **Desmarcar / Desfazer Marcação de Hoje**:
  - Permite desmarcar a rega do dia atual em caso de clique acidental.
  - Reverte a data anterior, o total de marcações e o streak de forma segura.
  - Validação inteligente: apenas a marcação de hoje pode ser desfeita.
- 🏆 **Milestones Motivacionais**: Celebrações automáticas ao atingir 7 dias (*"Uma semana completa! 🎉"*), 14 dias (*"Duas semanas de consistência! 🔥"*) e 30 dias (*"Um mês inteiro! Você é incrível! 🏆"*).
- 📊 **Painel de Estatísticas**:
  - Total de hábitos cadastrados.
  - Maior sequência (streak) atual entre todos os hábitos.
  - Hábitos regados hoje com barra de progresso em tempo real.
- ✏️ **Gerenciamento Completo (CRUD)**:
  - Cadastrar novo hábito com validação de nome duplicado e seleção de ícones.
  - Editar nome e ícone do hábito.
  - Excluir com diálogo de confirmação seguro.
- 🎨 **Interface & Design Moderno**:
  - Paleta com tons de verde (`#2d6a4f`, `#52b788`, `#95d5b2`, `#d8f3dc`, `#f0f7f0`).
  - Suporte completo a **Modo Escuro (Dark Mode)** e **Modo Claro**.
  - Layout 100% responsivo (Desktop 3 colunas, Tablet 2 colunas, Mobile 1 coluna).
  - Toasts de notificação flutuantes.
  - **Fallback Inteligente**: Caso as credenciais do Firebase não tenham sido configuradas, o app ativa o modo de demonstração local instantâneo via `LocalStorage`.

---

## 📁 Estrutura de Arquivos

```
Hábito Tracker/
├── index.html          # Estrutura HTML5 semântica, Nível Global e Modais
├── style.css           # Estilização completa, variáveis CSS, animações e responsividade
├── app.js              # Lógica da aplicação, CRUD, streaks, desmarcação e Firestore
├── firebase-config.js  # Configuração e credenciais do Firebase Firestore
├── test-habitos.js     # Suíte de testes unitários automatizados (Node.js)
├── README.md           # Guia de instalação e documentação
└── .gitignore          # Arquivos ignorados no versionamento
```

---

## 🗄️ Estrutura de Dados no Firestore

Coleção: `habitos`

Cada documento possui a seguinte estrutura:

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | `string` | Nome do hábito (mínimo 3, máximo 50 caracteres) |
| `emoji` | `string` | Ícone selecionado (ex: `📚`, `💧`, `🏃`, `🧘`, etc.) |
| `streak` | `number` | Quantidade de dias seguidos atual |
| `streakAnterior` | `number` | Sequência anterior (para reversão segura ao desmarcar) |
| `totalMarcacoes` | `number` | Total histórico de vezes que o hábito foi regado |
| `dataUltimaMarcacao` | `timestamp` | Data/hora da última marcação diária |
| `dataMarcacaoAnterior` | `timestamp` | Data/hora da marcação anterior (para desmarcação) |
| `criadoEm` | `timestamp` | Data/hora da criação do hábito |
| `uid` | `string` | Identificador do usuário (ou vazio para modo demo) |

---

## 🚀 Como Configurar o Firebase Firestore

1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. Crie um banco **Firestore Database** em modo de teste.
3. Registre um aplicativo Web (`</>`) e copie as credenciais.
4. Abra o arquivo `firebase-config.js` e cole suas credenciais:

```javascript
export const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

---

## 💻 Como Rodar o Projeto Localmente

```bash
# Com Python
python -m http.server 8080

# Ou com npx serve
npx serve .
```

Acesse no navegador: **`http://localhost:8080`**

---

Feito com 💚 para cultivar sua melhor versão!
