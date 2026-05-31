// ============================================================
// TypeRacer Live Leaderboard — Frontend Logic
// Typing game engine + SSE live updates + API integration
// ============================================================

// ========== Typing Passages ==========
const passages = {
    easy: [
        "The quick brown fox jumps over the lazy dog near the river bank on a warm sunny afternoon.",
        "She sells sea shells by the sea shore while the waves crash gently on the sand.",
        "A small cat sat on the red mat and looked out the big window at the falling rain.",
        "The sun sets slowly behind the tall mountains painting the sky in shades of orange and pink.",
        "Good food and great friends make every evening special and worth remembering forever."
    ],
    medium: [
        "Technology has transformed the way we communicate, work, and live our daily lives. From smartphones to cloud computing, innovation continues to push boundaries and create new possibilities for everyone around the globe.",
        "The art of programming is not just about writing code that works. It is about writing code that is clean, maintainable, and efficient. Every line should serve a clear purpose and contribute to the overall architecture.",
        "Redis is an open source, in-memory data structure store used as a database, cache, message broker, and streaming engine. It supports strings, hashes, lists, sets, sorted sets, and more.",
        "Building scalable web applications requires understanding of caching strategies, database optimization, and asynchronous processing. Each layer of the stack plays a critical role in delivering a seamless user experience.",
        "The best software engineers are not those who write the most code, but those who solve problems elegantly. They understand trade-offs, communicate clearly, and build systems that stand the test of time."
    ],
    hard: [
        "In distributed systems, achieving consensus among multiple nodes is fundamentally challenging due to network partitions, message delays, and process failures. The CAP theorem states that a distributed system cannot simultaneously provide consistency, availability, and partition tolerance — you must choose two out of three.",
        "Asynchronous programming in JavaScript leverages the event loop, callback queue, and microtask queue to handle concurrent operations without blocking the main thread. Promises and async/await syntax provide cleaner abstractions over traditional callback patterns, reducing complexity in error handling.",
        "Redis Sorted Sets use a dual data structure internally: a hash table for O(1) lookups by member, and a skip list for O(log N) range queries by score. This combination makes operations like ZRANGEBYSCORE and ZREVRANK incredibly efficient even with millions of entries in the set.",
        "The observer pattern, implemented through Redis Pub/Sub, decouples message producers from consumers. Publishers send messages to channels without knowledge of subscribers, enabling horizontal scaling. However, Pub/Sub provides at-most-once delivery semantics — messages are lost if no subscriber is connected.",
        "Microservices architecture decomposes monolithic applications into independently deployable services, each responsible for a specific business capability. Inter-service communication typically uses REST APIs, gRPC, or message queues like BullMQ backed by Redis, enabling eventual consistency across bounded contexts."
    ]
};

// ========== State ==========
let state = {
    currentUser: null,
    currentAvatar: '⌨️',
    currentGame: 'medium',
    typingText: '',
    charIndex: 0,
    correctChars: 0,
    incorrectChars: 0,
    startTime: null,
    isTyping: false,
    isFinished: false,
    timerInterval: null,
    sseConnected: false
};

// ========== DOM Elements ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========== Initialize ==========
document.addEventListener('DOMContentLoaded', () => {
    initSSE();
    loadLeaderboard();
    loadStats();
    setupEventListeners();
    loadNewPassage();
});

// ========== SSE — Live Updates via Redis Pub/Sub ==========
function initSSE() {
    const evtSource = new EventSource('/api/events');

    evtSource.onopen = () => {
        state.sseConnected = true;
        updateConnectionBadge(true);
    };

    evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
            state.sseConnected = true;
            updateConnectionBadge(true);
            return;
        }

        if (data.type === 'score_update') {
            // Refresh leaderboard if it's the current game
            if (data.game === state.currentGame) {
                loadLeaderboard();
            }
            loadStats();

            // Show toast notification
            showToast(`${data.avatar} ${data.playerName} scored ${Math.round(data.score)} WPM in ${data.game}!`);
        }
    };

    evtSource.onerror = () => {
        state.sseConnected = false;
        updateConnectionBadge(false);
    };
}

