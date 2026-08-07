/**
 * Motor de Cálculos de Horas Extras e CLT (Calc Engine)
 */

export const CalcEngine = {
  /**
   * Converte string de hora (HH:mm) em minutos desde a meia-noite
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  },

  /**
   * Converte minutos em string formatada "Xh YYm"
   */
  minutesToFormattedHours(totalMinutes) {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const mins = Math.round(Math.abs(totalMinutes) % 60);
    const sign = totalMinutes < 0 ? '-' : '';
    if (hours === 0 && mins === 0) return '0h 00m';
    return `${sign}${hours}h ${mins.toString().padStart(2, '0')}m`;
  },

  /**
   * Converte minutos em horas decimais (ex: 90m = 1.5h)
   */
  minutesToDecimalHours(totalMinutes) {
    return +(totalMinutes / 60).toFixed(2);
  },

  /**
   * Calcula a duração em minutos entre hora inicial e final, descontando intervalo
   */
  calculateDurationMinutes(startTime, endTime, breakMinutes = 0) {
    let startMin = this.timeToMinutes(startTime);
    let endMin = this.timeToMinutes(endTime);

    // Se término for menor que o início, presume-se virada da noite (+24h)
    if (endMin <= startMin) {
      endMin += 24 * 60;
    }

    const duration = endMin - startMin - (Number(breakMinutes) || 0);
    return Math.max(0, duration);
  },

  /**
   * Calcula a porção noturna (entre 22h e 05h da manhã seguinte)
   */
  calculateNightMinutes(startTime, endTime) {
    let startMin = this.timeToMinutes(startTime);
    let endMin = this.timeToMinutes(endTime);

    if (endMin <= startMin) {
      endMin += 24 * 60;
    }

    // Intervalos Noturnos: 22h (1320m) a 29h (1740m = 5h do dia seguinte)
    const nightStart = 22 * 60;
    const nightEnd = 29 * 60;

    const overlapStart = Math.max(startMin, nightStart);
    const overlapEnd = Math.min(endMin, nightEnd);

    if (overlapEnd > overlapStart) {
      return overlapEnd - overlapStart;
    }
    return 0;
  },

  /**
   * Calcula valor da hora regular
   */
  calculateBaseHourlyRate(salarioBase, cargaHorariaMensal = 220) {
    const salario = parseFloat(salarioBase) || 0;
    const horas = parseFloat(cargaHorariaMensal) || 220;
    if (horas <= 0) return 0;
    return salario / horas;
  },

  /**
   * Calcula o valor monetário de uma entrada de horas extras
   */
  calculateEntryFinancials(entry, settings) {
    const { salarioBase = 3000, cargaHorariaMensal = 220 } = settings || {};
    const horaBaseValue = this.calculateBaseHourlyRate(salarioBase, cargaHorariaMensal);

    const durationMinutes = this.calculateDurationMinutes(
      entry.startTime,
      entry.endTime,
      entry.breakMinutes || 0
    );

    let effectiveMinutes = durationMinutes;

    // Redução da hora noturna (CLT): 1 hora noturna = 52.5 minutos (fator ~1.1428)
    if (entry.isNightShift) {
      const nightMins = this.calculateNightMinutes(entry.startTime, entry.endTime);
      const normalMins = durationMinutes - nightMins;
      const convertedNightMins = nightMins * (60 / 52.5);
      effectiveMinutes = normalMins + convertedNightMins;
    }

    const decimalHours = effectiveMinutes / 60;
    const rateMultiplier = 1 + (parseFloat(entry.ratePercent) || 50) / 100;
    const nightBonusMultiplier = entry.isNightShift ? 1.20 : 1.0;

    const totalValue = decimalHours * horaBaseValue * rateMultiplier * (entry.isNightShift ? nightBonusMultiplier : 1);

    return {
      durationMinutes,
      effectiveMinutes: Math.round(effectiveMinutes),
      decimalHours: +decimalHours.toFixed(2),
      horaBaseValue,
      totalValue: +totalValue.toFixed(2)
    };
  },

  /**
   * Formata valor numérico como moeda BRL (R$ 1.234,56)
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount || 0);
  }
};
