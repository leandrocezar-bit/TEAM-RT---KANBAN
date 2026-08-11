/**
 * Visão do Gestor - Dashboard, Estatísticas, Relatório de Contratempos e Calendário Editável
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const ManagerEngine = {
  selectedCalendarMemberId: 'all',
  currentCalendarDate: new Date(),
  currentPeriodFilter: 'all', // 'all', 'daily', 'weekly', 'monthly'

  /**
   * Renderiza o Dashboard Completo do Gestor
   */
  async renderDashboard(onViewEvidenceCallback, onDeleteMemberCallback, onOpenDayDetailsCallback) {
    const members = (await DB.getAll('members')) || [];
    const tasks = (await DB.getAll('tasks')) || [];
    const impediments = (await DB.getAll('impediments')) || [];

    this.renderMemberCards(members, tasks, impediments);
    this.renderImpedimentsAlertList(impediments, tasks, members, onViewEvidenceCallback);
    this.renderCalendarGrid(tasks, members, onOpenDayDetailsCallback);
    this.setupPeriodFilterListeners(members, tasks, impediments);
  },

  /**
   * Configura os botões de filtro de período do Dashboard
   */
  setupPeriodFilterListeners(members, tasks, impediments) {
    const buttons = document.querySelectorAll('.btn-dashboard-period-filter');
    buttons.forEach(btn => {
      if (btn.dataset.listenerBound) return;
      btn.dataset.listenerBound = 'true';

      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentPeriodFilter = btn.dataset.period;
        this.renderMemberCards(members, tasks, impediments);
      });
    });
  },

  /**
   * Filtra tarefas de acordo com a data limite (dueDate) ou criação/atualização
   */
  filterTasksByPeriod(tasksList) {
    if (this.currentPeriodFilter === 'all') return tasksList;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return tasksList.filter(t => {
      const taskDateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);
      if (!taskDateStr) return false;

      if (this.currentPeriodFilter === 'daily') {
        return taskDateStr === todayStr;
      }

      if (this.currentPeriodFilter === 'weekly') {
        const taskDate = new Date(taskDateStr);
        const diffDays = (taskDate - now) / (1000 * 60 * 60 * 24);
        return diffDays >= -1 && diffDays <= 7;
      }

      if (this.currentPeriodFilter === 'monthly') {
        return taskDateStr.slice(0, 7) === todayStr.slice(0, 7);
      }

      return true;
    });
  },

  /**
   * Renderiza os cards de desempenho individual por membro da equipe
   */
  renderMemberCards(members, tasks, impediments) {
    const container = document.getElementById('manager-members-grid');
    if (!container) return;

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    let visibleMembers = members;
    if (!isManager && loggedMemberId) {
      visibleMembers = members.filter(m => String(m.id) === String(loggedMemberId));
    }

    if (visibleMembers.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Nenhum membro cadastrado.</p></div>`;
      return;
    }

    // Aplica o filtro de período nas tarefas
    const periodFilteredTasks = this.filterTasksByPeriod(tasks);

    container.innerHTML = visibleMembers.map(member => {
      const memberTasks = periodFilteredTasks.filter(t => String(t.member_id || t.memberId) === String(member.id));

      const todoCount = memberTasks.filter(t => t.status === 'A FAZER').length;
      const wipCount = memberTasks.filter(t => t.status === 'EM EXECUÇÃO').length;
      const doneCount = memberTasks.filter(t => t.status === 'CONCLUÍDO').length;

      let totalSeconds = 0;
      memberTasks.forEach(t => {
        totalSeconds += TimerEngine.getCurrentElapsedSeconds(t);
      });

      const memberTaskIds = new Set(memberTasks.map(t => String(t.id)));
      const memberImpediments = impediments.filter(imp => memberTaskIds.has(String(imp.taskId)));

      return `
        <div class="manager-card">
          <div class="manager-card-header" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
              <img src="${member.photo}" alt="${member.name}" class="manager-avatar" style="flex-shrink:0;">
              <div style="min-width:0; overflow:hidden;">
                <h3 style="font-size:1rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.name}</h3>
                <p style="font-size:0.775rem; color:var(--text-muted); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.role || 'Membro da Equipe'}</p>
                <p style="font-size:0.7rem; color:var(--text-dim); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.email || member.contact || ''}</p>
              </div>
            </div>

            <button class="btn-edit-member-profile" data-id="${member.id}" title="Editar Perfil" style="background:rgba(99,102,241,0.12); color:#818cf8; border:1px solid rgba(99,102,241,0.3); border-radius:var(--radius-sm); padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:700; cursor:pointer; flex-shrink:0; white-space:nowrap; display:block;">
              ✏️ Perfil
            </button>
          </div>

          <div style="margin-bottom:0.75rem;">
            <div class="manager-stats-row">
              <span>📋 A Fazer</span>
              <strong>${todoCount}</strong>
            </div>
            <div class="manager-stats-row">
              <span>⚡ Em Execução</span>
              <strong style="color:var(--col-wip);">${wipCount}</strong>
            </div>
            <div class="manager-stats-row">
              <span>✅ Concluído</span>
              <strong style="color:var(--col-done);">${doneCount}</strong>
            </div>
            <div class="manager-stats-row" style="border-bottom:none;">
              <span>⏱️ Tempo Total Efetivo</span>
              <strong style="color:var(--accent-primary);">${TimerEngine.formatTime(totalSeconds)}</strong>
            </div>
          </div>

          ${memberImpediments.length > 0 ? `
            <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-sm); padding:0.4rem 0.75rem; font-size:0.75rem; color:#ef4444; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
              ⚠️ ${memberImpediments.length} contratempo(s) relatado(s)
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-member-profile').forEach(btn => {
      btn.addEventListener('click', async () => {
        const member = members.find(m => String(m.id) === String(btn.dataset.id));
        if (member) {
          const modal = document.getElementById('modal-edit-profile');
          if (modal) {
            document.getElementById('edit-profile-id').value = member.id;
            document.getElementById('edit-profile-name').value = member.name;
            document.getElementById('edit-profile-role').value = member.role || '';
            document.getElementById('edit-profile-email').value = member.email || '';
            document.getElementById('edit-profile-preview').src = member.photo;
            modal.classList.add('active');
          }
        }
      });
    });
  },

  /**
   * Renderiza a lista detalhada de contratempos
   */
  renderImpedimentsAlertList(impediments, tasks, members, onViewEvidence) {
    const container = document.getElementById('impediments-list-container');
    if (!container) return;

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    const tasksMap = new Map(tasks.map(t => [String(t.id), t]));
    const membersMap = new Map(members.map(m => [String(m.id), m]));

    let visibleImpediments = impediments;
    if (!isManager && loggedMemberId) {
      visibleImpediments = impediments.filter(imp => {
        const task = tasksMap.get(String(imp.taskId));
        if (!task) return false;
        const taskOwnerId = task.member_id || task.memberId;
        return String(taskOwnerId) === String(loggedMemberId);
      });
    }

    if (visibleImpediments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">
          🎉 Nenhum contratempo registrado ${isManager ? 'na equipe' : 'nas suas atividades'} até o momento!
        </div>
      `;
      return;
    }

    container.innerHTML = visibleImpediments.map(imp => {
      const task = tasksMap.get(String(imp.taskId)) || { title: 'Tarefa não encontrada', memberId: null, member_id: null };
      const taskOwnerId = task.member_id || task.memberId;
      const member = membersMap.get(String(taskOwnerId)) || { name: 'Desconhecido', photo: '' };
      const dateFormatted = new Date(imp.createdAt).toLocaleString('pt-BR');

      return `
        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
              <span class="badge-impediment">⚠️ Contratempo</span>
              <strong style="font-size:0.9rem;">${task.title}</strong>
            </div>
            <p style="font-size:0.85rem; color:var(--text-main); margin-bottom:0.4rem;">"${imp.description}"</p>
            <div style="font-size:0.75rem; color:var(--text-dim); display:flex; align-items:center; gap:0.5rem;">
              <span>👤 ${member.name}</span> • <span>🕒 ${dateFormatted}</span>
            </div>
          </div>

          ${imp.evidenceImage ? `
            <button class="btn btn-secondary btn-view-evidence" data-img="${imp.evidenceImage}" style="font-size:0.75rem; padding:0.35rem 0.75rem;">
              🖼️ Ver Evidência
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-view-evidence').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onViewEvidence) onViewEvidence(btn.dataset.img);
      });
    });
  },

  /**
   * Renderiza a Visão de Calendário Editável
   */
  renderCalendarGrid(tasks, members, onOpenDayDetails) {
    const container = document.getElementById('calendar-grid-container');
    if (!container) return;

    const date = this.currentCalendarDate || new Date();
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date();

    const calendarTasks = this.selectedCalendarMemberId === 'all'
      ? tasks
      : tasks.filter(t => String(t.member_id || t.memberId) === String(this.selectedCalendarMemberId));

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; grid-column:span 7; margin-bottom:1rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <label style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">👤 Agenda do Colaborador:</label>
          <select id="select-calendar-member-filter" class="select-control" style="padding:0.25rem 0.5rem; font-size:0.775rem;">
            <option value="all">👥 Todos os Colaboradores</option>
            ${members.map(m => `
              <option value="${m.id}" ${String(this.selectedCalendarMemberId) === String(m.id) ? 'selected' : ''}>${m.name}</option>
            `).join('')}
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button id="btn-cal-prev" class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;">◄ Mês Anterior</button>
          <strong style="text-transform:capitalize; font-size:1rem; color:var(--text-main); font-weight:800;">${monthName}</strong>
          <button id="btn-cal-next" class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;">Mês Seguinte ►</button>
        </div>
      </div>
    `;

    html += weekDays.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="calendar-cell" style="opacity:0.3; background:transparent;"></div>`;
    }

    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = calendarTasks.filter(t => t.dueDate === dateStr);
      const isToday = isCurrentMonth && day === today.getDate();

      const dayDate = new Date(year, month, day);
      const diffTime = dayDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const has2DayAlert = diffDays >= 0 && diffDays <= 2 && dayTasks.some(t => t.status !== 'CONCLUÍDO');

      html += `
        <div class="calendar-cell calendar-day-clickable" data-date="${dateStr}" style="${isToday ? 'border:2px solid var(--accent-primary); background:rgba(99,102,241,0.1);' : ''} cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <span class="calendar-cell-date" style="${isToday ? 'color:var(--accent-primary); font-weight:800;' : ''}">${day}</span>
            ${has2DayAlert ? `<span title="Aviso: Tarefa com prazo nos próximos 2 dias!" style="font-size:0.65rem; background:#f59e0b; color:#000; padding:0.1rem 0.3rem; border-radius:3px; font-weight:800;">⏰ 2 Dias</span>` : ''}
          </div>

          ${dayTasks.map(t => `
            <div class="calendar-task-pill priority-${(t.priority || 'média').toLowerCase()}" title="${t.title} (${t.status})">
              ${t.title}
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;

    const selectMember = document.getElementById('select-calendar-member-filter');
    if (selectMember) {
      selectMember.addEventListener('change', (e) => {
        this.selectedCalendarMemberId = e.target.value;
        this.renderCalendarGrid(tasks, members, onOpenDayDetails);
      });
    }

    const btnPrev = document.getElementById('btn-cal-prev');
    const btnNext = document.getElementById('btn-cal-next');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.currentCalendarDate = new Date(year, month - 1, 1);
        this.renderCalendarGrid(tasks, members, onOpenDayDetails);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.currentCalendarDate = new Date(year, month + 1, 1);
        this.renderCalendarGrid(tasks, members, onOpenDayDetails);
      });
    }

    container.querySelectorAll('.calendar-day-clickable').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        if (dateStr && onOpenDayDetails) {
          onOpenDayDetails(dateStr);
        }
      });
    });
  }
};