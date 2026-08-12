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
  /* =========================================
   Ludo Board Configuration & Drawing
   ========================================= */

// The Ludo board is mathematically a 15x15 grid.
const GRID_SIZE = 15;
// Calculate the size of a single tile based on the canvas width
const TILE_SIZE = canvas.width / GRID_SIZE; 

// Define standard Ludo colors
const COLORS = {
    RED: '#e53935',
    GREEN: '#43a047',
    YELLOW: '#fdd835',
    BLUE: '#1e88e5',
    WHITE: '#ffffff',
    BORDER: '#121212'
};

function drawBoard() {
    // 1. Clear the canvas with white background
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw the 15x15 Grid for the pathways
    ctx.strokeStyle = COLORS.BORDER;
    ctx.lineWidth = 1;
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // 3. Draw the Four Colored Corner Bases
    // A base takes up a 6x6 grid area in the corners
    drawBase(0, 0, COLORS.RED);             // Top Left
    drawBase(9 * TILE_SIZE, 0, COLORS.GREEN); // Top Right
    drawBase(0, 9 * TILE_SIZE, COLORS.BLUE);  // Bottom Left
    drawBase(9 * TILE_SIZE, 9 * TILE_SIZE, COLORS.YELLOW); // Bottom Right

    // 4. Draw the Home Triangle (Center 3x3 area)
    drawHomeCenter();

    // 5. Fill the Colored Home Columns (The path leading to the center)
    fillHomeColumns();

    // 6. Draw Safe Zone / Starting Tile colors
    drawSafeZones();
}

function drawBase(x, y, color) {
    // The main colored square
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 6 * TILE_SIZE, 6 * TILE_SIZE);
    
    // The inner white square where pawns sit before rolling a 6
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(x + TILE_SIZE, y + TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE);
    ctx.strokeRect(x + TILE_SIZE, y + TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE);

    // Draw 4 circle placeholders for pawns inside the base
    const offset = 1.5 * TILE_SIZE;
    const padding = 2 * TILE_SIZE;
    
    drawPawnPlaceholder(x + offset, y + offset, color);
    drawPawnPlaceholder(x + offset + padding, y + offset, color);
    drawPawnPlaceholder(x + offset, y + offset + padding, color);
    drawPawnPlaceholder(x + offset + padding, y + offset + padding, color);
}

function drawPawnPlaceholder(x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, TILE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
}

function drawHomeCenter() {
    const cx = 7.5 * TILE_SIZE;
    const cy = 7.5 * TILE_SIZE;
    const offset = 1.5 * TILE_SIZE;

    // Red Triangle (Left)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy - offset);
    ctx.lineTo(cx - offset, cy + offset);
    ctx.fillStyle = COLORS.RED;
    ctx.fill();
    ctx.stroke();

    // Green Triangle (Top)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy - offset);
    ctx.lineTo(cx + offset, cy - offset);
    ctx.fillStyle = COLORS.GREEN;
    ctx.fill();
    ctx.stroke();

    // Yellow Triangle (Right)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + offset, cy - offset);
    ctx.lineTo(cx + offset, cy + offset);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fill();
    ctx.stroke();

    // Blue Triangle (Bottom)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy + offset);
    ctx.lineTo(cx + offset, cy + offset);
    ctx.fillStyle = COLORS.BLUE;
    ctx.fill();
    ctx.stroke();
}

function fillHomeColumns() {
    // Red column (Left middle, moving right)
    ctx.fillStyle = COLORS.RED;
    for (let i = 1; i <= 5; i++) {
        ctx.fillRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Green column (Top middle, moving down)
    ctx.fillStyle = COLORS.GREEN;
    for (let i = 1; i <= 5; i++) {
        ctx.fillRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Yellow column (Right middle, moving left)
    ctx.fillStyle = COLORS.YELLOW;
    for (let i = 9; i <= 13; i++) {
        ctx.fillRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Blue column (Bottom middle, moving up)
    ctx.fillStyle = COLORS.BLUE;
    for (let i = 9; i <= 13; i++) {
        ctx.fillRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
}

function drawSafeZones() {
    // Helper function to color a specific tile
    const colorTile = (x, y, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    };

    // Starting squares (where a pawn lands after a 6)
    colorTile(1, 6, COLORS.RED);
    colorTile(8, 1, COLORS.GREEN);
    colorTile(13, 8, COLORS.YELLOW);
    colorTile(6, 13, COLORS.BLUE);

    // Star/Safe tiles (Usually gray or distinct in physical boards, we'll use a lighter shade of the color)
    colorTile(2, 8, '#ff8a80'); // Red safe
    colorTile(6, 2, '#69f0ae'); // Green safe
    colorTile(12, 6, '#ffe57f'); // Yellow safe
    colorTile(8, 12, '#82b1ff'); // Blue safe
}

// Call the function to draw the board immediately when the page loads
drawBoard();
   ========================================= */
// Draw a temporary message on the canvas so you know it's working
ctx.fillStyle = "#1e1e24";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#ffffff";
ctx.font = "20px sans-serif";
ctx.textAlign = "center";
ctx.fillText("Board Loading...", canvas.width/2, canvas.height/2);
