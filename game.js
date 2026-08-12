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
let seenNonces = new Set(); // to dedupe incoming events

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
        addChatMessage('System', 'PeerJS error: ' + (err && err.type ? err.type : String(err)), 'system-msg');
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
        if (rollBtn) rollBtn.disabled = false; // We'll use this for the dice
        if (disconnectBtn) disconnectBtn.disabled = false;

        addChatMessage('System', 'Connection established! You can now chat and roll the dice.', 'system-msg');
    });

    connection.on('error', (err) => {
        console.error('Connection error', err);
        addChatMessage('System', 'Connection error: ' + String(err), 'system-msg');
    });

    // When we receive data (messages or game moves) from our friend
    connection.on('data', (data) => {
        try {
            if (!data) return;

            if (data.type === 'chat') {
                addChatMessage('Friend', data.content, 'friend-msg');
                return;
            }

            if (data.type === 'dice') {
                // Deduplicate by nonce
                if (!data.nonce) return;
                if (seenNonces.has(data.nonce)) return;
                seenNonces.add(data.nonce);

                // Display friend's dice
                addChatMessage('System', `Friend rolled: ${data.value}`, 'system-msg');
                // Show briefly in dice display
                if (diceDisplay) {
                    diceDisplay.innerText = `Friend: ${data.value}`;
                    setTimeout(() => { diceDisplay.innerText = 'Waiting...'; }, 2500);
                }
                return;
            }

            if (data.type === 'move') {
                // Placeholder for future move handling
                if (!data.nonce) return;
                if (seenNonces.has(data.nonce)) return;
                seenNonces.add(data.nonce);
                addChatMessage('System', `Friend moved piece (${data.detail || 'details'})`, 'system-msg');
                return;
            }

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

        addChatMessage('System', 'Your friend disconnected. Attempting reconnect...', 'system-msg');
        connection = null; // Reset connection

        // Try to reconnect automatically (lightweight)
        if (lastFriendId) {
            attemptReconnect(0);
        }

        // Re-enable the ability to join or create a new connection manually
        friendIdInput.disabled = false;
        connectBtn.disabled = false;
    });
}

/* =========================================
   Reconnection Logic
   ========================================= */
function attemptReconnect(attempt) {
    const maxAttempts = 5;
    if (attempt >= maxAttempts) {
        addChatMessage('System', 'Reconnect failed after multiple attempts. Please reconnect manually.', 'system-msg');
        return;
    }

    const delay = Math.min(2000 * Math.pow(2, attempt), 30000); // exponential backoff up to 30s
    addChatMessage('System', `Reconnect attempt ${attempt + 1} in ${Math.round(delay/1000)}s...`, 'system-msg');

    setTimeout(() => {
        if (!peer || !lastFriendId) return;
        try {
            connection = peer.connect(lastFriendId);
            setupConnectionHandlers();
        } catch (err) {
            console.error('Reconnect attempt failed', err);
            attemptReconnect(attempt + 1);
        }
    }, delay);
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
   Dice & Move Sync Logic
   ========================================= */
function generateNonce() {
    return Date.now() + '-' + Math.random().toString(36).slice(2,8);
}

if (rollBtn) {
    rollBtn.addEventListener('click', async () => {
        if (rollBtn.disabled) return;
        rollBtn.disabled = true;
        if (diceDisplay) diceDisplay.innerText = 'Rolling...';

        // simple roll animation delay
        await new Promise(res => setTimeout(res, 700));
        const value = Math.floor(Math.random() * 6) + 1;

        if (diceDisplay) diceDisplay.innerText = value;
        addChatMessage('System', `You rolled: ${value}`, 'system-msg');

        // send dice event to peer
        const nonce = generateNonce();
        seenNonces.add(nonce); // mark our own nonce so we don't process it when it bounces
        if (connection && connection.open) {
            try {
                connection.send({ type: 'dice', value, nonce });
            } catch (err) {
                console.error('Failed to send dice event', err);
            }
        }

        // re-enable after short cooldown
        setTimeout(() => { if (rollBtn) rollBtn.disabled = false; }, 800);
    });
}

/* =========================================
   Move Event Skeleton (for future use)
   ========================================= */
function sendMove(detail) {
    const nonce = generateNonce();
    seenNonces.add(nonce);
    if (connection && connection.open) {
        try {
            connection.send({ type: 'move', detail, nonce });
        } catch (err) {
            console.error('Failed to send move', err);
        }
    }
}

/* =========================================
   Responsive Canvas & Drawing (already implemented)
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

    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const availableWidth = Math.min(parent.clientWidth - 30, window.innerHeight - 200) || parent.clientWidth;

    canvas.style.width = availableWidth + 'px';
    canvas.style.height = availableWidth + 'px';

    canvas.width = Math.round(availableWidth * dpr);
    canvas.height = Math.round(availableWidth * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TILE_SIZE = (availableWidth) / GRID_SIZE;
}

function drawBoard() {
    if (!ctx || !canvas) return;
    fitCanvasToContainer();

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    ctx.strokeStyle = COLORS.BORDER;
    ctx.lineWidth = 1;
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    drawBase(0, 0, COLORS.RED);
    drawBase(9 * TILE_SIZE, 0, COLORS.GREEN);
    drawBase(0, 9 * TILE_SIZE, COLORS.BLUE);
    drawBase(9 * TILE_SIZE, 9 * TILE_SIZE, COLORS.YELLOW);

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
