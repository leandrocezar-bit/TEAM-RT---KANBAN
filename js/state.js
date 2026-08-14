/**
 * StateEngine - Barramento de Eventos e Gerenciamento de Estado Reativo
 * TEAM RT KANBAN
 */

(function () {
  const listeners = {};

  window.StateEngine = {
    /**
     * Inscreve um ouvinte para um evento específico
     * @param {string} eventName
     * @param {Function} callback
     */
    on(eventName, callback) {
      if (!listeners[eventName]) {
        listeners[eventName] = [];
      }
      listeners[eventName].push(callback);
    },

    /**
     * Remove a inscrição de um ouvinte
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
      if (!listeners[eventName]) return;
      listeners[eventName] = listeners[eventName].filter((cb) => cb !== callback);
    },

    /**
     * Emite um evento com dados para todos os ouvintes inscritos
     * @param {string} eventName
     * @param {any} data
     */
    emit(eventName, data) {
      if (!listeners[eventName]) return;
      listeners[eventName].forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`❌ Erro no listener do evento '${eventName}':`, err);
        }
      });
    },
  };
})();
