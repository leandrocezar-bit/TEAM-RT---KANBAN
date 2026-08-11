/**
 * Gestão de Projetos & Atividades em Grupo (Multi-Colaboradores)
 */

import { DB } from './db.js';

export const ProjectsEngine = {
  activeProjectId: null,

  /**
   * Renderiza a visão principal de Projetos
   */
  async renderProjectsSection(showToastCallback, onRefreshCallback) {
    const container = document.getElementById('section-projects');
    if (!container) return;

    const projects = (await DB.getAll('projects')) || [];
    const members = (await DB.getAll('members')) || [];
    const tasks = (await DB.getAll('tasks')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
            📁 Gestão de Projetos e Atividades em Grupo
          </h2>
          <p style="font-size:0.8rem; color:var(--text-muted, #aaa);">
            Crie projetos, atribua múltiplos colaboradores e acompanhe entregáveis da equipe em tempo real.
          </p>
        </div>

        <button id="btn-create-project" class="btn btn-primary" onclick="window.ProjectsEngine.openCreateModal()">
          + Criar Novo Projeto
        </button>
      </div>
    `;

    if (projects.length === 0) {
      html += `
        <div class="card-panel" style="text-align:center; padding:3rem 1.5rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">📂</div>
          <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem;">Nenhum projeto cadastrado no momento</h3>
          <p style="font-size:0.85rem; color:var(--text-muted, #aaa); margin-bottom:1.5rem;">
            Clique no botão acima para abrir um novo projeto.
          </p>
        </div>
      `;
    } else {
      html += `
        <div style="display:flex; gap:0.5rem; overflow-x:auto; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color, #333); padding-bottom:0.5rem;">
          ${projects.map(p => `
            <button class="btn ${this.activeProjectId === p.id ? 'btn-primary' : 'btn-secondary'} btn-project-tab" onclick="window.ProjectsEngine.selectProject('${p.id}')">
              📂 ${p.name}
            </button>
          `).join('')}
        </div>
      `;

      const activeProject = projects.find(p => p.id === this.activeProjectId) || projects[0];
      if (activeProject) {
        this.activeProjectId = activeProject.id;
        const projectTasks = tasks.filter(t => t.projectId === activeProject.id || t.project_id === activeProject.id);
        const doneTasks = projectTasks.filter(t => t.status === 'CONCLUÍDO');
        const progress = projectTasks.length > 0 ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0;

        html += `
          <div class="card-panel" style="border-top:4px solid var(--accent-primary, #7c3aed); margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
              <div>
                <h3 style="font-size:1.3rem; font-weight:800; margin-bottom:0.25rem;">
                  ${activeProject.name}
                </h3>
                <p style="font-size:0.85rem; color:var(--text-muted, #aaa);">${activeProject.description || 'Sem descrição cadastrada.'}</p>
              </div>

              <div style="display:flex; align-items:center; gap:0.5rem;">
                <button class="btn btn-secondary" onclick="window.ProjectsEngine.openEditModal('${activeProject.id}')" style="font-size:0.75rem;">
                  ✏️ Editar Projeto
                </button>
                <button class="btn btn-primary" onclick="window.ProjectsEngine.openAddTaskModal('${activeProject.id}')" style="font-size:0.75rem;">
                  + Atividade no Projeto
                </button>
                <button class="btn" onclick="window.ProjectsEngine.deleteProject('${activeProject.id}')" style="font-size:0.75rem; background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3);">
                  🗑️ Excluir Projeto
                </button>
              </div>
            </div>

            <div style="background:var(--bg-input, #222); padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.85rem;">
                <span>Progresso das Entregas</span>
                <strong>${progress}% Concluído (${doneTasks.length}/${projectTasks.length})</strong>
              </div>
              <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:10px; overflow:hidden;">
                <div style="background:var(--accent-gradient, #7c3aed); width:${progress}%; height:100%;"></div>
              </div>
            </div>

            <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.75rem;">
              📌 Atividades em Grupo do Projeto
            </h4>

            <div class="table-responsive">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Responsável</th>
                    <th>Grupo</th>
                    <th>Prioridade</th>
                    <th>Status</th>
                    <th>Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  ${projectTasks.length === 0 ? `
                    <tr>
                      <td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-dim, #777);">
                        Nenhuma atividade cadastrada neste projeto ainda.
                      </td>
                    </tr>
                  ` : projectTasks.map(t => {
          const mainMember = members.find(m => m.id === t.memberId || m.id === t.member_id) || { name: 'Não atribuído', photo: '' };
          const groupLinks = taskMembers.filter(tm => tm.taskId === t.id);
          const groupMembers = members.filter(m => groupLinks.some(gl => gl.memberId === m.id));

          return `
                      <tr>
                        <td>
                          <strong>${t.title}</strong>
                          <div style="font-size:0.75rem; color:var(--text-dim, #777);">${t.description || ''}</div>
                        </td>
                        <td>${mainMember.name}</td>
                        <td>
                          <div style="display:flex; align-items:center;">
                            ${groupMembers.map(gm => `<img src="${gm.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(gm.name)}" title="${gm.name}" style="width:20px; height:20px; border-radius:50%; border:1px solid #333; margin-left:-4px;">`).join('')}
                            <button class="btn btn-secondary" onclick="window.ProjectsEngine.openManageGroupModal('${t.id}')" style="padding:0.1rem 0.3rem; font-size:0.65rem; margin-left:6px;">+👥</button>
                          </div>
                        </td>
                        <td>${t.priority || 'Média'}</td>
                        <td><strong>${t.status}</strong></td>
                        <td>${t.dueDate ? t.dueDate.split('-').reverse().join('/') : '-'}</td>
                      </tr>
                    `;
        }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;

    // Salva os callbacks para reaproveitá-los nos eventos
    this._showToast = showToastCallback;
    this._onRefresh = onRefreshCallback;

    this.setupFormListeners();
  },

  // Seleciona uma aba de projeto
  selectProject(projectId) {
    this.activeProjectId = projectId;
    this.renderProjectsSection(this._showToast, this._onRefresh);
  },

  // Exclui um projeto e atualiza a tela
  async deleteProject(projectId) {
    const idToDelete = projectId || this.activeProjectId;
    if (!idToDelete) return;

    const project = await DB.get('projects', idToDelete);
    const projectName = project ? project.name : 'este projeto';

    if (confirm(`Tem certeza de que deseja excluir o projeto "${projectName}"?\n\nEsta ação não pode ser desfeita.`)) {
      try {
        await DB.delete('projects', idToDelete);

        // Desvincula o projectId de todas as tarefas associadas
        const tasks = (await DB.getAll('tasks')) || [];
        const relatedTasks = tasks.filter(t => t.projectId === idToDelete || t.project_id === idToDelete);
        for (const t of relatedTasks) {
          delete t.projectId;
          delete t.project_id;
          await DB.save('tasks', t);
        }

        this.activeProjectId = null;

        if (this._showToast) this._showToast('Projeto excluído com sucesso!', 'success');
        if (this._onRefresh) this._onRefresh();

        await this.renderProjectsSection(this._showToast, this._onRefresh);
      } catch (e) {
        console.error('Erro ao excluir projeto:', e);
        alert('Ocorreu um erro ao excluir o projeto.');
      }
    }
  },

  // Abre modal para criar novo projeto
  openCreateModal() {
    const modal = document.getElementById('modal-project');
    if (!modal) return;

    const form = modal.querySelector('form');
    if (form) {
      form.reset();
      delete form.dataset.editId;
    }

    const header = modal.querySelector('#modal-project-title-header, .modal-title');
    if (header) header.textContent = '📁 Novo Projeto';

    modal.classList.add('active');
    modal.style.display = 'flex';
  },

  // Abre modal para editar projeto
  async openEditModal(projectId) {
    const idToEdit = projectId || this.activeProjectId;
    if (!idToEdit) return;

    const project = await DB.get('projects', idToEdit);
    const modal = document.getElementById('modal-project');
    if (!modal || !project) return;

    const header = modal.querySelector('#modal-project-title-header, .modal-title');
    if (header) header.textContent = '✏️ Editar Projeto';

    const form = modal.querySelector('form');
    if (form) {
      form.dataset.editId = project.id;
      const nameInput = form.querySelector('input[type="text"], [name="name"], [name="title"], #project-name');
      const descInput = form.querySelector('textarea, [name="description"], #project-description');

      if (nameInput) nameInput.value = project.name || '';
      if (descInput) descInput.value = project.description || '';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
  },

  // Abre modal para adicionar atividade no projeto
  openAddTaskModal(projectId) {
    const idToUse = projectId || this.activeProjectId;
    const modalTask = document.getElementById('modal-task') || document.getElementById('modal-activity') || document.getElementById('modal-nova-tarefa');
    if (!modalTask) return;

    const form = modalTask.querySelector('form');
    if (form) form.reset();

    const selectProject = modalTask.querySelector('#task-project-id, [name="projectId"], select[name="project"]');
    if (selectProject && idToUse) {
      selectProject.value = idToUse;
    }

    modalTask.classList.add('active');
    modalTask.style.display = 'flex';
  },

  // Abre modal de integrantes
  async openManageGroupModal(taskId) {
    const modal = document.getElementById('modal-task-group');
    if (!modal) return;

    const members = (await DB.getAll('members')) || [];
    const taskMembers = (await DB.getAll('task_members')) || [];
    const currentGroup = taskMembers.filter(tm => tm.taskId === taskId).map(tm => tm.memberId);

    const listContainer = modal.querySelector('#task-group-members-list, .members-list');
    if (listContainer) {
      listContainer.innerHTML = members.map(m => `
        <label style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem; cursor:pointer;">
          <input type="checkbox" class="chk-group-member" data-member-id="${m.id}" ${currentGroup.includes(m.id) ? 'checked' : ''}>
          <span>${m.name}</span>
        </label>
      `).join('');
    }

    const btnSave = modal.querySelector('#task-group-save-btn, .btn-save-group');
    if (btnSave) btnSave.dataset.taskId = taskId;

    modal.classList.add('active');
    modal.style.display = 'flex';
  },

  // Configura a submissão dos formulários
  setupFormListeners() {
    const modalProject = document.getElementById('modal-project');
    const formProject = modalProject ? modalProject.querySelector('form') : null;

    if (formProject && !formProject.dataset.listenerBound) {
      formProject.dataset.listenerBound = 'true';

      formProject.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = formProject.dataset.editId;
        const nameInput = formProject.querySelector('input[type="text"], [name="name"], [name="title"], #project-name');
        const descInput = formProject.querySelector('textarea, [name="description"], #project-description');

        const name = nameInput ? nameInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';

        if (!name) {
          if (this._showToast) this._showToast('Por favor, informe o nome do projeto.', 'error');
          return;
        }

        if (editId) {
          const project = await DB.get('projects', editId);
          if (project) {
            project.name = name;
            project.description = description;
            project.updatedAt = new Date().toISOString();
            await DB.save('projects', project);
          }
        } else {
          const newProject = {
            id: Date.now().toString(),
            name,
            description,
            createdAt: new Date().toISOString()
          };
          await DB.save('projects', newProject);
          this.activeProjectId = newProject.id;
        }

        modalProject.classList.remove('active');
        modalProject.style.display = 'none';

        formProject.reset();
        delete formProject.dataset.editId;

        if (this._showToast) this._showToast(editId ? 'Projeto atualizado!' : 'Projeto criado!');
        if (this._onRefresh) this._onRefresh();

        await this.renderProjectsSection(this._showToast, this._onRefresh);
      });
    }
  }
};

// Torna o engine acessível globalmente para os comandos onclick
window.ProjectsEngine = ProjectsEngine;