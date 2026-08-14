/**
 * Renderização e Lógica do Quadro Kanban (Drag & Drop, Cards, Timers, Reordenação, Filtros, Edição e Exclusão)
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';
import { UndoEngine } from './undo.js';

export const KanbanEngine = {
  activeMemberId: 'all',
  currentPeriodFilter: 'all', // 'all', 'daily', 'weekly', 'monthly'
  lastCallbacks: {}, // Armazena os callbacks para re-renderizar quando o filtro mudar

  /**
   * 🗓️ Define o filtro de período e re-renderiza o quadro automaticamente
   */
  setPeriodFilter(period, callbacks = null) {
    this.currentPeriodFilter = period;
    this.updatePeriodButtonsUI();
    const cbs = (callbacks && Object.keys(callbacks).length > 0) ? callbacks : this.lastCallbacks;
    this.renderBoard(this.activeMemberId, cbs);
  },

  /**
   * 🎨 Atualiza a classe 'active' nos botões de filtro no DOM
   */
  updatePeriodButtonsUI() {
    const periodButtons = document.querySelectorAll('.btn-period-filter');
    periodButtons.forEach(btn => {
      if (btn.dataset.period === this.currentPeriodFilter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  /**
   * 🖱️ Inicializa os ouvintes de clique nos botões de filtro de período
   */
  initPeriodFilterButtons(callbacks = {}) {
    if (callbacks && Object.keys(callbacks).length > 0) {
      this.lastCallbacks = callbacks;
    }
    const periodButtons = document.querySelectorAll('.btn-period-filter');
    periodButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const period = btn.dataset.period;
        this.setPeriodFilter(period, callbacks);
      });
    });
    this.updatePeriodButtonsUI();
  },

  /**
   * 📅 Normaliza e converte qualquer formato de data da tarefa para objeto Date (à meia-noite)
   */
  parseTaskDate(t) {
    const rawDate = t.dueDate || t.due_date || t.createdAt || t.created_at || t.completedAt || t.completed_at;
    if (!rawDate) return null;

    if (typeof rawDate === 'string') {
      const cleanStr = rawDate.split('T')[0];
      if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length >= 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            return new Date(year, month, day);
          }
        }
      } else if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length >= 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            return new Date(year, month, day);
          }
        }
      }
    }

    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return null;
  },

  /**
   * Inicializa os escutadores de Drag and Drop nas colunas
   */
  initDragAndDrop(onTaskMovedCallback) {
    const columns = document.querySelectorAll('.kanban-column');

    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        const targetStatus = col.dataset.status;

        if (taskId && targetStatus) {
          // Impede a movimentação se a tarefa estiver travada
          const transfers = (await DB.getAll('activity_transfers')) || [];
          const isPending = transfers.some(tr => {
            const tId = tr.task_id || tr.taskId;
            const status = String(tr.status || '').trim().toUpperCase();
            return String(tId) === String(taskId) && status === 'PENDENTE';
          });

          if (isPending) {
            alert('Esta atividade possui uma solicitação de transferência pendente e está travada.');
            return;
          }

          await this.handleTaskMove(taskId, targetStatus, onTaskMovedCallback);
        }
      });
    });
  },

  /**
   * Processa a mudança de coluna/status de uma tarefa
   */
  async handleTaskMove(taskId, targetStatus, callback) {
    const task = await DB.get('tasks', taskId);
    if (!task || task.status === targetStatus) return;

    const oldStatus = task.status;
    const nowIso = new Date().toISOString();

    task.status = targetStatus;

    // Regras de Timer Automático por Mudança de Coluna
    if (targetStatus === 'A FAZER') {
      // 🔄 Se a tarefa voltou para A FAZER, zera todo o tempo trabalhado, pausado e marcadores
      task.elapsedSeconds = 0;
      task.isTimerRunning = false;
      task.lastTimerStartedAt = null;
      task.lastTimerStoppedAt = null;
      task.firstExecutionStartedAt = null;
      task.completedAt = null;
    } else if (targetStatus === 'EM EXECUÇÃO') {
      if (!task.firstExecutionStartedAt) {
        task.firstExecutionStartedAt = nowIso;
      }
      if (!task.lastTimerStartedAt) {
        task.lastTimerStartedAt = nowIso;
      }
      await TimerEngine.startTimer(task);
    } else if (oldStatus === 'EM EXECUÇÃO') {
      task.lastTimerStoppedAt = nowIso;
      await TimerEngine.stopTimer(task);
    }

    // 🗓️ Se a tarefa for movida para CONCLUÍDO, registra a data e hora exata
    if (targetStatus === 'CONCLUÍDO') {
      task.completedAt = nowIso;
      if (task.isTimerRunning) {
        task.lastTimerStoppedAt = nowIso;
        await TimerEngine.stopTimer(task);
      }
    }

    await DB.save('tasks', task);

    // Registra na pilha do Ctrl+Z
    UndoEngine.pushAction({
      type: 'TASK_STATUS',
      taskId: task.id,
      fromStatus: oldStatus,
      toStatus: targetStatus
    });

    // Auditoria
    const auditLog = {
      id: 'log-' + Date.now(),
      taskId: task.id,
      memberId: task.member_id || task.memberId,
      fromStatus: oldStatus,
      toStatus: targetStatus,
      timestamp: nowIso
    };
    await DB.save('audit_logs', auditLog);

    if (callback) {
      callback(task, oldStatus, targetStatus);
    }
  },

  /**
   * Reordena um cartão para cima ou para baixo dentro da coluna
   */
  async reorderTask(taskId, direction, callback) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;

    const allTasks = (await DB.getAll('tasks')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];

    // Filtra tarefas da mesma coluna
    const colTasks = allTasks
      .filter(t => {
        if (t.status !== task.status) return false;
        if (this.activeMemberId === 'all') return true;

        const isPrincipal = String(t.member_id || t.memberId) === String(this.activeMemberId);
        const isInGroup = taskMembers.some(tm =>
          String(tm.taskId) === String(t.id) &&
          String(tm.memberId || tm.member_id) === String(this.activeMemberId)
        );

        return isPrincipal || isInGroup;
      })
      .sort((a, b) => (Number(a.sortOrder ?? a.sort_order ?? 0)) - (Number(b.sortOrder ?? b.sort_order ?? 0)));

    // Normaliza os índices de 0 a N-1 para garantir números únicos e ordenáveis
    colTasks.forEach((t, i) => {
      t.sortOrder = i;
      t.sort_order = i;
    });

    const index = colTasks.findIndex(t => String(t.id) === String(taskId));
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= colTasks.length) return;

    // Troca sortOrder dos cartões vizinhos
    const currentTask = colTasks[index];
    const targetTask = colTasks[targetIndex];

    const tempOrder = currentTask.sortOrder;
    currentTask.sortOrder = targetTask.sortOrder;
    currentTask.sort_order = targetTask.sortOrder;
    targetTask.sortOrder = tempOrder;
    targetTask.sort_order = tempOrder;

    await DB.save('tasks', currentTask);
    await DB.save('tasks', targetTask);

    if (callback) await callback();
  },

  /**
   * Renderiza o quadro Kanban completo
   */
  async renderBoard(memberId = 'all', callbacks = {}) {
    this.activeMemberId = memberId;
    if (callbacks && Object.keys(callbacks).length > 0) {
      this.lastCallbacks = callbacks;
    }

    this.updatePeriodButtonsUI();

    const tasks = (await DB.getAll('tasks')) || [];
    const members = (await DB.getAll('members')) || [];
    const impediments = (await DB.getAll('impediments')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];
    const transfers = (await DB.getAll('activity_transfers')) || [];

    const membersMap = new Map(members.map(m => [String(m.id), m]));

    // Mapeia transferências pendentes por ID da tarefa
    const pendingTransfersMap = new Map();
    transfers.forEach(tr => {
      const tId = tr.task_id || tr.taskId;
      const status = String(tr.status || '').trim().toUpperCase();
      if (status === 'PENDENTE' && tId) {
        pendingTransfersMap.set(String(tId), tr);
      }
    });

    const impMap = new Map();
    impediments.forEach(imp => {
      if (!impMap.has(imp.taskId)) impMap.set(imp.taskId, []);
      impMap.get(imp.taskId).push(imp);
    });

    // 🔍 1. FILTRO POR MEMBRO
    let filteredTasks = memberId === 'all'
      ? tasks
      : tasks.filter(t => {
        const isPrincipal = String(t.member_id || t.memberId) === String(memberId);
        const isInGroup = taskMembers.some(tm =>
          String(tm.taskId) === String(t.id) &&
          String(tm.memberId || tm.member_id) === String(memberId)
        );
        return isPrincipal || isInGroup;
      });

    // 🗓️ 2. FILTRO POR PERÍODO
    if (this.currentPeriodFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filteredTasks = filteredTasks.filter(t => {
        const taskDate = this.parseTaskDate(t);
        if (!taskDate) return false;

        if (this.currentPeriodFilter === 'daily') {
          return taskDate.getFullYear() === today.getFullYear() &&
                 taskDate.getMonth() === today.getMonth() &&
                 taskDate.getDate() === today.getDate();
        }

        if (this.currentPeriodFilter === 'weekly') {
          const dayOfWeek = today.getDay();
          const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
          const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
          monday.setHours(0, 0, 0, 0);

          const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);

          return taskDate >= monday && taskDate <= sunday;
        }

        if (this.currentPeriodFilter === 'monthly') {
          return (
            taskDate.getMonth() === today.getMonth() &&
            taskDate.getFullYear() === today.getFullYear()
          );
        }

        return true;
      });
    }

    const statuses = ['A FAZER', 'EM EXECUÇÃO', 'CONCLUÍDO'];

    statuses.forEach(status => {
      const colEl = document.querySelector(`.kanban-column[data-status="${status}"] .cards-container`);
      const countEl = document.querySelector(`.kanban-column[data-status="${status}"] .column-count`);

      if (!colEl) return;

      const colTasks = filteredTasks
        .filter(t => t.status === status)
        .sort((a, b) => (Number(a.sortOrder ?? a.sort_order ?? 0)) - (Number(b.sortOrder ?? b.sort_order ?? 0)));

      if (countEl) countEl.textContent = colTasks.length;

      if (colTasks.length === 0) {
        colEl.innerHTML = `
          <div style="text-align:center; padding:2rem 1rem; color:var(--text-dim); font-size:0.8rem;">
            Nenhuma atividade nesta coluna
          </div>
        `;
        return;
      }

      colEl.innerHTML = colTasks.map((task, idx) => {
        const taskOwnerId = String(task.member_id || task.memberId || '');
        const member = membersMap.get(taskOwnerId) || { name: 'Não atribuído', photo: '' };
        const taskImpediments = impMap.get(task.id) || [];
        const elapsedSecs = TimerEngine.getCurrentElapsedSeconds(task);
        const timeFormatted = TimerEngine.formatTime(elapsedSecs);
        const isRunning = task.isTimerRunning;

        const pendingTransfer = pendingTransfersMap.get(String(task.id));
        const isLocked = Boolean(pendingTransfer);

        let destMemberName = '';
        if (isLocked) {
          const toId = pendingTransfer.to_member_id || pendingTransfer.toMemberId;
          const destMember = membersMap.get(String(toId));
          if (destMember) destMemberName = destMember.name;
        }

        const groupLinks = taskMembers.filter(tm => String(tm.taskId) === String(task.id));
        const groupMembers = members.filter(m => groupLinks.some(gl => String(gl.memberId || gl.member_id) === String(m.id)));

        return `
          <div class="kanban-card ${task.status === 'EM EXECUÇÃO' ? 'wip-active' : ''} ${isLocked ? 'task-locked' : ''}" 
                draggable="${!isLocked}" 
                data-id="${task.id}"
                style="${isLocked ? 'opacity:0.85; border:1px dashed #6366f1; position:relative; cursor:pointer;' : 'cursor:pointer;'}">
            
            ${isLocked ? `
              <div class="lock-banner" style="background:rgba(99, 102, 241, 0.2); border-bottom:1px solid #6366f1; margin:-0.75rem -0.75rem 0.5rem -0.75rem; padding:0.4rem 0.6rem; border-radius:6px 6px 0 0; font-size:0.75rem; color:#a5b4fc; display:flex; justify-content:space-between; align-items:center;">
                <span>⏳ <strong>Aguardando aceite de ${destMemberName || 'colaborador'}...</strong></span>
                <span>🔒</span>
              </div>
            ` : ''}

            <div class="card-header">
              <h4 class="card-title font-clickable-title" data-id="${task.id}" title="${isLocked ? 'Transferência Pendente' : 'Clique para ver detalhes completos'}">
                ${task.title}
              </h4>
              <div style="display:flex; align-items:center; gap:0.25rem;">
                <button class="btn-reorder btn-reorder-up" data-id="${task.id}" title="Mover para Cima" ${idx === 0 || isLocked ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
                <button class="btn-reorder btn-reorder-down" data-id="${task.id}" title="Mover para Baixo" ${idx === colTasks.length - 1 || isLocked ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
              </div>
            </div>

            <div class="card-badges" style="margin-bottom:0.5rem;">
              <span class="badge-priority priority-${(task.priority || 'média').toLowerCase()}">${task.priority || 'Média'}</span>
              ${taskImpediments.length > 0 ? `<span class="badge-impediment" title="${taskImpediments.length} contratempo(s) registrado(s)">⚠️ ${taskImpediments.length}</span>` : ''}
              ${groupMembers.length > 0 ? `<span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4);" title="Atividade em Grupo (+${groupMembers.length})">👥 Grupo (${groupMembers.length + 1})</span>` : ''}
            </div>

            <p class="card-desc">${task.description || 'Sem descrição.'}</p>

            <div class="timer-box">
              <div class="timer-display ${isRunning ? 'running' : ''}" id="timer-display-${task.id}">
                ⏱️ ${timeFormatted}
              </div>
              
              ${task.status === 'EM EXECUÇÃO' ? `
                <button class="timer-btn btn-toggle-timer" data-id="${task.id}" ${isLocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} title="${isRunning ? 'Pausar Cronômetro' : 'Retomar Cronômetro'}">
                  ${isRunning ? '⏸️ Pausar' : '▶️ Retomar'}
                </button>
              ` : ''}
            </div>

            ${task.status === 'EM EXECUÇÃO' ? `
              <button class="btn btn-warning btn-report-impediment" data-id="${task.id}" ${isLocked ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="width:100%; margin-bottom:0.75rem; font-size:0.75rem; padding:0.35rem;">
                ⚠️ Registrar Contratempo
              </button>
            ` : ''}

            <div class="card-footer">
              <div class="member-info">
                ${member.photo ? `<img src="${member.photo}" alt="${member.name}" class="card-avatar" title="Responsável: ${member.name}">` : '👤'}
                <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">${member.name.split(' ')[0]}</span>
                ${groupMembers.map(gm => `<img src="${gm.photo}" title="Integrante: ${gm.name}" class="card-avatar" style="margin-left:-8px; border:2px solid var(--bg-card);">`).join('')}
              </div>
              
              <div class="card-due-date">
                📅 ${task.dueDate ? task.dueDate.split('T')[0].split('-').reverse().slice(0, 2).join('/') : '-'}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Eventos de Drag & Drop nos cartões
      colEl.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          if (card.classList.contains('task-locked')) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', card.dataset.id);
          card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });

        // Clique no cartão para abrir os Detalhes / Editar / Excluir
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-toggle-timer') || e.target.closest('.btn-report-impediment') || e.target.closest('.btn-reorder')) {
            return;
          }

          if (card.classList.contains('task-locked')) {
            alert('Esta atividade possui uma solicitação de transferência pendente e está travada.');
            return;
          }

          const taskId = card.dataset.id;

          if (callbacks && typeof callbacks.onOpenTaskDetails === 'function') {
            callbacks.onOpenTaskDetails(taskId);
          } else {
            this.openTaskDetailsFallback(taskId, callbacks);
          }
        });
      });

      // Botões de Reordenação
      colEl.querySelectorAll('.btn-reorder-up').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.reorderTask(btn.dataset.id, 'up', callbacks.onRefresh);
        });
      });

      colEl.querySelectorAll('.btn-reorder-down').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.reorderTask(btn.dataset.id, 'down', callbacks.onRefresh);
        });
      });

      // Attach de botões internos dos cards
      colEl.querySelectorAll('.btn-toggle-timer').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const taskId = btn.dataset.id;
          const task = await DB.get('tasks', taskId);
          if (task.isTimerRunning) {
            await TimerEngine.pauseTimer(task);
          } else {
            await TimerEngine.startTimer(task);
          }
          if (callbacks.onRefresh) callbacks.onRefresh();
        });
      });

      colEl.querySelectorAll('.btn-report-impediment').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (callbacks.onReportImpediment) {
            callbacks.onReportImpediment(btn.dataset.id);
          }
        });
      });
    });
  },

  /**
   * Renderiza o Modal de Detalhes da Atividade com botões de Editar e Excluir
   */
  async openTaskDetailsFallback(taskId, callbacks) {
    const task = await DB.get('tasks', taskId);
    if (!task) return;

    const modal = document.getElementById('modal-task-details');
    const container = document.getElementById('task-details-body');
    if (!modal || !container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.85rem;">
        <h4 style="font-size:1.15rem; color:#fff; margin:0; font-weight:700;">${task.title}</h4>
        <p style="font-size:0.9rem; color:var(--text-muted, #9ca3af); margin:0; line-height:1.5;">${task.description || 'Sem descrição cadastrada.'}</p>
        
        <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.825rem; color:#e5e7eb; background:rgba(255,255,255,0.05); padding:0.75rem; border-radius:6px;">
          <span><strong>Status:</strong> ${task.status}</span>
          <span><strong>Prioridade:</strong> ${task.priority || 'Média'}</span>
          <span><strong>Prazo:</strong> ${task.dueDate ? task.dueDate.split('T')[0].split('-').reverse().join('/') : '-'}</span>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem; border-top:1px solid var(--border-color, #374151); padding-top:1rem;">
          <button id="btn-edit-task-action" class="btn btn-secondary" style="font-size:0.825rem; padding:0.5rem 1rem;">✏️ Editar Atividade</button>
          <button id="btn-delete-task-action" class="btn btn-danger" style="background:#ef4444; color:#fff; font-size:0.825rem; padding:0.5rem 1rem;">🗑️ Excluir Atividade</button>
        </div>
      </div>
    `;

    // Ação do Botão Editar
    const btnEdit = container.querySelector('#btn-edit-task-action');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        modal.classList.remove('active');
        if (callbacks && typeof callbacks.onEditTask === 'function') {
          callbacks.onEditTask(task);
        } else {
          const editModal = document.getElementById('modal-task');
          if (editModal) {
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description || '';
            document.getElementById('task-priority').value = task.priority || 'Média';
            if (task.dueDate) document.getElementById('task-date').value = task.dueDate.split('T')[0];

            const btnSubmit = editModal.querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';

            editModal.classList.add('active');
          }
        }
      });
    }

    // Ação do Botão Excluir
    const btnDelete = container.querySelector('#btn-delete-task-action');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (confirm(`Tem certeza que deseja excluir a atividade "${task.title}"?`)) {
          await DB.delete('tasks', task.id);
          modal.classList.remove('active');
          if (callbacks && typeof callbacks.onRefresh === 'function') {
            callbacks.onRefresh();
          } else {
            this.renderBoard(this.activeMemberId, callbacks);
          }
        }
      });
    }

    modal.classList.add('active');
  }
};