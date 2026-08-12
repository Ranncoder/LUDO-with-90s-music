/* =========================================
   DOM Elements Selection
   ========================================= */
// Connection UI
const myIdDisplay = document.getElementById('my-id');
const friendIdInput = document.getElementById('friend-id');
const connectBtn = document.getElementById('connect-btn');
const connectionStatus = document.getElementById('connection-status');

// Chat UI
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessagesArea = document.getElementById('chat-messages');

// Game UI (Canvas)
const canvas = document.getElementById('ludo-board');
const ctx = canvas.getContext('2d');
const rollBtn = document.getElementById('roll-btn');

/* =========================================
   PeerJS Initialization (Multiplayer Logic)
   ========================================= */
// Initialize PeerJS. Calling new Peer() connects to PeerJS's free cloud broker server 
// just long enough to trade IP addresses with your friend.
const peer = new Peer();
let connection = null; // This will hold our active data connection

// 1. When PeerJS successfully generates our ID
peer.on('open', (id) => {
    myIdDisplay.innerText = id;
    console.log('My Peer ID is: ' + id);
});

// 2. When a friend connects to US (We are the host)
peer.on('connection', (conn) => {
    // If we are already connected to someone, reject new connections
    if (connection) {
        conn.close();
        return;
    }
    connection = conn;
    setupConnectionHandlers();
});

// 3. When WE click "Join Game" to connect to a friend
connectBtn.addEventListener('click', () => {
    const friendId = friendIdInput.value.trim();
    if (!friendId) {
        alert("Please enter a friend's ID");
        return;
    }
    
    connectionStatus.innerText = "Connecting...";
    // Initiate connection to the friend's ID
    connection = peer.connect(friendId);
    setupConnectionHandlers();
});

/* =========================================
   Connection Event Handlers
   ========================================= */
function setupConnectionHandlers() {
    // When the connection is successfully opened
    connection.on('open', () => {
        connectionStatus.innerText = "Status: Connected! 🟢";
        connectionStatus.style.color = "#69f0ae"; // Neon Green
        
        // Disable connection inputs, enable chat
        friendIdInput.disabled = true;
        connectBtn.disabled = true;
        chatInput.disabled = false;
        sendBtn.disabled = false;
        rollBtn.disabled = false; // We'll use this later for the dice

        addChatMessage("System", "Connection established! You can now chat.", "system-msg");
    });

    // When we receive data (messages or game moves) from our friend
    connection.on('data', (data) => {
        // We will send data as objects: { type: 'chat', content: 'hello' }
        if (data.type === 'chat') {
            addChatMessage("Friend", data.content, "friend-msg");
        }
        // Later, we will add: if (data.type === 'move') { ... }
    });

    // When the friend disconnects or refreshes the page
    connection.on('close', () => {
        connectionStatus.innerText = "Status: Disconnected 🔴";
        connectionStatus.style.color = "#ef5350"; // Red
        
        // Disable chat
        chatInput.disabled = true;
        sendBtn.disabled = true;
        rollBtn.disabled = true;
        
        addChatMessage("System", "Your friend disconnected.", "system-msg");
        connection = null; // Reset connection
    });
}

/* =========================================
   Chat Box Logic
   ========================================= */
function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text && connection && connection.open) {
        // Send data to friend
        connection.send({
            type: 'chat',
            content: text
        });
        
        // Show message on our own screen
        addChatMessage("You", text, "my-msg");
        chatInput.value = ''; // Clear input
    }
}

// Listen for Send button click
sendBtn.addEventListener('click', sendChatMessage);

// Listen for Enter key in chat input
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function addChatMessage(sender, text, cssClass) {
    const msgElement = document.createElement('p');
    msgElement.className = cssClass; // Assign class for styling
    
    // Style the sender name differently based on who sent it
    const senderColor = sender === "You" ? "#4fc3f7" : (sender === "Friend" ? "#ffca28" : "#888");
    
    msgElement.innerHTML = `<strong style="color: ${senderColor}">${sender}:</strong> ${text}`;
    
    chatMessagesArea.appendChild(msgElement);
    
    // Auto-scroll to the bottom of the chat
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
}

/* =========================================
   Canvas Placeholder (Next Step)
   ========================================= */
// Draw a temporary message on the canvas so you know it's working
ctx.fillStyle = "#1e1e24";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#ffffff";
ctx.font = "20px sans-serif";
ctx.textAlign = "center";
ctx.fillText("Board Loading...", canvas.width/2, canvas.height/2);