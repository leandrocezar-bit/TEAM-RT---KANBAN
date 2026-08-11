/**
 * Módulo de Chat Interno da Equipe em Tempo Real
 */

import { DB } from './db.js';

export const ChatEngine = {
    /**
     * Renderiza a Seção do Chat da Equipe
     */
    async renderChatSection() {
        const section = document.getElementById('section-chat');
        if (section) {
            section.style.display = 'block';
            section.classList.add('active');
        }

        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        let messages = [];
        let members = [];

        try {
            messages = (await DB.getAll('messages')) || [];
            members = (await DB.getAll('members')) || [];
        } catch (e) {
            console.warn('⚡ Erro ou tabela messages vazia:', e);
        }

        const membersMap = new Map(members.map(m => [String(m.id), m]));
        const loggedMemberId = localStorage.getItem('logged_member_id');

        if (!messages || messages.length === 0) {
            container.innerHTML = `
        <div style="text-align: center; color: var(--text-dim, #6b7280); font-size: 0.85rem; margin: auto; padding: 2rem;">
          👋 Nenhuma mensagem ainda. Seja o primeiro a enviar um oi para a equipe!
        </div>
      `;
        } else {
            // Ordena as mensagens por data
            messages.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));

            container.innerHTML = messages.map(msg => {
                const senderId = msg.sender_id || msg.senderId;
                const isMe = String(senderId) === String(loggedMemberId);
                const sender = membersMap.get(String(senderId)) || { name: 'Desconhecido', photo: '' };

                const timeStr = (msg.created_at || msg.createdAt)
                    ? new Date(msg.created_at || msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                return `
          <div style="display: flex; gap: 0.6rem; align-items: flex-end; ${isMe ? 'flex-direction: row-reverse;' : ''}">
            <img src="${sender.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sender.name)}" 
                 alt="${sender.name}" 
                 style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
            
            <div style="max-width: 70%; background: ${isMe ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--bg-input, #1f2937)'}; border: 1px solid ${isMe ? 'transparent' : 'var(--border-color, #374151)'}; border-radius: 12px; ${isMe ? 'border-bottom-right-radius: 2px;' : 'border-bottom-left-radius: 2px;'} padding: 0.6rem 0.85rem; color: #fff;">
              ${!isMe ? `<div style="font-size: 0.7rem; font-weight: 700; color: #a5b4fc; margin-bottom: 0.2rem;">${sender.name}</div>` : ''}
              <div style="font-size: 0.85rem; line-height: 1.4; word-break: break-word;">${msg.content}</div>
              <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); text-align: right; margin-top: 0.25rem;">${timeStr}</div>
            </div>
          </div>
        `;
            }).join('');
        }

        container.scrollTop = container.scrollHeight;
        this.setupFormListener();
    },

    /**
     * Configura o envio de mensagens no formulário
     */
    setupFormListener() {
        const form = document.getElementById('form-chat-send');
        if (!form || form.dataset.listenerBound) return;
        form.dataset.listenerBound = 'true';

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const input = document.getElementById('chat-input-message');
            const content = input ? input.value.trim() : '';
            const loggedMemberId = localStorage.getItem('logged_member_id');

            if (!content) return;

            const newMessage = {
                id: 'msg-' + Date.now(),
                sender_id: loggedMemberId,
                content: content,
                created_at: new Date().toISOString()
            };

            try {
                await DB.save('messages', newMessage);
                if (input) input.value = '';
                await this.renderChatSection();
            } catch (err) {
                console.error('Erro ao enviar mensagem:', err);
                alert('Não foi possível enviar a mensagem.');
            }
        });
    }
};