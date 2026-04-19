# API Documentation — Rideau Canal Dashboard

The dashboard backend exposes two REST API endpoints. Both are served by the Node.js/Express server and query Azure Cosmos DB (`RideauCanalDB` → `SensorAggregations`).

---

## Base URL

**Local:** `http://localhost:3000`
**Production:** `https://rideau-canal-dashboard-mimi-b4cxg9afaabvfdcn.canadacentral-01.azurewebsites.net`

---

## Endpoints

### `GET /api/latest`

Returns the most recent 5-minute aggregation document for each of the three locations. Used by the dashboard to populate the three location cards with current conditions.

**Request**
```
GET /api/latest
```
No parameters required.

**Response**

Returns a JSON array with one object per location (up to 3). Locations with no data are omitted.

```json
[
  {
    "location": "dows-lake",
    "EventTime": "2026-04-18T03:20:00.0000000Z",
    "AvgIceThickness": 23.48,
    "MinIceThickness": 0.01,
    "MaxIceThickness": 56.63,
    "AvgSurfaceTemperature": -9.49,
    "MinSurfaceTemperature": -35.96,
    "MaxSurfaceTemperature": 8.25,
    "AvgExternalTemperature": -8.86,
    "MaxSnowAccumulation": 28.31,
    "ReadingCount": 30,
    "SafetyStatus": "Unsafe"
  },
  {
    "location": "fifth-avenue",
    "EventTime": "2026-04-18T03:20:00.0000000Z",
    "AvgIceThickness": 31.12,
    "MinIceThickness": 18.44,
    "MaxIceThickness": 47.90,
    "AvgSurfaceTemperature": -4.21,
    "MinSurfaceTemperature": -18.33,
    "MaxSurfaceTemperature": -1.02,
    "AvgExternalTemperature": -12.40,
    "MaxSnowAccumulation": 14.67,
    "ReadingCount": 30,
    "SafetyStatus": "Safe"
  },
  {
    "location": "nac",
    "EventTime": "2026-04-18T03:20:00.0000000Z",
    "AvgIceThickness": 27.55,
    "MinIceThickness": 11.20,
    "MaxIceThickness": 44.81,
    "AvgSurfaceTemperature": -1.88,
    "MinSurfaceTemperature": -9.14,
    "MaxSurfaceTemperature": 0.43,
    "AvgExternalTemperature": -6.72,
    "MaxSnowAccumulation": 20.15,
    "ReadingCount": 30,
    "SafetyStatus": "Caution"
  }
]
```

**Response Fields**

| Field | Type | Description |
|---|---|---|
| `location` | string | Location identifier (`dows-lake`, `fifth-avenue`, `nac`) |
| `EventTime` | string | ISO 8601 UTC timestamp — end of the 5-minute window |
| `AvgIceThickness` | number | Average ice thickness in cm over the window |
| `MinIceThickness` | number | Minimum ice thickness in cm over the window |
| `MaxIceThickness` | number | Maximum ice thickness in cm over the window |
| `AvgSurfaceTemperature` | number | Average ice surface temperature in °C |
| `MinSurfaceTemperature` | number | Minimum surface temperature in °C |
| `MaxSurfaceTemperature` | number | Maximum surface temperature in °C |
| `AvgExternalTemperature` | number | Average external (air) temperature in °C |
| `MaxSnowAccumulation` | number | Maximum snow accumulation in cm over the window |
| `ReadingCount` | number | Number of raw sensor readings in the window (expect ~30) |
| `SafetyStatus` | string | `Safe`, `Caution`, or `Unsafe` — computed by Stream Analytics |

**Safety Status Logic**

| Status | Condition |
|---|---|
| `Safe` | AvgIceThickness >= 30cm AND AvgSurfaceTemperature <= -2 degrees C |
| `Caution` | AvgIceThickness >= 25cm AND AvgSurfaceTemperature <= 0 degrees C |
| `Unsafe` | All other conditions |

**Error Response**
```json
{ "error": "Failed to fetch latest data" }
```
HTTP 500 — returned if the Cosmos DB query fails.

---

### `GET /api/history`

Returns all 5-minute aggregation documents from the past hour across all locations, sorted oldest-first. Used by the dashboard to populate the four Chart.js trend charts.

**Request**
```
GET /api/history
```
No parameters required. The time range (last 60 minutes) is computed server-side.

**Response**

Returns a JSON array ordered by `EventTime` ascending. All three locations are included in the same array — the frontend groups them by location for charting.

```json
[
  {
    "location": "dows-lake",
    "EventTime": "2026-04-18T02:25:00.0000000Z",
    "AvgIceThickness": 25.10,
    "AvgSurfaceTemperature": -6.33,
    "AvgExternalTemperature": -10.21,
    "MaxSnowAccumulation": 18.44,
    "SafetyStatus": "Caution",
    "ReadingCount": 30
  },
  {
    "location": "fifth-avenue",
    "EventTime": "2026-04-18T02:25:00.0000000Z",
    "AvgIceThickness": 33.80,
    "AvgSurfaceTemperature": -5.10,
    "AvgExternalTemperature": -13.00,
    "MaxSnowAccumulation": 12.90,
    "SafetyStatus": "Safe",
    "ReadingCount": 30
  }
]
```

Documents repeat for each 5-minute window in the last hour — expect up to 12 windows x 3 locations = 36 documents maximum.

**Error Response**
```json
{ "error": "Failed to fetch history" }
```
HTTP 500 — returned if the Cosmos DB query fails.

---

## How the Frontend Uses These Endpoints

| Endpoint | Used by | Refresh |
|---|---|---|
| `/api/latest` | Location cards, safety badges, system status header | Every 30 seconds |
| `/api/history` | Four Chart.js line charts (ice, surface temp, snow, external temp) | Every 30 seconds |

Both endpoints are called simultaneously on page load and then on a 30-second interval via `setInterval` in `public/app.js`.
