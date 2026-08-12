/* =========================================
   DOM Elements Selection
   ========================================= */
// Connection UI
const myIdDisplay = document.getElementById('my-id');
const friendIdInput = document.getElementById('friend-id');
const connectBtn = document.getElementById('connect-btn');
const connectionStatus = document.getElementById('connection-status');
const copyIdBtn = document.getElementById('copy-id');
const disconnectBtn = document.getElementById('disconnect-btn');

// Chat UI
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessagesArea = document.getElementById('chat-messages');

// Game UI (Canvas)
const canvas = document.getElementById('ludo-board');
const ctx = canvas.getContext && canvas.getContext('2d');
const rollBtn = document.getElementById('roll-btn');
const diceDisplay = document.getElementById('dice-display');

/* =========================================
   PeerJS Initialization (Multiplayer Logic)
   ========================================= */
let peer = null; // PeerJS instance
let connection = null; // Active data connection
let lastFriendId = null; // Keep the last friend ID we connected to (for reconnects)

// Guard: If PeerJS failed to load, disable multiplayer UI
function disableMultiplayerUI(reason) {
    connectionStatus.innerText = reason || 'Multiplayer unavailable.';
    connectionStatus.style.color = '#ef5350';
    connectBtn.disabled = true;
    friendIdInput.disabled = true;
    if (copyIdBtn) copyIdBtn.disabled = true;
}

if (typeof Peer === 'undefined') {
    disableMultiplayerUI('PeerJS not loaded. Multiplayer disabled.');
} else {
    peer = new Peer();

    // 1. When PeerJS successfully generates our ID
    peer.on('open', (id) => {
        myIdDisplay.innerText = id || 'n/a';
        console.log('My Peer ID is: ' + id);
        if (copyIdBtn) copyIdBtn.disabled = false;
    });

    // 2. When a friend connects to US (We are the host)
    peer.on('connection', (conn) => {
        // If we are already connected to someone, reject new connections
        if (connection) {
            conn.close();
            return;
        }
        connection = conn;
        lastFriendId = conn.peer;
        setupConnectionHandlers();
    });

    peer.on('error', (err) => {
        console.error('PeerJS error', err);
        addChatMessage('System', 'PeerJS error: ' + (err && err.type ? err.type : err), 'system-msg');
    });
}

// When WE click "Join Game" to connect to a friend
connectBtn.addEventListener('click', () => {
    if (!peer) {
        alert('Multiplayer is not available (PeerJS failed to load).');
        return;
    }

    const friendId = friendIdInput.value.trim();
    if (!friendId) {
        alert("Please enter a friend's ID");
        return;
    }

    lastFriendId = friendId;
    connectionStatus.innerText = 'Connecting...';
    connectionStatus.style.color = '#ffd54f';
    // Initiate connection to the friend's ID
    try {
        connection = peer.connect(friendId);
        setupConnectionHandlers();
    } catch (err) {
        console.error('Connection error', err);
        addChatMessage('System', 'Connection error: ' + err, 'system-msg');
    }
});

/* =========================================
   Connection Event Handlers
   ========================================= */
