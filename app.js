/**
 * AI Detection Dashboard — App Logic
 * Fetches detections from Supabase and renders the live dashboard.
 */

// ============================================================
// 🔧 CONFIGURATION — Replace with your Supabase credentials
// ============================================================
const SUPABASE_URL = "https://rvimwofuxfxngbhcgsxb.supabase.co";
const API_KEY = "sb_publishable_8rwkGi1W-skfghdlltysBQ_-zG7Z9_M";

// Auto-refresh interval in milliseconds
const REFRESH_INTERVAL = 5000;

// Max rows to display
const MAX_ROWS = 50;

// ============================================================

const headers = {
  apikey: API_KEY,
  Authorization: `Bearer ${API_KEY}`,
};

// Emoji map for common YOLO objects
const EMOJI_MAP = {
  person: "🧑",
  bicycle: "🚲",
  car: "🚗",
  motorcycle: "🏍️",
  airplane: "✈️",
  bus: "🚌",
  train: "🚆",
  truck: "🚛",
  boat: "⛵",
  "traffic light": "🚦",
  "fire hydrant": "🧯",
  "stop sign": "🛑",
  bench: "🪑",
  bird: "🐦",
  cat: "🐱",
  dog: "🐕",
  horse: "🐴",
  sheep: "🐑",
  cow: "🐄",
  elephant: "🐘",
  bear: "🐻",
  zebra: "🦓",
  giraffe: "🦒",
  backpack: "🎒",
  umbrella: "☂️",
  handbag: "👜",
  tie: "👔",
  suitcase: "🧳",
  frisbee: "🥏",
  skis: "🎿",
  snowboard: "🏂",
  "sports ball": "⚽",
  kite: "🪁",
  "baseball bat": "🏏",
  "baseball glove": "🧤",
  skateboard: "🛹",
  surfboard: "🏄",
  "tennis racket": "🎾",
  bottle: "🍼",
  "wine glass": "🍷",
  cup: "☕",
  fork: "🍴",
  knife: "🔪",
  spoon: "🥄",
  bowl: "🥣",
  banana: "🍌",
  apple: "🍎",
  sandwich: "🥪",
  orange: "🍊",
  broccoli: "🥦",
  carrot: "🥕",
  "hot dog": "🌭",
  pizza: "🍕",
  donut: "🍩",
  cake: "🎂",
  chair: "🪑",
  couch: "🛋️",
  "potted plant": "🪴",
  bed: "🛏️",
  "dining table": "🍽️",
  toilet: "🚽",
  tv: "📺",
  laptop: "💻",
  mouse: "🖱️",
  remote: "📱",
  keyboard: "⌨️",
  "cell phone": "📱",
  microwave: "🔲",
  oven: "🔥",
  toaster: "🍞",
  sink: "🚰",
  refrigerator: "🧊",
  book: "📖",
  clock: "🕐",
  vase: "🏺",
  scissors: "✂️",
  "teddy bear": "🧸",
  "hair drier": "💨",
  toothbrush: "🪥",
};

// DOM elements
const totalCountEl = document.getElementById("total-count");
const uniqueCountEl = document.getElementById("unique-count");
const avgConfidenceEl = document.getElementById("avg-confidence");
const latestObjectEl = document.getElementById("latest-object");
const tableBodyEl = document.getElementById("table-body");
const detectionTableEl = document.getElementById("detection-table");
const loadingStateEl = document.getElementById("loading-state");
const emptyStateEl = document.getElementById("empty-state");
const statusDot = document.querySelector(".status-dot");
const statusText = document.getElementById("status-text");
const lastUpdateEl = document.getElementById("last-update");
const refreshBtn = document.getElementById("refresh-btn");

function getEmoji(name) {
  return EMOJI_MAP[name?.toLowerCase()] || "🔍";
}

function formatTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function getConfidenceColor(conf) {
  if (conf >= 0.8) return "var(--accent-green)";
  if (conf >= 0.5) return "var(--accent-cyan)";
  return "var(--accent-orange)";
}

function updateStats(data) {
  // Total
  totalCountEl.textContent = data.length.toLocaleString();

  // Unique objects
  const unique = new Set(data.map((d) => d.object_name));
  uniqueCountEl.textContent = unique.size;

  // Avg confidence
  if (data.length > 0) {
    const avg = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
    avgConfidenceEl.textContent = (avg * 100).toFixed(1) + "%";
  } else {
    avgConfidenceEl.textContent = "—";
  }

  // Latest
  if (data.length > 0) {
    const latest = data[0];
    latestObjectEl.textContent =
      getEmoji(latest.object_name) + " " + latest.object_name;
  } else {
    latestObjectEl.textContent = "—";
  }
}

function renderTable(data) {
  tableBodyEl.innerHTML = "";

  data.slice(0, MAX_ROWS).forEach((item, index) => {
    const conf = item.confidence;
    const pct = (conf * 100).toFixed(1);
    const color = getConfidenceColor(conf);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <span class="object-name">
          <span class="object-emoji">${getEmoji(item.object_name)}</span>
          ${item.object_name}
        </span>
      </td>
      <td>
        <div class="confidence-cell">
          <div class="confidence-bar-bg">
            <div class="confidence-bar" style="width: ${pct}%; background: ${color};"></div>
          </div>
          <span class="confidence-value" style="color: ${color}">${pct}%</span>
        </div>
      </td>
      <td><span class="timestamp">${formatTime(item.created_at)}</span></td>
    `;
    tableBodyEl.appendChild(tr);
  });
}

async function fetchDetections() {
  refreshBtn.classList.add("spinning");

  try {
    const url = `${SUPABASE_URL}?order=created_at.desc&limit=${MAX_ROWS}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Update status
    statusDot.classList.add("live");
    statusText.textContent = "Live";

    // Update timestamp
    lastUpdateEl.textContent = "Updated " + new Date().toLocaleTimeString();

    // Hide loading, show content
    loadingStateEl.style.display = "none";

    if (data.length === 0) {
      emptyStateEl.style.display = "flex";
      detectionTableEl.style.display = "none";
    } else {
      emptyStateEl.style.display = "none";
      detectionTableEl.style.display = "table";
    }

    updateStats(data);
    renderTable(data);
  } catch (err) {
    console.error("Fetch error:", err);
    statusDot.classList.remove("live");
    statusText.textContent = "Error";

    loadingStateEl.style.display = "none";
    emptyStateEl.style.display = "flex";
    emptyStateEl.querySelector("p").textContent = "Connection error";
    emptyStateEl.querySelector("span").textContent =
      "Check your Supabase URL and API key in app.js";
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

// Manual refresh
refreshBtn.addEventListener("click", fetchDetections);

// Initial fetch + auto-refresh
fetchDetections();
setInterval(fetchDetections, REFRESH_INTERVAL);
