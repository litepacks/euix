# 🌐 EUIX Spatial API — Cloudflare Worker & D1 Database

A lightweight, high-performance spatial backend built with **Cloudflare Workers** and **Cloudflare D1 (Serverless SQLite)** for storing, querying, and managing polygon geometries, surface areas, and metadata for **EUIX Engine** interactive map applications.

---

## 🌐 Live Production Deployment
- **Worker Base URL:** `https://euix-spatial-api.webspresso.workers.dev`
- **Health Check:** `https://euix-spatial-api.webspresso.workers.dev/api/health`
- **Polygons API:** `https://euix-spatial-api.webspresso.workers.dev/api/polygons`

---

## 🏗️ Architecture

```
                    +------------------------------------------+
                    |  EUIX Engine Client (map_demo.html)      |
                    |  <api_config> + <leaflet_map>            |
                    +------------------------------------------+
                                         |
                                HTTP REST / JSON (CORS)
                                         |
                                         v
                    +------------------------------------------+
                    | Cloudflare Worker (Hono Router)          |
                    | /api/polygons, /api/cities, /api/seed    |
                    +------------------------------------------+
                                         |
                                   D1 Binding (DB)
                                         |
                                         v
                    +------------------------------------------+
                    | Cloudflare D1 Serverless SQL Database    |
                    | Table: polygons (GeoJSON coordinates)    |
                    +------------------------------------------+
```

---

## 🚀 Quick Start

### 1. Installation

```bash
cd spatial-api
npm install
```

### 2. Initialize Local D1 Database

```bash
# Execute schema migration against local D1 database
npx wrangler d1 execute euix-spatial-db --local --file=./schema.sql
```

### 3. Start Local Development Server

```bash
npm run dev
```

The Worker will start locally on `http://localhost:8787`.

---

## 📡 REST API Endpoints

| Method | Endpoint | Description | Query Parameters |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/api/health` | Health check & storage status | - |
| **`GET`** | `/api/cities` | City center presets & spatial metadata | - |
| **`GET`** | `/api/polygons` | List all saved polygons & measured areas | `?country=TR`, `?search=Sultanahmet` |
| **`POST`** | `/api/polygons` | Save a new polygon drawn on the map | JSON Body |
| **`DELETE`**| `/api/polygons/:id` | Delete a polygon by ID | - |
| **`POST`** | `/api/seed` | Reset & re-populate mock data | - |

---

## 🗺️ Connecting to EUIX Engine (<api_config>)

Use declarative `<api_config>` to fetch and persist polygons straight from the Cloudflare Worker into `<leaflet_map>`:

```xml
<uid_spec>
  <data_model>
    <state id="selections" type="array"></state>
    <state id="active_country">TR</state>
  </data_model>

  <!-- Cloudflare Worker API Configuration -->
  <api_config base_url="http://localhost:8787">
    <!-- Auto-fetch polygons for current country -->
    <api_endpoint 
      id="get_polygons" 
      url="/api/polygons?country={data.active_country}" 
      method="GET" 
      select="data" 
      bind_target="selections" 
      auto_fetch="true" 
    />
  </api_config>

  <!-- Interactive Map automatically synchronized with Cloudflare D1 data -->
  <leaflet_map 
    id="main_map" 
    lat="41.0082" 
    lng="28.9784" 
    zoom="13" 
    bind="data.selections" 
    draw="true" 
  />
</uid_spec>
```

---

## ☁️ Deployment to Cloudflare

1. Create a remote D1 database on Cloudflare:
   ```bash
   npx wrangler d1 create euix-spatial-db
   ```
2. Update `database_id` inside `wrangler.toml` with the generated UUID.
3. Apply the schema migration to remote:
   ```bash
   npx wrangler d1 execute euix-spatial-db --remote --file=./schema.sql
   ```
4. Deploy the worker:
   ```bash
   npm run deploy
   ```
