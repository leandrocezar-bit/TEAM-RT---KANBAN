/**
 * Renderização e Lógica do Quadro Kanban (Drag & Drop, Cards, Timers e Reordenação)
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';
import { UndoEngine } from './undo.js';

export const KanbanEngine = {
  activeMemberId: 'all',
  currentPeriodFilter: 'all', // 'all', 'daily', 'weekly', 'monthly'

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
    task.status = targetStatus;

    // Regras de Timer Automático por Mudança de Coluna
    if (targetStatus === 'EM EXECUÇÃO') {
      await TimerEngine.startTimer(task);
    } else if (oldStatus === 'EM EXECUÇÃO') {
      await TimerEngine.stopTimer(task);
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
      timestamp: new Date().toISOString()
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

    const allTasks = await DB.getAll('tasks');
    const colTasks = allTasks
      .filter(t => t.status === task.status && (this.activeMemberId === 'all' || String(t.member_id || t.memberId) === String(this.activeMemberId)))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const index = colTasks.findIndex(t => String(t.id) === String(taskId));
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= colTasks.length) return;

    // Troca sortOrder
    const targetTask = colTasks[targetIndex];
    const tempOrder = task.sortOrder || index;
    task.sortOrder = targetTask.sortOrder || targetIndex;
    targetTask.sortOrder = tempOrder;

    await DB.save('tasks', task);
    await DB.save('tasks', targetTask);

    if (callback) callback();
  },

  /**
   * Renderiza o quadro Kanban completo
   */
  async renderBoard(memberId = 'all', callbacks = {}) {
    this.activeMemberId = memberId;
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

    let filteredTasks = memberId === 'all'
      ? tasks
      : tasks.filter(t => String(t.member_id || t.memberId) === String(memberId));

    // Filtro por período se selecionado
    if (this.currentPeriodFilter !== 'all') {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      filteredTasks = filteredTasks.filter(t => {
        if (!t.dueDate) return false;
        if (this.currentPeriodFilter === 'daily') return t.dueDate === todayStr;
        if (this.currentPeriodFilter === 'weekly') {
          const due = new Date(t.dueDate);
          const diffDays = (due - now) / (1000 * 60 * 60 * 24);
          return diffDays >= -1 && diffDays <= 7;
        }
        if (this.currentPeriodFilter === 'monthly') {
          return t.dueDate.slice(0, 7) === todayStr.slice(0, 7);
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
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

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

        // Verifica se há transferência pendente travando este card
        const pendingTransfer = pendingTransfersMap.get(String(task.id));
        const isLocked = Boolean(pendingTransfer);

        let destMemberName = '';
        if (isLocked) {
          const toId = pendingTransfer.to_member_id || pendingTransfer.toMemberId;
          const destMember = membersMap.get(String(toId));
          if (destMember) destMemberName = destMember.name;
        }

        // Membros do Grupo
        const groupLinks = taskMembers.filter(tm => tm.taskId === task.id);
        const groupMembers = members.filter(m => groupLinks.some(gl => gl.memberId === m.id));

        return `
          <div class="kanban-card ${task.status === 'EM EXECUÇÃO' ? 'wip-active' : ''} ${isLocked ? 'task-locked' : ''}" 
               draggable="${!isLocked}" 
               data-id="${task.id}"
               style="${isLocked ? 'opacity:0.85; border:1px dashed #6366f1; position:relative;' : ''}">
            
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
              ${groupMembers.length > 0 ? `<span class="badge" style="background:rgba(99,102,241,0.2); color:#6366f1; border:1px solid rgba(99,102,241,0.4);" title="Atividade em Grupo (+${groupMembers.length})">👥 Grupo (${groupMembers.length + 1})</span>` : ''}
            </div>

            <p class="card-desc">${task.description || 'Sem descrição.'}</p>

            <!-- Box do Cronômetro -->
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
                ${member.photo ? `<img src="${member.photo}" alt="${member.name}" class="card-avatar">` : '👤'}
                <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">${member.name.split(' ')[0]}</span>
                ${groupMembers.map(gm => `<img src="${gm.photo}" title="${gm.name}" class="card-avatar" style="margin-left:-8px; border:2px solid var(--bg-card);">`).join('')}
              </div>
              
              <div class="card-due-date">
                📅 ${task.dueDate ? task.dueDate.split('-').reverse().slice(0, 2).join('/') : '-'}
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

        // Clique no cartão
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-toggle-timer') || e.target.closest('.btn-report-impediment') || e.target.closest('.btn-reorder')) {
            return;
          }

          if (card.classList.contains('task-locked')) {
            alert('Esta atividade possui uma solicitação de transferência pendente e está travada.');
            return;
          }

          if (callbacks.onOpenTaskDetails) {
            callbacks.onOpenTaskDetails(card.dataset.id);
          }
        });
      });

      // Botões de Reordenação (Para cima / Para baixo)
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
  }
};