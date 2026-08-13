/**
 * Módulo de integração com a API do Google Gemini para a Assistente IA
 */

import { DB } from './db.js';

export const AIEngine = {
  getApiKey() {
    let key = localStorage.getItem('gemini_api_key');
    if (!key) {
      key = prompt('🔑 Insira sua Chave de API do Gemini para ativar a IA (salva apenas no seu navegador):');
      if (key && key.trim()) {
        key = key.trim();
        localStorage.setItem('gemini_api_key', key);
      }
    }
    return key || '';
  },

  setApiKey(newKey) {
    if (newKey && newKey.trim()) {
      localStorage.setItem('gemini_api_key', newKey.trim());
    }
  },

  /**
   * Coleta o contexto atual das tarefas no Kanban para fornecer à IA
   */
  async getKanbanContext() {
    try {
      const tasks = (await DB.getAll('tasks')) || [];
      const members = (await DB.getAll('members')) || [];
      
      const memberMap = new Map(members.map(m => [String(m.id), m.name]));
      
      const todo = tasks.filter(t => t.status === 'A FAZER').map(t => `- ${t.title} (${memberMap.get(String(t.member_id || t.memberId)) || 'Não atribuído'})`);
      const inProgress = tasks.filter(t => t.status === 'EM EXECUÇÃO').map(t => `- ${t.title} (${memberMap.get(String(t.member_id || t.memberId)) || 'Não atribuído'})`);
      const done = tasks.filter(t => t.status === 'CONCLUÍDO').map(t => `- ${t.title}`);

      return `[Contexto do Quadro Kanban Atual]
- Tarefas A Fazer (${todo.length}):
${todo.length ? todo.join('\n') : 'Nenhuma'}

- Tarefas Em Execução (${inProgress.length}):
${inProgress.length ? inProgress.join('\n') : 'Nenhuma'}

- Tarefas Concluídas (${done.length}):
${done.length ? done.join('\n') : 'Nenhuma'}`;
    } catch (e) {
      console.warn('Erro ao obter contexto do Kanban para IA:', e);
      return '';
    }
  },

  /**
   * Envia a requisição para a API do Gemini
   */
  async askGemini(promptText) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chave de API do Gemini não configurada.');
    }

    const context = await this.getKanbanContext();
    const systemPrompt = `Você é a Assistente Virtual IA do sistema TeamTask Kanban do Setor RT. Seu papel é auxiliar os membros da equipe com gestão de tarefas, ideias, planos de ação, organização e dúvidas em geral. Responda de forma profissional, direta e em português (pt-BR). Use formatação Markdown (negrito, listas, tópicos) quando adequado.\n\n${context}`;

    const fullPrompt = `${systemPrompt}\n\n[Pergunta do Usuário]: ${promptText}`;

    // Modelos oficiais do Gemini v1beta (testados e validados)
    const models = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash'
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: fullPrompt }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${response.status}`;
          throw new Error(`Modelo ${model}: ${msg}`);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;

        if (textResponse) {
          return textResponse;
        }
      } catch (err) {
        console.warn(`[AI Engine] Tentativa com ${model} falhou:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('Não foi possível obter resposta da API do Gemini.');
  },

  /**
   * Formata texto em Markdown simples para HTML seguro
   */
  formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">$1</code>')
      .replace(/^\s*-\s+(.*)$/gm, '• $1')
      .replace(/\n/g, '<br>');
    return html;
  },

  /**
   * Configura listeners e comportamento da tela da IA
   */
  setupListeners() {
    const form = document.getElementById('form-ai-prompt');
    if (!form || form.dataset.listenerBound) return;
    form.dataset.listenerBound = 'true';

    const input = document.getElementById('ai-prompt-input');
    const container = document.getElementById('ai-response-container');
    const btnSend = document.getElementById('btn-send-ai');
    const btnConfigKey = document.getElementById('btn-config-ai-key');

    if (btnConfigKey) {
      btnConfigKey.addEventListener('click', () => {
        const currentKey = localStorage.getItem('gemini_api_key') || '';
        const newKey = prompt('🔑 Insira sua Chave de API do Gemini:', currentKey);
        if (newKey !== null) {
          this.setApiKey(newKey);
          alert('Chave de API do Gemini atualizada com sucesso!');
        }
      });
    }

    // Configura botões de sugestão rápida
    document.querySelectorAll('.ai-chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) {
          input.value = chip.dataset.prompt || chip.textContent.trim();
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = input ? input.value.trim() : '';
      if (!prompt) return;

      if (container) {
        const initNotice = container.querySelector('.ai-init-notice');
        if (initNotice) initNotice.remove();

        const userBubble = document.createElement('div');
        userBubble.style.cssText = 'align-self: flex-end; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 0.65rem 0.95rem; border-radius: 10px; border-bottom-right-radius: 2px; margin-bottom: 0.75rem; max-width: 80%; margin-left: auto; word-break: break-word; font-size: 0.875rem;';
        userBubble.innerHTML = `<strong>Você:</strong> ${this.formatMarkdown(prompt)}`;
        container.appendChild(userBubble);

        const loadingBubble = document.createElement('div');
        loadingBubble.id = 'ai-loading-bubble';
        loadingBubble.style.cssText = 'background: rgba(255,255,255,0.05); border: 1px solid var(--border-color, #374151); color: #a5b4fc; padding: 0.65rem 0.95rem; border-radius: 10px; border-bottom-left-radius: 2px; margin-bottom: 0.75rem; max-width: 85%; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;';
        loadingBubble.innerHTML = `<span class="spin-icon">⏳</span> <em>Assistente IA pensando...</em>`;
        container.appendChild(loadingBubble);

        container.scrollTop = container.scrollHeight;
      }

      if (input) input.value = '';
      if (btnSend) btnSend.disabled = true;

      try {
        const responseText = await this.askGemini(prompt);
        
        const loadingBubble = document.getElementById('ai-loading-bubble');
        if (loadingBubble) loadingBubble.remove();

        if (container) {
          const aiBubble = document.createElement('div');
          aiBubble.style.cssText = 'background: var(--bg-card, #1f2937); border: 1px solid var(--border-color, #374151); color: #f3f4f6; padding: 0.85rem 1rem; border-radius: 10px; border-bottom-left-radius: 2px; margin-bottom: 0.75rem; max-width: 90%; word-break: break-word; font-size: 0.875rem; line-height: 1.6;';
          aiBubble.innerHTML = `<div style="font-size: 0.75rem; font-weight: 700; color: #818cf8; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">🤖 Assistente IA</div>` + this.formatMarkdown(responseText);
          container.appendChild(aiBubble);
          container.scrollTop = container.scrollHeight;
        }
      } catch (err) {
        console.error('Erro ao consultar IA:', err);
        const loadingBubble = document.getElementById('ai-loading-bubble');
        if (loadingBubble) loadingBubble.remove();

        if (container) {
          const errBubble = document.createElement('div');
          errBubble.style.cssText = 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.65rem 0.95rem; border-radius: 10px; margin-bottom: 0.75rem; max-width: 90%; font-size: 0.85rem;';
          errBubble.innerHTML = `⚠️ <strong>Falha na Comunicação com a IA:</strong> ${err.message || 'Verifique sua conexão ou a chave de API.'}`;
          container.appendChild(errBubble);
          container.scrollTop = container.scrollHeight;
        }
      } finally {
        if (btnSend) btnSend.disabled = false;
      }
    });
  },

  /**
   * Renderiza e inicializa a seção da IA
   */
  renderAISection() {
    const section = document.getElementById('section-ai');
    if (section) {
      section.classList.add('active');
      section.style.setProperty('display', 'block', 'important');
    }
    this.setupListeners();
  }
};
