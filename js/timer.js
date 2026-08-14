/**
 * Motor de Gerenciamento de Cronômetro e Tempo Trabalhado (Timer Engine)
 */

import { DB } from './db.js';

export const TimerEngine = {
  tickerInterval: null,

  /**
   * Converte segundos inteiros no formato HH:MM:SS ou MM:SS
   */
  formatTime(totalSeconds) {
    const secs = Math.floor(Math.abs(totalSeconds) || 0);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  },

  /**
   * Calcula os segundos acumulados atuais de uma tarefa (incluindo tempo rodando no momento)
   */
  getCurrentElapsedSeconds(task) {
    let seconds = task.elapsedSeconds || 0;
    if (task.isTimerRunning && task.lastTimerStartedAt) {
      const now = Date.now();
      const diffSecs = Math.floor((now - task.lastTimerStartedAt) / 1000);
      seconds += Math.max(0, diffSecs);
    }
    return seconds;
  },

  /**
   * Inicia o cronômetro para uma tarefa
   */
  async startTimer(task) {
    if (task.isTimerRunning) return task;

    if (!task.firstExecutionStartedAt) {
      task.firstExecutionStartedAt = new Date().toISOString();
    }
    task.isTimerRunning = true;
    task.lastTimerStartedAt = Date.now();
    await DB.save('tasks', task);
    return task;
  },

  /**
   * Pausa o cronômetro de uma tarefa
   */
  async pauseTimer(task) {
    if (!task.isTimerRunning) return task;

    const now = Date.now();
    const diffSecs = Math.floor((now - (task.lastTimerStartedAt || now)) / 1000);
    
    task.elapsedSeconds = (task.elapsedSeconds || 0) + Math.max(0, diffSecs);
    task.isTimerRunning = false;
    task.lastTimerStartedAt = null;
    task.lastTimerStoppedAt = new Date().toISOString();

    await DB.save('tasks', task);
    return task;
  },

  /**
   * Paralisa o cronômetro ao concluir a tarefa
   */
  async stopTimer(task) {
    return this.pauseTimer(task);
  },

  /**
   * Inicia o ticker global para atualizar contadores no DOM a cada 1 segundo
   */
  startGlobalTicker(onTickCallback) {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }

    this.tickerInterval = setInterval(async () => {
      const tasks = await DB.getAll('tasks');
      const runningTasks = tasks.filter(t => t.isTimerRunning);

      // Atualiza mostradores de timer no DOM diretamente
      runningTasks.forEach(task => {
        const el = document.getElementById(`timer-display-${task.id}`);
        if (el) {
          const currentSecs = this.getCurrentElapsedSeconds(task);
          el.textContent = this.formatTime(currentSecs);
        }
      });

      if (onTickCallback) {
        onTickCallback(runningTasks);
      }
    }, 1000);
  }
};
