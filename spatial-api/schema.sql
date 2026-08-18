-- Cloudflare D1 SQL Schema for EUIX Spatial Map Data
CREATE TABLE IF NOT EXISTS polygons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT,
    area_sq_m REAL NOT NULL,
    display_area TEXT NOT NULL,
    coordinates TEXT NOT NULL, -- JSON string of [[lat, lng], ...]
    color TEXT DEFAULT '#286247',
    fill_color TEXT DEFAULT '#d9ef62',
    fill_opacity REAL DEFAULT 0.34,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_polygons_country ON polygons(country);
CREATE INDEX IF NOT EXISTS idx_polygons_created ON polygons(created_at DESC);

-- Initial Mock Seed Data
INSERT OR IGNORE INTO polygons (id, name, country, city, area_sq_m, display_area, coordinates, color, fill_color, fill_opacity)
VALUES 
('poly-ist-sultanahmet', 'Sultanahmet Historical Zone', 'TR', 'Istanbul', 28540.5, '2.85 ha', '[[41.0062, 28.9755], [41.0088, 28.9772], [41.0076, 28.9808], [41.0048, 28.9792]]', '#286247', '#d9ef62', 0.35),
('poly-ist-galata', 'Galata Tower Periphery', 'TR', 'Istanbul', 14200.0, '1.42 ha', '[[41.0250, 28.9735], [41.0265, 28.9750], [41.0255, 28.9765], [41.0240, 28.9750]]', '#ef7e46', '#d9ef62', 0.35),
('poly-lon-hyde', 'Hyde Park Perimeter Study', 'UK', 'London', 142000.0, '14.2 ha', '[[51.5065, -0.1690], [51.5110, -0.1600], [51.5050, -0.1550], [51.5020, -0.1650]]', '#286247', '#d9ef62', 0.35),
('poly-tyo-shibuya', 'Shibuya Crossing District', 'JP', 'Tokyo', 19800.0, '1.98 ha', '[[35.6585, 139.6995], [35.6605, 139.7020], [35.6580, 139.7035], [35.6565, 139.7010]]', '#2563eb', '#38bdf8', 0.35),
('poly-nyc-central', 'Central Park South Basin', 'USA', 'New York', 248000.0, '24.8 ha', '[[40.7645, -73.9740], [40.7680, -73.9780], [40.7720, -73.9720], [40.7685, -73.9680]]', '#16a34a', '#86efac', 0.35),
('poly-ber-tiergarten', 'Tiergarten Cultural Green', 'DE', 'Berlin', 89000.0, '8.9 ha', '[[52.5130, 13.3550], [52.5170, 13.3650], [52.5120, 13.3700], [52.5080, 13.3600]]', '#d97706', '#fde68a', 0.35);
