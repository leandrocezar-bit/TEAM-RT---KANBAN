/**
 * Visão do Gestor - Dashboard, Estatísticas, Relatório de Contratempos e Calendário Editável
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const ManagerEngine = {
  selectedCalendarMemberId: 'all',
  currentCalendarDate: new Date(),
  startDateFilter: null,
  endDateFilter: null,

  /**
   * Renderiza o Dashboard Completo do Gestor
   */
  async renderDashboard(onViewEvidenceCallback, onDeleteMemberCallback, onOpenDayDetailsCallback) {
    const isAdminMember = (m) => {
      if (!m) return false;
      const id = String(m.id || '').toLowerCase();
      const level = String(m.accessLevel || '').toLowerCase();
      return level === 'admin' || id === 'm-admin' || id === 'admin';
    };

    const allMembers = (await DB.getAll('members')) || [];
    const members = allMembers.filter(m => !isAdminMember(m));
    const tasks = (await DB.getAll('tasks')) || [];
    const impediments = (await DB.getAll('impediments')) || [];
    const absences = (await DB.getAll('member_absences')) || [];
    window.cachedAbsences = absences;

    // Monta o contêiner de filtro sem duplicar o título
    this.injectDateFilterContainer();
    this.renderDateFilterControls(members, tasks, impediments);

    this.renderMemberCards(members, tasks, impediments);
    this.renderAbsenceMatrix(absences, members);
    this.renderImpedimentsAlertList(impediments, tasks, members, onViewEvidenceCallback);
    this.renderCalendarGrid(tasks, members, onOpenDayDetailsCallback);
  },

  /**
   * Injeta os seletores de data no cabeçalho existente sem duplicar o <h2>
   */
  injectDateFilterContainer() {
    const section = document.getElementById('section-manager');
    if (!section) return;

    // Procura o <h2> existente da seção
    const existingH2 = section.querySelector('h2');
    let header = document.getElementById('manager-dashboard-header');

    if (!header && existingH2) {
      // Envolve o <h2> existente em uma div flex para colocar o filtro ao lado
      header = document.createElement('div');
      header.id = 'manager-dashboard-header';
      header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.25rem; width:100%;';

      existingH2.parentNode.insertBefore(header, existingH2);
      header.appendChild(existingH2);

      const filterBox = document.createElement('div');
      filterBox.id = 'dashboard-date-filter-container';
      header.appendChild(filterBox);
    } else if (!header && !existingH2) {
      // Caso não exista <h2> na página, cria o header completo
      header = document.createElement('div');
      header.id = 'manager-dashboard-header';
      header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.25rem; width:100%;';

      const title = document.createElement('h2');
      title.style.cssText = 'font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:0.5rem; margin:0;';
      title.innerHTML = 'Desempenho e Horas da Equipe';
      header.appendChild(title);

      const filterBox = document.createElement('div');
      filterBox.id = 'dashboard-date-filter-container';
      header.appendChild(filterBox);

      section.insertBefore(header, section.firstChild);
    } else {
      // Se o header já existe, garante apenas a presença do container do filtro
      let filterBox = document.getElementById('dashboard-date-filter-container');
      if (!filterBox) {
        filterBox = document.createElement('div');
        filterBox.id = 'dashboard-date-filter-container';
        header.appendChild(filterBox);
      }
    }
  },

  /**
   * Renderiza os controles de seleção por Calendário (De / Até)
   */
  renderDateFilterControls(members, tasks, impediments) {
    const container = document.getElementById('dashboard-date-filter-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-secondary, #1f2937); padding:0.4rem 0.75rem; border-radius:var(--radius-md, 8px); border:1px solid var(--border-color, #374151); flex-wrap:wrap;">
        <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted, #9ca3af);">Filtrar Período:</span>
        
        <label style="font-size:0.75rem; color:var(--text-dim, #9ca3af); display:flex; align-items:center; gap:0.3rem;">
          De:
          <input type="date" id="dash-start-date" class="input-control" value="${this.startDateFilter || ''}" style="padding:0.2rem 0.4rem; font-size:0.75rem; background:var(--bg-input, #111827); color:#fff; border:1px solid var(--border-color, #374151); border-radius:4px;">
        </label>

        <label style="font-size:0.75rem; color:var(--text-dim, #9ca3af); display:flex; align-items:center; gap:0.3rem;">
          Até:
          <input type="date" id="dash-end-date" class="input-control" value="${this.endDateFilter || ''}" style="padding:0.2rem 0.4rem; font-size:0.75rem; background:var(--bg-input, #111827); color:#fff; border:1px solid var(--border-color, #374151); border-radius:4px;">
        </label>

        <button id="btn-apply-dash-date" class="btn btn-primary" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">Filtrar</button>
        <button id="btn-clear-dash-date" class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;">Limpar</button>
      </div>
    `;

    const startInput = document.getElementById('dash-start-date');
    const endInput = document.getElementById('dash-end-date');
    const applyBtn = document.getElementById('btn-apply-dash-date');
    const clearBtn = document.getElementById('btn-clear-dash-date');

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.startDateFilter = startInput.value || null;
        this.endDateFilter = endInput.value || null;
        this.renderMemberCards(members, tasks, impediments);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.startDateFilter = null;
        this.endDateFilter = null;
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this.renderMemberCards(members, tasks, impediments);
      });
    }
  },

  /**
   * Filtra as tarefas de acordo com o intervalo de datas selecionado
   */
  filterTasksByDateRange(tasksList) {
    if (!this.startDateFilter && !this.endDateFilter) return tasksList;

    return tasksList.filter(t => {
      const taskDateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);
      if (!taskDateStr) return false;

      if (this.startDateFilter && taskDateStr < this.startDateFilter) return false;
      if (this.endDateFilter && taskDateStr > this.endDateFilter) return false;

      return true;
    });
  },

  /**
   * Renderiza os cards de desempenho individual por membro da equipe
   */
  async renderMemberCards(members, tasks, impediments) {
    const container = document.getElementById('manager-members-grid');
    if (!container) return;

    const isAdminMember = (m) => {
      if (!m) return false;
      const id = String(m.id || '').toLowerCase();
      const level = String(m.accessLevel || '').toLowerCase();
      return level === 'admin' || id === 'm-admin' || id === 'admin';
    };

    const rawOperational = (members || []).filter(m => !isAdminMember(m));
    const operationalMembers = window.sortMembersByCustomOrder ? window.sortMembersByCustomOrder(rawOperational) : rawOperational;

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    let visibleMembers = operationalMembers;
    if (!isManager && loggedMemberId) {
      visibleMembers = operationalMembers.filter(m => String(m.id) === String(loggedMemberId));
    }

    if (visibleMembers.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Nenhum membro cadastrado.</p></div>`;
      return;
    }

    const filteredTasks = this.filterTasksByDateRange(tasks);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Busca todas as tarefas uma vez para o cálculo de tempo por intervalo
    const allTasksDB = (await DB.getAll('tasks')) || [];

    // Janela de tempo do filtro em ms (meia-noite início → 23:59:59 fim)
    const filterStartMs = this.startDateFilter
      ? new Date(this.startDateFilter + 'T00:00:00').getTime()
      : null;
    const filterEndMs = this.endDateFilter
      ? new Date(this.endDateFilter + 'T23:59:59').getTime()
      : null;

    const htmlParts = [];
    for (const member of visibleMembers) {
      const memberTasks = filteredTasks.filter(t => String(t.member_id || t.memberId) === String(member.id));

      const todoCount = memberTasks.filter(t => t.status === 'A FAZER').length;
      const wipCount  = memberTasks.filter(t => t.status === 'EM EXECUÇÃO').length;
      const doneCount = memberTasks.filter(t => t.status === 'CONCLUÍDO').length;

      // ── Tempo Total Efetivo com Merge de Intervalos ──────────────────────────
      // Tarefas com timeIntervals: intervalos são mesclados entre TODAS as tarefas
      //   do membro → elimina dupla contagem de sessões simultâneas.
      // Quando há filtro de data ativo, cada intervalo é clippado para a janela
      //   selecionada → conta apenas o tempo efetivamente trabalhado no período.
      // Tarefas sem timeIntervals (legado): soma elapsedSeconds (filtro por dueDate).

      const now = Date.now();
      const allMemberTasks = allTasksDB.filter(
        t => String(t.member_id || t.memberId) === String(member.id)
      );

      const allIntervals = [];  // intervalos reais (clippados ao período se filtro ativo)
      let legacySeconds = 0;    // tempo legado (elapsedSeconds antes da migração)

      allMemberTasks.forEach(t => {
        if (t.timeIntervals && t._legacySeconds !== undefined && t._legacySeconds !== null) {
          // Novo sistema: percorre cada intervalo e clippa à janela do filtro
          t.timeIntervals.forEach(iv => {
            let s = Number(iv.s);
            let e = Number(iv.e) || now;
            if (!s || s <= 0) return;

            // Clippa ao período filtrado
            if (filterStartMs !== null) s = Math.max(s, filterStartMs);
            if (filterEndMs   !== null) e = Math.min(e, filterEndMs);

            // Só adiciona se ainda há duração válida após clippar
            if (e > s) allIntervals.push({ s, e });
          });
          // _legacySeconds não tem timestamp → só inclui se não há filtro de data
          if (!filterStartMs && !filterEndMs) {
            legacySeconds += (t._legacySeconds || 0);
          }
        } else {
          // Legado (sem timeIntervals): usa dueDate/createdAt para filtrar
          const taskDateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);
          const inRange = (!filterStartMs && !filterEndMs) ||
            (taskDateStr &&
              (!this.startDateFilter || taskDateStr >= this.startDateFilter) &&
              (!this.endDateFilter   || taskDateStr <= this.endDateFilter));
          if (inRange) {
            let secs = t.elapsedSeconds || 0;
            if (t.isTimerRunning && t.lastTimerStartedAt) {
              secs += Math.max(0, Math.floor((now - Number(t.lastTimerStartedAt)) / 1000));
            }
            legacySeconds += secs;
          }
        }
      });

      // Merge: une intervalos sobrepostos para não contar o mesmo período duas vezes
      let mergedSeconds = 0;
      if (allIntervals.length > 0) {
        const sorted = allIntervals.sort((a, b) => a.s - b.s);
        const merged = [];
        let cs = sorted[0].s;
        let ce = sorted[0].e;
        for (let i = 1; i < sorted.length; i++) {
          const { s, e } = sorted[i];
          if (s <= ce) {
            ce = Math.max(ce, e);
          } else {
            merged.push([cs, ce]);
            cs = s;
            ce = e;
          }
        }
        merged.push([cs, ce]);
        mergedSeconds = Math.floor(
          merged.reduce((acc, [s, e]) => acc + (e - s), 0) / 1000
        );
      }

      const totalSeconds = legacySeconds + mergedSeconds;

      const memberTaskIds = new Set(memberTasks.map(t => String(t.id)));

      const memberImpediments = impediments.filter(imp => memberTaskIds.has(String(imp.taskId)));

      // Status de ausência/escala ativo hoje
      const memberAbsencesList = (window.cachedAbsences || []).filter(a => String(a.memberId) === String(member.id));
      const activeAbsenceToday = memberAbsencesList.find(a => a.startDate <= todayStr && a.endDate >= todayStr);

      let absenceBadgeHtml = '';
      if (activeAbsenceToday) {
        const labels = {
          home_office: '🏡 Home Office',
          ferias: '🏝️ Férias',
          atestado: '📄 Atestado Médico',
          folga: '🏖️ Folga / DSR',
          presencial: '🏢 Presencial'
        };
        const isPartial = activeAbsenceToday.durationType === 'parcial' && activeAbsenceToday.startTime && activeAbsenceToday.endTime;
        const timeBadge = isPartial ? ` ⏰ ${activeAbsenceToday.startTime}-${activeAbsenceToday.endTime}` : '';
        absenceBadgeHtml = `
          <div style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; padding:0.25rem 0.5rem; border-radius:6px; font-size:0.725rem; font-weight:700; margin-top:0.35rem; display:inline-block;">
            ${labels[activeAbsenceToday.type] || '📍 Ausência Ativa'} (${activeAbsenceToday.endDate.split('-').reverse().join('/')}${timeBadge})
          </div>
        `;
      }

      htmlParts.push(`
        <div class="manager-card">

          <div class="manager-card-header" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
              <img src="${member.photo}" alt="${member.name}" class="manager-avatar" style="flex-shrink:0;">
              <div style="min-width:0; overflow:hidden;">
                <h3 style="font-size:1rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.name}</h3>
                <p style="font-size:0.775rem; color:var(--text-muted); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${member.role || 'Membro da Equipe'}</p>
                ${absenceBadgeHtml}
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
      `);
    } // end for...of

    container.innerHTML = htmlParts.join('');

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

    container.style.setProperty('max-height', '210px', 'important');
    container.style.setProperty('overflow-y', 'auto', 'important');
    container.style.paddingRight = '0.35rem';

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
        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.85rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
              <span class="badge-impediment">⚠️ Contratempo</span>
              <strong style="font-size:0.875rem;">${task.title}</strong>
            </div>
            <p style="font-size:0.825rem; color:var(--text-main); margin-bottom:0.3rem;">"${imp.description}"</p>
            <div style="font-size:0.725rem; color:var(--text-dim); display:flex; align-items:center; gap:0.5rem;">
              <span>👤 ${member.name}</span> • <span>🕒 ${dateFormatted}</span>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.4rem;">
            ${imp.evidenceImage ? `
              <button class="btn btn-secondary btn-view-evidence" data-img="${imp.evidenceImage}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">
                🖼️ Evidência
              </button>
            ` : ''}
            <button class="btn btn-delete-imp-mgr" data-imp-id="${imp.id}" style="font-size:0.75rem; padding:0.25rem 0.6rem; background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4); cursor:pointer;" title="Excluir este contratempo">
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-view-evidence').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onViewEvidence) onViewEvidence(btn.dataset.img);
      });
    });

    container.querySelectorAll('.btn-delete-imp-mgr').forEach(btn => {
      btn.addEventListener('click', async () => {
        const impId = btn.dataset.impId;
        if (!impId) return;

        if (confirm('Deseja realmente excluir este contratempo?')) {
          await DB.delete('impediments', impId);
          if (window.showToast) window.showToast('Contratempo excluído!', 'success');
          if (window.refreshUI) await window.refreshUI();
        }
      });
    });
  },

  /**
   * Renderiza a Matriz de Escala e Ausências da Equipe
   */
  renderAbsenceMatrix(absences = [], members = []) {
    const container = document.getElementById('absence-matrix-container');
    if (!container) return;

    if (absences.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.25rem; color:var(--text-muted); font-size:0.85rem;">
          🌱 Nenhum registro de ausência ou escala diferenciada cadastrado no momento.
        </div>
      `;
      return;
    }

    const membersMap = new Map(members.map(m => [String(m.id), m]));

    const typeConfig = {
      home_office: { label: '🏡 Home Office', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)', color: '#818cf8' },
      ferias: { label: '🏝️ Férias', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#f59e0b' },
      atestado: { label: '📄 Atestado Médico', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#ef4444' },
      folga: { label: '🏖️ Folga / DSR', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', color: '#eab308' },
      presencial: { label: '🏢 Presencial', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#10b981' }
    };

    container.innerHTML = absences.map(abs => {
      const member = membersMap.get(String(abs.memberId)) || { name: 'Desconhecido' };
      const cfg = typeConfig[abs.type] || typeConfig.presencial;
      const startFormatted = abs.startDate ? abs.startDate.split('-').reverse().join('/') : '';
      const endFormatted = abs.endDate ? abs.endDate.split('-').reverse().join('/') : '';
      const isPartial = abs.durationType === 'parcial' && abs.startTime && abs.endTime;
      const hoursStr = isPartial ? ` ⏰ <strong>Horário:</strong> ${abs.startTime} às ${abs.endTime} (Parcial)` : ' (Dia Inteiro)';

      return `
        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.75rem 0.9rem; margin-bottom:0.6rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
              <span style="background:${cfg.bg}; border:1px solid ${cfg.border}; color:${cfg.color}; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">
                ${cfg.label}
              </span>
              <strong style="font-size:0.875rem; color:#fff;">${member.name}</strong>
            </div>
            <div style="font-size:0.775rem; color:var(--text-muted); display:flex; gap:0.75rem; flex-wrap:wrap;">
              <span>📅 <strong>Período:</strong> ${startFormatted} até ${endFormatted}${hoursStr}</span>
              ${abs.notes ? `<span>📝 <strong>Obs:</strong> ${abs.notes}</span>` : ''}
            </div>
          </div>

          <button class="btn btn-delete-absence" data-abs-id="${abs.id}" style="font-size:0.75rem; padding:0.25rem 0.6rem; background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4); cursor:pointer;" title="Excluir este registro">
            🗑️ Excluir
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-delete-absence').forEach(btn => {
      btn.addEventListener('click', async () => {
        const absId = btn.dataset.absId;
        if (!absId) return;

        if (confirm('Deseja realmente excluir este registro de escala/ausência?')) {
          await DB.delete('member_absences', absId);
          if (window.showToast) window.showToast('Registro de ausência excluído!', 'success');
          if (window.refreshUI) await window.refreshUI();
        }
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