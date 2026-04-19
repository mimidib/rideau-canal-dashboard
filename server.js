// backend server to serve the frontend dashboard and read from Cosmos DB
const express = require("express");       // Express web framework (like Flask in Python)
const { CosmosClient } = require("@azure/cosmos"); // Azure Cosmos DB client library SDK for node.js
require("dotenv").config();               // loads .env into process.env (like load_dotenv in Python)

// ---- Config ----
const PORT = process.env.PORT || 3000; // || 3000 means "use port from env if set, otherwise default to 3000" for Azure app service, it sets this automatically
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY; // for authenticating and authorizing access to Cosmos DB 
const DATABASE_ID = "RideauCanalDB"; // ID of the cosmos Db in azure portal
const CONTAINER_ID = "SensorAggregations"; // Cosmod DB container (like a table) where processed sensor data is stored

// Validate env vars on startup, if empty then log error and exit
if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    console.error("Missing COSMOS_ENDPOINT or COSMOS_KEY in .env");
    process.exit(1);
}

// ---- Cosmos DB client, create, connect and authorize then set database and container (table) context ----
const cosmosClient = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
const container = cosmosClient.database(DATABASE_ID).container(CONTAINER_ID);

// ---- Express app, create and serve ----
const app = express();      // create web server app using express
app.use(express.static("public"));        // serves all our files in HTML/CSS/JS files from the public/ folder

// ---- Endpoints ----

// GET /api/latest -> most recent reading per location (for the 3 location cards)
app.get("/api/latest", async (req, res) => {
    try {
        // Query the latest document in the container (c) for each location using a parameterized query to prevent injection
        const query = `
            SELECT TOP 1 *
            FROM c
            WHERE c.location = @location
            ORDER BY c.EventTime DESC
        `;
        const locations = ["dows-lake", "fifth-avenue", "nac"];

        // Run query for each location in parallel, 
        //      async to pause/wait without blocking everything else while waiting for db response,
        //      promise.all to run all queries in parallel and wait for all to finish b4 proceeding. Faster than running one by one.
        const results = await Promise.all(
            // run query once per location
            locations.map(async (location) => {
                const { resources } = await container.items.query({
                    query,
                    parameters: [{ name: "@location", value: location }]
                }).fetchAll();
                return resources[0] || null;  // return first (and only cus "TOP 1" select) & latest doc or null if no data yet
            })
        );

        res.json(results.filter(Boolean));   // sends array back as a JSON response, filter out nulls (locations with no data yet)
    } catch (err) {
        console.error("Error fetching latest data:", err.message);
        res.status(500).json({ error: "Failed to fetch latest data" });
    }
});

// GET /api/history -> last hour of readings for all locations (for the charts). Also from Cosmos DB, 
//    but instead of getting just the latest per location we get all readings in the last hour to show trends in the charts.
app.get("/api/history", async (req, res) => {
    try {
        // Get timestamp from 1 hour ago in ISO format
        //      Date.now to get current time, then subtract (60 * 60 & 1000) which is = 1h in milliseconds, to get last 1h timestamp
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        // get all documents in the last hour using the oneHourAgo timestamp andorder by ascending time to show first to last in charts
        const query = `
            SELECT *
            FROM c
            WHERE c.EventTime >= @oneHourAgo
            ORDER BY c.EventTime ASC
        `;

        // Run query and get all matching documents/readings in last hour (will filter by location in frontend to display separate lines in charts)
        const { resources } = await container.items.query({
            query,
            parameters: [{ name: "@oneHourAgo", value: oneHourAgo }]
        }).fetchAll();

        res.json(resources);
    } catch (err) {
        console.error("Error fetching history:", err.message);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// ---- Start server ----
app.listen(PORT, () => {
    console.log(`Dashboard server running at http://localhost:${PORT}`);
});
