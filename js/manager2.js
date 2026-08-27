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
  async renderDashboard(onViewEvidenceCallback, onDeleteMemberCallback, onOpenDayDetailsCallback, memberFilter = 'all') {
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
    this.renderImpedimentsAlertList(impediments, tasks, members, onViewEvidenceCallback, memberFilter);
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

    const accessLevel = localStorage.getItem('logged_access_level');
    const isManager = accessLevel === 'gestor' || accessLevel === 'admin';
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

    // Busca todas as tarefas e os membros das tarefas uma vez
    const allTasksDB = (await DB.getAll('tasks')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];

    // Janela de tempo do filtro em ms (meia-noite início → 23:59:59 fim)
    // Se nenhum filtro de data foi selecionado, usa o mês atual como janela padrão
    const competence = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const defaultStart = competence + '-01';
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const defaultEnd   = competence + '-' + String(lastDay).padStart(2, '0');

    const activeStart = this.startDateFilter || defaultStart;
    const activeEnd   = this.endDateFilter   || defaultEnd;

    const filterStartMs = new Date(activeStart + 'T00:00:00').getTime();
    const filterEndMs   = new Date(activeEnd   + 'T23:59:59').getTime();

    // Flag para saber se o usuário selecionou um filtro manualmente
    const hasManualFilter = !!(this.startDateFilter || this.endDateFilter);

    const htmlParts = [];
    for (const member of visibleMembers) {
      // 1. Encontra os IDs das tarefas onde o membro é participante
      const participantTaskIds = new Set(
        taskMembers
          .filter(tm => String(tm.memberId || tm.member_id) === String(member.id))
          .map(tm => String(tm.taskId))
      );

      // 2. Filtra as tarefas exibidas nos cards considerando dono ou participante
      const memberTasks = filteredTasks.filter(t => {
        const isOwner = String(t.member_id || t.memberId) === String(member.id);
        const isParticipant = participantTaskIds.has(String(t.id));
        return isOwner || isParticipant;
      });

      const todoCount = memberTasks.filter(t => t.status === 'A FAZER').length;
      const wipCount  = memberTasks.filter(t => t.status === 'EM EXECUÇÃO').length;
      const doneCount = memberTasks.filter(t => t.status === 'CONCLUÍDO').length;

      // ── Tempo Total Efetivo (Cálculo Igual ao Portfólio) ─────────────────────
      let totalSeconds = 0;
      
      // Busca todas as tarefas do membro ativas no quadro
      const allMemberTasks = tasks.filter(t => {
        const isOwner = String(t.member_id || t.memberId) === String(member.id);
        const isParticipant = participantTaskIds.has(String(t.id));
        return isOwner || isParticipant;
      });

      // Convert filter dates to ms for interval slice
      let filterStartMs = 0;
      let filterEndMs = Infinity;
      if (this.startDateFilter || this.endDateFilter) {
        if (this.startDateFilter) filterStartMs = new Date(this.startDateFilter + 'T00:00:00').getTime() || 0;
        if (this.endDateFilter) filterEndMs = new Date(this.endDateFilter + 'T23:59:59.999').getTime() || Infinity;
      } else if (competence) {
        const parts = competence.split('-');
        if (parts.length === 2) {
          filterStartMs = new Date(parts[0], parseInt(parts[1])-1, 1, 0, 0, 0).getTime();
          filterEndMs = new Date(parts[0], parseInt(parts[1]), 0, 23, 59, 59, 999).getTime();
        }
      }

      const validTasks = [];
      allMemberTasks.forEach(t => {
        const getLocalDateStr = (dateVal) => {
          if (!dateVal) return null;
          if (typeof dateVal === 'string' && dateVal.length >= 10 && dateVal.includes('-')) return dateVal.slice(0, 10);
          try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return null;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          } catch(e) { return null; }
        };
        
        const dueDateStr = getLocalDateStr(t.dueDate) || getLocalDateStr(t.createdAt);
        let targetDateStr = dueDateStr;

        if (t.status === 'CONCLUÍDO') {
          const compDateStr = getLocalDateStr(t.completedAt) || getLocalDateStr(t.updatedAt);
          if (compDateStr) targetDateStr = compDateStr;
        }

        let inRange = false;
        let workedInPeriod = false;

        if (t.timeIntervals && t.timeIntervals.length > 0) {
          const now = Date.now();
          workedInPeriod = t.timeIntervals.some(iv => {
            const s = Number(iv.s) || now;
            const e = Number(iv.e) || now;
            return (s <= filterEndMs && e >= filterStartMs);
          });
        }

        if (workedInPeriod) {
          inRange = true;
        } else {
          if (this.startDateFilter || this.endDateFilter) {
            if (targetDateStr) {
              inRange = true;
              if (this.startDateFilter && targetDateStr < this.startDateFilter) inRange = false;
              if (this.endDateFilter && targetDateStr > this.endDateFilter) inRange = false;
            }
          } else {
            if (targetDateStr && targetDateStr.slice(0, 7) === competence) {
              inRange = true;
            }
          }
        }

        if (inRange) {
          validTasks.push(t);
        }
      });
      totalSeconds = 0;
      try {
        if (typeof TimerEngine.calculateUnionSeconds === 'function') {
          totalSeconds = TimerEngine.calculateUnionSeconds(validTasks, filterStartMs, filterEndMs);
        } else {
          validTasks.forEach(t => totalSeconds += TimerEngine.getCurrentElapsedSeconds(t));
        }
      } catch (e) {
        console.error("Erro ao calcular union seconds no dashboard:", e);
        validTasks.forEach(t => totalSeconds += TimerEngine.getCurrentElapsedSeconds(t));
      }

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
  renderImpedimentsAlertList(impediments, tasks, members, onViewEvidence, memberFilter = 'all') {
    const container = document.getElementById('impediments-list-container');
    if (!container) return;

    const accessLevel = localStorage.getItem('logged_access_level');
    const isManager = accessLevel === 'gestor' || accessLevel === 'admin';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    const tasksMap = new Map(tasks.map(t => [String(t.id), t]));
    const membersMap = new Map(members.map(m => [String(m.id), m]));

    // 1. Filtrar visibilidade por permissão (não-gestor só vê o que é seu)
    let visibleImpediments = impediments;
    if (!isManager && loggedMemberId) {
      visibleImpediments = impediments.filter(imp => {
        const task = tasksMap.get(String(imp.taskId));
        if (!task) return false;
        const taskOwnerId = task.member_id || task.memberId;
        return String(taskOwnerId) === String(loggedMemberId);
      });
    }

    // 2. Filtro de Aba de Membro (memberFilter)
    if (memberFilter !== 'all') {
      visibleImpediments = visibleImpediments.filter(imp => {
        const task = tasksMap.get(String(imp.taskId));
        if (!task) return false;
        const taskOwnerId = task.member_id || task.memberId;
        return String(taskOwnerId) === String(memberFilter);
      });
    }

    // 3. Filtro de Datas do Dashboard
    const competence = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    let filterStartMs = 0;
    let filterEndMs = Infinity;
    
    if (this.startDateFilter || this.endDateFilter) {
      if (this.startDateFilter) filterStartMs = new Date(this.startDateFilter + 'T00:00:00').getTime() || 0;
      if (this.endDateFilter) filterEndMs = new Date(this.endDateFilter + 'T23:59:59.999').getTime() || Infinity;
    } else {
      // Mês atual por padrão
      const parts = competence.split('-');
      if (parts.length === 2) {
        filterStartMs = new Date(parts[0], parseInt(parts[1])-1, 1, 0, 0, 0).getTime();
        filterEndMs = new Date(parts[0], parseInt(parts[1]), 0, 23, 59, 59, 999).getTime();
      }
    }

    visibleImpediments = visibleImpediments.filter(imp => {
      if (!imp.createdAt) return true;
      const impTime = new Date(imp.createdAt).getTime();
      return impTime >= filterStartMs && impTime <= filterEndMs;
    });

    // Remover limite de altura fixa para abraçar o novo layout
    container.style.removeProperty('max-height');
    container.style.removeProperty('overflow-y');
    container.style.paddingRight = '0';

    if (visibleImpediments.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color);">
          🎉 Nenhum contratempo registrado ${isManager ? 'na equipe' : 'nas suas atividades'} até o momento!
        </div>
      `;
      return;
    }

    // 1. KPIs
    const totalImpediments = visibleImpediments.length;
    const affectedTasks = new Set(visibleImpediments.map(imp => String(imp.taskId))).size;
    
    const memberImpediments = {};
    visibleImpediments.forEach(imp => {
      const task = tasksMap.get(String(imp.taskId));
      if (task) {
        const mId = String(task.member_id || task.memberId);
        if (!memberImpediments[mId]) {
          memberImpediments[mId] = 0;
        }
        memberImpediments[mId]++;
      }
    });
    
    const affectedMembersCount = Object.keys(memberImpediments).length;

    // 2. Ranking de Membros
    const rankingArray = Object.keys(memberImpediments).map(mId => {
      return {
        member: membersMap.get(mId) || { name: 'Desconhecido', role: '', photo: '' },
        count: memberImpediments[mId]
      };
    }).sort((a, b) => b.count - a.count);

    const maxImpediments = rankingArray.length > 0 ? rankingArray[0].count : 1;

    // Build HTML
    let html = `
      <div class="imp-dash-container">
        <!-- KPIs Row -->
        <div class="imp-kpi-row">
          <div class="imp-kpi-card ${totalImpediments > 5 ? 'critical' : ''}">
            <span class="imp-kpi-label">Total de Contratempos</span>
            <span class="imp-kpi-value ${totalImpediments > 5 ? 'text-critical' : ''}">${totalImpediments}</span>
          </div>
          <div class="imp-kpi-card">
            <span class="imp-kpi-label">Tarefas Afetadas</span>
            <span class="imp-kpi-value">${affectedTasks}</span>
          </div>
          <div class="imp-kpi-card">
            <span class="imp-kpi-label">Membros Afetados</span>
            <span class="imp-kpi-value">${affectedMembersCount}</span>
          </div>
        </div>

        <!-- 2-Column Layout -->
        <div class="imp-content-grid">
          
          <!-- Ranking -->
          <div class="imp-panel-section">
            <div class="imp-panel-title">Membros Mais Afetados</div>
            <div class="imp-scrollable">
              ${rankingArray.map((item, index) => {
                const percent = (item.count / maxImpediments) * 100;
                const avatarUrl = item.member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.member.name);
                return `
                  <div class="imp-ranking-item">
                    <span style="font-size:0.8rem; color:var(--text-dim); width:15px;">${index + 1}</span>
                    <img src="${avatarUrl}" class="imp-ranking-avatar" alt="${item.member.name}">
                    <div class="imp-ranking-info">
                      <div class="imp-ranking-name">
                        <span>${item.member.name}</span>
                        <span>${item.count}</span>
                      </div>
                      <div class="imp-progress-track">
                        <div class="imp-progress-bar" style="width: ${percent}%;"></div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Feed -->
          <div class="imp-panel-section">
            <div class="imp-panel-title">Feed de Contratempos Recentes</div>
            <div class="imp-scrollable">
              ${visibleImpediments.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(imp => {
                const task = tasksMap.get(String(imp.taskId)) || { title: 'Tarefa não encontrada' };
                const taskOwnerId = task.member_id || task.memberId;
                const member = membersMap.get(String(taskOwnerId)) || { name: 'Desconhecido' };
                const avatarUrl = member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name);
                const dateFormatted = new Date(imp.createdAt).toLocaleString('pt-BR');
                
                return `
                  <div class="imp-feed-item">
                    <div class="imp-feed-dot"></div>
                    <img src="${avatarUrl}" class="imp-feed-avatar" alt="${member.name}">
                    <div class="imp-feed-content">
                      <div class="imp-feed-task">${task.title}</div>
                      <div class="imp-feed-text">"${imp.description}"</div>
                      <div class="imp-feed-meta">
                        <span>${member.name}</span>
                        <span>${dateFormatted}</span>
                      </div>
                      <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                        ${imp.evidenceImage ? `
                          <button class="btn btn-secondary btn-view-evidence" data-img="${imp.evidenceImage}" style="font-size:0.65rem; padding:0.2rem 0.5rem;">
                            🖼️ Evidência
                          </button>
                        ` : ''}
                        <button class="btn btn-delete-imp-mgr" data-imp-id="${imp.id}" style="font-size:0.65rem; padding:0.2rem 0.5rem; background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4); cursor:pointer;">
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>
      </div>
    `;

    container.innerHTML = html;

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

    if (members.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:1.25rem; color:var(--text-muted); font-size:0.85rem;">
          🌱 Nenhum membro para exibir na escala.
        </div>
      `;
      return;
    }

    // Determine the month to show
    let targetDate = new Date();
    if (this.startDateFilter) {
      const parsed = new Date(this.startDateFilter + 'T00:00:00');
      if (!isNaN(parsed)) targetDate = parsed;
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    // Build Header
    let headerHtml = `<div class="attendance-header-row"><div class="attendance-cell-header-member">Colaborador</div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const wDay = d.getDay();
      const isWeekend = wDay === 0 || wDay === 6;
      const wName = weekDays[wDay];
      
      headerHtml += `
        <div class="attendance-cell-header-day ${isWeekend ? 'weekend' : ''}">
          <span style="font-size:0.65rem;">${wName}</span>
          <span style="font-size:0.85rem; font-weight:700;">${day}</span>
        </div>
      `;
    }
    headerHtml += `</div>`;

    // Build Rows
    let rowsHtml = '';
    
    // Sort members alphabetically for better UX
    const sortedMembers = [...members].sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    sortedMembers.forEach(member => {
      // Find all absences for this member
      const memberAbsences = absences.filter(a => String(a.memberId) === String(member.id));

      const avatarUrl = member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name);
      
      let rowHtml = `
        <div class="attendance-row">
          <div class="attendance-member-info">
            <img src="${avatarUrl}" class="attendance-avatar" alt="${member.name}">
            <div class="attendance-name-role">
              <span class="attendance-name">${member.name}</span>
              <span class="attendance-role">${member.role || 'Membro'}</span>
            </div>
          </div>
      `;

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const wDay = d.getDay();
        const isWeekend = wDay === 0 || wDay === 6;
        
        // Format YYYY-MM-DD
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check if there is an absence on this date
        const absenceToday = memberAbsences.find(a => a.startDate <= dateStr && a.endDate >= dateStr);

        let cellContent = '';

        if (absenceToday) {
          // Has absence
          if (absenceToday.type === 'home_office') {
            cellContent = `<div class="att-dot att-dot-wfh" title="Home Office"></div>`;
          } else if (absenceToday.type === 'atestado') {
            cellContent = `<div class="att-dot att-dot-medical" title="Atestado"></div>`;
          } else if (absenceToday.type === 'ferias') {
            cellContent = `<div class="att-dot att-dot-vacation" title="Férias"></div>`;
          } else if (absenceToday.type === 'folga') {
            cellContent = `<div class="att-dot att-dot-folga" title="Folga"></div>`;
          } else {
            cellContent = `<div class="att-dot att-dot-present" title="Presencial"></div>`;
          }
        } else {
          // No absence record -> default to Present on Weekdays, empty on Weekends
          if (!isWeekend) {
            cellContent = `<div class="att-dot att-dot-present" title="Presencial"></div>`;
          }
        }

        rowHtml += `
          <div class="attendance-cell-day ${isWeekend ? 'weekend' : ''}">
            ${cellContent}
          </div>
        `;
      }
      
      rowHtml += `</div>`;
      rowsHtml += rowHtml;
    });

    const legendHtml = `
      <div class="attendance-legend">
        <div class="att-legend-item"><div class="att-dot att-dot-present"></div> Presencial (Padrão)</div>
        <div class="att-legend-item"><div class="att-dot att-dot-wfh"></div> Home Office</div>
        <div class="att-legend-item"><div class="att-dot att-dot-medical"></div> Atestado</div>
        <div class="att-legend-item"><div class="att-dot att-dot-vacation"></div> Férias</div>
        <div class="att-legend-item"><div class="att-dot att-dot-folga"></div> Folga / DSR</div>
      </div>
    `;

    container.innerHTML = `
      <div class="attendance-matrix-container">
        <div class="attendance-table">
          ${headerHtml}
          ${rowsHtml}
        </div>
        ${legendHtml}
      </div>
    `;
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