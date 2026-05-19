import express from 'express';
import { db } from '../controllers/databaseController'; // Make sure the path is correct


import { secureMiddleware } from "../SecurityMiddleware";
const router = express.Router();


router.get('/news', secureMiddleware, async (req, res) => {
    try {
        // 1. Fetch the cached data from MongoDB
        const patchCache = await db.collection('game_cache').findOne({ type: 'patch_notes' });
        const eventCache = await db.collection('game_cache').findOne({ type: 'events' });

        // 2. Extract the data safely, defaulting to an empty array if nothing exists
        const patches = patchCache?.data?.formatted_patches || patchCache?.data || [];
        const events = eventCache?.data || [];

        // 3. PASS BOTH TO THE VIEW
        res.render('news', { 
            patches: patches,
            events: events, // This fixes the "is not defined" error
            currentPage: 'news'
        });
    } catch (err) {
        console.error("Error rendering news:", err);
        // Even in an error state, passing empty arrays prevents the EJS crash
        res.render('news', { patches: [], events: [], currentPage: 'news' });
    }
});
export default router;