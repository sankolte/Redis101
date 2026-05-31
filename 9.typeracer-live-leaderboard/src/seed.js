// ======================================================================
//  SEED SCRIPT — Populates Redis with demo players and scores
//  Run: npm run seed
//
//  Ye script 15 fake players create karta hai with random WPM scores
//  taaki jab tum pehli baar app kholte ho, leaderboard empty na dikhhe
// ======================================================================

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Same keys as index.js (centralized keys pattern)
const KEYS = {
    LEADERBOARD: (game) => `typeracer:leaderboard:${game}`,
    PLAYER:      (userId) => `typeracer:player:${userId}`,
    ACTIVITY:    (userId) => `typeracer:activity:${userId}`,
    STATS:       'typeracer:stats:global',
};

const players = [
    { id: 'speedster_42',  name: 'SpeedDemon',    avatar: '⚡' },
    { id: 'typo_queen',    name: 'TypeQueen',     avatar: '👑' },
    { id: 'kb_ninja',      name: 'KeyboardNinja', avatar: '🥷' },
    { id: 'swift_keys',    name: 'SwiftKeys',     avatar: '🦅' },
    { id: 'turbo_typer',   name: 'TurboTyper',    avatar: '🏎️' },
    { id: 'pixel_pro',     name: 'PixelPro',      avatar: '🎮' },
    { id: 'code_wizard',   name: 'CodeWizard',    avatar: '🧙' },
    { id: 'byte_storm',    name: 'ByteStorm',     avatar: '🌩️' },
    { id: 'algo_ace',      name: 'AlgoAce',       avatar: '🃏' },
    { id: 'dev_dash',      name: 'DevDash',       avatar: '💨' },
    { id: 'rocket_keys',   name: 'RocketKeys',    avatar: '🚀' },
    { id: 'zen_typer',     name: 'ZenTyper',      avatar: '🧘' },
    { id: 'flash_finger',  name: 'FlashFinger',   avatar: '✨' },
    { id: 'blaze_board',   name: 'BlazeBoard',    avatar: '🔥' },
    { id: 'echo_keys',     name: 'EchoKeys',      avatar: '🎵' },
];

const games = ['easy', 'medium', 'hard'];

async function seed() {
    console.log('🌱 Seeding demo data...\n');

    // Clear existing leaderboard data
    for (const game of games) {
        await redis.del(KEYS.LEADERBOARD(game));
    }
    await redis.del(KEYS.STATS);

    let totalGamesPlayed = 0;

    for (const player of players) {
        // HSET → create player profile (Redis Hash)
        await redis.hset(KEYS.PLAYER(player.id), {
            name: player.name,
            avatar: player.avatar,
            joinedAt: Date.now().toString(),
            totalGames: '0',
            bestWpm: '0',
        });

        // Add scores to each difficulty leaderboard
        for (const game of games) {
            // Random WPM based on difficulty
            const baseWpm = game === 'easy' ? 35 : game === 'medium' ? 45 : 55;
            const range = game === 'easy' ? 35 : game === 'medium' ? 45 : 60;
            const wpm = Math.floor(baseWpm + Math.random() * range);

            // ZADD → add to sorted set
            await redis.zadd(KEYS.LEADERBOARD(game), wpm, player.id);

            // LPUSH → add activity entry to list
            await redis.lpush(KEYS.ACTIVITY(player.id), JSON.stringify({
                game,
                wpm,
                accuracy: Math.floor(85 + Math.random() * 15),
                timestamp: Date.now() - Math.floor(Math.random() * 3600000)
            }));

            totalGamesPlayed++;
        }

        // Update player stats
        await redis.hset(KEYS.PLAYER(player.id), 'totalGames', '3');
        
        console.log(`  ✅ ${player.avatar} ${player.name}`);
    }

    // Set global stats (Redis Hash)
    await redis.hset(KEYS.STATS, {
        totalPlayers: players.length.toString(),
        totalGames: totalGamesPlayed.toString(),
    });

    console.log(`\n🎉 Done! Seeded ${players.length} players across ${games.length} leaderboards`);
    console.log('\n   Now run: npm run dev\n');

    redis.disconnect();
}

seed().catch(console.error);
