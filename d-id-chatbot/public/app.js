// Load D-ID API configuration from api.json
let API_KEY = null;
let DID_API_URL = null;
let DID_WEBSOCKET_URL = null;
let SERVICE_TYPE = null;

// Streaming client instance
let streamingClient = null;
let isConnected = false;

// DOM elements
const connectButton = document.getElementById('connect-button');
const destroyButton = document.getElementById('destroy-button');
const talkVideo = document.getElementById('talk-video');
const loadingIndicator = document.getElementById('loading-indicator');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatHistory = document.getElementById('chat-history');
const statusElement = document.getElementById('status');

// Load API configuration
async function loadAPIConfig() {
    try {
        // First get the service configuration
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        
        // Then load the full API config including the key
        const apiResponse = await fetch('/api.json');
        const apiConfig = await apiResponse.json();
        
        API_KEY = apiConfig.key;
        DID_API_URL = config.url;
        DID_WEBSOCKET_URL = config.websocketUrl;
        SERVICE_TYPE = config.service;
        
        updateStatus('API configuration loaded');
    } catch (error) {
        updateStatus('Failed to load API configuration: ' + error.message);
        console.error('Config error:', error);
    }
}

// Update status message
function updateStatus(message) {
    statusElement.textContent = message;
    console.log('Status:', message);
}

// Add message to chat history
function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = text;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Initialize streaming client
async function initializeStreamingClient() {
    if (!API_KEY) {
        updateStatus('API key not loaded');
        return;
    }
    
    try {
        loadingIndicator.classList.remove('hidden');
        updateStatus('Connecting to avatar...');
        
        // Configure streaming client
        const configuration = {
            service: SERVICE_TYPE,
            key: API_KEY,
            url: DID_API_URL,
            wsUrl: DID_WEBSOCKET_URL
        };
        
        // Create streaming client instance
        streamingClient = new StreamingApiClient(configuration, talkVideo);
        
        // Set up stream ready handler
        streamingClient.setStreamReadyHandler(() => {
            console.log('Stream is ready!');
            updateStatus('Avatar ready to speak!');
            
            // Send initial greeting now that stream is ready
            makeAvatarSpeak("Hello! I'm your AI assistant. How can I help you today?");
        });
        
        // Set up event handlers
        streamingClient.setConnectionStateChangeHandler((state) => {
            console.log('Connection state:', state);
            
            if (state === 'connected') {
                isConnected = true;
                loadingIndicator.classList.add('hidden');
                updateStatus('Avatar connected, waiting for stream initialization...');
                
                // Enable chat controls
                userInput.disabled = false;
                sendButton.disabled = false;
                destroyButton.disabled = false;
                connectButton.disabled = true;
            } else if (state === 'disconnected' || state === 'failed') {
                isConnected = false;
                loadingIndicator.classList.add('hidden');
                updateStatus('Avatar disconnected');
                
                // Reset controls
                userInput.disabled = true;
                sendButton.disabled = true;
                destroyButton.disabled = true;
                connectButton.disabled = false;
            }
        });
        
        // Get selected avatar URL
        const avatarUrl = avatarSelector ? avatarSelector.getCurrentAvatar() : null;
        
        // Connect to streaming service with selected avatar
        await streamingClient.connect(avatarUrl);
        
    } catch (error) {
        loadingIndicator.classList.add('hidden');
        updateStatus('Connection failed: ' + error.message);
        console.error('Streaming error:', error);
        
        // Reset button states
        connectButton.disabled = false;
        destroyButton.disabled = true;
    }
}

// Make avatar speak
async function makeAvatarSpeak(text) {
    if (!streamingClient || !isConnected) {
        console.error('Not connected to avatar');
        return;
    }
    
    try {
        updateStatus('Avatar is speaking...');
        await streamingClient.speak(text);
        updateStatus('Ready');
    } catch (error) {
        updateStatus('Speaking failed: ' + error.message);
        console.error('Speak error:', error);
    }
}

// Send message to AI and get response
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, true);
    userInput.value = '';
    
    // Disable input while processing
    userInput.disabled = true;
    sendButton.disabled = true;
    updateStatus('Getting AI response...');
    
    try {
        // Get AI response
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get AI response');
        }
        
        const data = await response.json();
        const aiResponse = data.response;
        
        // Add AI response to chat
        addMessage(aiResponse, false);
        
        // Make avatar speak the response
        await makeAvatarSpeak(aiResponse);
        
    } catch (error) {
        updateStatus('Error: ' + error.message);
        console.error('Chat error:', error);
    } finally {
        // Re-enable input
        if (isConnected) {
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }
}

// Disconnect avatar
async function disconnectAvatar() {
    if (streamingClient) {
        try {
            await streamingClient.disconnect();
            streamingClient = null;
            isConnected = false;
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    }
}

// Event listeners
connectButton.addEventListener('click', initializeStreamingClient);
destroyButton.addEventListener('click', disconnectAvatar);
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Initialize on page load
window.addEventListener('load', async () => {
    await loadAPIConfig();
    updateStatus('Ready to connect');
});