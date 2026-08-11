/**
 * Portfólio do Setor - Matriz Fixa de Responsabilidades por Colaborador & Métricas por Competência
 */

import { DB } from './db.js';
import { TimerEngine } from './timer.js';

export const MapEngine = {
  selectedCompetence: new Date().toISOString().slice(0, 7),
  activeMemberFilter: 'all', // 'all' ou ID do membro selecionado

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

    this.renderHeaderMetrics(tasks);
    this.renderMembersPortfolioGrid(portfolio, members);
    this.renderRoadmapTable(tasks, membersMap, impMap);

    this.attachEvents(portfolio);
    this.bindMemberTabsAutoListener(); // 🎯 Escuta o clique nas abas dos membros automaticamente
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
   * Métricas do Topo com Filtro de Competência Mensal
   */
  renderHeaderMetrics(tasks) {
    const container = document.getElementById('map-metrics-summary');
    if (!container) return;

    // Filtra por competência e também por membro selecionado
    const competenceTasks = tasks.filter(t => {
      const dateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);
      if (!dateStr || dateStr.slice(0, 7) !== this.selectedCompetence) return false;

      if (this.activeMemberFilter !== 'all') {
        return String(t.member_id || t.memberId) === String(this.activeMemberFilter);
      }
      return true;
    });

    const total = competenceTasks.length;
    const done = competenceTasks.filter(t => t.status === 'CONCLUÍDO').length;
    const wip = competenceTasks.filter(t => t.status === 'EM EXECUÇÃO').length;
    const todo = competenceTasks.filter(t => t.status === 'A FAZER').length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    let totalSeconds = 0;
    competenceTasks.forEach(t => {
      totalSeconds += TimerEngine.getCurrentElapsedSeconds(t);
    });

    const [year, month] = this.selectedCompetence.split('-');
    const competenceName = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    container.style.cssText = 'display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.75rem; width: 100%;';

    container.innerHTML = `
      <!-- Seletor de Competência Mensal -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-card, #111827); border: 1px solid var(--border-color, #1f2937); padding: 0.75rem 1.25rem; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1rem; font-weight: 800; color: #ffffff;">🗓️ Competência:</span>
          <span style="font-size: 0.95rem; font-weight: 700; color: #8b5cf6; text-transform: capitalize;">${competenceName}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-size: 0.8rem; font-weight: 600; color: #9ca3af;">Mudar Competência:</label>
          <input type="month" id="select-map-competence" value="${this.selectedCompetence}" 
                 style="background: var(--bg-input, #1f2937); border: 1px solid var(--border-color, #374151); border-radius: 6px; padding: 0.35rem 0.6rem; color: #ffffff; font-size: 0.8rem; outline: none; cursor: pointer;">
        </div>
      </div>

      <!-- Cards de Métricas da Competência -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; width: 100%;">
        
        <!-- Card 1: Progresso -->
        <div style="background: var(--bg-card, #111827); border: 1px solid var(--border-color, #1f2937); border-left: 4px solid #8b5cf6; border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #9ca3af;">📈 Progresso da Competência</span>
            <span style="font-size: 1.25rem;">📊</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem;">
            ${completionPercent}%
          </div>
          <div style="background: rgba(255,255,255,0.08); border-radius: 10px; height: 8px; width: 100%; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); width: ${completionPercent}%; height: 100%; border-radius: 10px; transition: width 0.4s ease;"></div>
          </div>
          <span style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem; display: block;">${done} de ${total} entregas no mês</span>
        </div>

        <!-- Card 2: Demandas -->
        <div style="background: var(--bg-card, #111827); border: 1px solid var(--border-color, #1f2937); border-left: 4px solid #10b981; border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #9ca3af;">💼 Demandas da Competência</span>
            <span style="font-size: 1.25rem;">💼</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem;">
            ${total} <span style="font-size: 0.85rem; font-weight: 600; color: #9ca3af;">Atividades</span>
          </div>
          <div style="display: flex; gap: 0.75rem; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem; margin-top: 0.25rem;">
            <span style="color: #f59e0b; font-weight: 600;">📋 ${todo} a fazer</span>
            <span style="color: #6366f1; font-weight: 600;">⚡ ${wip} ativas</span>
            <span style="color: #10b981; font-weight: 600;">✅ ${done} concluídas</span>
          </div>
        </div>

        <!-- Card 3: Horas -->
        <div style="background: var(--bg-card, #111827); border: 1px solid var(--border-color, #1f2937); border-left: 4px solid #06b6d4; border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #9ca3af;">⏱️ Horas na Competência</span>
            <span style="font-size: 1.25rem;">⏱️</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 800; color: #38bdf8; font-family: monospace; margin-bottom: 0.5rem;">
            ${TimerEngine.formatTime(totalSeconds)}
          </div>
          <span style="font-size: 0.75rem; color: #6b7280; display: block; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
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

    const isManager = localStorage.getItem('logged_access_level') === 'gestor';
    const loggedMemberId = localStorage.getItem('logged_member_id');

    let visibleMembers = members;
    if (this.activeMemberFilter !== 'all') {
      visibleMembers = members.filter(m => String(m.id) === String(this.activeMemberFilter));
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
        <div class="card-panel" style="background: var(--bg-card, #111827); border: 1px solid var(--border-color, #1f2937); border-radius: var(--radius-lg, 12px); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border-color, #1f2937);">
            <img src="${member.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name)}" 
                 alt="${member.name}" 
                 style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-primary, #6366f1); flex-shrink: 0;">
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 800; color: #ffffff; margin: 0;">${member.name}</h3>
              <span style="font-size: 0.8rem; color: var(--text-muted, #9ca3af); display: block; margin-top: 0.15rem;">${member.role || 'Colaborador'}</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1;">
            <label style="font-size: 0.9rem; font-weight: 700; color: var(--text-main, #f3f4f6); display: flex; align-items: center; gap: 0.4rem;">
              📌 Responsabilidades:
            </label>
            
            <textarea class="textarea-responsibilities" 
                      data-member-id="${member.id}" 
                      ${!canEditCard ? 'readonly' : ''} 
                      placeholder="Descreva aqui as atribuições, escopo e responsabilidades do membro no setor..." 
                      style="width: 100%; min-height: 120px; background: var(--bg-input, #1f2937); border: 1px solid var(--border-color, #374151); border-radius: 8px; padding: 0.75rem; color: #f3f4f6; font-size: 0.85rem; line-height: 1.5; resize: vertical; outline: none; ${!canEditCard ? 'opacity: 0.85; cursor: default;' : ''}">${responsibilitiesText}</textarea>

            ${canEditCard ? `
              <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
                <button class="btn btn-primary btn-save-responsibilities" data-member-id="${member.id}" style="font-size: 0.75rem; padding: 0.4rem 0.85rem; font-weight: 700;">
                  💾 Salvar Responsabilidades
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
   */
  renderRoadmapTable(tasks, membersMap, impMap) {
    const container = document.getElementById('map-roadmap-table-body');
    if (!container) return;

    const filteredTasks = tasks.filter(t => {
      const dateStr = t.dueDate || (t.createdAt ? t.createdAt.slice(0, 10) : null);
      if (!dateStr || dateStr.slice(0, 7) !== this.selectedCompetence) return false;

      if (this.activeMemberFilter !== 'all') {
        return String(t.member_id || t.memberId) === String(this.activeMemberFilter);
      }
      return true;
    });

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-dim);">Nenhuma demanda cadastrada para esta seleção.</td>
        </tr>
      `;
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    container.innerHTML = filteredTasks.map(task => {
      const taskOwnerId = task.member_id || task.memberId;
      const member = membersMap.get(String(taskOwnerId)) || { name: 'Não atribuído', photo: '' };

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

      let timeIntervalStr = '-';
      const startIso = task.lastTimerStartedAt || task.createdAt;
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
      }

      let completionDateStr = '-';
      if (task.status === 'CONCLUÍDO') {
        const rawCompletion = task.completedAt || task.updatedAt;
        if (rawCompletion) {
          completionDateStr = new Date(rawCompletion).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      }

      return `
        <tr>
          <td>
            <strong>${task.title}</strong>
            <div style="font-size:0.75rem; color:var(--text-dim); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:240px;">
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
          <td style="font-size:0.775rem; color:var(--text-main); font-weight:600; white-space:nowrap;">
            ${timeIntervalStr}
          </td>
          <td style="font-size:0.775rem; font-weight:700; color:${task.status === 'CONCLUÍDO' ? '#10b981' : 'var(--text-dim)'}; white-space:nowrap;">
            ${completionDateStr}
          </td>
        </tr>
      `;
    }).join('');
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