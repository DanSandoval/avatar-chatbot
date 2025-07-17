// Load D-ID API configuration from api.json
let API_KEY = null;
let DID_API_URL = null;
let DID_WEBSOCKET_URL = null;
let SERVICE_TYPE = null;

// Streaming client instance
let streamingClient = null;
let isConnected = false;

// Unified Realtime chat instance (renamed from voiceChat)
let realtimeChat = null;
let voiceMode = false;

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

// Expose to window for cross-file access
window.addMessage = addMessage;

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
        
        // Expose to window for cross-file access
        window.streamingClient = streamingClient;
        
        // Track if we've sent the greeting
        let greetingSent = false;
        
        // Set up stream ready handler
        streamingClient.setStreamReadyHandler(() => {
            console.log('Stream is ready!');
            updateStatus('Avatar ready to speak!');
            
            // Send initial greeting only if not already sent
            if (!greetingSent) {
                greetingSent = true;
                makeAvatarSpeak("Hi there, explorer! I'm Dr. Elias Grant! Ready to discover some amazing dinosaur facts? What's your favorite dinosaur?");
            }
        });
        
        // Fallback: If no stream ready event after 3 seconds, assume ready
        setTimeout(() => {
            if (isConnected && !streamingClient.isStreamReady && !greetingSent) {
                console.log('Forcing stream ready from app.js after timeout');
                updateStatus('Avatar ready to speak! (forced)');
                greetingSent = true;
                makeAvatarSpeak("Hi there, explorer! I'm Dr. Elias Grant! Ready to discover some amazing dinosaur facts? What's your favorite dinosaur?");
            }
        }, 3000);
        
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
                
                // Enable voice button
                const voiceBtn = document.getElementById('voice-button');
                if (voiceBtn) {
                    voiceBtn.disabled = false;
                }
                
                // Initialize Realtime API connection
                initializeRealtimeChat();
            } else if (state === 'disconnected' || state === 'failed') {
                isConnected = false;
                loadingIndicator.classList.add('hidden');
                updateStatus('Avatar disconnected');
                
                // Reset controls
                userInput.disabled = true;
                sendButton.disabled = true;
                destroyButton.disabled = true;
                connectButton.disabled = false;
                
                // Disconnect button is always visible, just enable/disable it
            }
        });
        
        // Get selected avatar URL
        const avatarUrl = avatarSelector ? avatarSelector.getCurrentAvatar() : "https://i.imgur.com/SXwWFEf.png";
        console.log('Avatar URL:', avatarUrl, 'avatarSelector:', avatarSelector);
        
        // Connect to streaming service with selected avatar
        await streamingClient.connect(avatarUrl);
        
    } catch (error) {
        loadingIndicator.classList.add('hidden');
        updateStatus('Connection failed: ' + error.message);
        console.error('Streaming error:', error);
        
        // Reset button states
        connectButton.disabled = false;
        destroyButton.disabled = true;
        
        // Disconnect button is always visible, just enable/disable it
    }
}

// Speech queue management
let speechQueue = [];
let isSpeaking = false;