function setupConnectionHandlers() {
    if (!connection) return;

    // When the connection is successfully opened
    connection.on('open', () => {
        connectionStatus.innerText = 'Status: Connected! 🟢';
        connectionStatus.style.color = '#69f0ae'; // Neon Green

        // Disable connection inputs, enable chat
        friendIdInput.disabled = true;
        connectBtn.disabled = true;
        chatInput.disabled = false;
        sendBtn.disabled = false;
        if (rollBtn) rollBtn.disabled = false; // We'll use this later for the dice
        if (disconnectBtn) disconnectBtn.disabled = false;

        addChatMessage('System', 'Connection established! You can now chat.', 'system-msg');
    });

    // When we receive data (messages or game moves) from our friend
    connection.on('data', (data) => {
        // We will send data as objects: { type: 'chat', content: 'hello' }
        try {
            if (!data) return;
            if (data.type === 'chat') {
                addChatMessage('Friend', data.content, 'friend-msg');
            }
            // dice and moves will be handled in a later commit
        } catch (err) {
            console.error('Error handling incoming data', err);
        }
    });

    // When the friend disconnects or refreshes the page
    connection.on('close', () => {
        connectionStatus.innerText = 'Status: Disconnected 🔴';
        connectionStatus.style.color = '#ef5350'; // Red

        // Disable chat
        chatInput.disabled = true;
        sendBtn.disabled = true;
        if (rollBtn) rollBtn.disabled = true;
        if (disconnectBtn) disconnectBtn.disabled = true;

        addChatMessage('System', 'Your friend disconnected.', 'system-msg');
        connection = null; // Reset connection

        // Re-enable the ability to join or create a new connection
        friendIdInput.disabled = false;
        connectBtn.disabled = false;
    });
}

/* =========================================
   Chat Box Logic
   ========================================= */
function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // If we have a connection, send it
    if (connection && connection.open) {
        connection.send({
            type: 'chat',
            content: text
        });

        // Show message on our own screen
        addChatMessage('You', text, 'my-msg');
        chatInput.value = ''; // Clear input
        return;
    }

    // No connection: just show locally as info
    addChatMessage('You (local)', text, 'my-msg');
    chatInput.value = '';
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
    msgElement.className = cssClass || '';

    // Style the sender name differently based on who sent it
    const senderColor = sender === 'You' || sender.startsWith('You') ? '#4fc3f7' : (sender === 'Friend' ? '#ffca28' : '#888');

    msgElement.innerHTML = `<strong style="color: ${senderColor}">${sender}:</strong> ${escapeHtml(String(text))}`;

    chatMessagesArea.appendChild(msgElement);

    // Auto-scroll to the bottom of the chat
    chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
}

// Small helper to avoid HTML injection in chat messages
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/\"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/* =========================================
   Responsive Canvas & Drawing
   ========================================= */
// The Ludo board is a 15x15 grid.
const GRID_SIZE = 15;
let TILE_SIZE = 0; // calculated per-draw

// Define standard Ludo colors
const COLORS = {
    RED: '#e53935',
    GREEN: '#43a047',
    YELLOW: '#fdd835',
    BLUE: '#1e88e5',
    WHITE: '#ffffff',
    BORDER: '#121212'
};

// Make canvas crisp on HiDPI displays and responsive to its container
function fitCanvasToContainer() {
    if (!canvas || !canvas.parentElement || !ctx) return;

    // Make canvas width 100% of its container via CSS and then set internal pixel size
    const dpr = window.devicePixelRatio || 1;
    // Use parent width to determine the available space. Keep the canvas square.
    const parent = canvas.parentElement;
    const availableWidth = Math.min(parent.clientWidth - 30, window.innerHeight - 200) || parent.clientWidth;

    // Set CSS display size first
    canvas.style.width = availableWidth + 'px';
    canvas.style.height = availableWidth + 'px';

    // Set actual pixel size for high-DPI
    canvas.width = Math.round(availableWidth * dpr);
    canvas.height = Math.round(availableWidth * dpr);

    // Scale context so drawing operations are in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Recalculate tile size
    TILE_SIZE = (availableWidth) / GRID_SIZE;
}

function drawBoard() {
    if (!ctx || !canvas) return;

    // Ensure canvas fits container and TILE_SIZE is up-to-date
    fitCanvasToContainer();

    // 1. Clear the canvas with white background
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // 2. Draw the 15x15 Grid for the pathways
    ctx.strokeStyle = COLORS.BORDER;
    ctx.lineWidth = 1;
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // 3. Draw the Four Colored Corner Bases
    drawBase(0, 0, COLORS.RED);                         // Top Left
    drawBase(9 * TILE_SIZE, 0, COLORS.GREEN);           // Top Right
    drawBase(0, 9 * TILE_SIZE, COLORS.BLUE);            // Bottom Left
    drawBase(9 * TILE_SIZE, 9 * TILE_SIZE, COLORS.YELLOW); // Bottom Right

    drawHomeCenter();
    fillHomeColumns();
    drawSafeZones();
}

