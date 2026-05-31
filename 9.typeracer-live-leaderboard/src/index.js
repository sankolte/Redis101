import Redis from 'ioredis';
import express from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Serve frontend files (public/ folder me index.html, style.css, app.js hain)
app.use(express.static(join(__dirname, '../public')));


// ======================================================================
// REDIS CONNECTIONS
// ======================================================================
// 
// Humein 2 Redis connections chahiye — kyun?
// 
// Jab hum redis.subscribe() karte hain, toh woh connection SIRF 
// subscribe mode me chala jaata hai. Usse hum aur koi command 
// (like zadd, hset) nahi bhej sakte.
// 
// Isliye: 
//   - "redis"    → normal commands ke liye (zadd, zrevrange, hset, etc.)
//   - "redisSub" → SIRF Pub/Sub subscribe ke liye
//
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));


// ======================================================================
// CENTRALIZED REDIS KEYS — (notes.md me padha tha ye pattern)
// ======================================================================
//
// Kyun? → Agar hum har jagah "leaderboard:easy" manually likhenge, 
// toh ek jagah typo hua → silently break hoga, Redis warn nahi karega.
// 
// Isliye sab keys ek jagah define karo:
//
const KEYS = {
    LEADERBOARD: (game) => `typeracer:leaderboard:${game}`,   // Sorted Set
    PLAYER:      (userId) => `typeracer:player:${userId}`,     // Hash
    ACTIVITY:    (userId) => `typeracer:activity:${userId}`,   // List
    STATS:       'typeracer:stats:global',                     // Hash
};

const CHANNEL = 'typeracer:leaderboard:updates';  // Pub/Sub channel name


// ======================================================================
//  1. SORTED SETS — Leaderboard (ye toh 8.project wala code hai!)
// ======================================================================
//
// Redis Sorted Set = har member ke saath ek SCORE hota hai
// Internally: Hash Table + Skip List
//   → O(1) lookup by member
//   → O(log N) range queries by score
//
// Commands used:
//   ZADD key score member   → add/update member with score
//   ZREVRANGE key start stop WITHSCORES → get top members (highest first)
//   ZREVRANK key member     → rank of member (0-based, highest = 0)
//   ZSCORE key member       → score of a specific member


// POST /api/leaderboard/:game/score — Submit typing score
// :game can be "easy", "medium", or "hard"
app.post("/api/leaderboard/:game/score", async (req, res) => {
    let { userId, score, accuracy } = req.body;
    const { game } = req.params;

    if (userId == null || score == null) {
        return res.status(400).json({ error: "userId and score are required" });
    }

    score = parseFloat(score);

    // ZADD — adds userId to sorted set with given score
    // Unlike 8.project which used ZINCRBY (cumulative score),
    // here we only keep the BEST score (highest WPM)
    const currentScore = await redis.zscore(KEYS.LEADERBOARD(game), userId);

    if (currentScore === null || score > parseFloat(currentScore)) {
        await redis.zadd(KEYS.LEADERBOARD(game), score, userId);
    }

    // ---- HASH: Update player stats ----
    // HINCRBY increments a field in a hash by given number
    await redis.hincrby(KEYS.PLAYER(userId), 'totalGames', 1);

    if (currentScore === null || score > parseFloat(currentScore)) {
        // HSET sets a field in the hash
        await redis.hset(KEYS.PLAYER(userId), 'bestWpm', score.toString());
    }

    // ---- LIST: Log this attempt to activity history ----
    // LPUSH adds to the LEFT (front) of list → newest first
    // LTRIM keeps only first 20 items → prevents list from growing forever
    const activityEntry = JSON.stringify({
        game,
        wpm: score,
        accuracy: accuracy || 0,
        timestamp: Date.now()
    });
    await redis.lpush(KEYS.ACTIVITY(userId), activityEntry);
    await redis.ltrim(KEYS.ACTIVITY(userId), 0, 19);

    // Global stats update
    await redis.hincrby(KEYS.STATS, 'totalGames', 1);

    // ---- PUB/SUB: Publish update for live SSE ----
    // PUBLISH sends a message to a channel
    // All subscribers (our SSE endpoint) will receive it
    const rank = await redis.zrevrank(KEYS.LEADERBOARD(game), userId);
    const playerData = await redis.hgetall(KEYS.PLAYER(userId));

    await redis.publish(CHANNEL, JSON.stringify({
        type: 'score_update',
        game,
        userId,
        score,
        rank: rank + 1,  // 0-based → 1-based
        playerName: playerData.name || userId,
        avatar: playerData.avatar || '⌨️',
    }));

    res.json({ msg: "Score updated successfully", rank: rank + 1 });
});


