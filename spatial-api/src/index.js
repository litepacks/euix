/**
 * spatial-api/src/index.js
 * Cloudflare Worker & D1 Database API for EUIX Engine Interactive Map Suite.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable universal CORS for EUIX frontend clients
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// In-Memory Fallback Store (Used when running in environments without D1 binding attached)
let inMemoryPolygons = [
    {
        id: 'poly-ist-sultanahmet',
        name: 'Sultanahmet Historical Zone',
        country: 'TR',
        city: 'Istanbul',
        area_sq_m: 28540.5,
        display_area: '2.85 ha',
        coordinates: '[[41.0062, 28.9755], [41.0088, 28.9772], [41.0076, 28.9808], [41.0048, 28.9792]]',
        color: '#286247',
        fill_color: '#d9ef62',
        fill_opacity: 0.35,
        created_at: new Date().toISOString()
    },
    {
        id: 'poly-lon-hyde',
        name: 'Hyde Park Perimeter Study',
        country: 'UK',
        city: 'London',
        area_sq_m: 142000.0,
        display_area: '14.2 ha',
        coordinates: '[[51.5065, -0.1690], [51.5110, -0.1600], [51.5050, -0.1550], [51.5020, -0.1650]]',
        color: '#286247',
        fill_color: '#d9ef62',
        fill_opacity: 0.35,
        created_at: new Date().toISOString()
    }
];

// Helper: Ensure D1 table exists on first write if uninitialized
async function ensureDb(db) {
    if (!db) return;
    try {
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS polygons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                country TEXT NOT NULL,
                city TEXT,
                area_sq_m REAL NOT NULL,
                display_area TEXT NOT NULL,
                coordinates TEXT NOT NULL,
                color TEXT DEFAULT '#286247',
                fill_color TEXT DEFAULT '#d9ef62',
                fill_opacity REAL DEFAULT 0.34,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    } catch (_) {}
}

// 1. Health Check
app.get('/api/health', (c) => {
    return c.json({
        status: 'online',
        service: 'EUIX Spatial Cloudflare Worker',
        storage: c.env?.DB ? 'Cloudflare D1 SQL' : 'In-Memory Store',
        timestamp: new Date().toISOString()
    });
});

// 2. City Coordinate Presets & Metadata
app.get('/api/cities', (c) => {
    return c.json({
        cities: [
            { code: 'TR', city: 'Istanbul', name: 'Turkey', lat: 41.0082, lng: 28.9784, zoom: 13, flag: '🇹🇷' },
            { code: 'UK', city: 'London', name: 'United Kingdom', lat: 51.5074, lng: -0.1278, zoom: 13, flag: '🇬🇧' },
            { code: 'USA', city: 'New York', name: 'United States', lat: 40.7128, lng: -74.0060, zoom: 12, flag: '🇺🇸' },
            { code: 'JP', city: 'Tokyo', name: 'Japan', lat: 35.6762, lng: 139.6503, zoom: 12, flag: '🇯🇵' },
            { code: 'DE', city: 'Berlin', name: 'Germany', lat: 52.5200, lng: 13.4050, zoom: 13, flag: '🇩🇪' }
        ]
    });
});

// 3. Get All Polygons (Filterable by ?country=TR & ?search=...)
app.get('/api/polygons', async (c) => {
    const country = c.req.query('country');
    const search = c.req.query('search');
    const db = c.env?.DB;

    if (db) {
        await ensureDb(db);
        let query = 'SELECT * FROM polygons WHERE 1=1';
        const params = [];

        if (country && country.toUpperCase() !== 'ALL') {
            query += ' AND country = ?';
            params.push(country.toUpperCase());
        }

        if (search) {
            query += ' AND (name LIKE ? OR city LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        try {
            const stmt = params.length > 0 ? db.prepare(query).bind(...params) : db.prepare(query);
            const { results } = await stmt.all();
            
            // Parse JSON coordinates
            const items = (results || []).map(row => {
                let coords = row.coordinates;
                try { coords = typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : row.coordinates; } catch (_) {}
                return {
                    ...row,
                    latlngs: coords,
                    latLngs: coords,
                    points: coords,
                    area: row.area_sq_m,
                    areaM2: row.area_sq_m,
                    area_sq_m: row.area_sq_m,
                    displayArea: row.display_area,
                    display_area: row.display_area,
                    createdAt: row.created_at,
                    created_at: row.created_at
                };
            });

            return c.json({
                success: true,
                count: items.length,
                data: items
            });
        } catch (err) {
            return c.json({ success: false, error: err.message }, 500);
        }
    }

    // In-memory fallback
    let items = [...inMemoryPolygons];
    if (country && country.toUpperCase() !== 'ALL') {
        items = items.filter(p => p.country === country.toUpperCase());
    }
    if (search) {
        const s = search.toLowerCase();
        items = items.filter(p => (p.name && p.name.toLowerCase().includes(s)) || (p.city && p.city.toLowerCase().includes(s)));
    }

    return c.json({
        success: true,
        count: items.length,
        data: items.map(p => {
            let coords = p.coordinates;
            try { coords = typeof p.coordinates === 'string' ? JSON.parse(p.coordinates) : p.coordinates; } catch (_) {}
            return {
                ...p,
                latlngs: coords,
                latLngs: coords,
                points: coords,
                area: p.area_sq_m,
                areaM2: p.area_sq_m,
                area_sq_m: p.area_sq_m,
                displayArea: p.display_area,
                display_area: p.display_area,
                createdAt: p.created_at,
                created_at: p.created_at
            };
        })
    });
});

// 4. Create New Polygon (POST from EUIX map drawing)
app.post('/api/polygons', async (c) => {
    try {
        const body = await c.req.json();
        const id = body.id || `poly-${Date.now()}`;
        const name = body.name || `Polygon ${new Date().toLocaleTimeString()}`;
        const country = (body.country || 'TR').toUpperCase();
        const city = body.city || 'Custom Zone';
        const area_sq_m = Number(body.area || body.area_sq_m || 0);
        const display_area = body.displayArea || body.display_area || `${(area_sq_m / 10000).toFixed(2)} ha`;
        
        let coordinates = body.latlngs || body.coordinates || [];
        if (typeof coordinates !== 'string') {
            coordinates = JSON.stringify(coordinates);
        }

        const color = body.color || '#286247';
        const fill_color = body.fillColor || body.fill_color || '#d9ef62';
        const fill_opacity = Number(body.fillOpacity || body.fill_opacity || 0.34);

        const newRecord = {
            id,
            name,
            country,
            city,
            area_sq_m,
            display_area,
            coordinates,
            color,
            fill_color,
            fill_opacity,
            created_at: new Date().toISOString()
        };

        const db = c.env?.DB;
        if (db) {
            await ensureDb(db);
            await db.prepare(`
                INSERT INTO polygons (id, name, country, city, area_sq_m, display_area, coordinates, color, fill_color, fill_opacity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, name, country, city, area_sq_m, display_area, coordinates, color, fill_color, fill_opacity).run();
        } else {
            inMemoryPolygons.unshift(newRecord);
        }

        return c.json({
            success: true,
            message: 'Polygon created successfully',
            data: newRecord
        }, 201);
    } catch (err) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

// 5. Delete Polygon
app.delete('/api/polygons/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env?.DB;

    if (db) {
        try {
            await ensureDb(db);
            await db.prepare('DELETE FROM polygons WHERE id = ?').bind(id).run();
            return c.json({ success: true, message: `Polygon ${id} deleted` });
        } catch (err) {
            return c.json({ success: false, error: err.message }, 500);
        }
    }

    inMemoryPolygons = inMemoryPolygons.filter(p => p.id !== id);
    return c.json({ success: true, message: `Polygon ${id} deleted from memory` });
});

// 6. Reset & Seed Default Polygons
app.post('/api/seed', async (c) => {
    const seedData = [
        { id: 'poly-ist-sultanahmet', name: 'Sultanahmet Historical Zone', country: 'TR', city: 'Istanbul', area_sq_m: 28540.5, display_area: '2.85 ha', coordinates: '[[41.0062, 28.9755], [41.0088, 28.9772], [41.0076, 28.9808], [41.0048, 28.9792]]', color: '#286247', fill_color: '#d9ef62', fill_opacity: 0.35 },
        { id: 'poly-ist-galata', name: 'Galata Tower Periphery', country: 'TR', city: 'Istanbul', area_sq_m: 14200.0, display_area: '1.42 ha', coordinates: '[[41.0250, 28.9735], [41.0265, 28.9750], [41.0255, 28.9765], [41.0240, 28.9750]]', color: '#ef7e46', fill_color: '#d9ef62', fill_opacity: 0.35 },
        { id: 'poly-lon-hyde', name: 'Hyde Park Perimeter Study', country: 'UK', city: 'London', area_sq_m: 142000.0, display_area: '14.2 ha', coordinates: '[[51.5065, -0.1690], [51.5110, -0.1600], [51.5050, -0.1550], [51.5020, -0.1650]]', color: '#286247', fill_color: '#d9ef62', fill_opacity: 0.35 },
        { id: 'poly-tyo-shibuya', name: 'Shibuya Crossing District', country: 'JP', city: 'Tokyo', area_sq_m: 19800.0, display_area: '1.98 ha', coordinates: '[[35.6585, 139.6995], [35.6605, 139.7020], [35.6580, 139.7035], [35.6565, 139.7010]]', color: '#2563eb', fill_color: '#38bdf8', fill_opacity: 0.35 },
        { id: 'poly-nyc-central', name: 'Central Park South Basin', country: 'USA', city: 'New York', area_sq_m: 248000.0, display_area: '24.8 ha', coordinates: '[[40.7645, -73.9740], [40.7680, -73.9780], [40.7720, -73.9720], [40.7685, -73.9680]]', color: '#16a34a', fill_color: '#86efac', fill_opacity: 0.35 },
        { id: 'poly-ber-tiergarten', name: 'Tiergarten Cultural Green', country: 'DE', city: 'Berlin', area_sq_m: 89000.0, display_area: '8.9 ha', coordinates: '[[52.5130, 13.3550], [52.5170, 13.3650], [52.5120, 13.3700], [52.5080, 13.3600]]', color: '#d97706', fill_color: '#fde68a', fill_opacity: 0.35 }
    ];

    const db = c.env?.DB;
    if (db) {
        await ensureDb(db);
        await db.prepare('DELETE FROM polygons').run();
        for (const item of seedData) {
            await db.prepare(`
                INSERT INTO polygons (id, name, country, city, area_sq_m, display_area, coordinates, color, fill_color, fill_opacity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(item.id, item.name, item.country, item.city, item.area_sq_m, item.display_area, item.coordinates, item.color, item.fill_color, item.fill_opacity).run();
        }
    } else {
        inMemoryPolygons = [...seedData];
    }

    return c.json({
        success: true,
        message: 'Spatial database successfully seeded with 6 city areas.',
        count: seedData.length
    });
});

export default app;
