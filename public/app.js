// Chat Application
class ChatApp {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.messages = [];
        this.currentConversationId = null;
        this.isStreaming = false;
        this.apiKey = localStorage.getItem('kimi_api_key') || null;
        
        this.init();
    }

    init() {
        this.checkApiKey();
        this.setupEventListeners();
        this.loadConversations();
        this.setupMarked();
    }

    setupMarked() {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true
        });
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('chat_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chat_session_id', sessionId);
        }
        return sessionId;
    }

    checkApiKey() {
        if (!this.apiKey) {
            document.getElementById('apiKeyModal').classList.add('active');
        } else {
            this.setApiKey(this.apiKey);
        }
    }

    async setApiKey(key) {
        try {
            const response = await fetch('/api/set-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId, apiKey: key })
            });
            const data = await response.json();
            if (data.success) {
                this.apiKey = key;
                localStorage.setItem('kimi_api_key', key);
            }
        } catch (error) {
            console.error('Failed to set API key:', error);
        }
    }

    saveApiKey() {
        const key = document.getElementById('apiKeyInput').value.trim();
        if (key) {
            this.setApiKey(key);
            document.getElementById('apiKeyModal').classList.remove('active');
        }
    }

    setupEventListeners() {
        // Temperature slider
        const tempSlider = document.getElementById('temperature');
        const tempValue = document.getElementById('temperatureValue');
        tempSlider.addEventListener('input', (e) => {
            tempValue.textContent = e.target.value;
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal && modal.id !== 'apiKeyModal') {
                    modal.classList.remove('active');
                }
            });
        });

        // Load saved settings
        const savedSystemPrompt = localStorage.getItem('system_prompt');
        if (savedSystemPrompt) {
            document.getElementById('systemPrompt').value = savedSystemPrompt;
        }
        const savedTemp = localStorage.getItem('temperature');
        if (savedTemp) {
            document.getElementById('temperature').value = savedTemp;
            document.getElementById('temperatureValue').textContent = savedTemp;
        }
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    }

    toggleSettings() {
        document.getElementById('settingsModal').classList.toggle('active');
    }

    saveSettings() {
        const systemPrompt = document.getElementById('systemPrompt').value;
        const temperature = document.getElementById('temperature').value;
        
        localStorage.setItem('system_prompt', systemPrompt);
        localStorage.setItem('temperature', temperature);
        
        this.toggleSettings();
    }

    getSystemPrompt() {
        return localStorage.getItem('system_prompt') || 
            'You are Kimi, an AI assistant made by Moonshot AI. You are helpful, harmless, and honest.';
    }

    getTemperature() {
        return parseFloat(localStorage.getItem('temperature') || '0.6');
    }

    useExample(text) {
        document.getElementById('messageInput').value = text;
        this.autoResize(document.getElementById('messageInput'));
        document.getElementById('messageInput').focus();
    }

    newChat() {
        this.messages = [];
        this.currentConversationId = null;
        this.renderMessages();
        document.getElementById('welcomeScreen').style.display = 'flex';
    }

    clearChat() {
        if (this.messages.length === 0) return;
        if (confirm('Clear this conversation?')) {
            this.newChat();
        }
    }

    async loadConversations() {
        // Load from localStorage for now
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        this.renderConversationsList(conversations);
    }

    renderConversationsList(conversations) {
        const container = document.getElementById('conversationsList');
        
        if (conversations.length === 0) {
            container.innerHTML = '<div style="padding: 16px; color: var(--text-tertiary); font-size: 14px; text-align: center;">No conversations yet</div>';
            return;
        }

        container.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}" 
                 onclick="chatApp.loadConversation('${conv.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="title">${this.escapeHtml(conv.title || 'New Chat')}</span>
                <button class="delete-btn" onclick="event.stopPropagation(); chatApp.deleteConversation('${conv.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    loadConversation(id) {
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        const conv = conversations.find(c => c.id === id);
        if (conv) {
            this.currentConversationId = id;
            this.messages = conv.messages || [];
            this.renderMessages();
            this.loadConversations(); // Refresh active state
        }
    }

    deleteConversation(id) {
        if (!confirm('Delete this conversation?')) return;
        
        let conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        conversations = conversations.filter(c => c.id !== id);
        localStorage.setItem('conversations', JSON.stringify(conversations));
        
        if (this.currentConversationId === id) {
            this.newChat();
        } else {
            this.loadConversations();
        }
    }

    saveConversation() {
        if (this.messages.length === 0) return;
        
        let conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        
        const title = this.messages.find(m => m.role === 'user')?.content.slice(0, 50) || 'New Chat';
        const convData = {
            id: this.currentConversationId || 'conv_' + Date.now(),
            title: title,
            messages: this.messages,
            updatedAt: new Date().toISOString()
        };
        
        const existingIndex = conversations.findIndex(c => c.id === convData.id);
        if (existingIndex >= 0) {
            conversations[existingIndex] = convData;
        } else {
            conversations.unshift(convData);
            this.currentConversationId = convData.id;
        }
        
        localStorage.setItem('conversations', JSON.stringify(conversations));
        this.loadConversations();
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        
        if (!text || this.isStreaming) return;
        
        if (!this.apiKey) {
            document.getElementById('apiKeyModal').classList.add('active');
            return;
        }

        // Add user message
        this.messages.push({ role: 'user', content: text });
        this.renderMessages();
        
        input.value = '';
        input.style.height = 'auto';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Send to API
        await this.streamResponse();
    }

    showTypingIndicator() {
        const container = document.getElementById('messagesContainer');
        document.getElementById('welcomeScreen').style.display = 'none';
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar">K</div>
                <div class="message-body">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    async streamResponse() {
        this.isStreaming = true;
        document.getElementById('sendBtn').disabled = true;
        
        const model = document.getElementById('modelSelect').value;
        const systemPrompt = this.getSystemPrompt();
        
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...this.messages
        ];

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': this.sessionId
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: model,
                    temperature: this.getTemperature()
                })
            });

            this.removeTypingIndicator();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to get response');
            }

            // Create assistant message container
            const messageId = 'msg_' + Date.now();
            this.messages.push({ role: 'assistant', content: '' });
            this.renderMessages();
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                this.messages[this.messages.length - 1].content = fullContent;
                                this.updateLastMessage(fullContent);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // Save conversation after completion
            this.saveConversation();

        } catch (error) {
            this.removeTypingIndicator();
            this.showError(error.message);
            // Remove the failed assistant message
            if (this.messages[this.messages.length - 1]?.role === 'assistant' && 
                this.messages[this.messages.length - 1]?.content === '') {
                this.messages.pop();
            }
        } finally {
            this.isStreaming = false;
            document.getElementById('sendBtn').disabled = false;
        }
    }

    updateLastMessage(content) {
        const container = document.getElementById('messagesContainer');
        const messages = container.querySelectorAll('.message.assistant');
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage) {
            const body = lastMessage.querySelector('.message-text');
            if (body) {
                body.innerHTML = this.formatMessage(content);
                this.addCodeCopyButtons(lastMessage);
            }
        }
        container.scrollTop = container.scrollHeight;
    }

    formatMessage(content) {
        // Process markdown
        let html = marked.parse(content);
        
        // Clean up any unclosed tags
        const div = document.createElement('div');
        div.innerHTML = html;
        
        return div.innerHTML;
    }

    addCodeCopyButtons(messageEl) {
        const codeBlocks = messageEl.querySelectorAll('pre code');
        codeBlocks.forEach(codeBlock => {
            const pre = codeBlock.parentElement;
            if (pre.parentElement.classList.contains('code-block-wrapper')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(codeBlock.textContent);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy', 2000);
            };
            wrapper.appendChild(copyBtn);
        });
    }

    renderMessages() {
        const container = document.getElementById('messagesContainer');
        
        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="welcome-screen" id="welcomeScreen">
                    <div class="welcome-content">
                        <h1>Kimi Chat</h1>
                        <p class="subtitle">Powered by Moonshot AI</p>
                        <div class="example-prompts">
                            <button class="example-prompt" onclick="chatApp.useExample('Explain quantum computing in simple terms')">
                                "Explain quantum computing in simple terms"
                            </button>
                            <button class="example-prompt" onclick="chatApp.useExample('Write a Python function to calculate fibonacci numbers')">
                                "Write a Python function to calculate fibonacci numbers"
                            </button>
                            <button class="example-prompt" onclick="chatApp.useExample('Help me debug this error: TypeError: cannot concatenate str and int')">
                                "Help me debug this TypeError..."
                            </button>
                            <button class="example-prompt" onclick="chatApp.useExample('Create a business plan for a sustainable coffee shop')">
                                "Create a business plan for a sustainable coffee shop"
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        document.getElementById('welcomeScreen')?.style.display = 'none';
        
        container.innerHTML = this.messages.map((msg, index) => `
            <div class="message ${msg.role}">
                <div class="message-content">
                    <div class="message-avatar">${msg.role === 'user' ? 'U' : 'K'}</div>
                    <div class="message-body">
                        <div class="message-text">${this.formatMessage(msg.content)}</div>
                        <div class="message-actions">
                            <button class="action-btn" onclick="chatApp.copyMessage(${index})">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                            </button>
                            ${msg.role === 'assistant' ? `
                            <button class="action-btn" onclick="chatApp.regenerate(${index})">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                </svg>
                                Regenerate
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add code copy buttons
        container.querySelectorAll('.message').forEach(msg => {
            this.addCodeCopyButtons(msg);
        });

        // Highlight code
        container.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });

        container.scrollTop = container.scrollHeight;
    }

    copyMessage(index) {
        const content = this.messages[index]?.content;
        if (content) {
            navigator.clipboard.writeText(content);
        }
    }

    regenerate(index) {
        if (this.messages[index]?.role !== 'assistant') return;
        
        // Remove assistant message and all after it
        this.messages = this.messages.slice(0, index);
        this.renderMessages();
        
        // Show typing and regenerate
        this.showTypingIndicator();
        this.streamResponse();
    }

    showError(message) {
        const container = document.getElementById('messagesContainer');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Error: ' + message;
        container.appendChild(errorDiv);
        container.scrollTop = container.scrollHeight;
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
const chatApp = new ChatApp();
