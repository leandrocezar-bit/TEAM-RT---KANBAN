/**
 * AbsenceEngine - Módulo de Registro de Escalas e Ausências
 * TEAM RT KANBAN
 */

(function () {
  async function saveAbsence(formData) {
    if (!window.DB) return;

    const { memberId, type, startDate, endDate, startTime, endTime, notes } = formData;

    const isPartial = Boolean(startTime || endTime);

    const newAbsence = {
      id: 'abs-' + Date.now(),
      memberId,
      type,
      durationType: isPartial ? 'parcial' : 'dia_inteiro',
      startDate,
      endDate,
      startTime: isPartial ? startTime : null,
      endTime: isPartial ? endTime : null,
      notes,
      createdAt: new Date().toISOString(),
    };

    await window.DB.save('member_absences', newAbsence);

    if (window.StateEngine) {
      window.StateEngine.emit('absence:saved', newAbsence);
    }

    return newAbsence;
  }

  window.AbsenceEngine = {
    saveAbsence,
  };
})();