// GET /api/leaderboard/:game/top — Top 15 players (sorted by highest WPM)
app.get("/api/leaderboard/:game/top", async (req, res) => {
    const { game } = req.params;

    // ZREVRANGE → returns members from highest to lowest score
    // "WITHSCORES" → also returns the score alongside each member
    // Result format: [userId1, score1, userId2, score2, ...]
    const leaders = await redis.zrevrange(KEYS.LEADERBOARD(game), 0, 14, "WITHSCORES");

    if (leaders.length === 0) {
        return res.json({ leaders: [] });
    }

    // Parse the flat array into objects and enrich with player data from Hash
    const result = [];
    for (let i = 0; i < leaders.length; i += 2) {
        const userId = leaders[i];
        const score = parseFloat(leaders[i + 1]);
        const playerData = await redis.hgetall(KEYS.PLAYER(userId));

        result.push({
            rank: (i / 2) + 1,
            userId,
            score,
            name: playerData.name || userId,
            avatar: playerData.avatar || '⌨️',
            totalGames: parseInt(playerData.totalGames) || 0
        });
    }

    res.json({ leaders: result });
});


// GET /api/leaderboard/:game/:userId/rank — Get user's rank
app.get("/api/leaderboard/:game/:userId/rank", async (req, res) => {
    const { game, userId } = req.params;

    // ZREVRANK → rank of member in sorted set (0-based, highest score = rank 0)
    const rank = await redis.zrevrank(KEYS.LEADERBOARD(game), userId);

    // IMPORTANT: rank === null check, NOT !rank
    // kyunki rank 0 (first place) bhi falsy hai but valid hai!
    // (ye bug 8.project me fix kiya tha)
    if (rank === null) {
        return res.status(404).json({ error: "User not found in leaderboard" });
    }

    const score = await redis.zscore(KEYS.LEADERBOARD(game), userId);
    res.json({ userId, rank: rank + 1, score: parseFloat(score) });
});


// ======================================================================
//  2. HASHES — Player Profiles
// ======================================================================
//
// Redis Hash = ek key ke andar multiple field-value pairs
// Think of it like a mini JSON object stored in Redis
//
// Why Hash over JSON string?
//   → Individual fields update kar sakte ho (HSET, HINCRBY)
//   → Poora object fetch kar sakte ho (HGETALL)
//   → Memory efficient for small objects
//
// Commands used:
//   HSET key field value     → set a field
//   HGETALL key              → get all field-value pairs
//   HINCRBY key field amount → increment a numeric field
//   HEXISTS key field        → check if field exists


// POST /api/players/:userId — Create or update player profile
app.post("/api/players/:userId", async (req, res) => {
    const { userId } = req.params;
    const { name, avatar } = req.body;

    // Check if player already exists
    const exists = await redis.exists(KEYS.PLAYER(userId));

    const playerData = {
        name: name || userId,
        avatar: avatar || '⌨️',
    };

    // Only set joinedAt for brand new players
    if (!exists) {
        playerData.joinedAt = Date.now().toString();
        playerData.totalGames = '0';
        playerData.bestWpm = '0';
        await redis.hincrby(KEYS.STATS, 'totalPlayers', 1);
    }

    // HSET can set multiple fields at once
    await redis.hset(KEYS.PLAYER(userId), playerData);

    // HGETALL returns ALL fields as an object
    const full = await redis.hgetall(KEYS.PLAYER(userId));
    res.json({ player: full });
});


