# Rideau Canal Dashboard

A real-time web dashboard displaying live sensor data from the Rideau Canal Skateway. Built with Node.js and Express, querying Azure Cosmos DB, with a Grafana-inspired dark UI.

## Repository Structure

```
rideau-canal-dashboard/
├── README.md               # This file
├── server.js               # Node.js/Express backend
├── package.json            # Node dependencies
├── package-lock.json
├── .env.example            # Example environment variables
├── .gitignore
└── public/
    ├── index.html          # Dashboard UI
    ├── styles.css          # Grafana-inspired dark theme
    └── app.js              # Frontend JS — fetches API, renders Chart.js charts
```

---

## Overview

### Dashboard Features
- **3 location cards** — Dow's Lake, Fifth Avenue, NAC — showing current avg ice thickness, surface temperature, snow accumulation, and external temperature
- **Safety status badges** — Safe / Caution / Unsafe per location based on Stream Analytics aggregations
- **Overall system status** — worst-case status across all locations shown in the header
- **Historical trend charts** — 4 Chart.js line charts showing the last hour of data per location
- **Auto-refresh** — updates every 30 seconds automatically

### Technologies Used
- **Node.js + Express** — backend server, API routes, serves static files
- **@azure/cosmos** — official Azure SDK to query Cosmos DB
- **Chart.js** — frontend charting library (loaded via CDN)
- **dotenv** — loads environment variables from `.env`

> **Note on Grafana:** Grafana was initially considered as it is a powerful visualization tool. It was ruled out because Azure Managed Grafana is not available on student subscriptions, and there is no native Cosmos DB connector for Grafana — a middleware API would be required, tripling the complexity.

---

## Prerequisites

- Node.js 18+
- Azure Cosmos DB account with database `RideauCanalDB` and container `SensorAggregations`
- Stream Analytics job running and writing data to Cosmos DB

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/mimidib/rideau-canal-dashboard
cd rideau-canal-dashboard

# 2. Install dependencies
npm install
```

---

## Configuration

Create a `.env` file in the project root:

```
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-primary-key
```

Get these from: **Azure Portal → Cosmos DB account → Settings → Keys**
- **URI** → `COSMOS_ENDPOINT`
- **Primary Key** → `COSMOS_KEY`

> Use the Primary Key (long base64 string), not the Primary Connection String. The `@azure/cosmos` SDK expects endpoint and key separately.

---

## Usage

```bash
node server.js
```

Then open your browser at `http://localhost:3000`.

The server serves the frontend from `public/` and exposes two API endpoints. `app.js` runs in the browser automatically — you do not run it directly.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/latest` | GET | Most recent aggregation per location (for location cards) |
| `/api/history` | GET | All aggregations from the last hour (for charts) |

### Example: `GET /api/latest`

```json
[
  {
    "location": "Dow's Lake",
    "EventTime": "2026-04-17T18:35:00Z",
    "AvgIceThickness": 32.4,
    "AvgSurfaceTemperature": -3.1,
    "MaxSnowAccumulation": 8.2,
    "AvgExternalTemperature": -11.5,
    "SafetyStatus": "Safe"
  }
]
```

### Example: `GET /api/history`

```json
[
  {
    "location": "Dow's Lake",
    "EventTime": "2026-04-17T17:40:00Z",
    "AvgIceThickness": 31.8,
    "SafetyStatus": "Safe"
  },
  ...
]
```

---

## Deployment to Azure App Service

### Prerequisites
- Azure subscription with an active resource group
- Code pushed to GitHub (`mimidib/rideau-canal-dashboard`)

### Steps

**1. Create the Web App**
- Azure Portal → **App Services** → **+ Create**
- **Resource group:** your existing group
- **Name:** `rideau-canal-dashboard-mimi`
- **Publish:** Code
- **Runtime stack:** Node 20 LTS
- **OS:** Linux
- **Region:** Canada Central
- **Pricing plan:** Free F1
- Click **Review + Create** → **Create**

**2. Configure Environment Variables**
- Go to your new App Service → **Settings → Environment variables**
- Click **+ Add** for each variable:
  - `COSMOS_ENDPOINT` → your Cosmos DB URI
  - `COSMOS_KEY` → your Cosmos DB Primary Key
- Click **Apply** → **Confirm**

**3. Deploy from GitHub**
- In your App Service → **Deployment Center**
- **Source:** GitHub
- Authorize and select:
  - **Organization:** `mimidib`
  - **Repository:** `rideau-canal-dashboard`
  - **Branch:** `main`
- Click **Save** — Azure will build and deploy automatically

**4. Verify**
- Go to **Overview** → click the URL or wait for deployment to complete under **Deployment Center → Logs**

The live dashboard will be available at:
`https://rideau-canal-dashboard-mimi-b4cxg9afaabvfdcn.canadacentral-01.azurewebsites.net`

---

## Dashboard Features

### Real-time Updates
`app.js` calls `/api/latest` and `/api/history` on load, then repeats every 30 seconds via `setInterval`. No page refresh required.

### Safety Status Indicators
Each location card displays a colour-coded badge:
- **Green — Safe:** Avg ice ≥ 30cm AND avg surface temp ≤ -2°C
- **Yellow — Caution:** Avg ice ≥ 25cm AND avg surface temp ≤ 0°C
- **Red — Unsafe:** All other conditions

The header shows the overall system status (worst-case across all three locations).

### Charts
Four Chart.js line charts show the last hour of data with one line per location:
- Ice Thickness (cm)
- Surface Temperature (°C)
- Snow Accumulation (cm)
- External Temperature (°C)

---

## Troubleshooting

**`Missing COSMOS_ENDPOINT or COSMOS_KEY in .env`**
Create a `.env` file with your Cosmos DB credentials. See Configuration above.

**Dashboard shows `--` for all values**
- Confirm Stream Analytics job is running and writing to Cosmos DB
- Check Cosmos DB Data Explorer for documents in `SensorAggregations`
- Verify your Cosmos DB credentials in `.env` are correct

**`Cannot find module 'express'`**
Run `npm install` to install dependencies.

**Charts are empty**
The `/api/history` endpoint returns data from the last hour. If your Stream Analytics job has been running for less than one 5-minute window, there may be no history yet. Wait for data to accumulate.
