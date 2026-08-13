/**
 * Módulo de Chat Interno da Equipe com Auto-Sync e Supabase Realtime
 */

import { DB } from './db.js';

let pendingFileBase64 = null;
let pendingFileName = null;
let chatPollingInterval = null;

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

        // Limpa o badge de aviso do botão de menu ao abrir o chat
        const btnChat = document.getElementById('btn-view-chat');
        if (btnChat) {
            btnChat.innerHTML = `💬 Chat Geral`;
        }

        await this.syncMessages();
        this.setupListeners();
        this.startAutoSync();
    },

    /**
     * Sincroniza e insere mensagens novas na DOM em segundo plano
     */
    async syncMessages() {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        let messages = [];
        let members = [];

        try {
            messages = (await DB.getAll('messages')) || [];
            members = (await DB.getAll('members')) || [];
        } catch (e) {
            console.warn('⚡ Erro ao buscar mensagens do chat:', e);
            return;
        }

        const membersMap = new Map(members.map(m => [String(m.id), m]));
        const loggedMemberId = localStorage.getItem('logged_member_id');

        if (!messages || messages.length === 0) {
            if (!container.querySelector('#no-messages-notice') && container.children.length === 0) {
                container.innerHTML = `
                  <div id="no-messages-notice" style="text-align: center; color: var(--text-dim, #6b7280); font-size: 0.85rem; margin: auto; padding: 2rem;">
                    👋 Nenhuma mensagem ainda. Seja o primeiro a enviar um oi para a equipe!
                  </div>
                `;
            }
            return;
        }

        // Ordena por data
        messages.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));

        // Remove aviso de "Sem mensagens" se houver novas
        const notice = document.getElementById('no-messages-notice');

        let hasNewMessages = false;
        let isIncomingFromOther = false;
        let lastIncomingSenderName = '';
        let lastIncomingContent = '';

        // Insere apenas as mensagens que AINDA NÃO ESTÃO no container da tela
        messages.forEach(msg => {
            const existingMsg = container.querySelector(`[data-id="${msg.id}"]`);
            if (!existingMsg) {
                if (notice) notice.remove();
                const msgHtml = this.buildMessageHtml(msg, membersMap, loggedMemberId);
                container.insertAdjacentHTML('beforeend', msgHtml);
                hasNewMessages = true;

                const senderId = msg.sender_id || msg.senderId;
                if (loggedMemberId && String(senderId).trim() !== String(loggedMemberId).trim()) {
                    isIncomingFromOther = true;
                    const senderObj = membersMap.get(String(senderId));
                    lastIncomingSenderName = senderObj ? senderObj.name : 'Colega de Equipe';
                    lastIncomingContent = msg.content || (msg.file_data ? '📎 Arquivo anexado' : 'Nova mensagem');
                }
            }
        });

        // Se chegaram mensagens novas, rola para o final
        if (hasNewMessages) {
            container.scrollTop = container.scrollHeight;

            // Se for mensagem vinda de outro membro e não for a primeira carga inicial da tela
            if (isIncomingFromOther && this.isInitialized) {
                // Toca o som de notificação em QUALQUER ABA da aplicação! 🔔
                this.playNotificationSound();

                const sectionChat = document.getElementById('section-chat');
                const isChatActive = sectionChat && sectionChat.classList.contains('active');

                // Se o usuário não estiver na aba do chat, exibe alerta visual e destaca o botão
                if (!isChatActive) {
                    const btnChat = document.getElementById('btn-view-chat');
                    if (btnChat) {
                        btnChat.innerHTML = `💬 Chat Geral <span style="background:#ef4444; color:#fff; font-size:0.7rem; padding:0.15rem 0.4rem; border-radius:10px; margin-left:0.25rem;">Novo!</span>`;
                    }
                }
            }
        }

        this.isInitialized = true;
    },

    /**
     * Inicia a checagem automática (Auto-Sync) em segundo plano em QUALQUER aba
     */
    startAutoSync() {
        if (chatPollingInterval) clearInterval(chatPollingInterval);

        // Busca silenciosa em segundo plano a cada 3 segundos mesmo fora da aba do chat
        chatPollingInterval = setInterval(() => {
            this.syncMessages();
        }, 3000);

        // Inscreve no Realtime para notificar na mesma hora
        this.setupRealtimeChat();
    },

    /**
     * Escuta em tempo real do Supabase para entregas instantâneas
     */
    setupRealtimeChat() {
        if (!DB.supabase) return;

        if (window.chatRealtimeChannel) {
            try { DB.supabase.removeChannel(window.chatRealtimeChannel); } catch (e) { }
        }

        window.chatRealtimeChannel = DB.supabase
            .channel('chat-global-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => { this.syncMessages(); }
            )
            .subscribe();
    },

    /**
     * Configuração dos eventos do formulário, emojis e anexos
     */
    setupListeners() {
        const btnTestSound = document.getElementById('btn-chat-test-sound');
        if (btnTestSound && !btnTestSound.dataset.bound) {
            btnTestSound.dataset.bound = 'true';
            btnTestSound.addEventListener('click', () => {
                this.playNotificationSound();
            });
        }

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

        if (btnRemoveFile) {
            btnRemoveFile.addEventListener('click', () => {
                pendingFileBase64 = null;
                pendingFileName = null;
                if (inputFile) inputFile.value = '';
                if (previewBar) previewBar.style.display = 'none';
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = inputMsg ? inputMsg.value.trim() : '';
            const loggedMemberId = localStorage.getItem('logged_member_id');

            if (!content && !pendingFileBase64) return;

            const newMessage = {
                id: 'msg-' + Date.now(),
                sender_id: loggedMemberId,
                senderId: loggedMemberId,
                content: content,
                file_data: pendingFileBase64,
                fileData: pendingFileBase64,
                file_name: pendingFileName,
                fileName: pendingFileName,
                created_at: new Date().toISOString()
            };

            try {
                await DB.save('messages', newMessage);
                await this.syncMessages();

                if (inputMsg) inputMsg.value = '';
                if (inputFile) inputFile.value = '';
                pendingFileBase64 = null;
                pendingFileName = null;
                if (previewBar) previewBar.style.display = 'none';
                if (emojiPicker) emojiPicker.style.display = 'none';

            } catch (err) {
                console.error('Erro ao enviar mensagem:', err);
                alert('Não foi possível enviar a mensagem ou anexo.');
            }
        });
    }
};