// Process speech queue
async function processSpeechQueue() {
    if (isSpeaking || speechQueue.length === 0 || !streamingClient || !isConnected) {
        return;
    }
    
    isSpeaking = true;
    const text = speechQueue.shift();
    
    try {
        updateStatus('Avatar is speaking...');
        await streamingClient.speak(text);
        
        // Wait for avatar to finish speaking
        // Estimate based on text length (roughly 50ms per character)
        const estimatedDuration = Math.max(2000, text.length * 50);
        await new Promise(resolve => setTimeout(resolve, estimatedDuration));
        
        updateStatus('Ready');
    } catch (error) {
        updateStatus('Speaking failed: ' + error.message);
        console.error('Speak error:', error);
        
        // If it's a 400 error, wait longer before continuing
        if (error.message.includes('400') || error.message.includes('Bad Request')) {
            console.log('Stream busy, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } finally {
        isSpeaking = false;
        // Process next item in queue after a short delay
        setTimeout(processSpeechQueue, 500);
    }
}

// Make avatar speak
async function makeAvatarSpeak(text) {
    if (!streamingClient || !isConnected) {
        console.error('Not connected to avatar');
        return;
    }
    
    // Add to queue and process
    speechQueue.push(text);
    processSpeechQueue();
}

// Expose functions to window for cross-file access
window.makeAvatarSpeak = makeAvatarSpeak;
// Create a getter for isConnected since it changes
Object.defineProperty(window, 'isConnected', {
    get: function() { return isConnected; }
});

// Initialize Realtime API connection
async function initializeRealtimeChat() {
    try {
        const openAIKey = await getOpenAIKey();
        if (!openAIKey) {
            console.log('OpenAI API key not available');
            return;
        }
        
        // Create unified chat instance (using VoiceChat class)
        realtimeChat = new VoiceChat();
        // Start with silent audio (text-only mode)
        await realtimeChat.start(openAIKey, false);
        
        updateStatus('AI connection established');
    } catch (error) {
        console.error('Failed to initialize Realtime chat:', error);
        updateStatus('AI connection failed');
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
        if (realtimeChat && realtimeChat.isConnected()) {
            // Use Realtime API
            await realtimeChat.sendTextMessage(message);
            // Response will come through handleAIResponse callback
        } else {
            // Fallback to REST API
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
        }
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
    // Stop Realtime connection
    if (realtimeChat) {
        try {
            await realtimeChat.stop();
            realtimeChat = null;
        } catch (error) {
            console.error('Realtime disconnect error:', error);
        }
    }
    
    // Stop avatar streaming
    if (streamingClient) {
        try {
            await streamingClient.disconnect();
            streamingClient = null;
            isConnected = false;
        } catch (error) {
            console.error('Avatar disconnect error:', error);
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

// Create and add voice button
function createVoiceButton() {
    const voiceBtn = document.createElement('button');
    voiceBtn.id = 'voice-button';
    voiceBtn.innerHTML = '<span class="voice-icon">🎤</span><span class="voice-text">Voice</span>';
    voiceBtn.className = 'voice-button';
    voiceBtn.disabled = true; // Enable after avatar connects
    voiceBtn.title = 'Voice Chat';
    
    // Find the main controls row (first row with Start Call button)
    const mainControls = document.querySelector('#main-controls');
    if (mainControls) {
        mainControls.appendChild(voiceBtn);
    } else {
        // Fallback: try to find any controls container
        const controls = document.querySelector('.controls') || document.querySelector('.chat-controls');
        if (controls) {
            controls.appendChild(voiceBtn);
        } else {
            // Final fallback: add to chat container
            const chatContainer = document.querySelector('.chat-container') || document.body;
            voiceBtn.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; z-index: 1000;';
            chatContainer.appendChild(voiceBtn);
        }
    }
    
    // Voice button click handler
    voiceBtn.addEventListener('click', toggleVoiceMode);
    
    return voiceBtn;
}

// Toggle voice mode
async function toggleVoiceMode() {
    const voiceBtn = document.getElementById('voice-button');
    
    if (!voiceMode) {
        try {
            // Check if Realtime connection exists
            if (!realtimeChat || !realtimeChat.isConnected()) {
                updateStatus('AI connection not ready');
                return;
            }
            
            // Start voice mode
            voiceMode = true;
            voiceBtn.innerHTML = '🔴 Voice Active';
            voiceBtn.style.background = '#dc3545';
            
            // Enable voice in the unified chat
            await realtimeChat.enableVoice();
            
            // Hide text input
            userInput.disabled = true;
            sendButton.disabled = true;
            userInput.placeholder = 'Voice mode active - speak to chat';
            
            updateStatus('Voice chat active - speak naturally!');
            
        } catch (error) {
            console.error('Failed to start voice:', error);
            updateStatus('Voice chat failed: ' + error.message);
            voiceMode = false;
            voiceBtn.innerHTML = '🎤 Voice Chat';
            voiceBtn.style.background = '#007bff';
        }
    } else {
        // Stop voice mode
        voiceMode = false;
        voiceBtn.innerHTML = '🎤 Voice Chat';
        voiceBtn.style.background = '#007bff';
        
        if (realtimeChat) {
            await realtimeChat.disableVoice();
        }
        
        // Re-enable text input
        if (isConnected) {
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.placeholder = 'Type your message...';
        }
        
        updateStatus('Voice chat stopped');
    }
}

// Handle AI response from voice chat
window.handleAIResponse = async function(text) {
    // Add AI response to chat display
    addMessage(text, false);
    
    // Make avatar speak
    if (streamingClient && isConnected) {
        await makeAvatarSpeak(text);
    }
};

// Handle voice disconnection
window.handleVoiceDisconnected = function() {
    if (voiceMode) {
        const voiceBtn = document.getElementById('voice-button');
        voiceMode = false;
        voiceBtn.innerHTML = '🎤 Voice Chat';
        voiceBtn.style.background = '#007bff';
        
        if (isConnected) {
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.placeholder = 'Type your message...';
        }
        
        updateStatus('Voice chat disconnected');
    }
};

// Get OpenAI API key
async function getOpenAIKey() {
    try {
        // First check if it's in .env on server
        const response = await fetch('/api/openai-key');
        if (response.ok) {
            const data = await response.json();
            return data.key;
        }
    } catch (error) {
        console.log('No server-side OpenAI key, checking client config');
    }
    
    // Fallback to client-side config (not recommended for production)
    return window.OPENAI_API_KEY || null;
}

// Dinosaur facts array
const dinosaurFacts = [
    "T-Rex arms were actually super strong - each arm could lift 400 pounds!",
    "The longest dinosaur was Argentinosaurus, stretching up to 115 feet long!",
    "Velociraptors were only about the size of a turkey, not as big as in movies!",
    "Some dinosaurs swallowed stones to help grind up food in their stomachs!",
    "The smallest dinosaur ever found was only 16 inches long - about the size of a crow!",
    "Dinosaurs lived on every continent, including Antarctica!",
    "Many dinosaurs had feathers, not just scales!",
    "The word 'dinosaur' means 'terrible lizard' in Greek!",
    "Some dinosaurs could run up to 45 mph - faster than a racehorse!",
    "The largest dinosaur eggs were about the size of a football!",
    "Triceratops had up to 800 teeth for grinding plants!",
    "Dinosaurs ruled the Earth for over 165 million years!",
    "The first dinosaur fossil was discovered in 1824!",
    "Some meat-eating dinosaurs were cannibals!",
    "Stegosaurus had a brain the size of a walnut!",
    "Brachiosaurus' heart weighed as much as 400 pounds!",
    "Many dinosaurs traveled in herds for protection!",
    "Some dinosaurs could swim, but none could fly - those were pterosaurs!",
    "The loudest dinosaur was probably Parasaurolophus with its trumpet-like crest!",
    "Baby dinosaurs are called hatchlings!"
];

let currentFactIndex = 0;
let factRotationInterval = null;

// Function to update the dinosaur fact with fade effect
function updateDinosaurFact() {
    const factElement = document.getElementById('dino-fact');
    if (!factElement) return;
    
    // Fade out
    factElement.style.opacity = '0';
    
    setTimeout(() => {
        // Update fact
        currentFactIndex = (currentFactIndex + 1) % dinosaurFacts.length;
        factElement.textContent = dinosaurFacts[currentFactIndex];
        
        // Fade in
        factElement.style.opacity = '1';
    }, 300);
}

// Start rotating facts
function startFactRotation() {
    // Clear any existing interval
    if (factRotationInterval) {
        clearInterval(factRotationInterval);
    }
    
    // Rotate every 25 seconds
    factRotationInterval = setInterval(updateDinosaurFact, 25000);
}

// Initialize on page load
window.addEventListener('load', async () => {
    await loadAPIConfig();
    updateStatus('Ready to connect');
    
    // Create voice button
    const voiceBtn = createVoiceButton();
    
    // Start fact rotation
    startFactRotation();
    
    // Add transition for smooth fade effect
    const factElement = document.getElementById('dino-fact');
    if (factElement) {
        factElement.style.transition = 'opacity 0.3s ease-in-out';
    }
});