/**
 * Motor de Gerenciamento de Cronômetro e Tempo Trabalhado (Timer Engine)
 *
 * NOVO SISTEMA DE INTERVALOS (timeIntervals):
 * Cada sessão de trabalho é gravada como { s: startMs, e: endMs|null }.
 * Isso permite calcular o tempo real sem contar duplo sessões simultâneas.
 *
 * Compatibilidade:
 * - Tarefas antigas (sem timeIntervals): usam elapsedSeconds (legado).
 * - Tarefas novas: migram automaticamente na primeira vez que o timer é iniciado.
 *   O elapsedSeconds existente é preservado em _legacySeconds.
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
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  },

  /**
   * Soma a duração de todos os intervalos em segundos.
   * Intervalos sem 'e' (abertos) usam Date.now() como fim.
   */
  sumIntervalSeconds(intervals) {
    if (!intervals || intervals.length === 0) return 0;
    const now = Date.now();
    return Math.floor(
      intervals.reduce((acc, iv) => {
        const end = Number(iv.e) || now;
        const start = Number(iv.s) || now;
        return acc + Math.max(0, end - start);
      }, 0) / 1000
    );
  },

  /**
   * Calcula os segundos acumulados atuais de uma tarefa.
   * Usa timeIntervals se disponível E se a migração ocorreu (_legacySeconds definido).
   */
  getCurrentElapsedSeconds(task) {
    // Se _legacySeconds está definido, a tarefa já foi migrada corretamente pelo startTimer
    if (task.timeIntervals && task._legacySeconds !== undefined && task._legacySeconds !== null) {
      return (task._legacySeconds || 0) + this.sumIntervalSeconds(task.timeIntervals);
    }

    // Legado: elapsedSeconds + tempo da sessão ativa atual
    let seconds = task.elapsedSeconds || 0;
    if (task.isTimerRunning && task.lastTimerStartedAt) {
      seconds += Math.max(0, Math.floor((Date.now() - Number(task.lastTimerStartedAt)) / 1000));
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

    // ── Migração automática para o novo sistema ──────────────────────────
    // Na primeira vez que o timer é iniciado após a atualização,
    // congela o elapsedSeconds antigo em _legacySeconds e inicia os intervalos.
    if (task._legacySeconds === undefined || task._legacySeconds === null) {
      task._legacySeconds = task.elapsedSeconds || 0;
      task.timeIntervals = [];
    }

    // Abre um novo intervalo de sessão
    task.timeIntervals.push({ s: Date.now(), e: null });
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

    if (task._legacySeconds !== undefined && task._legacySeconds !== null && task.timeIntervals) {
      // Novo sistema: fecha o intervalo aberto
      const last = task.timeIntervals[task.timeIntervals.length - 1];
      if (last && !last.e) last.e = now;

      // Mantém elapsedSeconds atualizado para compatibilidade com o resto do sistema
      task.elapsedSeconds = (task._legacySeconds || 0) + this.sumIntervalSeconds(task.timeIntervals);
    } else {
      // Legado: acumula no elapsedSeconds
      const diffSecs = Math.floor((now - (Number(task.lastTimerStartedAt) || now)) / 1000);
      task.elapsedSeconds = (task.elapsedSeconds || 0) + Math.max(0, diffSecs);
    }

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
   * Migra tarefas legadas (sem timeIntervals) para o novo sistema de intervalos.
   *
   * Para cada tarefa legada com elapsedSeconds > 0, constrói um intervalo sintético
   * { s: início, e: fim } usando os melhores timestamps disponíveis:
   *   1. firstExecutionStartedAt → início real da execução
   *   2. lastTimerStoppedAt / completedAt / updatedAt → fim real
   *   3. Fallback: cria o intervalo "regressivo" a partir do fim (e - elapsedSeconds)
   *
   * O elapsedSeconds original é preservado em _legacySeconds para compatibilidade.
   * Tarefas já migradas (com _legacySeconds definido) são ignoradas.
   */
  async migrateAllLegacyTasks() {
    const tasks = (await DB.getAll('tasks')) || [];
    const toMigrate = tasks.filter(
      t => (t._legacySeconds === undefined || t._legacySeconds === null) &&
           (t.elapsedSeconds > 0 || t.isTimerRunning)
    );

    if (toMigrate.length === 0) return;

    console.log(`[TimerMigration] Migrando ${toMigrate.length} tarefa(s) legada(s)...`);

    for (const task of toMigrate) {
      const elapsed = task.elapsedSeconds || 0;
      const elapsedMs = elapsed * 1000;

      // Melhor estimativa para o fim da sessão
      const endIso =
        task.lastTimerStoppedAt ||
        task.completedAt         ||
        task.updatedAt           ||
        new Date().toISOString();

      const endMs = new Date(endIso).getTime();

      // Melhor estimativa para o início da sessão
      let startMs;
      if (task.firstExecutionStartedAt) {
        startMs = new Date(task.firstExecutionStartedAt).getTime();
      } else if (task.lastTimerStartedAt) {
        startMs = new Date(task.lastTimerStartedAt).getTime();
      } else {
        // Fallback: recua a partir do fim pelo tempo acumulado
        startMs = endMs - elapsedMs;
      }

      // Garante que o intervalo sintético não seja maior que elapsedSeconds
      // (pode ocorrer se a tarefa ficou pausada a maior parte do tempo)
      const syntheticDurationMs = endMs - startMs;
      const adjustedStartMs = syntheticDurationMs > elapsedMs
        ? endMs - elapsedMs   // recua exatamente o tempo acumulado a partir do fim
        : startMs;

      task._legacySeconds = 0;  // todo o tempo está no intervalo sintético
      task.timeIntervals  = [{ s: adjustedStartMs, e: endMs }];

      // Se o timer ainda está rodando, abre um novo intervalo ativo
      if (task.isTimerRunning && task.lastTimerStartedAt) {
        const activeStart = Number(task.lastTimerStartedAt);
        // Garante que não sobreponha o intervalo sintético
        if (activeStart > endMs) {
          task.timeIntervals.push({ s: activeStart, e: null });
        } else {
          // Estende o intervalo sintético até agora
          task.timeIntervals[0].e = null;
        }
      }

      // A migração de formato agora acontece apenas na memória (RAM) para a tela funcionar.
      // Removemos o DB.save e o console.log para poupar cota e limpar o console.
    }
  },

  /**
   * Inicia o ticker global para atualizar contadores no DOM a cada 1 segundo
   */
  startGlobalTicker(onTickCallback) {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }

    this.tickerInterval = setInterval(async () => {
      // Ler diretamente da memória local em vez de bater no Supabase (DB.getAll)
      // para evitar que o cache bust a cada 3 segundos acione a rede.
      const tasks = window.DB ? window.DB.getMemory('tasks') : [];
      const runningTasks = tasks.filter(t => t.isTimerRunning);

      // Atualiza mostradores de timer no DOM diretamente
      runningTasks.forEach(task => {
        const el = document.getElementById(`timer-display-${task.id}`);
        if (el) {
          const currentSecs = this.getCurrentElapsedSeconds(task);
          el.textContent = this.formatTime(currentSecs);
        }
      });

      if (typeof onTickCallback === 'function') {
        onTickCallback(runningTasks);
      }
    }, 1000);
  },
};
