import axios from 'axios';
import cron from 'node-cron';

const API_KEY = process.env.RIVALS_API_KEY;
const BASE_URL = "https://marvelrivalsapi.com/api/v1";
// The root domain
const ASSET_DOMAIN = "https://marvelrivalsapi.com";

export async function syncHeroes(db: any) {
    try {
        console.log("🚀 Starting Aggressive Hero Sync (Costume Fix Applied)...");

        const listRes = await axios.get(`${BASE_URL}/heroes`, {
            headers: { 
                "x-api-key": API_KEY,
                "User-Agent": "Mozilla/5.0" 
            }
        });
        
        const basicHeroes = Array.isArray(listRes.data) ? listRes.data : (listRes.data.heroes || []);

        for (const h of basicHeroes) {
            try {
                // Try ID first, then clean name slug
                const nameSlug = h.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^-a-z0-9]/g, '');
                const slugsToTry = [h.id, nameSlug]; 
                
                let detailData = null;
                for (const slug of slugsToTry) {
                    try {
                        const res = await axios.get(`${BASE_URL}/heroes/hero/${slug}`, {
                            headers: { "x-api-key": API_KEY }
                        });
                        detailData = res.data;
                        if (detailData) break;
                    } catch (e) { continue; }
                }

                if (!detailData) continue;

                // 1. Save Text Data
                await db.collection('heroes').updateOne(
                    { id: h.id },
                    { $set: { ...detailData, updatedAt: new Date() } },
                    { upsert: true }
                );

                // 2. IMAGE FETCHING - WITH /RIVALS/ PREFIX FIX
                const rawPath = (detailData.costumes && detailData.costumes[0]?.icon) || detailData.imageUrl;
                
                if (rawPath) {
                    // Ensure the path is clean
                    const cleanRawPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
                    
                    // The API JSON omits '/rivals' for costume paths. We check and add it.
                    const finalPath = cleanRawPath.startsWith('/rivals') 
                        ? cleanRawPath 
                        : `/rivals${cleanRawPath}`;

                    const imgUrl = `${ASSET_DOMAIN}${finalPath}`;

                    try {
                        const imgRes = await axios.get(imgUrl, { 
                            responseType: 'arraybuffer',
                            headers: { 
                                "x-api-key": API_KEY,
                                "User-Agent": "Mozilla/5.0" 
                            },
                            timeout: 10000 
                        });
                        
                        await db.collection('hero_images').updateOne(
                            { heroId: h.id },
                            { $set: { 
                                imageBuffer: imgRes.data, 
                                contentType: imgRes.headers['content-type'] || 'image/png',
                                updatedAt: new Date()
                            }},
                            { upsert: true }
                        );
                        console.log(`✅ Fully Synced: ${h.name} (Url: ${imgUrl})`);
                    } catch (imgErr: any) {
                        console.warn(`⚠️ Text saved, but image 404 for ${h.name} at ${imgUrl}`);
                    }
                }

            } catch (err: any) {
                console.error(`❌ Global error for ${h.name}: ${err.message}`);
            }
        }
        console.log("🏁 Sync process completed.");
    } catch (err) {
        console.error("❌ Critical Sync Failure:", err);
    }
}

cron.schedule('0 * * * *', async () => {
    // DB injection here
});