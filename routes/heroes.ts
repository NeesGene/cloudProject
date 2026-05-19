import express from 'express';
import { db, getAccountById, setFavoriteHero } from '../controllers/databaseController'; // Make sure the path is correct

import { secureMiddleware } from "../SecurityMiddleware";
import { syncHeroes } from '../controllers/heroController';
const router = express.Router();

router.get('/heroes', secureMiddleware, async (req, res) => {
    try {
        const cache = await db.collection('game_cache').findOne({ type: 'heroes' });
        let heroes = cache ? cache.data : [];

        // --- NEW: FETCH CACHED IMAGES ---
        const cachedImages = await db.collection('hero_images').find({}).toArray();
        const imageMap = new Map(cachedImages.map(img => [img.heroId, img]));

        const sessionUser = req.session.user;
        const account = sessionUser ? await getAccountById(sessionUser.id) : null;
        const favoriteHeroes = new Set((account?.favoriteHeroes || []).map(String));

        // Sorting logic...
        const sortType = req.query.sort;
        if (sortType === 'HP') {
            heroes.sort((a: any, b: any) =>
                (parseInt(b.transformations?.[0]?.health) || 0) - (parseInt(a.transformations?.[0]?.health) || 0)
            );
        } else if (sortType === 'name') {
            heroes.sort((a: any, b: any) => a.name.localeCompare(b.name));
        }

        // Search filtering
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.toLowerCase().trim() : '';
        if (searchQuery) {
            heroes = heroes.filter((hero: any) =>
                (hero.name || '').toLowerCase().includes(searchQuery) ||
                (hero.real_name || '').toLowerCase().includes(searchQuery)
            );
        }

        // Attach the local image to each hero object
        heroes = heroes.map((hero: any) => {
            const cached = imageMap.get(hero.id);
            return {
                ...hero,
                // If we have it in DB, create the Data URI. 
                // If not, fallback to your original URL logic.
                localImage: cached 
                    ? `data:${cached.contentType};base64,${cached.imageBuffer.toString('base64')}`
                    : null
            };
        });

        heroes = [
            ...heroes.filter((hero: any) => favoriteHeroes.has(String(hero.id))),
            ...heroes.filter((hero: any) => !favoriteHeroes.has(String(hero.id)))
        ];

        res.render('heroes', {
            heroes,
            favoriteHeroes,
            selectedSort: sortType,
            selectedSearch: searchQuery,
            currentPage: 'heroes',
            IMG_BASE: "https://marvelrivalsapi.com",
            SKIN_BASE: "https://marvelrivalsapi.com/rivals"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading heroes");
    }
});

router.post('/heroes/:id/favorite', secureMiddleware, async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) return res.redirect('/login');

        const heroId = String(req.params.id);
        const isFavorite = req.body.favorite === 'true';
        const sort = typeof req.body.sort === 'string' ? req.body.sort : '';
        const search = typeof req.body.search === 'string' ? req.body.search : '';

        await setFavoriteHero(sessionUser.id, heroId, isFavorite);

        const params = new URLSearchParams();
        if (sort) params.set('sort', sort);
        if (search) params.set('search', search);
        const qs = params.toString();
        res.redirect(qs ? `/heroes?${qs}` : '/heroes');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating favorite hero");
    }
});

router.get('/hero-image/:id', async (req, res) => {
    try {
        const heroImg = await db.collection('hero_images').findOne({ heroId: req.params.id });
        
        if (!heroImg || !heroImg.imageBuffer) {
            // If not found in DB, we could redirect to the placeholder or original API
            return res.redirect('/img/placeholder.png');
        }

        // Set the header so the browser knows it's an image
        res.set("Content-Type", heroImg.contentType || "image/png");
        
        // Send the raw binary buffer
        res.send(heroImg.imageBuffer.buffer);
    } catch (err) {
        console.error("Error serving image:", err);
        res.status(500).send("Error");
    }
});

router.get('/sync-force', secureMiddleware, async (req, res) => {
    try {
        console.log("🚀 Force sync requested...");
        await syncHeroes(db);
        res.send("<h1>Sync Complete!</h1><p>Check your console for details.</p><a href='/heroes'>Back to Heroes</a>");
    } catch (err:any) {
        res.status(500).send("Sync failed: " + err.message);
    }
});

router.get('/heroes/:id',secureMiddleware, async (req, res) => {
    try {
        const heroId = req.params.id;
        
        // 1. Get all heroes from cache
        const cache = await db.collection('game_cache').findOne({ type: 'heroes' });
        const allHeroes = cache ? cache.data : [];

        // 2. Find the specific hero (checking both id and name for safety)
        const hero = allHeroes.find((h: any) => String(h.id) === heroId || h.name === heroId);

        if (!hero) {
            return res.status(404).send("Hero not found");
        }

        // 3. Get 4 "Other Heroes" (randomized or just sliced, excluding current)
        const otherHeroes = allHeroes
            .filter((h: any) => String(h.id) !== String(hero.id))
            .slice(0, 5);

        res.render('heroDetail', { 
            hero, 
            otherHeroes,
            currentPage: 'heroes',
            IMG_BASE: "https://marvelrivalsapi.com",
            SKIN_BASE: "https://marvelrivalsapi.com/rivals"
        });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

export default router;
