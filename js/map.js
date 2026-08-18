/**
 * Portfólio do Setor - Matriz Fixa de Responsabilidades por Colaborador & Métricas por Competência
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const MapEngine = {
  selectedCompetence: new Date().toISOString().slice(0, 7),
  activeMemberFilter: 'all', // 'all' ou ID do membro selecionado
  startDateFilter: null,
  endDateFilter: null,

  /**
   * Obtém a lista de dados do portfólio
   */
  async getSectorPortfolio() {
    try {
      const records = await DB.getAll('cycle_templates');
      if (records && records.length > 0) {
        return records.map(r => r.data || r);
      }
    } catch (e) {
      console.warn('⚡ Tabela cycle_templates vazia ou indisponível.', e);
    }
    return [];
  },

  /**
   * Renderiza a tela do Portfólio do Setor
   */
  async renderSectorMap(memberId = null) {
    if (memberId !== null) {
      this.activeMemberFilter = memberId;
    }

    const tasks = (await DB.getAll('tasks')) || [];
    const members = (await DB.getAll('members')) || [];
    const impediments = (await DB.getAll('impediments')) || [];
    const portfolio = await this.getSectorPortfolio();

    const membersMap = new Map(members.map(m => [String(m.id), m]));
    const impMap = new Map();
    impediments.forEach(imp => {
      if (!impMap.has(String(imp.taskId))) impMap.set(String(imp.taskId), []);
      impMap.get(String(imp.taskId)).push(imp);
    });

    const taskMembers = (await DB.getAll('task_members')) || [];
    const absences = window.cachedAbsences || (await DB.getAll('member_absences')) || [];

    this.renderDateFilterControls();
    this.renderHeaderMetrics(tasks, taskMembers);
    this.renderMembersPortfolioGrid(portfolio, members);
    this.renderRoadmapTable(tasks, membersMap, impMap, taskMembers, absences);

    this.attachEvents(portfolio);
    this.bindMemberTabsAutoListener(); // 🎯 Escuta o clique nas abas dos membros automaticamente
  },

  /**
   * Renderiza os controles de seleção por Calendário (De / Até) no cabeçalho do Roadmap
   */
  renderDateFilterControls() {
    const container = document.getElementById('roadmap-date-filter-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-secondary); padding:0.4rem 0.75rem; border-radius:var(--radius-md, 8px); border:1px solid var(--border-color); flex-wrap:wrap; justify-content:space-between; width:100%;">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">🗓️ Filtrar Período:</span>
          
          <label style="font-size:0.75rem; color:var(--text-dim); display:flex; align-items:center; gap:0.3rem;">
            De:
            <input type="date" id="roadmap-start-date" class="input-control" value="${this.startDateFilter || ''}" style="padding:0.2rem 0.4rem; font-size:0.75rem; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">
          </label>

          <label style="font-size:0.75rem; color:var(--text-dim); display:flex; align-items:center; gap:0.3rem;">
            Até:
            <input type="date" id="roadmap-end-date" class="input-control" value="${this.endDateFilter || ''}" style="padding:0.2rem 0.4rem; font-size:0.75rem; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">
          </label>

          <button id="btn-apply-roadmap-date" class="btn btn-primary" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">Filtrar</button>
          <button id="btn-clear-roadmap-date" class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem;">Limpar</button>
        </div>
        <button id="btn-export-roadmap-excel" class="btn" style="background:#10b981; color:#fff; padding:0.25rem 0.75rem; font-size:0.75rem; font-weight:700; border-radius:4px; display:flex; align-items:center; gap:0.4rem; border:none; cursor:pointer;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/><path d="M4.603 12.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.701 19.701 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .471.216c.088.104.139.23.146.365v.076c-.02.447-.145.93-.333 1.401-.159.398-.352.79-.546 1.15.402.566.852 1.15 1.34 1.705.428.487.896.962 1.406 1.414.44.385.918.72 1.436 1.002.268.146.56.262.883.332.25.054.506.05.75-.028.24-.075.465-.213.626-.41.136-.168.225-.365.26-.575.034-.206.014-.419-.057-.618a.955.955 0 0 0-.294-.424c-.167-.142-.367-.234-.582-.266a1.59 1.59 0 0 0-.616.035c-.218.069-.425.184-.616.326-.182.135-.352.288-.512.454-.15.154-.288.32-.416.495-.084.116-.163.235-.236.358-.095.16-.185.324-.268.491-.122.247-.235.5-.34.757-.105.257-.2.518-.285.782-.09.28-.168.564-.234.85-.062.274-.112.551-.15.83-.04.282-.066.567-.078.854 0 .046-.002.091 0 .137a1.08 1.08 0 0 0 .1.43 1 1 0 0 0 .285.35c.148.114.32.189.502.22.186.03.38.02.566-.025.18-.046.35-.125.5-.23.14-.1.265-.224.368-.364.1-.137.18-.29.24-.45.056-.156.09-.32.106-.484.015-.164.01-.33-.016-.492z"/></svg>
          Exportar Excel
        </button>
      </div>
    `;

    const btnApply = document.getElementById('btn-apply-roadmap-date');
    const btnClear = document.getElementById('btn-clear-roadmap-date');

    if (btnApply) {
      btnApply.onclick = () => {
        const startVal = document.getElementById('roadmap-start-date')?.value;
        const endVal = document.getElementById('roadmap-end-date')?.value;

        if (startVal || endVal) {
          this.startDateFilter = startVal || null;
          this.endDateFilter = endVal || null;
          this.renderSectorMap(this.activeMemberFilter);
        }
      };
    }

    if (btnClear) {
      btnClear.onclick = () => {
        this.startDateFilter = null;
        this.endDateFilter = null;
        this.renderSectorMap(this.activeMemberFilter);
      };
    }

    const btnExport = document.getElementById('btn-export-roadmap-excel');
    if (btnExport) {
      btnExport.onclick = () => this.exportRoadmapToExcel();
    }
  },

  /**
   * Adiciona um ouvinte nos botões de membros (.tab-btn) para atualizar o Portfólio em tempo real
   */
  bindMemberTabsAutoListener() {
    const bar = document.getElementById('member-tabs-bar');
    if (!bar || bar.dataset.mapListenerBound) return;
    bar.dataset.mapListenerBound = 'true';

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      const sectionMap = document.getElementById('section-map');
      // Apenas re-renderiza o portfólio se a seção do Portfólio estiver visível na tela
      if (sectionMap && (sectionMap.classList.contains('active') || sectionMap.style.display !== 'none')) {
        const selectedId = btn.dataset.id || 'all';
        this.renderSectorMap(selectedId);
      }
    });
  },

  /**
   * Métricas do Topo com Filtro de Competência Mensal / Período Customizado
   */
  renderHeaderMetrics(tasks, taskMembers = []) {
    const container = document.getElementById('map-metrics-summary');
    if (!container) return;

    // Monta um Set de taskIds em que o membro filtrado é participante
    const participantTaskIds = new Set();
    if (this.activeMemberFilter !== 'all') {
      taskMembers.forEach(tm => {
        if (String(tm.memberId || tm.member_id) === String(this.activeMemberFilter)) {
          participantTaskIds.add(String(tm.taskId));
        }
      });
    }

    // Filtra por período De/Até ou por competência mensal, e também por membro selecionado
    const competenceTasks = tasks.filter(t => {
      const dateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);

      if (this.startDateFilter || this.endDateFilter) {
        if (!dateStr) return false;
        if (this.startDateFilter && dateStr < this.startDateFilter) return false;
        if (this.endDateFilter && dateStr > this.endDateFilter) return false;
      } else {
        if (!dateStr || dateStr.slice(0, 7) !== this.selectedCompetence) return false;
      }

      if (this.activeMemberFilter !== 'all') {
        const isOwner       = String(t.member_id || t.memberId) === String(this.activeMemberFilter);
        const isParticipant = participantTaskIds.has(String(t.id));
        return isOwner || isParticipant;
      }
      return true;
    });

    const total = competenceTasks.length;
    const done = competenceTasks.filter(t => t.status === 'CONCLUÍDO').length;
    const wip = competenceTasks.filter(t => t.status === 'EM EXECUÇÃO').length;
    const todo = competenceTasks.filter(t => t.status === 'A FAZER').length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    let totalSeconds = 0;
    try {
      if (typeof TimerEngine.calculateUnionSeconds === 'function') {
        totalSeconds = TimerEngine.calculateUnionSeconds(competenceTasks);
      } else {
        competenceTasks.forEach(t => totalSeconds += TimerEngine.getCurrentElapsedSeconds(t));
      }
    } catch(e) {
      console.error("Erro no portfolio union:", e);
      competenceTasks.forEach(t => totalSeconds += TimerEngine.getCurrentElapsedSeconds(t));
    }

    const [year, month] = this.selectedCompetence.split('-');
    const competenceName = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    container.style.cssText = 'display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.75rem; width: 100%;';

    container.innerHTML = `
      <!-- Seletor de Competência Mensal -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem 1.25rem; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1rem; font-weight: 800; color: var(--text-main);">Competência:</span>
          <span style="font-size: 0.95rem; font-weight: 700; color: #8b5cf6; text-transform: capitalize;">${competenceName}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Mudar Competência:</label>
          <input type="month" id="select-map-competence" value="${this.selectedCompetence}" 
                 style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.35rem 0.6rem; color: var(--text-main); font-size: 0.8rem; outline: none; cursor: pointer;">
        </div>
      </div>

      <!-- Cards de Métricas da Competência -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; width: 100%;">
        
        <!-- Card 1: Progresso -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #8b5cf6; border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">Progresso da Competência</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">
            ${completionPercent}%
          </div>
          <div style="background: var(--border-color); border-radius: 10px; height: 8px; width: 100%; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); width: ${completionPercent}%; height: 100%; border-radius: 10px; transition: width 0.4s ease;"></div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.5rem; display: block;">${done} de ${total} entregas no mês</span>
        </div>

        <!-- Card 2: Demandas -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #10b981; border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">Demandas da Competência</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">
            ${total} <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Atividades</span>
          </div>
          <div style="display: flex; gap: 0.75rem; font-size: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.25rem;">
            <span style="color: #f59e0b; font-weight: 600;">${todo} a fazer</span>
            <span style="color: #6366f1; font-weight: 600;">${wip} ativas</span>
            <span style="color: #10b981; font-weight: 600;">${done} concluídas</span>
          </div>
        </div>

        <!-- Card 3: Horas -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #06b6d4; border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">Horas na Competência</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: #0284c7; font-family: monospace; margin-bottom: 0.5rem;">
            ${TimerEngine.formatTime(totalSeconds)}
          </div>
          <span style="font-size: 0.75rem; color: var(--text-dim); display: block; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
            Tempo total acumulado neste mês
          </span>
        </div>

      </div>
    `;

    const compInput = document.getElementById('select-map-competence');
    if (compInput) {
      compInput.addEventListener('change', (e) => {
        if (e.target.value) {
          this.selectedCompetence = e.target.value;
          this.renderSectorMap(this.activeMemberFilter);
        }
      });
    }
  },

  /**
   * Renderiza a grade de Cartões Informativos por Colaborador
   */
  renderMembersPortfolioGrid(portfolio, members) {
    const container = document.getElementById('map-organogram-grid');
    if (!container) return;

    const isAdminMember = (m) => {
      if (!m) return false;
      const id = String(m.id || '').toLowerCase();
      const level = String(m.accessLevel || '').toLowerCase();
      return level === 'admin' || id === 'm-admin' || id === 'admin';
    };

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    const rawOperational = (members || []).filter(m => !isAdminMember(m));
    const operationalMembers = window.sortMembersByCustomOrder ? window.sortMembersByCustomOrder(rawOperational) : rawOperational;

    let visibleMembers = operationalMembers;
    if (this.activeMemberFilter !== 'all') {
      visibleMembers = operationalMembers.filter(m => String(m.id) === String(this.activeMemberFilter));
    }

    if (visibleMembers.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
          <p style="font-size: 1rem; color: var(--text-muted);">Nenhum colaborador encontrado para esta seleção.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = visibleMembers.map(member => {
      const canEditCard = isManager || String(loggedMemberId) === String(member.id);

      const memberData = portfolio.find(p => String(p.memberId) === String(member.id)) || {
        id: 'port-' + member.id,
        memberId: member.id,
        responsibilitiesText: ''
      };

      const responsibilitiesText = memberData.responsibilitiesText || (memberData.tasks ? memberData.tasks.map(t => `• ${t.title}: ${t.desc || ''}`).join('\n') : '');

      return `
        <div class="card-panel" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: var(--shadow-sm);">
          
          <div style="display: flex; align-items: center; gap: 1rem; background: var(--bg-surface); padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" 
                 alt="${member.name}" 
                 style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-primary); flex-shrink: 0;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0;">${member.name}</h3>
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">${member.role || 'Colaborador'}</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1;">
            <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              Responsabilidades:
            </label>
            
            <textarea class="textarea-responsibilities" 
                      data-member-id="${member.id}" 
                      ${!canEditCard ? 'readonly' : ''} 
                      placeholder="Descreva aqui as atribuições, escopo e responsabilidades do membro no setor..." 
                      style="width: 100%; min-height: 120px; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; color: var(--text-main); font-size: 0.85rem; line-height: 1.5; resize: vertical; outline: none; ${!canEditCard ? 'opacity: 0.85; cursor: default;' : ''}">${responsibilitiesText}</textarea>

            ${canEditCard ? `
              <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
                <button class="btn btn-primary btn-save-responsibilities" data-member-id="${member.id}" style="font-size: 0.75rem; padding: 0.4rem 0.85rem; font-weight: 700;">
                  Salvar Responsabilidades
                </button>
              </div>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');
  },

  /**
   * Renderiza a Tabela Roadmap Geral de Acompanhamento
   * taskMembers: registros da tabela task_members (participantes de cada tarefa)
   */
  renderRoadmapTable(tasks, membersMap, impMap, taskMembers = [], absences = []) {
    const container = document.getElementById('map-roadmap-table-body');
    if (!container) return;

    // Guarda referências para a função de exportação
    this._lastRoadmapTasks = tasks;
    this._lastMembersMap = membersMap;
    this._lastTaskMembers = taskMembers;
    this._lastRoadmapAbsences = absences;

    let filterStartMs = 0;
    let filterEndMs = Infinity;
    if (this.startDateFilter || this.endDateFilter) {
      if (this.startDateFilter) filterStartMs = new Date(this.startDateFilter + 'T00:00:00').getTime() || 0;
      if (this.endDateFilter) filterEndMs = new Date(this.endDateFilter + 'T23:59:59.999').getTime() || Infinity;
    } else if (this.selectedCompetence) {
      const parts = this.selectedCompetence.split('-');
      if (parts.length === 2) {
        filterStartMs = new Date(parts[0], parseInt(parts[1])-1, 1, 0, 0, 0).getTime();
        filterEndMs = new Date(parts[0], parseInt(parts[1]), 0, 23, 59, 59, 999).getTime();
      }
    }

    // Monta um Set de taskIds em que o membro filtrado é participante
    const participantTaskIds = new Set();
    if (this.activeMemberFilter !== 'all') {
      taskMembers.forEach(tm => {
        if (String(tm.memberId || tm.member_id) === String(this.activeMemberFilter)) {
          participantTaskIds.add(String(tm.taskId));
        }
      });
    }

    const filteredTasks = tasks.filter(t => {
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

      let matchesDate = false;
      let workedInPeriod = false;

      // 1. Verifica se houve trabalho faturado no período selecionado
      if (t.timeIntervals && t.timeIntervals.length > 0) {
        const now = Date.now();
        workedInPeriod = t.timeIntervals.some(iv => {
          const s = Number(iv.s) || now;
          const e = Number(iv.e) || now;
          return (s <= filterEndMs && e >= filterStartMs);
        });
      }

      if (workedInPeriod) {
        matchesDate = true;
      } else {
        // 2. Fallback legado: se não tem log exato, olha pra data alvo
        if (this.startDateFilter || this.endDateFilter) {
          if (targetDateStr) {
            matchesDate = true;
            if (this.startDateFilter && targetDateStr < this.startDateFilter) matchesDate = false;
            if (this.endDateFilter && targetDateStr > this.endDateFilter) matchesDate = false;
          }
        } else {
          matchesDate = targetDateStr && targetDateStr.slice(0, 7) === this.selectedCompetence;
        }
      }

      if (!matchesDate) return false;

      if (this.activeMemberFilter !== 'all') {
        const isOwner       = String(t.member_id || t.memberId) === String(this.activeMemberFilter);
        const isParticipant = participantTaskIds.has(String(t.id));
        return isOwner || isParticipant;
      }
      return true;
    });

    // Mapa rápido: taskId → true se o membro filtrado é participante (não dono)
    const isParticipantTask = (taskId) =>
      this.activeMemberFilter !== 'all' && participantTaskIds.has(String(taskId));

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:2rem; color:var(--text-dim);">Nenhuma demanda cadastrada para esta seleção.</td>
        </tr>
      `;
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    let sumActiveSecs = 0;
    try {
      if (typeof TimerEngine.calculateUnionSeconds === 'function') {
        sumActiveSecs = TimerEngine.calculateUnionSeconds(filteredTasks, filterStartMs, filterEndMs);
      } else {
        filteredTasks.forEach(t => sumActiveSecs += TimerEngine.getCurrentElapsedSeconds(t));
      }
    } catch(e) {
      console.error("Erro ao calcular union seconds:", e);
      filteredTasks.forEach(t => sumActiveSecs += TimerEngine.getCurrentElapsedSeconds(t));
    }
    let sumPausedSecs = 0;

    const rowsHtml = filteredTasks.map(task => {
      const taskOwnerId = task.member_id || task.memberId;
      const member = membersMap.get(String(taskOwnerId)) || { name: 'Não atribuído', photo: '' };
      const isParticipant = isParticipantTask(task.id);

      // Busca todos os participantes desta tarefa
      const thisTaskParticipants = taskMembers
        .filter(tm => String(tm.taskId) === String(task.id))
        .map(tm => membersMap.get(String(tm.memberId || tm.member_id)))
        .filter(m => m); // remove undefined

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

      let timeIntervalStr = '<span style="color:var(--text-dim); font-style:italic;">Não iniciada</span>';
      let startIso = task.firstExecutionStartedAt || task.lastTimerStartedAt;
      
      if (startIso) {
        const startTime = new Date(startIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let endTime = 'Em andamento';
        if (task.status === 'CONCLUÍDO') {
          const endIso = task.completedAt || task.lastTimerStoppedAt || task.updatedAt;
          if (endIso) {
            endTime = new Date(endIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }
        } else if (!task.isTimerRunning && task.lastTimerStoppedAt) {
          endTime = new Date(task.lastTimerStoppedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        timeIntervalStr = `🕒 ${startTime} às ${endTime}`;
      } else if (task.status === 'CONCLUÍDO' && (task.completedAt || task.updatedAt)) {
         const endIso = task.completedAt || task.updatedAt;
         const endTime = new Date(endIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
         timeIntervalStr = `🕒 Concluída às ${endTime}`;
      }

      // Função de parsing seguro para milissegundos
      const parseToMs = (val) => {
        if (!val) return null;
        if (typeof val === 'number' && !isNaN(val)) return val;
        const ms = new Date(val).getTime();
        return isNaN(ms) ? null : ms;
      };

      // Tempo Ativo (Trabalhado)
      const isTodo = task.status === 'A FAZER';
      const activeSecs = isTodo ? 0 : TimerEngine.getCurrentElapsedSeconds(task);
      const activeTimeStr = activeSecs > 0 ? TimerEngine.formatTime(activeSecs) : '00:00';

      // Ponto de início da primeira execução
      const startMs = isTodo ? null : (
        parseToMs(task.firstExecutionStartedAt) ||
        parseToMs(task.lastTimerStartedAt) ||
        (task.status === 'EM EXECUÇÃO' || task.status === 'CONCLUÍDO' || activeSecs > 0 || task.completedAt || task.lastTimerStoppedAt
          ? parseToMs(task.createdAt)
          : null)
      );

      let pausedTimeStr = '00:00';

      if (startMs && !isTodo) {
        let endMs = Date.now();
        if (task.status === 'CONCLUÍDO') {
          endMs = parseToMs(task.completedAt) || parseToMs(task.lastTimerStoppedAt) || parseToMs(task.updatedAt) || Date.now();
        }

        const totalElapsedSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const pausedSecs = Math.max(0, totalElapsedSecs - activeSecs);
        if (pausedSecs > 0) {
          sumPausedSecs += pausedSecs;
          pausedTimeStr = TimerEngine.formatTime(pausedSecs);
        }
      }
      let completionDateStr = '-';
      if (task.status === 'CONCLUÍDO') {
        const rawCompletion = task.completedAt || task.updatedAt;
        if (rawCompletion) {
          completionDateStr = new Date(rawCompletion).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      }

      return `
        <tr style="${isParticipant ? 'opacity:0.9; border-left:3px solid rgba(99,102,241,0.5);' : ''}">
          <td>
            <strong>${task.title}</strong>
            ${isParticipant ? `<span style="display:inline-block; margin-left:4px; font-size:0.65rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); border-radius:4px; padding:1px 5px; vertical-align:middle;">👥 Participante</span>` : ''}
            <div style="font-size:0.75rem; color:var(--text-dim); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:240px;">
              ${task.description || ''}
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <!-- Dono -->
              <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" title="Responsável: ${member.name}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border: 1px solid var(--border-color);">
              <span>${member.name}</span>
              ${isParticipant ? `<span style="font-size:0.65rem; color:#818cf8; font-style:italic;">(você participa)</span>` : ''}
              
              <!-- Participantes -->
              ${thisTaskParticipants.length > 0 ? `
                <div style="display:flex; margin-left:0.5rem; border-left:1px solid var(--border-color); padding-left:0.5rem;">
                  ${thisTaskParticipants.map(p => `
                    <img src="${p.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.name)}" title="Participante: ${p.name}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; border:1px solid var(--bg-card); margin-left:-6px;">
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </td>
          <td>
            <span class="badge-priority priority-${(task.priority || 'média').toLowerCase()}">${task.priority || 'Média'}</span>
          </td>
          <td><strong>${task.status}</strong></td>
          <td>${task.dueDate ? task.dueDate.split('-').reverse().join('/') : '-'}</td>
          <td>${deadlineBadge}</td>
          <td style="font-size:0.775rem; color:var(--text-main); font-weight:600; white-space:nowrap;">
            ${timeIntervalStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:#10b981; white-space:nowrap;">
            ⏱️ ${activeTimeStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:${pausedTimeStr !== '00:00' ? '#f59e0b' : 'var(--text-dim)'}; white-space:nowrap;">
            ⏸️ ${pausedTimeStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:${task.status === 'CONCLUÍDO' ? '#10b981' : 'var(--text-dim)'}; white-space:nowrap;">
            ${completionDateStr}
          </td>
        </tr>
      `;
    }).join('');

    // --- Absences Logic ---
    const filteredAbsences = absences.filter(a => {
      const absDateStart = a.startDate;
      const absDateEnd = a.endDate;
      if (!absDateStart) return false;

      if (this.startDateFilter || this.endDateFilter) {
        if (this.startDateFilter && absDateEnd < this.startDateFilter) return false;
        if (this.endDateFilter && absDateStart > this.endDateFilter) return false;
      } else {
        if (absDateStart.slice(0, 7) !== this.selectedCompetence && absDateEnd.slice(0, 7) !== this.selectedCompetence) return false;
      }

      if (this.activeMemberFilter !== 'all') {
        if (String(a.memberId) !== String(this.activeMemberFilter)) return false;
      }
      return true;
    });

    const absenceRowsHtml = filteredAbsences.map(abs => {
      const member = membersMap.get(String(abs.memberId)) || { name: 'Não atribuído', photo: '' };
      
      const labels = {
        home_office: '🏡 Home Office',
        ferias: '🏝️ Férias',
        atestado: '📄 Atestado Médico',
        folga: '🏖️ Folga / DSR',
        presencial: '🏢 Presencial'
      };
      const title = labels[abs.type] || 'Ausência';
      const isPartial = abs.durationType === 'parcial' && abs.startTime && abs.endTime;
      
      let executionTimeStr = '-';
      let pausedSecs = 0;
      let pausedTimeStr = '-';
      
      if (isPartial) {
        executionTimeStr = `🕒 ${abs.startTime} às ${abs.endTime}`;
        const [h1, m1] = abs.startTime.split(':').map(Number);
        const [h2, m2] = abs.endTime.split(':').map(Number);
        const startSecs = h1 * 3600 + m1 * 60;
        const endSecs = h2 * 3600 + m2 * 60;
        if (endSecs > startSecs) {
          pausedSecs = endSecs - startSecs;
          sumPausedSecs += pausedSecs;
          pausedTimeStr = TimerEngine.formatTime(pausedSecs);
        }
      } else {
        const d1 = abs.startDate.split('-').reverse().join('/');
        const d2 = abs.endDate.split('-').reverse().join('/');
        executionTimeStr = d1 === d2 ? `📅 ${d1}` : `📅 ${d1} a ${d2}`;
        pausedTimeStr = 'Integral';
      }

      return `
        <tr style="background: rgba(245,158,11,0.05); border-left: 3px solid #f59e0b;">
          <td>
            <strong>${title}</strong>
            <div style="font-size:0.75rem; color:var(--text-dim); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:240px;">
              ${abs.description || 'Ausência justificada'}
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border: 1px solid var(--border-color);">
              <span>${member.name}</span>
            </div>
          </td>
          <td>-</td>
          <td><strong style="color:#f59e0b;">Ausência ${isPartial ? 'Parcial' : 'Integral'}</strong></td>
          <td>${abs.endDate.split('-').reverse().join('/')}</td>
          <td>-</td>
          <td style="font-size:0.775rem; color:var(--text-main); font-weight:600; white-space:nowrap;">
            ${executionTimeStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:var(--text-dim); white-space:nowrap;">
            -
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:#f59e0b; white-space:nowrap;">
            ⏸️ ${pausedTimeStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:var(--text-dim); white-space:nowrap;">
            -
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = rowsHtml + absenceRowsHtml + `
      <tr style="background: rgba(99, 102, 241, 0.1); font-weight: bold; border-top: 2px solid var(--border-color);">
        <td colspan="7" style="text-align: right; color: var(--text-main); padding-right: 1rem;">Totais do Roadmap:</td>
        <td style="color: #10b981; font-size: 0.85rem;">⏱️ ${TimerEngine.formatTime(sumActiveSecs)}</td>
        <td style="color: #f59e0b; font-size: 0.85rem;">⏸️ ${TimerEngine.formatTime(sumPausedSecs)}</td>
        <td></td>
      </tr>
    `;
  },

  /**
   * Exporta a tabela atual do Roadmap para Excel (CSV)
   */
  exportRoadmapToExcel() {
    if (!this._lastRoadmapTasks) return;
    const tasks = this._lastRoadmapTasks;
    const membersMap = this._lastMembersMap || new Map();
    const taskMembers = this._lastTaskMembers || [];

    const participantTaskIds = new Set();
    if (this.activeMemberFilter !== 'all') {
      taskMembers.forEach(tm => {
        if (String(tm.memberId || tm.member_id) === String(this.activeMemberFilter)) {
          participantTaskIds.add(String(tm.taskId));
        }
      });
    }

    const filteredTasks = tasks.filter(t => {
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

      let matchesDate = false;
      if (this.startDateFilter || this.endDateFilter) {
        if (!targetDateStr) return false;
        if (this.startDateFilter && targetDateStr < this.startDateFilter) return false;
        if (this.endDateFilter && targetDateStr > this.endDateFilter) return false;
        matchesDate = true;
      } else {
        matchesDate = targetDateStr && targetDateStr.slice(0, 7) === this.selectedCompetence;
      }

      if (!matchesDate) return false;
      if (this.activeMemberFilter !== 'all') {
        const isOwner = String(t.member_id || t.memberId) === String(this.activeMemberFilter);
        const isParticipant = participantTaskIds.has(String(t.id));
        return isOwner || isParticipant;
      }
      return true;
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const parseToMs = (val) => {
      if (!val) return null;
      if (typeof val === 'number' && !isNaN(val)) return val;
      const ms = new Date(val).getTime();
      return isNaN(ms) ? null : ms;
    };

    const sanitize = (str) => {
      if (!str) return '""';
      return '"' + String(str).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
    };

    let csvContent = "Demanda / Atividade;Responsavel;Prioridade;Status;Prazo;Saude do Prazo;Horario de Execucao;Tempo Trabalhado;Tempo Pausado;Data da Conclusao\n";

    filteredTasks.forEach(task => {
      const taskOwnerId = task.member_id || task.memberId;
      const member = membersMap.get(String(taskOwnerId)) || { name: 'Nao atribuido' };
      
      let saude = '';
      if (task.status === 'CONCLUÍDO') saude = 'Concluido';
      else if (!task.dueDate) saude = 'Sem Prazo';
      else if (task.dueDate < todayStr) saude = 'Atrasada';
      else if (task.dueDate === todayStr) saude = 'Vence Hoje';
      else saude = 'No Prazo';

      let timeIntervalStr = 'Nao iniciada';
      let startIso = task.firstExecutionStartedAt || task.lastTimerStartedAt;
      if (startIso) {
        const startTime = new Date(startIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let endTime = 'Em andamento';
        if (task.status === 'CONCLUÍDO') {
          const endIso = task.completedAt || task.lastTimerStoppedAt || task.updatedAt;
          if (endIso) endTime = new Date(endIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (!task.isTimerRunning && task.lastTimerStoppedAt) {
          endTime = new Date(task.lastTimerStoppedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        timeIntervalStr = `${startTime} as ${endTime}`;
      } else if (task.status === 'CONCLUÍDO' && (task.completedAt || task.updatedAt)) {
         const endIso = task.completedAt || task.updatedAt;
         const endTime = new Date(endIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
         timeIntervalStr = `Concluida as ${endTime}`;
      }

      const isTodo = task.status === 'A FAZER';
      const activeSecs = isTodo ? 0 : TimerEngine.getCurrentElapsedSeconds(task);
      const activeTimeStr = activeSecs > 0 ? TimerEngine.formatTime(activeSecs) : '00:00';

      const startMs = isTodo ? null : (
        parseToMs(task.firstExecutionStartedAt) || parseToMs(task.lastTimerStartedAt) ||
        (task.status === 'EM EXECUÇÃO' || task.status === 'CONCLUÍDO' || activeSecs > 0 || task.completedAt || task.lastTimerStoppedAt ? parseToMs(task.createdAt) : null)
      );

      let pausedTimeStr = '00:00';
      if (startMs && !isTodo) {
        let endMs = Date.now();
        if (task.status === 'CONCLUÍDO') {
          endMs = parseToMs(task.completedAt) || parseToMs(task.lastTimerStoppedAt) || parseToMs(task.updatedAt) || Date.now();
        }
        const totalElapsedSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const pausedSecs = Math.max(0, totalElapsedSecs - activeSecs);
        if (pausedSecs > 0) pausedTimeStr = TimerEngine.formatTime(pausedSecs);
      }

      let completionDateStr = '-';
      if (task.status === 'CONCLUÍDO') {
        const rawCompletion = task.completedAt || task.updatedAt;
        if (rawCompletion) completionDateStr = new Date(rawCompletion).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }

      const row = [
        sanitize(task.title),
        sanitize(member.name),
        sanitize(task.priority || 'Media'),
        sanitize(task.status),
        sanitize(task.dueDate ? task.dueDate.split('-').reverse().join('/') : '-'),
        sanitize(saude),
        sanitize(timeIntervalStr),
        sanitize(activeTimeStr),
        sanitize(pausedTimeStr),
        sanitize(completionDateStr)
      ].join(';');

      csvContent += row + "\n";
    });

    // Adiciona as ausências no CSV
    const absences = this._lastRoadmapAbsences || [];
    const filteredAbsences = absences.filter(a => {
      const absDateStart = a.startDate;
      const absDateEnd = a.endDate;
      if (!absDateStart) return false;

      if (this.startDateFilter || this.endDateFilter) {
        if (this.startDateFilter && absDateEnd < this.startDateFilter) return false;
        if (this.endDateFilter && absDateStart > this.endDateFilter) return false;
      } else {
        if (absDateStart.slice(0, 7) !== this.selectedCompetence && absDateEnd.slice(0, 7) !== this.selectedCompetence) return false;
      }
      if (this.activeMemberFilter !== 'all') {
        if (String(a.memberId) !== String(this.activeMemberFilter)) return false;
      }
      return true;
    });

    filteredAbsences.forEach(abs => {
      const member = membersMap.get(String(abs.memberId)) || { name: 'Nao atribuido' };
      const labels = { home_office: 'Home Office', ferias: 'Ferias', atestado: 'Atestado Medico', folga: 'Folga / DSR', presencial: 'Presencial' };
      const title = labels[abs.type] || 'Ausencia';
      const isPartial = abs.durationType === 'parcial' && abs.startTime && abs.endTime;

      let executionTimeStr = '-';
      let pausedTimeStr = '-';
      if (isPartial) {
        executionTimeStr = `${abs.startTime} as ${abs.endTime}`;
        const [h1, m1] = abs.startTime.split(':').map(Number);
        const [h2, m2] = abs.endTime.split(':').map(Number);
        const startSecs = h1 * 3600 + m1 * 60;
        const endSecs = h2 * 3600 + m2 * 60;
        if (endSecs > startSecs) {
          pausedTimeStr = TimerEngine.formatTime(endSecs - startSecs);
        }
      } else {
        const d1 = abs.startDate.split('-').reverse().join('/');
        const d2 = abs.endDate.split('-').reverse().join('/');
        executionTimeStr = d1 === d2 ? d1 : `${d1} a ${d2}`;
        pausedTimeStr = 'Integral';
      }

      const row = [
        sanitize(title + (abs.description ? ' - ' + abs.description : '')),
        sanitize(member.name),
        sanitize('-'),
        sanitize(`Ausencia ${isPartial ? 'Parcial' : 'Integral'}`),
        sanitize(abs.endDate.split('-').reverse().join('/')),
        sanitize('-'),
        sanitize(executionTimeStr),
        sanitize('-'),
        sanitize(pausedTimeStr),
        sanitize('-')
      ].join(';');

      csvContent += row + "\n";
    });

    const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `roadmap_export_${todayStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Eventos de salvamento de responsabilidades
   */
  attachEvents(portfolio) {
    document.querySelectorAll('.btn-save-responsibilities').forEach(btn => {
      btn.addEventListener('click', async () => {
        const memberId = btn.dataset.memberId;
        const textarea = document.querySelector(`.textarea-responsibilities[data-member-id="${memberId}"]`);
        if (!textarea) return;

        const newText = textarea.value.trim();
        let memberData = portfolio.find(p => String(p.memberId) === String(memberId));

        if (!memberData) {
          memberData = {
            id: 'port-' + memberId,
            memberId: memberId,
            responsibilitiesText: newText
          };
          portfolio.push(memberData);
        } else {
          memberData.responsibilitiesText = newText;
        }

        const payload = {
          id: memberData.id,
          data: memberData
        };

        await DB.save('cycle_templates', payload);
        alert('Responsabilidades atualizadas com sucesso!');
      });
    });
  }
};