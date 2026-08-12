/**
 * Módulo de Chat Interno da Equipe em Tempo Real com Emojis, Anexos e Supabase Realtime
 */

import { DB } from './db.js';

let pendingFileBase64 = null;
let pendingFileName = null;
let activeChatChannel = null;

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
            messages.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));

            container.innerHTML = messages.map(msg => this.buildMessageHtml(msg, membersMap, loggedMemberId)).join('');
        }

        container.scrollTop = container.scrollHeight;
        this.setupListeners();
        this.setupRealtimeChat();
    },

    /**
     * Monta o HTML individual de cada mensagem
     */
    buildMessageHtml(msg, membersMap, loggedMemberId) {
        const senderId = msg.sender_id || msg.senderId;
        const isMe = String(senderId) === String(loggedMemberId);
        const sender = membersMap.get(String(senderId)) || { name: 'Desconhecido', photo: '' };

        const timeStr = (msg.created_at || msg.createdAt)
            ? new Date(msg.created_at || msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';

        // Tratamento de Mídia/Anexo
        let fileHtml = '';
        if (msg.file_data || msg.fileData) {
            const fileData = msg.file_data || msg.fileData;
            const fileName = msg.file_name || msg.fileName || 'Arquivo Anexo';

            if (fileData.startsWith('data:image/')) {
                fileHtml = `<div style="margin-top: 0.5rem;"><img src="${fileData}" alt="${fileName}" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>`;
            } else {
                fileHtml = `
              <div style="margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.4rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem;">
                📎 <a href="${fileData}" download="${fileName}" style="color: #60a5fa; text-decoration: underline; font-size: 0.8rem; word-break: break-all;">${fileName}</a>
              </div>
            `;
            }
        }

        return `
          <div style="display: flex; gap: 0.6rem; align-items: flex-end; ${isMe ? 'flex-direction: row-reverse;' : ''}">
            <img src="${sender.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sender.name)}" 
                 alt="${sender.name}" 
                 style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
            
            <div style="max-width: 70%; background: ${isMe ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--bg-input, #1f2937)'}; border: 1px solid ${isMe ? 'transparent' : 'var(--border-color, #374151)'}; border-radius: 12px; ${isMe ? 'border-bottom-right-radius: 2px;' : 'border-bottom-left-radius: 2px;'} padding: 0.6rem 0.85rem; color: #fff;">
              ${!isMe ? `<div style="font-size: 0.7rem; font-weight: 700; color: #a5b4fc; margin-bottom: 0.2rem;">${sender.name}</div>` : ''}
              ${msg.content ? `<div style="font-size: 0.85rem; line-height: 1.4; word-break: break-word;">${msg.content}</div>` : ''}
              ${fileHtml}
              <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6); text-align: right; margin-top: 0.25rem;">${timeStr}</div>
            </div>
          </div>
        `;
    },

    /**
     * Configura a escuta em tempo real (Supabase Realtime) para novas mensagens
     */
    setupRealtimeChat() {
        if (!DB.supabase) return;

        // Se já existir um canal ativo, cancela para não duplicar escutas
        if (activeChatChannel) {
            DB.supabase.removeChannel(activeChatChannel);
        }

        activeChatChannel = DB.supabase
            .channel('chat-realtime-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                async (payload) => {
                    console.log('💬 Nova mensagem recebida via Realtime:', payload.new);

                    // Recarrega a seção de chat instantaneamente ao receber novas mensagens
                    await this.renderChatSection();
                }
            )
            .subscribe((status) => {
                console.log('📡 Status do Realtime no Chat:', status);
            });
    },

    /**
     * Configura os ouvintes do formulário, upload de arquivo e picker de emojis
     */
    setupListeners() {
        const form = document.getElementById('form-chat-send');
        if (!form || form.dataset.listenerBound) return;
        form.dataset.listenerBound = 'true';

        const inputMsg = document.getElementById('chat-input-message');
        const inputFile = document.getElementById('chat-input-file');
        const previewBar = document.getElementById('chat-file-preview-bar');
        const previewName = document.getElementById('chat-file-preview-name');
        const btnRemoveFile = document.getElementById('btn-chat-remove-file');
        const btnEmojiToggle = document.getElementById('btn-chat-toggle-emoji');
        const emojiPicker = document.getElementById('chat-emoji-picker');

        // Toggle do Picker de Emojis
        if (btnEmojiToggle && emojiPicker) {
            btnEmojiToggle.addEventListener('click', () => {
                const isHidden = emojiPicker.style.display === 'none';
                emojiPicker.style.display = isHidden ? 'grid' : 'none';
            });

            emojiPicker.querySelectorAll('.btn-emoji-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (inputMsg) {
                        inputMsg.value += item.textContent;
                        inputMsg.focus();
                    }
                    emojiPicker.style.display = 'none';
                });
            });
        }

        // Leitura e carregamento de Arquivo
        if (inputFile) {
            inputFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        alert('Por favor, selecione arquivos de até 5MB.');
                        inputFile.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        pendingFileBase64 = evt.target.result;
                        pendingFileName = file.name;

                        if (previewBar && previewName) {
                            previewName.textContent = `📎 ${file.name}`;
                            previewBar.style.display = 'flex';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Remoção do Anexo
        if (btnRemoveFile) {
            btnRemoveFile.addEventListener('click', () => {
                pendingFileBase64 = null;
                pendingFileName = null;
                if (inputFile) inputFile.value = '';
                if (previewBar) previewBar.style.display = 'none';
            });
        }

        // Submissão da Mensagem
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = inputMsg ? inputMsg.value.trim() : '';
            const loggedMemberId = localStorage.getItem('logged_member_id');

            if (!content && !pendingFileBase64) return;

            const newMessage = {
                id: 'msg-' + Date.now(),
                sender_id: loggedMemberId,
                content: content,
                file_data: pendingFileBase64,
                file_name: pendingFileName,
                created_at: new Date().toISOString()
            };

            try {
                await DB.save('messages', newMessage);

                // Limpa campos
                if (inputMsg) inputMsg.value = '';
                if (inputFile) inputFile.value = '';
                pendingFileBase64 = null;
                pendingFileName = null;
                if (previewBar) previewBar.style.display = 'none';
                if (emojiPicker) emojiPicker.style.display = 'none';

                // A própria resposta do Realtime ou a chamada abaixo vai atualizar a tela na hora
                await this.renderChatSection();
            } catch (err) {
                console.error('Erro ao enviar mensagem:', err);
                alert('Não foi possível enviar a mensagem ou anexo.');
            }
        });
    }
};