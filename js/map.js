/**
 * Organograma e Mapa de Processos Recorrentes Editável (100% Personalizado)
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const MapEngine = {
  defaultDpProcesses: [],

  /**
   * Obtém a lista atualizada de processos da tabela "cycle_templates" do Supabase
   */
  async getDpProcesses() {
    try {
      const records = await DB.getAll('cycle_templates');
      if (records && records.length > 0) {
        return records.map(r => r.data || r);
      }
    } catch (e) {
      console.warn('⚡ Tabela cycle_templates vazia ou indisponível.', e);
    }
    return this.defaultDpProcesses;
  },

  /**
   * Renderiza a tela do Mapa de Demandas
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

    this.attachEvents(processes, members);
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
          <span class="metric-title">Fechamento do Mês</span>
          <div class="metric-icon">📈</div>
        </div>
        <div class="metric-value">${completionPercent}%</div>
        <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:8px; width:100%; margin-top:0.5rem; overflow:hidden;">
          <div style="background:var(--accent-gradient); width:${completionPercent}%; height:100%; border-radius:10px;"></div>
        </div>
      </div>

      <div class="metric-card" style="--card-accent: #10b981;">
        <div class="metric-header">
          <span class="metric-title">Demandas no Quadro</span>
          <div class="metric-icon">💼</div>
        </div>
        <div class="metric-value">${total}</div>
        <div class="metric-sub positive">
          <span>${done} concluídas • ${wip} em execução</span>
        </div>
      </div>

      <div class="metric-card" style="--card-accent: #06b6d4;">
        <div class="metric-header">
          <span class="metric-title">Horas Trabalhadas</span>
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
   * Renderiza o Organograma por Categoria (Sem os cabeçalhos antigos)
   */
  renderDPOrganogram(processes, tasks, members) {
    const container = document.getElementById('map-organogram-grid');
    if (!container) return;

    let html = `
      <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; margin-bottom: 0.5rem;">
        <button id="btn-add-map-process" class="btn btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
          📌 + Criar Nova Atividade Padrão
        </button>
      </div>
    `;

    if (processes.length === 0) {
      html += `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
          <p style="font-size: 1rem; color: var(--text-muted); margin-bottom: 1rem;">Nenhuma atividade padrão cadastrada no mapa.</p>
          <p style="font-size: 0.8rem; color: var(--text-dim);">Clique no botão acima para criar suas próprias categorias e processos recorrentes.</p>
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    html += processes.map(proc => {
      const defaultMember = members.find(m => String(m.id) === String(proc.defaultMemberId)) || members[0];

      return `
        <div class="card-panel" style="border-top: 3px solid var(--accent-primary);">
          <div class="panel-header" style="margin-bottom:0.75rem;">
            <h3 class="panel-title" style="font-size:0.95rem;">
              <span>${proc.icon || '📋'}</span> ${proc.category}
            </h3>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${(proc.tasks || []).map(t => {
        const activeTask = tasks.find(item => item.title === t.title);

        let statusBadge = `<span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-dim);">Padrão</span>`;
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
                      <button class="btn-edit-process-item" data-proc-id="${proc.id}" data-task-id="${t.id}" title="Editar Atividade" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem; padding:0 0.2rem;">✏️</button>
                      <button class="btn-delete-process-item" data-proc-id="${proc.id}" data-task-id="${t.id}" title="Excluir Atividade" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.75rem; padding:0 0.2rem;">🗑️</button>
                    </div>
                  </div>
                  
                  <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.6rem;">${t.desc || 'Sem detalhes cadastrados.'}</p>

                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.4rem; font-size:0.75rem;">
                    <span style="color:var(--text-dim); font-weight:600;">🗓️ Limite: ${t.dayLimit || 'A definir'}</span>
                    <button class="btn btn-secondary btn-launch-dp-task" 
                            data-title="${t.title}" 
                            data-desc="${t.desc || ''}" 
                            data-priority="${t.priority || 'Média'}" 
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
   * Renderiza a Tabela Roadmap
   */
  renderRoadmapTable(tasks, membersMap, impMap) {
    const container = document.getElementById('map-roadmap-table-body');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-dim);">Nenhuma demanda ativa no momento. Clique no botão de lançar para enviar atividades para o Kanban.</td>
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
              <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" alt="${member.name}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
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
   * Associa os eventos aos elementos interativos
   */
  attachEvents(processes, members) {
    // 1. Iniciar ciclo mensal
    const btnCycle = document.getElementById('btn-start-dp-cycle');
    if (btnCycle) {
      btnCycle.addEventListener('click', async () => {
        if (confirm('Deseja instanciar todas as atividades mensais recorrentes no Quadro Kanban da equipe?')) {
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
          alert('Esta atividade já foi inserida no Quadro Kanban!');
          return;
        }

        const newTask = {
          id: 't-dp-' + Date.now(),
          title,
          description: desc,
          member_id: memberId || (members[0] ? members[0].id : 'm-1'),
          memberId: memberId || (members[0] ? members[0].id : 'm-1'),
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

    // 3. Adicionar Nova Atividade Padrão
    const btnAdd = document.getElementById('btn-add-map-process');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.openCustomModal(null, null, processes, members);
      });
    }

    // 4. Editar Atividade Padrão
    document.querySelectorAll('.btn-edit-process-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const procId = btn.dataset.procId;
        const taskId = btn.dataset.taskId;
        this.openCustomModal(procId, taskId, processes, members);
      });
    });

    // 5. Excluir Atividade Padrão
    document.querySelectorAll('.btn-delete-process-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const procId = btn.dataset.procId;
        const taskId = btn.dataset.taskId;

        if (confirm('Deseja realmente remover esta atividade do Mapa de Processos?')) {
          const procIndex = processes.findIndex(p => String(p.id) === String(procId));
          if (procIndex !== -1) {
            processes[procIndex].tasks = processes[procIndex].tasks.filter(t => String(t.id) !== String(taskId));

            const payload = {
              id: processes[procIndex].id,
              data: processes[procIndex]
            };
            await DB.save('cycle_templates', payload);

            alert('Atividade removida com sucesso!');
            this.renderSectorMap();
          }
        }
      });
    });
  },

  /**
   * Exibe o Modal de Criação / Edição estilo "Nova Atividade"
   */
  openCustomModal(procId, taskId, processes, members) {
    let currentTask = { title: '', desc: '', dayLimit: '', priority: 'Média' };
    let currentCategory = 'Geral';
    let currentMemberId = members[0] ? members[0].id : '';

    if (procId && taskId) {
      const proc = processes.find(p => String(p.id) === String(procId));
      if (proc) {
        currentCategory = proc.category;
        currentMemberId = proc.defaultMemberId || currentMemberId;
        const t = (proc.tasks || []).find(item => String(item.id) === String(taskId));
        if (t) currentTask = t;
      }
    }

    const oldModal = document.getElementById('modal-custom-map-task');
    if (oldModal) oldModal.remove();

    const modalHtml = `
      <div id="modal-custom-map-task" class="modal-overlay active" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:9999;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; width: 100%; max-width: 580px; padding: 1.5rem; color: #f3f4f6; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 0.5rem;">
              📌 ${taskId ? 'Editar Atividade' : 'Nova Atividade'}
            </h3>
            <button id="btn-close-map-modal" style="background: none; border: none; color: #9ca3af; font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>

          <form id="form-custom-map-task">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                Título da Atividade *
              </label>
              <input type="text" id="map-input-title" required value="${currentTask.title}" placeholder="Ex: Fechamento da Folha de Pagamento" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.875rem; outline: none;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                  Categoria / Macro-Área *
                </label>
                <input type="text" id="map-input-category" required value="${currentCategory}" placeholder="Ex: Folha de Pagamento" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.85rem; outline: none;">
              </div>

              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                  Responsável Principal *
                </label>
                <select id="map-select-member" required style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.85rem; outline: none;">
                  ${members.map(m => `
                    <option value="${m.id}" ${String(m.id) === String(currentMemberId) ? 'selected' : ''}>
                      ${m.name} (${m.role || 'Membro'})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                  Prioridade *
                </label>
                <select id="map-select-priority" required style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.85rem; outline: none;">
                  <option value="Baixa" ${currentTask.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                  <option value="Média" ${currentTask.priority === 'Média' || !currentTask.priority ? 'selected' : ''}>Média</option>
                  <option value="Alta" ${currentTask.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                  Prazo (Data Limite / Texto) *
                </label>
                <input type="text" id="map-input-limit" required value="${currentTask.dayLimit || 'Dia 05'}" placeholder="Ex: Dia 05, Dia 15 ou 11/08/2026" style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.85rem; outline: none;">
              </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.35rem;">
                Descrição dos Detalhes
              </label>
              <textarea id="map-input-desc" rows="3" placeholder="Instruções e requisitos da atividade..." style="width: 100%; background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 0.6rem 0.8rem; color: #ffffff; font-size: 0.85rem; outline: none; resize: vertical;">${currentTask.desc || ''}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-map-modal" style="background: #374151; color: #ffffff; border: none; border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.875rem; font-weight: 600; cursor: pointer;">
                Cancelar
              </button>
              <button type="submit" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #ffffff; border: none; border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.875rem; font-weight: 700; cursor: pointer;">
                ${taskId ? 'Salvar Alterações' : 'Criar Atividade'}
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('modal-custom-map-task');
    const closeBtn = document.getElementById('btn-close-map-modal');
    const cancelBtn = document.getElementById('btn-cancel-map-modal');
    const form = document.getElementById('form-custom-map-task');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('map-input-title').value.trim();
      const category = document.getElementById('map-input-category').value.trim();
      const memberId = document.getElementById('map-select-member').value;
      const priority = document.getElementById('map-select-priority').value;
      const dayLimit = document.getElementById('map-input-limit').value.trim();
      const desc = document.getElementById('map-input-desc').value.trim();

      let targetProc = processes.find(p => p.category.toLowerCase() === category.toLowerCase());

      if (!targetProc) {
        targetProc = {
          id: 'proc-' + Date.now(),
          category: category,
          icon: '📋',
          defaultMemberId: memberId,
          tasks: []
        };
        processes.push(targetProc);
      } else {
        targetProc.defaultMemberId = memberId;
      }

      if (taskId) {
        const taskIndex = targetProc.tasks.findIndex(t => String(t.id) === String(taskId));
        if (taskIndex !== -1) {
          targetProc.tasks[taskIndex] = {
            ...targetProc.tasks[taskIndex],
            title,
            desc,
            dayLimit,
            priority
          };
        }
      } else {
        targetProc.tasks.push({
          id: 'dp-t-' + Date.now(),
          title,
          desc,
          dayLimit,
          priority
        });
      }

      const payload = {
        id: targetProc.id,
        data: targetProc
      };

      await DB.save('cycle_templates', payload);
      closeModal();
      this.renderSectorMap();
    });
  },

  /**
   * Gera automaticamente todo o ciclo de tarefas mensais na tabela "tasks"
   */
  async startDPMonthlyCycle() {
    const members = (await DB.getAll('members')) || [];
    const existingTasks = (await DB.getAll('tasks')) || [];
    const processes = await this.getDpProcesses();
    const todayStr = new Date().toISOString().slice(0, 10);

    let countAdded = 0;

    for (const proc of processes) {
      const defaultMember = members.find(m => String(m.id) === String(proc.defaultMemberId)) || members[0];
      const memberId = defaultMember ? defaultMember.id : 'm-1';

      for (const t of (proc.tasks || [])) {
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

    alert(`${countAdded} atividades foram geradas e atribuídas no Quadro Kanban!`);
    this.renderSectorMap();
  }
};