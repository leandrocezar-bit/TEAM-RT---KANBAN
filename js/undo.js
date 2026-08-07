/**
 * Motor de Desfazer (Ctrl+Z) - History Action Stack Engine
 */

import { DB } from './db.js';

export const UndoEngine = {
  stack: [],
  maxStackSize: 30,

  /**
   * Registra uma ação reversível na pilha de histórico
   */
  pushAction(action) {
    this.stack.push({
      ...action,
      timestamp: Date.now()
    });
    if (this.stack.length > this.maxStackSize) {
      this.stack.shift();
    }
  },

  /**
   * Executa o desfazer da última ação (Ctrl+Z)
   */
  async undo(onRefreshCallback, showToastCallback) {
    if (this.stack.length === 0) {
      if (showToastCallback) showToastCallback('Nenhuma alteração recente para desfazer.', 'info');
      return false;
    }

    const action = this.stack.pop();
    let undoDescription = '';

    switch (action.type) {
      case 'TASK_STATUS': {
        const task = await DB.get('tasks', action.taskId);
        if (task) {
          task.status = action.fromStatus;
          await DB.save('tasks', task);
          undoDescription = `Restaurado status da tarefa "${task.title}" para ${action.fromStatus}`;
        }
        break;
      }

      case 'TASK_CREATE': {
        await DB.delete('tasks', action.taskId);
        undoDescription = `Criação da atividade desfeita`;
        break;
      }

      case 'TASK_DELETE': {
        if (action.task) {
          await DB.save('tasks', action.task);
          undoDescription = `Atividade "${action.task.title}" restaurada`;
        }
        break;
      }

      case 'TASK_UPDATE': {
        if (action.previousState) {
          await DB.save('tasks', action.previousState);
          undoDescription = `Alterações na atividade "${action.previousState.title}" desfeitas`;
        }
        break;
      }

      case 'TRANSFER_REQUEST': {
        if (action.transferId) {
          await DB.delete('activity_transfers', action.transferId);
          undoDescription = `Solicitação de transferência desfeita`;
        }
        break;
      }

      default:
        console.warn('Tipo de ação desconhecido para desfazer:', action.type);
        return false;
    }

    if (showToastCallback && undoDescription) {
      showToastCallback(`↩️ Desfeito: ${undoDescription}`, 'success');
    }

    if (onRefreshCallback) {
      await onRefreshCallback();
    }

    return true;
  },

  /**
   * Inicializa o escutador do atalho global de teclado Ctrl+Z
   */
  initKeyboardShortcut(onRefreshCallback, showToastCallback) {
    window.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          return;
        }
        e.preventDefault();
        await this.undo(onRefreshCallback, showToastCallback);
      }
    });
  }
};