function drawBase(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 6 * TILE_SIZE, 6 * TILE_SIZE);

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(x + TILE_SIZE, y + TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE);
    ctx.strokeRect(x + TILE_SIZE, y + TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE);

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

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy - offset);
    ctx.lineTo(cx - offset, cy + offset);
    ctx.fillStyle = COLORS.RED;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy - offset);
    ctx.lineTo(cx + offset, cy - offset);
    ctx.fillStyle = COLORS.GREEN;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + offset, cy - offset);
    ctx.lineTo(cx + offset, cy + offset);
    ctx.fillStyle = COLORS.YELLOW;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - offset, cy + offset);
    ctx.lineTo(cx + offset, cy + offset);
    ctx.fillStyle = COLORS.BLUE;
    ctx.fill();
    ctx.stroke();
}

function fillHomeColumns() {
    ctx.fillStyle = COLORS.RED;
    for (let i = 1; i <= 5; i++) {
        ctx.fillRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    ctx.fillStyle = COLORS.GREEN;
    for (let i = 1; i <= 5; i++) {
        ctx.fillRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    ctx.fillStyle = COLORS.YELLOW;
    for (let i = 9; i <= 13; i++) {
        ctx.fillRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(i * TILE_SIZE, 7 * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    ctx.fillStyle = COLORS.BLUE;
    for (let i = 9; i <= 13; i++) {
        ctx.fillRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(7 * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
}

function drawSafeZones() {
    const colorTile = (x, y, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    };

    colorTile(1, 6, COLORS.RED);
    colorTile(8, 1, COLORS.GREEN);
    colorTile(13, 8, COLORS.YELLOW);
    colorTile(6, 13, COLORS.BLUE);

    colorTile(2, 8, '#ff8a80');
    colorTile(6, 2, '#69f0ae');
    colorTile(12, 6, '#ffe57f');
    colorTile(8, 12, '#82b1ff');
}

// Initial draw
if (ctx) {
    drawBoard();
} else {
    console.warn('Canvas 2D context not available.');
}

// Redraw on resize with debounce
let resizeTimer = null;
window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        drawBoard();
    }, 150);
});

/* =========================================
   UI Helpers: Copy ID & Disconnect
   ========================================= */
if (copyIdBtn) {
    copyIdBtn.addEventListener('click', async () => {
        const id = myIdDisplay.innerText || '';
        if (!id || id === 'Generating...' || id === 'n/a') {
            addChatMessage('System', 'No Room ID available to copy yet.', 'system-msg');
            return;
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(id);
            } else {
                // Fallback
                const tmp = document.createElement('textarea');
                tmp.value = id;
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
            }
            addChatMessage('System', 'Room ID copied to clipboard.', 'system-msg');
        } catch (err) {
            console.error('Copy failed', err);
            addChatMessage('System', 'Failed to copy Room ID.', 'system-msg');
        }
    });
}

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        try {
            if (connection) {
                connection.close();
                connection = null;
            }
            // Do not destroy peer here to allow getting a new connection; if you want a fresh ID use peer.destroy()
            friendIdInput.disabled = false;
            connectBtn.disabled = false;
            chatInput.disabled = true;
            sendBtn.disabled = true;
            if (rollBtn) rollBtn.disabled = true;
            disconnectBtn.disabled = true;
            connectionStatus.innerText = 'Status: Disconnected';
            connectionStatus.style.color = '#aaa';
            addChatMessage('System', 'Disconnected from peer.', 'system-msg');
        } catch (err) {
            console.error('Error during disconnect', err);
        }
    });
}
