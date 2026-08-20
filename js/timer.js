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
   * Obtém a data de fim segura para um intervalo. Se estiver aberto e a tarefa estiver CONCLUÍDA, 
   * trava o fim na data de conclusão em vez de deixá-lo rodar até "agora".
   */
  getSafeEndMs(iv, task, now) {
    let end = Number(iv.e);
    if (!end || isNaN(end)) {
      if (task && task.status === 'CONCLUÍDO') {
        const comp = task.completedAt ? new Date(task.completedAt).getTime() : NaN;
        end = !isNaN(comp) ? comp : (Number(iv.s) || now);
      } else {
        end = now;
      }
    }
    return end;
  },

  /**
   * Soma a duração de todos os intervalos em segundos.
   * Intervalos sem 'e' (abertos) usam Date.now() ou a data de conclusão da tarefa.
   */
  sumIntervalSeconds(intervals, task = null) {
    if (!intervals || intervals.length === 0) return 0;
    const now = Date.now();
    return Math.floor(
      intervals.reduce((acc, iv) => {
        const end = this.getSafeEndMs(iv, task, now);
        const start = Number(iv.s) || now;
        return acc + Math.max(0, end - start);
      }, 0) / 1000
    );
  },

  /**
   * Retorna a soma em segundos apenas dos intervalos fechados.
   */
  getClosedIntervalsSum(task) {
    if (!task.timeIntervals || task.timeIntervals.length === 0) return 0;
    const now = Date.now();
    return Math.floor(
      task.timeIntervals.reduce((acc, iv) => {
        const end = this.getSafeEndMs(iv, task, now);
        if (!iv.e && task.status !== 'CONCLUÍDO') return acc; // Se tá aberto e rodando, não conta no fechado
        return acc + Math.max(0, end - (Number(iv.s) || end));
      }, 0) / 1000
    );
  },

  /**
   * Retorna os segundos da base legada que não estão nos intervalos.
   */
  getLegacyBaseSeconds(task) {
    if (!task.timeIntervals || task.timeIntervals.length === 0) return task.elapsedSeconds || 0;
    
    // ANTI-DUPLICAÇÃO DEFINITIVA:
    // Como o script de migração já transformou todo o tempo legado em intervalos sintéticos,
    // a propriedade timeIntervals passa a ser a ÚNICA fonte da verdade.
    // Continuar lendo task.elapsedSeconds estava somando o tempo verdadeiro com o histórico corrompido do DB.
    return 0;
  },

  /**
   * Calcula os segundos acumulados atuais de uma tarefa.
   * Usa timeIntervals se disponível.
   */
  getCurrentElapsedSeconds(task) {
    if (task.timeIntervals && task.timeIntervals.length > 0) {
      // Usar a união garante que intervalos duplicados ou sobrepostos nunca dobrem o tempo
      return this.calculateUnionSeconds([task]);
    }

    // Legado: elapsedSeconds + tempo da sessão ativa atual
    let seconds = task.elapsedSeconds || 0;
    if (task.isTimerRunning && task.lastTimerStartedAt) {
      seconds += Math.max(0, Math.floor((Date.now() - Number(task.lastTimerStartedAt)) / 1000));
    }
    return seconds;
  },

  /**
   * Calcula o tempo real trabalhado (sem duplicações) fazendo a união
   * de todos os timeIntervals de um conjunto de tarefas.
   * Pode opcionalmente fatiar os intervalos para o período especificado (filterStartMs a filterEndMs).
   */
  calculateUnionSeconds(tasks, filterStartMs = 0, filterEndMs = Infinity) {
    if (!tasks || tasks.length === 0) return 0;
    
    let totalLegacySeconds = 0;
    const allIntervals = [];
    const now = Date.now();

    tasks.forEach(task => {
      // Se a tarefa não tem sistema de intervalos
      if (!task.timeIntervals || task.timeIntervals.length === 0) {
        totalLegacySeconds += this.getCurrentElapsedSeconds(task);
        return;
      }
      
      // Soma os segundos da base legada (calculado dinamicamente para não depender do DB)
      totalLegacySeconds += this.getLegacyBaseSeconds(task);

      // Coleta todos os intervalos que se sobrepõem ao filtro de datas
      (task.timeIntervals || []).forEach(iv => {
        let start = Number(iv.s) || now;
        let end = this.getSafeEndMs(iv, task, now);
        
        // AUTO-CORREÇÃO DE INTERVALO SINTÉTICO INFLADO DO DB
        // Impede matematicamente que o intervalo conte tempo ANTES da tarefa ter sido iniciada pela primeira vez.
        // Corta qualquer tempo "fantasma" que tenha sido salvo errado no banco ontem.
        if (task.firstExecutionStartedAt) {
          const firstMs = new Date(task.firstExecutionStartedAt).getTime();
          if (start < firstMs && !isNaN(firstMs)) {
            start = firstMs;
          }
        }
        
        // Fatiamento do tempo (Timesheet)
        start = Math.max(start, filterStartMs);
        end = Math.min(end, filterEndMs);

        if (end > start) {
          allIntervals.push({ start, end });
        }
      });
    });

    if (allIntervals.length === 0) {
      return totalLegacySeconds;
    }

    // Ordena pelo tempo de início
    allIntervals.sort((a, b) => a.start - b.start);

    // Algoritmo de União (Merge Intervals)
    const merged = [allIntervals[0]];
    for (let i = 1; i < allIntervals.length; i++) {
      const current = allIntervals[i];
      const lastMerged = merged[merged.length - 1];

      if (current.start <= lastMerged.end) {
        // Há sobreposição: estende o fim do último intervalo, se necessário
        lastMerged.end = Math.max(lastMerged.end, current.end);
      } else {
        // Não há sobreposição: adiciona o novo intervalo
        merged.push(current);
      }
    }

    // Soma a duração dos intervalos unidos
    let unionMs = 0;
    merged.forEach(iv => {
      unionMs += (iv.end - iv.start);
    });

    return totalLegacySeconds + Math.floor(unionMs / 1000);
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
    // Na primeira vez que o timer é iniciado após a atualização, inicializa os intervalos.
    if (!task.timeIntervals) {
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

    if (task.timeIntervals) {
      // Pega a base legada ANTES de fechar o intervalo
      const legacyBase = this.getLegacyBaseSeconds(task);

      // Novo sistema: fecha o intervalo aberto
      const last = task.timeIntervals[task.timeIntervals.length - 1];
      if (last && !last.e) last.e = now;

      // Mantém elapsedSeconds atualizado com o tempo correto já desduplicado
      task.elapsedSeconds = this.calculateUnionSeconds([task]);
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
      t => (!t.timeIntervals || t.timeIntervals.length === 0) &&
           (t.elapsedSeconds > 0 || t.isTimerRunning)
    );

    if (toMigrate.length === 0) return;

    // console.log(`[TimerMigration] Migrando ${toMigrate.length} tarefa(s) legada(s)...`);

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
   * Calcula o tempo exato em que a tarefa ficou em pausa (gaps entre sessões ativas).
   */
  getPausedSeconds(task) {
    if (!task.timeIntervals || task.timeIntervals.length < 2) return 0;
    
    const validIntervals = task.timeIntervals.filter(iv => iv.s);
    if (validIntervals.length < 2) return 0;
    
    const sorted = [...validIntervals].sort((a, b) => Number(a.s) - Number(b.s));
    
    let pausedMs = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = Number(sorted[i].e) || Date.now();
      const nextStart = Number(sorted[i + 1].s);
      
      if (nextStart > currentEnd) {
        pausedMs += (nextStart - currentEnd);
      }
    }
    
    return Math.floor(pausedMs / 1000);
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
