/**
 * Visão do Gestor / Dashboard - Apresentação Fixa de Responsabilidades e Contratempos
 */

import { DB } from './db.js';

export const ManagerEngine = {
  selectedCalendarMemberId: 'all',
  currentCalendarDate: new Date(),

  /**
   * Renderiza o Dashboard Completo
   */
  async renderDashboard(onViewEvidenceCallback, onDeleteMemberCallback, onOpenDayDetailsCallback) {
    const members = (await DB.getAll('members')) || [];
    const tasks = (await DB.getAll('tasks')) || [];
    const impediments = (await DB.getAll('impediments')) || [];

    // Busca a matriz fixa de responsabilidades cadastrada no Portfólio
    let portfolio = [];
    try {
      const records = await DB.getAll('cycle_templates');
      if (records && records.length > 0) {
        portfolio = records.map(r => r.data || r);
      }
    } catch (e) {
      console.warn('⚡ Não foi possível carregar o portfólio no Dashboard.', e);
    }

    this.renderMemberCards(members, portfolio);
    this.renderImpedimentsAlertList(impediments, tasks, members, onViewEvidenceCallback);
    this.renderCalendarGrid(tasks, members, onOpenDayDetailsCallback);
  },

  /**
   * Renderiza os cards de apresentação de responsabilidades fixas por membro
   */
  renderMemberCards(members, portfolio) {
    const container = document.getElementById('manager-members-grid');
    if (!container) return;

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    let visibleMembers = members;
    if (!isManager && loggedMemberId) {
      visibleMembers = members.filter(m => String(m.id) === String(loggedMemberId));
    }

    if (visibleMembers.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Nenhum colaborador cadastrado.</p></div>`;
      return;
    }

    container.innerHTML = visibleMembers.map(member => {
      // Busca as responsabilidades fixas do colaborador no Portfólio
      const memberData = portfolio.find(p => String(p.memberId) === String(member.id)) || { tasks: [] };
      const responsibilities = memberData.tasks || [];

      return `
        <div class="manager-card member-summary-card" data-id="${member.id}" style="cursor: pointer; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; transition: transform 0.2s, border-color 0.2s;">
          
          <!-- Cabeçalho do Perfil -->
          <div style="display:flex; align-items:center; justify-space-between; width:100%; margin-bottom: 1rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" alt="${member.name}" class="manager-avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">
              <div>
                <h3 style="font-size:1rem; font-weight:700; color: var(--text-main); margin:0;">${member.name}</h3>
                <p style="font-size:0.775rem; color:var(--text-muted); margin:0;">${member.role || 'Membro da Equipe'}</p>
                <p style="font-size:0.7rem; color:var(--text-dim); margin:0;">${member.email || member.contact || ''}</p>
              </div>
            </div>

            <button class="btn-edit-member-profile" data-id="${member.id}" title="Editar Perfil" style="background:rgba(99,102,241,0.12); color:#818cf8; border:1px solid rgba(99,102,241,0.3); border-radius:var(--radius-sm); padding:0.3rem 0.6rem; font-size:0.75rem; font-weight:700; cursor:pointer;">
              ✏️ Perfil
            </button>
          </div>

          <hr style="border: 0; border-top: 1px dashed var(--border-color); margin-bottom: 0.85rem;">

          <!-- Apresentação em Texto das Responsabilidades Diretas no Setor -->
          <div style="font-size: 0.825rem;">
            <div style="font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
              <span>📌 Responsabilidades Diretas no Setor:</span>
              <span style="font-size: 0.725rem; background: rgba(99,102,241,0.2); color: #a5b4fc; padding: 0.1rem 0.4rem; border-radius: 4px;">
                ${responsibilities.length} atribuição(ões)
              </span>
            </div>

            ${responsibilities.length === 0 ? `
              <p style="color: var(--text-dim); font-size: 0.775rem; font-style: italic; margin: 0;">
                Nenhuma responsabilidade vinculada a este perfil no portfólio.
              </p>
            ` : `
              <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem;">
                ${responsibilities.slice(0, 4).map(r => `
                  <li style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-input); padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <span style="color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">
                      • ${r.title}
                    </span>
                    <span style="font-size: 0.65rem; color: var(--text-dim); background: rgba(255,255,255,0.05); padding: 0.1rem 0.3rem; border-radius: 3px;">
                      ${r.dayLimit || 'Recorrente'}
                    </span>
                  </li>
                `).join('')}

                ${responsibilities.length > 4 ? `
                  <p style="font-size: 0.725rem; color: var(--accent-primary); font-weight: 700; margin-top: 0.2rem; text-align: right;">
                    + ver mais ${responsibilities.length - 4} responsabilidade(s)...
                  </p>
                ` : ''}
              </ul>
            `}
          </div>

        </div>
      `;
    }).join('');

    // Clique no Card para ver a Apresentação Completa das Responsabilidades
    container.querySelectorAll('.member-summary-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit-member-profile')) return;
        const memberId = card.dataset.id;
        this.openMemberResponsibilitiesModal(memberId, members, portfolio);
      });
    });

    // Clique no Botão Perfil
    container.querySelectorAll('.btn-edit-member-profile').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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
   * Modal de Apresentação das Atribuições do Colaborador no Setor
   */
  openMemberResponsibilitiesModal(memberId, members, portfolio) {
    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) return;

    const memberData = portfolio.find(p => String(p.memberId) === String(member.id)) || { tasks: [] };
    const responsibilities = memberData.tasks || [];

    const oldModal = document.getElementById('modal-member-text-summary');
    if (oldModal) oldModal.remove();

    const modalHtml = `
      <div id="modal-member-text-summary" class="modal-overlay active" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; width: 100%; max-width: 620px; padding: 1.5rem; color: #f3f4f6; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Cabeçalho com dados do Membro -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid #1f2937; padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" alt="${member.name}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #6366f1;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin: 0;">${member.name}</h3>
                <span style="font-size: 0.8rem; color: #9ca3af;">${member.role || 'Colaborador'}</span>
              </div>
            </div>
            <button id="btn-close-summary-modal" style="background: none; border: none; color: #9ca3af; font-size: 1.25rem; cursor: pointer;">✕</button>
          </div>

          <!-- Texto de Apresentação das Responsabilidades -->
          <div style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #a5b4fc; margin-bottom: 0.85rem;">
              📌 Matriz de Responsabilidades do Setor (${responsibilities.length})
            </h4>

            ${responsibilities.length === 0 ? `
              <p style="text-align: center; color: #9ca3af; padding: 2rem 0; font-size: 0.85rem;">
                Nenhuma responsabilidade fixada para este colaborador no portfólio do setor.
              </p>
            ` : responsibilities.map(r => `
              <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
                  <strong style="font-size: 0.9rem; color: #ffffff;">${r.title}</strong>
                  <span style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; background: rgba(99, 102, 241, 0.2); color: #818cf8;">
                    ${r.dayLimit || 'Recorrente'}
                  </span>
                </div>
                
                <p style="font-size: 0.8rem; color: #9ca3af; margin: 0; line-height: 1.4;">
                  ${r.desc || 'Sem requisitos ou detalhes cadastrados.'}
                </p>
              </div>
            `).join('')}
          </div>

          <!-- Botão Fechar -->
          <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem; border-top: 1px solid #1f2937; padding-top: 0.75rem;">
            <button id="btn-cancel-summary-modal" style="background: #374151; color: #ffffff; border: none; border-radius: 8px; padding: 0.5rem 1.25rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              Fechar
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('modal-member-text-summary');
    const closeBtn = document.getElementById('btn-close-summary-modal');
    const cancelBtn = document.getElementById('btn-cancel-summary-modal');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
  },

  /**
   * Renderiza a lista de contratempos
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
        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem; margin-bottom:0.75rem; display:flex; justify-space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
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
   * Renderiza a Visão de Calendário
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