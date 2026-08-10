/**
 * Organograma e Mapa de Processos Recorrentes do Departamento Pessoal (DP) Editável
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const MapEngine = {
  selectedCalendarMemberId: 'all',

  /**
   * Processos padrão pré-definidos caso ainda não existam no banco de dados
   */
  defaultDpProcesses: [
    {
      id: 'proc-1',
      category: 'Folha de Pagamento & Encargos',
      icon: '💵',
      defaultMemberRole: 'Analista de Folha de Pagamento',
      tasks: [
        { id: 'dp-t-1', title: 'Fechamento da Folha de Pagamento Mensal (S-1200 / S-1210)', dayLimit: 'Dia 05', priority: 'Alta', desc: 'Cálculo de proventos, descontos, DSR, INSS, IRRF e emissão de holerites.' },
        { id: 'dp-t-2', title: 'Emissão e Envio da Guia DCTFWeb (INSS / DARF Unificado)', dayLimit: 'Dia 15', priority: 'Alta', desc: 'Fechamento do eSocial S-1299 e transmissão da DCTFWeb à Receita Federal.' },
        { id: 'dp-t-3', title: 'Gerar e Enviar Guia do FGTS Digital', dayLimit: 'Dia 20', priority: 'Alta', desc: 'Emissão da guia do FGTS referente à folha de pagamento do mês.' }
      ]
    },
    {
      id: 'proc-2',
      category: 'Gestão de Ponto & Benefícios',
      icon: '⏱️',
      defaultMemberRole: 'Assistente de Admissão e Benefícios',
      tasks: [
        { id: 'dp-t-4', title: 'Apuração e Fechamento do Espelho de Ponto Eletrônico', dayLimit: 'Dia 25', priority: 'Alta', desc: 'Ajuste de marcações, cálculo de HE, adicional noturno, banco de horas e faltas.' },
        { id: 'dp-t-5', title: 'Pedido e Recarga de Vale Transporte (VT) e Vale Alimentação (VA/VR)', dayLimit: 'Dia 28', priority: 'Média', desc: 'Conferência de dias úteis e recarga nos cartões dos colaboradores.' }
      ]
    },
    {
      id: 'proc-3',
      category: 'Admissão & Registro de Colaboradores',
      icon: '💼',
      defaultMemberRole: 'Assistente de Admissão e Benefícios',
      tasks: [
        { id: 'dp-t-6', title: 'Processamento de Admissões e Qualificação Cadastral (S-2200)', dayLimit: 'Recorrente', priority: 'Média', desc: 'Coleta de documentos, ASO admissional e transmissão prévia ao eSocial.' },
        { id: 'dp-t-7', title: 'Cadastro no Ponto e Abertura de Conta Salário', dayLimit: 'Recorrente', priority: 'Média', desc: 'Inclusão no sistema de relógio de ponto e solicitação de conta bancária.' }
      ]
    },
    {
      id: 'proc-4',
      category: 'Férias & Ausências',
      icon: '🏖️',
      defaultMemberRole: 'Analista de Folha de Pagamento',
      tasks: [
        { id: 'dp-t-8', title: 'Mapeamento de Escala de Férias e Emissão de Avisos (30 dias antes)', dayLimit: 'Dia 01', priority: 'Média', desc: 'Verificação do período aquisitivo/concessivo e colheita de assinatura.' },
        { id: 'dp-t-9', title: 'Cálculo de Recibo de Férias e Adicional de 1/3 (S-2230)', dayLimit: 'Dia 25', priority: 'Média', desc: 'Pagamento das férias até 2 dias antes do início do gozo conforme CLT.' }
      ]
    },
    {
      id: 'proc-5',
      category: 'Rescisão & Desligamento',
      icon: '📄',
      defaultMemberRole: 'Analista de Folha de Pagamento',
      tasks: [
        { id: 'dp-t-10', title: 'Cálculo de Rescisão Contratual (TRCT) e Chave do FGTS (S-2299)', dayLimit: 'Recorrente', priority: 'Alta', desc: 'Cálculo de aviso prévio, saldo de salário, guias e transmissão de desligamento.' }
      ]
    },
    {
      id: 'proc-6',
      category: 'SST & Obrigações eSocial',
      icon: '📋',
      defaultMemberRole: 'Especialista eSocial & Encargos',
      tasks: [
        { id: 'dp-t-11', title: 'Gestão de Eventos de SST (S-2210 CAT, S-2220 ASO, S-2240 Periculosidade)', dayLimit: 'Dia 15', priority: 'Média', desc: 'Acompanhamento de exames periódicos e laudos ambientais de trabalho.' }
      ]
    }
  ],

  /**
   * Obtém a lista atualizada de processos (do banco de dados ou do padrão)
   */
  async getDpProcesses() {
    try {
      const savedProcesses = await DB.getAll('dp_processes');
      if (savedProcesses && savedProcesses.length > 0) {
        return savedProcesses;
      }
    } catch (e) {
      console.warn('⚡ Tabela dp_processes não encontrada ou vazia. Usando estrutura padrão.', e);
    }
    return this.defaultDpProcesses;
  },

  /**
   * Renderiza a tela do Mapa de Demandas do DP
   */
  async renderSectorMap() {
    const tasks = (await DB.getAll('tasks')) || [];
    const members = (await DB.getAll('members')) || [];
    const impediments = (await DB.getAll('impediments')) || [];
    const processes = await this.getDpProcesses();

    const membersMap = new Map(members.map(m => [String(m.id), m]));
    const impMap = new Map();
    impediments.forEach(imp => {
      if (!impMap.has(String(imp.taskId))) impMap.set(String(imp.taskId), []);
      impMap.get(String(imp.taskId)).push(imp);
    });

    this.renderHeaderMetrics(tasks);
    this.renderDPOrganogram(processes, tasks, members);
    this.renderRoadmapTable(tasks, membersMap, impMap);

    this.attachEvents(processes);
  },

  /**
   * Renderiza as métricas no topo do mapa
   */
  renderHeaderMetrics(tasks) {
    const container = document.getElementById('map-metrics-summary');
    if (!container) return;

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'CONCLUÍDO').length;
    const wip = tasks.filter(t => t.status === 'EM EXECUÇÃO').length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    let totalSeconds = 0;
    tasks.forEach(t => {
      totalSeconds += TimerEngine.getCurrentElapsedSeconds(t);
    });

    container.innerHTML = `
      <div class="metric-card" style="--card-accent: #6366f1;">
        <div class="metric-header">
          <span class="metric-title">Fechamento do Mês (DP)</span>
          <div class="metric-icon">📈</div>
        </div>
        <div class="metric-value">${completionPercent}%</div>
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:8px; width:100%; margin-top:0.5rem; overflow:hidden;">
          <div style="background:var(--accent-gradient); width:${completionPercent}%; height:100%; border-radius:10px;"></div>
        </div>
      </div>

      <div class="metric-card" style="--card-accent: #10b981;">
        <div class="metric-header">
          <span class="metric-title">Demandas do DP no Quadro</span>
          <div class="metric-icon">💼</div>
        </div>
        <div class="metric-value">${total}</div>
        <div class="metric-sub positive">
          <span>${done} concluídas • ${wip} em execução</span>
        </div>
      </div>

      <div class="metric-card" style="--card-accent: #06b6d4;">
        <div class="metric-header">
          <span class="metric-title">Horas Trabalhadas no DP</span>
          <div class="metric-icon">⏱️</div>
        </div>
        <div class="metric-value">${TimerEngine.formatTime(totalSeconds)}</div>
        <div class="metric-sub">
          <span>Tempo total acumulado</span>
        </div>
      </div>
    `;
  },

  /**
   * Renderiza o Organograma Editável por Sub-Área do DP
   */
  renderDPOrganogram(processes, tasks, members) {
    const container = document.getElementById('map-organogram-grid');
    if (!container) return;

    let html = `
      <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; margin-bottom: 0.5rem;">
        <button id="btn-add-map-process" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
          ➕ Adicionar Nova Atividade Padrão
        </button>
      </div>
    `;

    html += processes.map(proc => {
      const defaultMember = members.find(m =>
        (m.role || '').toLowerCase().includes((proc.defaultMemberRole || '').toLowerCase())
      ) || members[0];

      return `
        <div class="card-panel" style="border-top: 3px solid var(--accent-primary);">
          <div class="panel-header" style="margin-bottom:0.75rem;">
            <h3 class="panel-title" style="font-size:0.95rem;">
              <span>${proc.icon || '📋'}</span> ${proc.category}
            </h3>
          </div>

          ${defaultMember ? `
            <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; color:var(--text-muted); margin-bottom:0.85rem; padding-bottom:0.4rem; border-bottom:1px dashed var(--border-color);">
              <span>Responsável Principal:</span>
              <img src="${defaultMember.photo}" alt="${defaultMember.name}" style="width:20px; height:20px; border-radius:50%;">
              <strong style="color:var(--text-main);">${defaultMember.name}</strong>
            </div>
          ` : ''}

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${proc.tasks.map(t => {
        const activeTask = tasks.find(item => item.title === t.title);

        let statusBadge = `<span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-dim);">Padrão DP</span>`;
        if (activeTask) {
          const badgeClass = activeTask.status === 'EM EXECUÇÃO' ? 'badge-pending' : activeTask.status === 'CONCLUÍDO' ? 'badge-approved' : 'badge-rate';
          statusBadge = `<span class="badge ${badgeClass}">${activeTask.status}</span>`;
        }

        return `
                <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.85rem; position:relative;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.35rem; gap:0.5rem;">
                    <strong style="font-size:0.85rem; color:var(--text-main);">${t.title}</strong>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                      ${statusBadge}
                      <button class="btn-edit-process-item" data-proc-id="${proc.id}" data-task-id="${t.id}" title="Editar Atividade Padrão" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem; padding:0 0.2rem;">✏️</button>
                      <button class="btn-delete-process-item" data-proc-id="${proc.id}" data-task-id="${t.id}" title="Excluir Atividade Padrão" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.75rem; padding:0 0.2rem;">🗑️</button>
                    </div>
                  </div>
                  
                  <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.6rem;">${t.desc}</p>

                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.4rem; font-size:0.75rem;">
                    <span style="color:var(--text-dim); font-weight:600;">🗓️ Limite: ${t.dayLimit}</span>
                    <button class="btn btn-secondary btn-launch-dp-task" 
                            data-title="${t.title}" 
                            data-desc="${t.desc}" 
                            data-priority="${t.priority}" 
                            data-member="${defaultMember ? defaultMember.id : ''}"
                            style="font-size:0.7rem; padding:0.25rem 0.5rem;">
                      ⚡ ${activeTask ? 'Já no Kanban' : '+ Lançar no Kanban'}
                    </button>
                  </div>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  /**
   * Renderiza a Tabela Roadmap do DP
   */
  renderRoadmapTable(tasks, membersMap, impMap) {
    const container = document.getElementById('map-roadmap-table-body');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-dim);">Nenhuma demanda ativa no momento. Clique no botão acima para iniciar o ciclo do mês.</td>
        </tr>
      `;
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    container.innerHTML = tasks.map(task => {
      const taskOwnerId = task.member_id || task.memberId;
      const member = membersMap.get(String(taskOwnerId)) || { name: 'Não atribuído', photo: '' };
      const taskImpediments = impMap.get(String(task.id)) || [];
      const elapsedSecs = TimerEngine.getCurrentElapsedSeconds(task);

      let deadlineBadge = '';
      if (task.status === 'CONCLUÍDO') {
        deadlineBadge = `<span class="badge badge-approved">Concluído</span>`;
      } else if (!task.dueDate) {
        deadlineBadge = `<span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-muted);">Sem Prazo</span>`;
      } else if (task.dueDate < todayStr) {
        deadlineBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4);">🔴 Atrasada</span>`;
      } else if (task.dueDate === todayStr) {
        deadlineBadge = `<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4);">🟡 Vence Hoje</span>`;
      } else {
        deadlineBadge = `<span class="badge" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);">🟢 No Prazo</span>`;
      }

      return `
        <tr>
          <td>
            <strong>${task.title}</strong>
            <div style="font-size:0.75rem; color:var(--text-dim); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:260px;">
              ${task.description || ''}
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <img src="${member.photo}" alt="${member.name}" style="width:24px; height:24px; border-radius:50%;">
              <span>${member.name}</span>
            </div>
          </td>
          <td>
            <span class="badge-priority priority-${(task.priority || 'média').toLowerCase()}">${task.priority || 'Média'}</span>
          </td>
          <td><strong>${task.status}</strong></td>
          <td>${task.dueDate ? task.dueDate.split('-').reverse().join('/') : '-'}</td>
          <td>${deadlineBadge}</td>
          <td>
            <span style="font-family:monospace; font-weight:700;">⏱️ ${TimerEngine.formatTime(elapsedSecs)}</span>
            ${taskImpediments.length > 0 ? `<div style="font-size:0.7rem; color:#ef4444;">⚠️ Contratempo</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Eventos dos botões do Organograma DP (Edição e Criação liberados para todos)
   */
  attachEvents(processes) {
    // 1. Iniciar ciclo mensal
    const btnCycle = document.getElementById('btn-start-dp-cycle');
    if (btnCycle) {
      btnCycle.addEventListener('click', async () => {
        if (confirm('Deseja instanciar todas as atividades mensais recorrentes do DP no Quadro Kanban da equipe?')) {
          await this.startDPMonthlyCycle();
        }
      });
    }

    // 2. Lançar uma única tarefa no Kanban
    document.querySelectorAll('.btn-launch-dp-task').forEach(btn => {
      btn.addEventListener('click', async () => {
        const title = btn.dataset.title;
        const desc = btn.dataset.desc;
        const priority = btn.dataset.priority;
        const memberId = btn.dataset.member;

        const tasks = (await DB.getAll('tasks')) || [];
        const exists = tasks.some(t => t.title === title);

        if (exists) {
          alert('Esta atividade já foi inserida no Quadro Kanban do setor!');
          return;
        }

        const newTask = {
          id: 't-dp-' + Date.now(),
          title,
          description: desc,
          member_id: memberId || 'm-1',
          memberId: memberId || 'm-1',
          priority: priority || 'Média',
          dueDate: new Date().toISOString().slice(0, 10),
          status: 'A FAZER',
          elapsedSeconds: 0,
          isTimerRunning: false,
          lastTimerStartedAt: null,
          createdAt: new Date().toISOString()
        };

        await DB.save('tasks', newTask);
        alert(`Atividade "${title}" lançada no Quadro Kanban!`);
        this.renderSectorMap();
      });
    });

    // 3. Adicionar Nova Atividade Padrão ao Mapa
    const btnAdd = document.getElementById('btn-add-map-process');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.openEditProcessModal(null, null, processes);
      });
    }

    // 4. Editar Atividade Padrão
    document.querySelectorAll('.btn-edit-process-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const procId = btn.dataset.procId;
        const taskId = btn.dataset.taskId;
        this.openEditProcessModal(procId, taskId, processes);
      });
    });

    // 5. Excluir Atividade Padrão do Mapa
    document.querySelectorAll('.btn-delete-process-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const procId = btn.dataset.procId;
        const taskId = btn.dataset.taskId;

        if (confirm('Deseja realmente remover esta atividade do Mapa de Processos?')) {
          const procIndex = processes.findIndex(p => String(p.id) === String(procId));
          if (procIndex !== -1) {
            processes[procIndex].tasks = processes[procIndex].tasks.filter(t => String(t.id) !== String(taskId));
            await DB.save('dp_processes', processes[procIndex]);
            alert('Atividade removida com sucesso!');
            this.renderSectorMap();
          }
        }
      });
    });
  },

  /**
   * Abre Modal Prompt simples para Edição / Adição de Processos Padrões
   */
  async openEditProcessModal(procId, taskId, processes) {
    let currentTask = { title: '', desc: '', dayLimit: 'Dia 05', priority: 'Média' };
    let currentCategory = processes[0].category;

    if (procId && taskId) {
      const proc = processes.find(p => String(p.id) === String(procId));
      if (proc) {
        currentCategory = proc.category;
        const t = proc.tasks.find(item => String(item.id) === String(taskId));
        if (t) currentTask = t;
      }
    }

    const newTitle = prompt('Título da Atividade Padrão:', currentTask.title);
    if (!newTitle) return;

    const newDesc = prompt('Descrição detalhada:', currentTask.desc) || '';
    const newDayLimit = prompt('Prazo limite padrão (ex: Dia 05, Dia 15, Recorrente):', currentTask.dayLimit) || 'Dia 05';
    const newPriority = prompt('Prioridade (Alta, Média, Baixa):', currentTask.priority) || 'Média';

    // Encontra ou cria a categoria no array
    let targetProc = processes.find(p => p.category === currentCategory);
    if (!targetProc) {
      targetProc = processes[0];
    }

    if (taskId) {
      // Atualização
      const taskIndex = targetProc.tasks.findIndex(t => String(t.id) === String(taskId));
      if (taskIndex !== -1) {
        targetProc.tasks[taskIndex] = {
          ...targetProc.tasks[taskIndex],
          title: newTitle,
          desc: newDesc,
          dayLimit: newDayLimit,
          priority: newPriority
        };
      }
    } else {
      // Criação de Nova Atividade
      targetProc.tasks.push({
        id: 'dp-t-' + Date.now(),
        title: newTitle,
        desc: newDesc,
        dayLimit: newDayLimit,
        priority: newPriority
      });
    }

    await DB.save('dp_processes', targetProc);
    alert('Mapa de Processos atualizado com sucesso!');
    this.renderSectorMap();
  },

  /**
   * Gera automaticamente todo o ciclo de tarefas mensais do DP
   */
  async startDPMonthlyCycle() {
    const members = (await DB.getAll('members')) || [];
    const existingTasks = (await DB.getAll('tasks')) || [];
    const processes = await this.getDpProcesses();
    const todayStr = new Date().toISOString().slice(0, 10);

    let countAdded = 0;

    for (const proc of processes) {
      const defaultMember = members.find(m =>
        (m.role || '').toLowerCase().includes((proc.defaultMemberRole || '').toLowerCase())
      ) || members[0];
      const memberId = defaultMember ? defaultMember.id : 'm-1';

      for (const t of proc.tasks) {
        const alreadyExists = existingTasks.some(item => item.title === t.title);
        if (!alreadyExists) {
          const newTask = {
            id: 't-dp-' + Date.now() + Math.floor(Math.random() * 1000),
            title: t.title,
            description: t.desc,
            member_id: memberId,
            memberId: memberId,
            priority: t.priority,
            dueDate: todayStr,
            status: 'A FAZER',
            elapsedSeconds: 0,
            isTimerRunning: false,
            lastTimerStartedAt: null,
            createdAt: new Date().toISOString()
          };
          await DB.save('tasks', newTask);
          countAdded++;
        }
      }
    }

    alert(`${countAdded} atividades mensais do DP foram geradas e atribuídas no Quadro Kanban!`);
    this.renderSectorMap();
  }
};