// GET /api/players/:userId — Get player profile
app.get("/api/players/:userId", async (req, res) => {
    const { userId } = req.params;
    const player = await redis.hgetall(KEYS.PLAYER(userId));

    if (!player || Object.keys(player).length === 0) {
        return res.status(404).json({ error: "Player not found" });
    }

    res.json({ player });
});


// ======================================================================
//  3. LISTS — Activity History
// ======================================================================
//
// Redis List = ordered sequence of strings (like an array)
// We use it as a "recent activity" log
//
// Commands used:
//   LPUSH key value   → add to front (newest first)
//   LTRIM key 0 19    → keep only first 20 items (auto-cleanup!)
//   LRANGE key 0 9    → get first 10 items


// GET /api/players/:userId/history — Recent game history
app.get("/api/players/:userId/history", async (req, res) => {
    const { userId } = req.params;

    // LRANGE returns elements from index 0 to 9 (first 10)
    const history = await redis.lrange(KEYS.ACTIVITY(userId), 0, 9);
    const parsed = history.map(item => JSON.parse(item));
    res.json({ history: parsed });
});


// ======================================================================
//  4. PUB/SUB — Live Updates (Server-Sent Events)
// ======================================================================
//
// Redis Pub/Sub = real-time messaging system
//   - PUBLISH channel message → koi bhi bhej sakta hai
//   - SUBSCRIBE channel       → sunne wale sab ko milega
//
// Flow:
//   1. User submits score → POST /api/leaderboard/:game/score
//   2. That endpoint does: redis.publish(CHANNEL, data)
//   3. redisSub is subscribed to CHANNEL
//   4. When message arrives → broadcast to ALL connected browsers via SSE
//
// SSE (Server-Sent Events) = browser ka ek feature
//   - Browser opens a persistent connection to /api/events
//   - Server can push messages anytime
//   - Simpler than WebSockets for one-way communication


const sseClients = new Set();  // track all connected browsers

// Subscribe to Redis Pub/Sub channel
redisSub.subscribe(CHANNEL, (err) => {
    if (err) console.error('❌ Failed to subscribe:', err);
    else console.log('📡 Subscribed to leaderboard updates channel');
});

// When a message arrives on the channel → broadcast to all SSE clients
redisSub.on('message', (channel, message) => {
    if (channel === CHANNEL) {
        sseClients.forEach(client => {
            // SSE format: "data: {json}\n\n"
            client.write(`data: ${message}\n\n`);
        });
    }
});

// GET /api/events — SSE endpoint (browser connects here and keeps connection open)
app.get("/api/events", (req, res) => {
    // These headers tell the browser "this is an SSE stream, keep it open"
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Add this client to our set
    sseClients.add(res);
    console.log(`📡 SSE client connected (${sseClients.size} total)`);

    // When browser disconnects (tab closed, etc.) → remove from set
    req.on('close', () => {
        sseClients.delete(res);
        console.log(`📡 SSE client disconnected (${sseClients.size} total)`);
    });
});


// ======================================================================
//  GLOBAL STATS
// ======================================================================
app.get("/api/stats", async (req, res) => {
    const stats = await redis.hgetall(KEYS.STATS);
    res.json({
        totalPlayers: parseInt(stats.totalPlayers) || 0,
        totalGames: parseInt(stats.totalGames) || 0,
    });
});


// ======================================================================
//  START SERVER
// ======================================================================
app.listen(3000, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║  🏆  TypeRacer Live Leaderboard                 ║
║  🌐  http://localhost:3000                       ║
║                                                  ║
║  Redis features used:                            ║
║    1. Sorted Sets → Leaderboard rankings         ║
║    2. Hashes      → Player profiles              ║
║    3. Lists       → Activity history             ║
║    4. Pub/Sub     → Live updates (SSE)           ║
╚══════════════════════════════════════════════════╝
    `);
});


// ======================================================================
//  SEED DATA — Run: node src/seed.js
//  (keeping seed in a separate file so you can run it independently)
// ======================================================================
