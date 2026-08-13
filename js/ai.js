/**
 * Módulo de integração com a API do Google Gemini para a Assistente IA
 */

import { DB } from './db.js';

/**
 * Catálogo de Convenções Coletivas de Trabalho (CCTs) cadastradas
 */
export const CONVENCOES_COLETIVAS = [
  {
    id: 'cct-secovi-sinteg-2026',
    title: 'CONVENÇÃO COLETIVA DE TRABALHO 2026/2026 (SECOVI-PB / SINTEG-PB)',
    mte: 'PB000112/2026',
    vigencia: '01/01/2026 a 31/12/2026',
    content: `
================================================================================
TÍTULO DA CONVENÇÃO: CONVENÇÃO COLETIVA DE TRABALHO 2026/2026 (SECOVI-PB / SINTEG-PB)
REGISTRO MTE: PB000112/2026 | PROCESSO: 13090.200379/2026-83
VIGÊNCIA: 01/01/2026 a 31/12/2026 | DATA-BASE: 01º de Janeiro.
PARTES: SINTEG-PB (Sindicato dos Trabalhadores em Empresas de Prestação de Serviços Gerais da PB) e SECOVI-PB (Sindicato das Empresas de Compra, Venda, Locação e Administração de Imóveis e Condomínios da PB).
================================================================================

CLÁUSULA SEGUNDA - ABRANGÊNCIA:
Trabalhadores nas Empresas de Prestação de Serviços em Condomínios Residenciais (Horizontais e Verticais), Comerciais, Empresariais, Mistos, Hoteleiros, Administradoras de Condomínios, Shopping Centers, Imobiliárias e Coworking na Paraíba.

CLÁUSULA TERCEIRA - SALÁRIOS NORMATIVOS E PISOS SALARIAIS (Reajustes a partir de 01/01/2026):
• Percentuais de Reajuste:
  - 6,79% para quem recebia em dez/2025 R$ 1.518,00 até R$ 1.550,00.
  - 5,79% para quem recebia em dez/2025 R$ 1.550,01 até R$ 1.770,00.
  - 4,79% para quem recebia em dez/2025 a partir de R$ 1.770,01.

• TABELA DE PISOS SALARIAIS POR FUNÇÃO:
  [GRUPO VIII - ADMINISTRADORAS DE CONDOMÍNOS]
  - Atendente: R$ 1.837,33
  - Recepcionista: R$ 1.837,33
  - Assistente Administrativo: R$ 1.974,11
  - Assistente de Departamento Pessoal (DP): R$ 1.974,11
  - Assistente de Contabilidade: R$ 1.974,11
  - Assistente Financeiro: R$ 1.974,11
  - Auxiliar de Serviços Gerais: R$ 1.680,44
  - Auxiliar de Escritório: R$ 1.829,52
  - Auxiliar de Contabilidade: R$ 1.829,52
  - Auxiliar de Setor Financeiro / Recursos Humanos: R$ 1.829,52
  - Analista de Cobrança / Financeiro / Contabilidade: R$ 1.994,29
  - Encarregados (Compras, Contabilidade, RH, Financeiro, Cobrança): R$ 2.049,04
  - Office Boy: R$ 1.743,86
  - Secretaria: R$ 1.974,11
  - Supervisor de Recursos Humanos / Contabilidade: R$ 2.599,77
  - Gerente Administrativo: R$ 3.466,87

  [GRUPO IX - SHOPPING CENTERS]
  - Analista: R$ 2.738,18
  - Assistente Administrativo: R$ 1.743,86
  - Assistente de Operações: R$ 2.106,30
  - Atendente / Aux. Serviços Gerais / Manutenção / Aux. Admin: R$ 1.712,73
  - Coordenador Administrativo: R$ 3.143,51
  - Porteiro / Zelador / Inspetor / Operador CFTV: R$ 1.743,86
  - Vigia: R$ 1.766,55
  - Supervisor: R$ 2.801,18 | Supervisor de Segurança: R$ 2.106,30
  - Gerente: R$ 3.514,02

  [GRUPO X - IMOBILIÁRIAS]
  - Gerente: R$ 2.910,70
  - Coordenador: R$ 2.571,74
  - Supervisor: R$ 2.143,54
  - Assistente Administrativo / Vistoriador / Recepcionista: R$ 1.686,76
  - Copeira / Aux. Serviços Gerais: R$ 1.621,00
  - Motorista: R$ 2.298,13

CLÁUSULA QUINTA - PAGAMENTO DE SALÁRIO:
Até o 5º dia útil do mês subsequente via transferência bancária.

CLÁUSULA SÉTIMA - GRATIFICAÇÃO DE FUNÇÃO:
Recepcionista atuando como Intérprete fará jus a 30% sobre o salário base.

CLÁUSULA OITAVA E NONA - HORAS EXTRAS E FERIADOS:
- Horas Extras Normais: Adicional de 50% sobre o valor da hora normal.
- Feriados e Folgas Trabalhadas: Adicional de 100% sobre o valor da hora normal.

CLÁUSULA DÉCIMA SEGUNDA - ADICIONAL DE QUEBRA DE CAIXA:
Adicional de 10% (dez por cento) sobre o salário para quem exercer a função de Caixa.

CLÁUSULA DÉCIMA TERCEIRA - AUXÍLIO ALIMENTAÇÃO (VALE ALIMENTAÇÃO):
Valor de R$ 265,00 (Duzentos e sessenta e cinco reais) sem ônus para todos os empregados (inclusive escala 12x36). Pago até o 5º dia útil do mês.

CLÁUSULA DÉCIMA QUARTA - AUXÍLIO TRANSPORTE:
Vale Transporte com desconto máximo de 6% sobre o salário base.

CLÁUSULA DÉCIMA QUINTA - ASSISTÊNCIA ODONTOLÓGICA:
Custeio obrigatório e integral pelo empregador de plano odontológico no valor de R$ 25,00 por empregado (SINTEG/PB).

CLÁUSULA DÉCIMA SEXTA - BENEFÍCIOS SOCIAIS E ASSISTENCIAIS (SINTEG/PB):
- Natalidade: R$ 1.120,00 por filho.
- Farmácia Natalidade: R$ 420,00 para medicamentos.
- Renda Familiar: 3 parcelas de R$ 1.120,00 (incapacidade/falecimento).
- Benefício Alimentar: 3 parcelas de R$ 440,00.
- Funeral Despesas Extras: R$ 2.800,00.

CLÁUSULA DÉCIMA OITAVA - RESCISÃO E HOMOLOGAÇÃO:
- Contratos a partir de 6 meses: Homologação perante o SINTEG/PB.
- Prazo para pagamento de rescisão: Até 10 (dez) dias contados da efetiva demissão.

CLÁUSULA VIGÉSIMA SEXTA E SÉTIMA - JORNADA DE TRABALHO E BANCO DE HORAS:
- Jornada 44h semanais. Escala 12x36 permitida.
- Banco de Horas com prazo máximo de compensação de até 6 meses.

CLÁUSULA TRIGÉSIMA SEGUNDA - ATESTADOS MÉDICOS E FALTAS:
- Prazo para entrega do atestado médico pelo trabalhador: Até 48 horas após a ausência.
- Licença / Faltas abonadas: Falecimento parentes diretos (2 dias), Casamento (3 dias), Nascimento de filho (5 dias).

CLÁUSULA TRIGÉSIMA OITAVA - DIA DA CATEGORIA:
Terceira Segunda-feira de Outubro: Feriado remunerado para os trabalhadores da categoria.`
  },
  {
    id: 'cct-sincom-secir-2026',
    title: 'CONVENÇÃO COLETIVA DE TRABALHO 2026 (SINCOM-BA / SECIR - COMÉRCIO DE IRECÊ E REGIÃO - BAHIA)',
    vigencia: '01/01/2026 a 31/12/2026',
    partes: 'SINDICATO DOS EMPREGADOS NO COMÉRCIO DE IRECÊ E REGIÃO (SECIR - CNPJ 63.111.249/0001-94) e SINDICATO DO COMÉRCIO DE IRECÊ (SINCOM-BA - CNPJ 00.981.737/0001-32)',
    abrangencia: 'Empregados no Comércio Atacadista, Varejista, Bens e Serviços dos Municípios de Irecê, América Dourada, Barra do Mendes, Barro Alto, Cafarnaum, Canarana, Central, Ibipeba, Ibititá, Itaguaçu da Bahia, João Dourado, Jussara, Lapão, Morro do Chapéu, Mulungu do Morro, Presidente Dutra, São Gabriel, Uibaí e Xique-Xique na Bahia.',
    content: `
================================================================================
TÍTULO DA CONVENÇÃO: CONVENÇÃO COLETIVA DE TRABALHO 2026 (SINCOM-BA / SECIR - COMÉRCIO DE IRECÊ E REGIÃO - BAHIA)
VIGÊNCIA: 01/01/2026 a 31/12/2026 | DATA-BASE: 01º de Janeiro.
PARTES: SECIR (Sindicato dos Empregados no Comércio de Irecê e Região) e SINCOM-BA (Sindicato do Comércio de Irecê).
================================================================================

CLÁUSULA PRIMEIRA - VIGÊNCIA E DATA-BASE:
Vigência de 01 de janeiro de 2026 a 31 de dezembro de 2026. Data-base em 01º de janeiro.

CLÁUSULA SEGUNDA - REAJUSTE SALARIAL:
Reajuste salarial de 5,75% (cinco vírgula setenta e cinco por cento) a partir de 1º de janeiro de 2026 acumulado do período de 01/01/2025 a 31/12/2025.

CLÁUSULA TERCEIRA - PISO SALARIAL DA CATEGORIA DOS COMERCIÁRIOS 2026:
- Piso Salarial Geral (Comerciários do setor administrativo com mais de 4 meses na empresa): R$ 1.650,62 (um mil, seiscentos e cinquenta reais e sessenta e dois centavos).
- Piso Salarial nos Povoados dos municípios abrangidos: R$ 1.622,57 (um mil, seiscentos e vinte e dois reais e cinquenta e sete centavos).

CLÁUSULA QUARTA - TRIÊNIO:
Adicional de 4% (quatro por cento) a cada 3 (três) anos de serviço prestado ao mesmo empregador, limitado ao máximo de 3 (três) triênios.

CLÁUSULA QUINTA - ADICIONAL DE QUEBRA DE CAIXA:
Gratificação mensal de 10% (dez por cento) do salário percebido para empregados no exercício da função de Caixa.

CLÁUSULA SÉTIMA E OITAVA - COMISSIONADOS E DIÁRIA DE VIAGEM:
- Remuneração mínima mensal garantida ao comissionista equivalente ao piso salarial (R$ 1.650,62).
- Ajuda de custo para viagens a serviço (alimentação): R$ 26,39 (vinte e seis reais e trinta e nove centavos) por dia de trabalho fora do seu domicílio de origem.

CLÁUSULA DÉCIMA - ESTABILIDADE PROVISÓRIA:
- Gestante: Desde a notificação da gravidez até 90 (noventa) dias após o término da licença-maternidade.
- Pré-aposentado: Nos 12 (doze) meses anteriores ao direito à aposentadoria voluntária.
- Acidentado do Trabalho: Desde a comunicação até 01 (um) ano após a cessação do auxílio-acidente.
- Retorno de Férias: Estabilidade por 30 (trinta) dias após o retorno do gozo de férias.

CLÁUSULA DÉCIMA PRIMEIRA - UNIFORMES E MAQUIAGEM:
Fornecimento gratuito de 3 (três) a 4 (quatro) uniformes por ano. Maquiagem fornecida gratuitamente quando exigida pela empresa.

CLÁUSULA DÉCIMA SEGUNDA - PROIBIÇÃO DE LIMPEZA, CARGA E DESCARGA:
Proibido o serviço de limpeza das dependências, carga e descarga de mercadorias a empregados diretamente no atendimento ao público em empresas com mais de 5 empregados.

CLÁUSULA DÉCIMA TERCEIRA - JORNADA DE TRABALHO E HORAS EXTRAS:
- Jornada normal de 44 (quarenta e quatro) horas semanais.
- Adicional de Horas Extras: 65% (sessenta e cinco por cento) sobre a hora normal.
- Lanche gratuito para convocações de H.E. superiores a 2 horas + intervalo de 10 minutos.
- Trabalho em Domingos e Feriados: Valor indenizatório de R$ 90,34 (noventa reais e trinta e quatro centavos) por domingo/feriado trabalhado + folga compensatória na mesma semana.

CLÁUSULA DÉCIMA QUARTA - DOMINGOS E FERIADOS PERMITIDOS:
Funcionamento permitido das 08:00 às 15:00. Feriados com proibição de trabalho: 01/Jan, 16 e 17/Fev (Carnaval/Dia do Comerciário), Sexta-Feira Santa, 1º/Maio, Corpus Christi, 24/Jun (São João), 02/Jul, 04/Ago, 07/Set, 12/Out, 02/Nov, 15/Nov, 20/Nov (Consciência Negra) e 25/Dez.

CLÁUSULA VIGÉSIMA - DIA DO COMERCIÁRIO:
Dias 16 e 17 de Fevereiro de 2026 (Segunda e Terça-feira de Carnaval): Folga remunerada para a categoria sem prejuízo do salário.

CLÁUSULA VIGÉSIMA OITAVA - PLANO DE ASSISTÊNCIA E CUIDADO PESSOAL (AUXÍLIO SAÚDE E ODONTO):
- Valor pago pela empresa: R$ 35,90 (trinta e cinco reais e noventa centavos) mensais por trabalhador sem desconto no salário.
- Benefícios inclusos no plano:
  * Plano Odontológico completo regulamentado pela ANS.
  * Seguro por Morte Natural, Acidental ou Invalidez: R$ 15.000,00.
  * Auxílio Funeral: Indenização de R$ 3.300,00 + Cesta Básica por 6 meses (R$ 150,00/mês).
  * Assistência Natalidade: Cartão magnético no valor de R$ 600,00 por filho.
  * Telemedicina Individual Gratuita (Clínico Geral sem limite de uso).
  * Consultas Médicas Presenciais Subvencionadas (R$ 50,00 por consulta com +50 especialidades).
  * Programa de Saúde Mental: 2 (dois) atendimentos mensais com psicólogo.
  * Serviço de Chaveiro Emergencial residência/automóvel: Mão de obra até R$ 100,00.
  * Desconto em Rede de Farmácias Conveniadas.`
  }
];

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
   * Coleta o contexto do Kanban e das Convenções Coletivas para a IA
   */
  async getKanbanContext() {
    try {
      const tasks = (await DB.getAll('tasks')) || [];
      const members = (await DB.getAll('members')) || [];
      
      const memberMap = new Map(members.map(m => [String(m.id), m.name]));
      
      const todo = tasks.filter(t => t.status === 'A FAZER').map(t => `- ${t.title} (${memberMap.get(String(t.member_id || t.memberId)) || 'Não atribuído'})`);
      const inProgress = tasks.filter(t => t.status === 'EM EXECUÇÃO').map(t => `- ${t.title} (${memberMap.get(String(t.member_id || t.memberId)) || 'Não atribuído'})`);
      const done = tasks.filter(t => t.status === 'CONCLUÍDO').map(t => `- ${t.title}`);

      const cctContext = CONVENCOES_COLETIVAS.map(c => `[CONVENÇÃO COLETIVA CADASTRADA: "${c.title}"]\n${c.content}`).join('\n\n');

      return `[BASE DE CONHECIMENTO DE CONVENÇÕES COLETIVAS]
${cctContext}

[CONTEXTO DO QUADRO KANBAN ATUAL]
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
    const systemPrompt = `Você é a Assistente Virtual IA do sistema TeamTask Kanban do Setor RT.
Seu papel é auxiliar os membros da equipe com gestão de tarefas e DÚVIDAS TRABALHISTAS / CONVENÇÕES COLETIVAS DE TRABALHO.

REGRAS OBRIGATÓRIAS PARA RESPOSTAS SOBRE CONVENÇÃO COLETIVA:
1. Sempre que responder a qualquer dúvida trabalhista, salarial, benefício ou de regras trabalhistas, CITE EXPLICITAMENTE o TÍTULO OFICIAL DA CONVENÇÃO COLETIVA de onde a informação foi extraída (Exemplo: "Conforme a **CONVENÇÃO COLETIVA DE TRABALHO 2026/2026 (SECOVI-PB / SINTEG-PB)**, Cláusula 3ª: ...").
2. Se houver cláusulas ou valores específicos, mencione o número da cláusula e o valor em R$ ou percentual exato.
3. Responda de forma profissional, direta e em português (pt-BR). Use formatação Markdown (negrito, listas, tópicos) para clareza.

${context}`;

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
          aiBubble.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); padding: 0.85rem 1rem; border-radius: 10px; border-bottom-left-radius: 2px; margin-bottom: 0.75rem; max-width: 90%; word-break: break-word; font-size: 0.875rem; line-height: 1.6;';
          aiBubble.innerHTML = `<div style="font-size: 0.75rem; font-weight: 700; color: #6366f1; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">Assistente IA</div>` + this.formatMarkdown(responseText);
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
      section.style.display = 'block';
    }
    this.setupListeners();
  }
};
