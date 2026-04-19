// Frontend JS — fetches data from the backend API and updates the dashboard

const REFRESH_INTERVAL = 30000; // 30 seconds for auto-refresh

// Location key mapping — maps location name to HTML element ID suffix
//      irrelvant right now, but previously we had a different name for locations
const LOCATIONS = {
    "dows-lake":     "dows-lake",
    "fifth-avenue":  "fifth-avenue",
    "nac":           "nac"
};

// Chart.js color per location
const LOCATION_COLORS = {
    "dows-lake":    "#5794f2",
    "fifth-avenue": "#73bf69",
    "nac":          "#f2cc0c"
};

// Holds Chart.js instances so we can update them without recreating
const charts = {};

// ---- Fetch latest readings and update location cards ----
async function fetchLatest() {
    try {
        const res = await fetch("/api/latest");
        const data = await res.json();

        let overallStatus = "Safe";

        data.forEach((location) => {
            const key = LOCATIONS[location.location];
            if (!key) return;

            // Update metric values
            document.getElementById(`ice-${key}`).textContent     = location.AvgIceThickness?.toFixed(1)      ?? "--";
            document.getElementById(`surface-${key}`).textContent = location.AvgSurfaceTemperature?.toFixed(1) ?? "--";
            document.getElementById(`snow-${key}`).textContent    = location.MaxSnowAccumulation?.toFixed(1)   ?? "--";
            document.getElementById(`ext-${key}`).textContent     = location.AvgExternalTemperature?.toFixed(1)?? "--";

            // Update safety badge
            const badge = document.getElementById(`status-${key}`);
            const status = location.SafetyStatus || "Unknown";
            badge.textContent = status;
            badge.className = `badge ${statusClass(status)}`;

            // Determine overall system status (worst of all locations)
            if (status === "Unsafe") overallStatus = "Unsafe";
            else if (status === "Caution" && overallStatus !== "Unsafe") overallStatus = "Caution";
        });

        // Update system status in header
        const systemBadge = document.getElementById("system-status");
        systemBadge.textContent = overallStatus;
        systemBadge.className = `badge ${statusClass(overallStatus)}`;

        // Update last refreshed time
        document.getElementById("last-updated").textContent =
            "Last updated: " + new Date().toLocaleTimeString();

    } catch (err) {
        console.error("Failed to fetch latest data:", err);
    }
}

// ---- Fetch history and update charts ----
async function fetchHistory() {
    try {
        const res = await fetch("/api/history");
        const data = await res.json();

        // Group records by location
        const grouped = {};
        data.forEach((record) => {
            if (!grouped[record.location]) grouped[record.location] = [];
            grouped[record.location].push(record);
        });

        // Build shared time labels from first location's data
        const firstKey = Object.keys(grouped)[0];
        const labels = firstKey
            ? grouped[firstKey].map((r) => new Date(r.EventTime).toLocaleTimeString())
            : [];

        // Update each chart
        updateChart("chart-ice",      labels, grouped, "AvgIceThickness");
        updateChart("chart-surface",  labels, grouped, "AvgSurfaceTemperature");
        updateChart("chart-snow",     labels, grouped, "MaxSnowAccumulation");
        updateChart("chart-external", labels, grouped, "AvgExternalTemperature");

    } catch (err) {
        console.error("Failed to fetch history:", err);
    }
}

// ---- Create or update a Chart.js line chart ----
function updateChart(canvasId, labels, grouped, field) {
    const datasets = Object.entries(grouped).map(([locationName, records]) => ({
        label: locationName,
        data: records.map((r) => r[field] ?? null),
        borderColor: LOCATION_COLORS[locationName] || "#fff",
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3
    }));

    if (charts[canvasId]) {
        // Chart already exists — just update the data
        charts[canvasId].data.labels = labels;
        charts[canvasId].data.datasets = datasets;
        charts[canvasId].update();
    } else {
        // Create chart for the first time
        const ctx = document.getElementById(canvasId).getContext("2d");
        charts[canvasId] = new Chart(ctx, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                animation: false,
                plugins: {
                    legend: {
                        labels: { color: "#8e9aab", font: { size: 12 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: "#8e9aab", maxTicksLimit: 8 },
                        grid:  { color: "#2c2f33" }
                    },
                    y: {
                        ticks: { color: "#8e9aab" },
                        grid:  { color: "#2c2f33" }
                    }
                }
            }
        });
    }
}

// ---- Maps safety status string to CSS class ----
function statusClass(status) {
    if (status === "Safe")    return "badge-safe";
    if (status === "Caution") return "badge-caution";
    if (status === "Unsafe")  return "badge-unsafe";
    return "badge-loading";
}

// ---- Initial load + auto-refresh ----
async function refresh() {
    await fetchLatest();
    await fetchHistory();
}

refresh();
setInterval(refresh, REFRESH_INTERVAL);
