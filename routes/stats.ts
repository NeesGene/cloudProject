import express from 'express';
import { db } from '../controllers/databaseController'; // Make sure the path is correct
import axios from 'axios'

import { secureMiddleware } from "../SecurityMiddleware";


const router = express.Router();
const BASE_URL = "https://marvelrivalsapi.com/api/v1";


router.get('/stats',secureMiddleware, async (req, res) => {
    try {
        const cache = await db.collection('game_cache').findOne({ type: 'heroes' });
        const heroes = cache ? cache.data : [];

        // 1. Calculate Role Breakdown
        const roles: Record<string, number> = {};
        heroes.forEach((h: any) => {
            const role = h.role || "Unknown";
            roles[role] = (roles[role] || 0) + 1;
        });

        // 2. Pick Featured Heroes (One per role, max 3)
        const featured: any[] = [];
        const seenRoles = new Set();
        for (const h of heroes) {
            if (!seenRoles.has(h.role) && featured.length < 3) {
                featured.push(h);
                seenRoles.add(h.role);
            }
        }

        res.render('stats', {
            heroCount: heroes.length,
            roles,
            featured,
            currentPage: 'stats',
            IMG_BASE: "https://marvelrivalsapi.com",
            SKIN_BASE: "https://marvelrivalsapi.com/rivals"
        });
    } catch (err) {
        res.status(500).send("Error loading stats");
    }
});

// GET /stats/api/player/:username
router.get('/stats/api/player/:username', async (req, res) => {
    let foundPlayer: any = null;

    try {
        const { username } = req.params;
        const API_KEY = process.env.RIVALS_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({
                error: "Missing API key",
                details: "RIVALS_API_KEY is not set."
            });
        }
        
        const headers = { "x-api-key": API_KEY };
        try {
            foundPlayer = await axios
                .get(`${BASE_URL}/find-player/${encodeURIComponent(username)}`, { headers })
                .then(response => response.data);
        } catch {
            foundPlayer = null;
        }

        const queries = [foundPlayer?.name, foundPlayer?.uid, username]
            .filter(Boolean)
            .filter((query, index, allQueries) => allQueries.indexOf(query) === index);

        let lastError: any = null;
        for (const query of queries) {
            const url = `${BASE_URL}/player/${encodeURIComponent(query)}`;
            console.log("Fetching from:", url);

            try {
                const response = await axios.get(url, { headers });
                console.log("API Response received!");
                return res.json(response.data);
            } catch (statsError: any) {
                lastError = statsError;
            }
        }

        throw lastError;

    } catch (error: any) {
        if (error.response) {
            console.error("API DATA ERROR:", error.response.data);
            console.error("API STATUS:", error.response.status);
        } else {
            console.error("NETWORK/TIMEOUT ERROR:", error.message);
        }

        const upstreamMessage = error.response?.data?.message || error.message;
        if (foundPlayer) {
            return res.status(502).json({
                error: "Player found, but stats are unavailable",
                details: upstreamMessage,
                player: foundPlayer
            });
        }

        const status = error.response?.status || 500;
        res.status(status).json({ 
            error: "Player search failed",
            details: upstreamMessage 
        });
    }
}); 
export default router;