function updateConnectionBadge(connected) {
    const badge = $('#connection-badge');
    if (connected) {
        badge.className = 'connection-badge';
        badge.innerHTML = '<span class="connection-dot"></span> Live';
    } else {
        badge.className = 'connection-badge disconnected';
        badge.innerHTML = '<span class="connection-dot"></span> Offline';
    }
}

// ========== Toast Notifications ==========
function showToast(message) {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>⚡</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// ========== Stats ==========
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        $('#stat-players').textContent = data.totalPlayers || 0;
        $('#stat-games').textContent = data.totalGames || 0;
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// ========== Leaderboard ==========
async function loadLeaderboard() {
    const list = $('#leaderboard-list');

    try {
        const res = await fetch(`/api/leaderboard/${state.currentGame}/top?limit=15`);
        const data = await res.json();

        if (!data.leaders || data.leaders.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏜️</div>
                    <div class="empty-state-text">No scores yet. Be the first!</div>
                </div>`;
            return;
        }

        const maxScore = data.leaders[0]?.score || 1;

        list.innerHTML = data.leaders.map(p => `
            <div class="lb-row" data-userid="${p.userId}">
                <div class="lb-rank ${p.rank <= 3 ? 'rank-' + p.rank : ''}">
                    ${p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : p.rank}
                </div>
                <div class="lb-avatar">${p.avatar}</div>
                <div class="lb-info">
                    <div class="lb-name">${escapeHtml(p.name)}</div>
                    <div class="lb-games">${p.totalGames} games</div>
                </div>
                <div class="lb-score">${Math.round(p.score)}<span class="lb-unit">WPM</span></div>
                <div class="lb-bar-container">
                    <div class="lb-bar" style="width: ${(p.score / maxScore * 100).toFixed(1)}%"></div>
                </div>
            </div>
        `).join('');

        // Highlight user's row if they're on the board
        if (state.currentUser) {
            const userRow = list.querySelector(`[data-userid="${state.currentUser}"]`);
            if (userRow) userRow.classList.add('highlight');
        }
    } catch (e) {
        console.error('Failed to load leaderboard:', e);
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Failed to load. Is Redis running?</div>
            </div>`;
    }
}

// ========== Typing Game ==========
function loadNewPassage() {
    const gamePassages = passages[state.currentGame];
    state.typingText = gamePassages[Math.floor(Math.random() * gamePassages.length)];
    state.charIndex = 0;
    state.correctChars = 0;
    state.incorrectChars = 0;
    state.startTime = null;
    state.isTyping = false;
    state.isFinished = false;

    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    renderTypingDisplay();
    updateMetrics(0, 0, 100, 0);

    // Re-enable start button
    $('#btn-start').disabled = false;
    $('#btn-start').innerHTML = '⌨️ Start Typing';
}

function renderTypingDisplay() {
    const display = $('#typing-display');
    display.innerHTML = state.typingText.split('').map((char, i) => {
        let cls = 'char pending';
        if (i < state.charIndex) {
            // Already typed
            cls = 'char ' + (state.typedChars?.[i] ? 'correct' : 'incorrect');
        } else if (i === state.charIndex && state.isTyping) {
            cls = 'char current';
        }
        return `<span class="${cls}">${char === ' ' ? '&nbsp;' : escapeHtml(char)}</span>`;
    }).join('');
}

function startTyping() {
    const nameInput = $('#player-name');
    const name = nameInput.value.trim();

    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        setTimeout(() => nameInput.style.borderColor = '', 1500);
        return;
    }

    // Generate a userId from name (lowercase, replace spaces with underscores)
    state.currentUser = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Register player
    registerPlayer(state.currentUser, name, state.currentAvatar);

    // Reset typing state
    state.charIndex = 0;
    state.correctChars = 0;
    state.incorrectChars = 0;
    state.isTyping = true;
    state.isFinished = false;
    state.typedChars = {};

    renderTypingDisplay();

    // Focus hidden input
    const input = $('#typing-input');
    input.value = '';
    input.focus();

    $('#btn-start').disabled = true;
    $('#btn-start').innerHTML = '⏳ Typing...';

    // Show click-to-focus hint
    $('#typing-display').style.cursor = 'text';
}

function handleTypingInput(e) {
    if (!state.isTyping || state.isFinished) return;

    const input = $('#typing-input');
    const typed = input.value;

    // Start timer on first keypress
    if (!state.startTime && typed.length > 0) {
        state.startTime = Date.now();
        state.timerInterval = setInterval(updateTimer, 100);
    }

    // Process each character
    const newIndex = typed.length;

    // Track correctness for each position
    for (let i = 0; i < newIndex; i++) {
        state.typedChars[i] = typed[i] === state.typingText[i];
    }

    state.charIndex = newIndex;
    state.correctChars = Object.values(state.typedChars).filter(v => v).length;
    state.incorrectChars = Object.values(state.typedChars).filter(v => !v).length;

    renderTypingDisplay();
    updateLiveMetrics();

    // Check if finished
    if (newIndex >= state.typingText.length) {
        finishTyping();
    }
}

function updateTimer() {
    if (!state.startTime) return;
    const elapsed = (Date.now() - state.startTime) / 1000;
    $('#metric-time').textContent = elapsed.toFixed(1) + 's';
}

function updateLiveMetrics() {
    if (!state.startTime) return;

    const elapsed = (Date.now() - state.startTime) / 1000 / 60; // in minutes
    const wordsTyped = state.correctChars / 5; // standard WPM calculation
    const wpm = elapsed > 0 ? Math.round(wordsTyped / elapsed) : 0;
    const accuracy = state.charIndex > 0
        ? Math.round((state.correctChars / state.charIndex) * 100)
        : 100;
    const progress = Math.round((state.charIndex / state.typingText.length) * 100);

    updateMetrics(wpm, null, accuracy, progress);
}

function updateMetrics(wpm, time, accuracy, progress) {
    // Update stats bar (top)
    if (wpm !== null) $('#metric-wpm').textContent = wpm;
    if (accuracy !== null) $('#metric-accuracy').textContent = accuracy + '%';
    // Update inline typing metrics (below typing area)
    if (wpm !== null) $('#metric-wpm-live').textContent = wpm;
    if (time !== null) $('#metric-time').textContent = time + 's';
    if (accuracy !== null) $('#metric-acc-live').textContent = accuracy + '%';
    if (progress !== null) $('#metric-progress').textContent = progress + '%';
}

async function finishTyping() {
    state.isTyping = false;
    state.isFinished = true;

    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }

    const elapsed = (Date.now() - state.startTime) / 1000; // seconds
    const elapsedMin = elapsed / 60;
    const wordsTyped = state.correctChars / 5;
    const finalWpm = Math.round(wordsTyped / elapsedMin);
    const finalAccuracy = Math.round((state.correctChars / state.typingText.length) * 100);

    // Submit score to backend
    try {
        const res = await fetch(`/api/leaderboard/${state.currentGame}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser,
                score: finalWpm,
                accuracy: finalAccuracy
            })
        });
        const data = await res.json();

        // Show result modal
        showResultModal(finalWpm, elapsed, finalAccuracy, data.rank);
    } catch (e) {
        console.error('Failed to submit score:', e);
        showResultModal(finalWpm, elapsed, finalAccuracy, '?');
    }

    // Refresh leaderboard
    setTimeout(() => {
        loadLeaderboard();
        loadStats();
    }, 500);
}

function showResultModal(wpm, time, accuracy, rank) {
    const modal = $('#result-modal');
    modal.classList.remove('hidden');

    let emoji = '⌨️';
    let title = 'Nice Try!';
    if (wpm >= 80) { emoji = '🏆'; title = 'Incredible!'; }
    else if (wpm >= 60) { emoji = '🔥'; title = 'Amazing Speed!'; }
    else if (wpm >= 40) { emoji = '⚡'; title = 'Great Job!'; }
    else if (wpm >= 20) { emoji = '👍'; title = 'Good Start!'; }

    $('#result-emoji').textContent = emoji;
    $('#result-title').textContent = title;
    $('#result-subtitle').textContent = `You completed the ${state.currentGame} challenge!`;
    $('#result-wpm').textContent = wpm;
    $('#result-time').textContent = time.toFixed(1) + 's';
    $('#result-accuracy').textContent = accuracy + '%';
    $('#result-rank-value').innerHTML = rank ? `You're ranked <strong>#${rank}</strong> on the ${state.currentGame} leaderboard` : '';
}

function closeResultModal() {
    $('#result-modal').classList.add('hidden');
    loadNewPassage();
}

// ========== Player Registration ==========
async function registerPlayer(userId, name, avatar) {
    try {
        await fetch(`/api/players/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, avatar })
        });
    } catch (e) {
        console.error('Failed to register player:', e);
    }
}

// ========== Player Lookup ==========
async function lookupPlayer() {
    const input = $('#lookup-input');
    const userId = input.value.trim().toLowerCase().replace(/\s+/g, '_');

    if (!userId) return;

    const cardContainer = $('#player-card-container');
    const historyList = $('#activity-list');

    try {
        const [playerRes, historyRes] = await Promise.all([
            fetch(`/api/players/${userId}`),
            fetch(`/api/players/${userId}/history`)
        ]);

        if (!playerRes.ok) {
            cardContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">Player not found</div>
                </div>`;
            historyList.innerHTML = '';
            return;
        }

        const { player } = await playerRes.json();
        const { history } = await historyRes.json();

        cardContainer.innerHTML = `
            <div class="player-card">
                <div class="player-card-avatar">${player.avatar || '⌨️'}</div>
                <div class="player-card-info">
                    <h3>${escapeHtml(player.name || userId)}</h3>
                    <div class="player-card-stats">
                        <span class="player-card-stat">🏅 Best: <strong>${player.bestWpm || 0} WPM</strong></span>
                        <span class="player-card-stat">🎮 Games: <strong>${player.totalGames || 0}</strong></span>
                    </div>
                </div>
            </div>`;

        if (history && history.length > 0) {
            historyList.innerHTML = history.map(h => `
                <div class="activity-item">
                    <span class="activity-icon">${h.game === 'easy' ? '🟢' : h.game === 'medium' ? '🟡' : '🔴'}</span>
                    <span class="activity-text"><strong>${Math.round(h.wpm)} WPM</strong> on ${h.game}</span>
                    <span class="activity-time">${timeAgo(h.timestamp)}</span>
                </div>
            `).join('');
        } else {
            historyList.innerHTML = '<div class="empty-state"><div class="empty-state-text">No activity yet</div></div>';
        }
    } catch (e) {
        console.error('Failed to lookup player:', e);
    }
}

// ========== Event Listeners ==========
function setupEventListeners() {
    // Difficulty tabs
    $$('.diff-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.diff-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentGame = tab.dataset.game;
            loadNewPassage();
            loadLeaderboard();
        });
    });

    // Start button
    $('#btn-start').addEventListener('click', startTyping);

    // Reset button
    $('#btn-reset').addEventListener('click', loadNewPassage);

    // Typing input
    $('#typing-input').addEventListener('input', handleTypingInput);

    // Click on typing display to focus input
    $('#typing-display').addEventListener('click', () => {
        if (state.isTyping) {
            $('#typing-input').focus();
        }
    });

    // Prevent paste in typing input
    $('#typing-input').addEventListener('paste', (e) => e.preventDefault());

    // Avatar selector
    const avatarBtn = $('#avatar-btn');
    const avatarOptions = $('#avatar-options');
    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        avatarOptions.classList.toggle('hidden');
        avatarOptions.classList.toggle('show');
    });

    $$('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.currentAvatar = opt.dataset.avatar;
            $('#avatar-current').textContent = opt.dataset.avatar;
            avatarOptions.classList.add('hidden');
            avatarOptions.classList.remove('show');
        });
    });

    // Close avatar dropdown on outside click
    document.addEventListener('click', () => {
        avatarOptions.classList.add('hidden');
        avatarOptions.classList.remove('show');
    });

    // Player lookup
    $('#btn-lookup').addEventListener('click', lookupPlayer);
    $('#lookup-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') lookupPlayer();
    });

    // Result modal
    $('#btn-play-again').addEventListener('click', closeResultModal);
    $('#btn-close-modal').addEventListener('click', closeResultModal);

    // Enter key on player name starts typing
    $('#player-name').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startTyping();
    });
}

// ========== Utilities ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}
