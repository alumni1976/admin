import { supabaseFetch } from "../database.js";
import { escapeHtml } from "../app.js";

export async function renderMetricsPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Φόρτωση μετρικών...</div>`;

  try {
    const rows = await supabaseFetch(
      "/rest/v1/t_alumini1976_metrics?select=*&order=recorded_at.desc&limit=1"
    );

    if (!rows || !rows.length) {
      app.innerHTML = `<div class="message error">Δεν βρέθηκαν δεδομένα μετρικών.</div>`;
      return;
    }

    const m = rows[0];
    const recordedAt = formatDateTime(m.recorded_at);

    app.innerHTML = `
      <section class="page-title">
        <div>
          <h1>ΜΕΤΡΙΚΕΣ ΣΥΣΤΗΜΑΤΟΣ</h1>
          <p>Τελευταία ενημέρωση: ${escapeHtml(recordedAt)}</p>
        </div>
      </section>

      <!-- SUPABASE -->
      <section class="metrics-source-section">
        <div class="metrics-source-header metrics-source-header--supabase">
          <span class="metrics-source-icon">🗄️</span>
          <h2>Supabase</h2>
        </div>

        <div class="metrics-cards-grid">
          ${metricCard("Μέγεθος Βάσης", formatBytes(m.supabase_db_size_bytes), "supabase")}
          ${metricCard("Όριο Βάσης", formatBytes(m.supabase_db_limit_bytes), "supabase")}
          ${metricCard("Bandwidth Χρήση", formatBytes(m.supabase_bandwidth_usage_bytes), "supabase")}
          ${metricCard("Όριο Bandwidth", formatBytes(m.supabase_bandwidth_limit_bytes), "supabase")}
        </div>

        <div class="metrics-progress-wrap">
          ${progressBar(
            "Χρήση αποθηκευτικού χώρου βάσης",
            m.supabase_db_size_bytes,
            m.supabase_db_limit_bytes,
            "supabase"
          )}
          ${progressBar(
            "Χρήση bandwidth",
            m.supabase_bandwidth_usage_bytes,
            m.supabase_bandwidth_limit_bytes,
            "supabase"
          )}
        </div>
      </section>

      <!-- GITHUB -->
      <section class="metrics-source-section">
        <div class="metrics-source-header metrics-source-header--github">
          <span class="metrics-source-icon">🐙</span>
          <h2>GitHub</h2>
        </div>

        <div class="metrics-cards-grid">
          ${metricCard("Views", formatNumber(m.github_views_count), "github")}
          ${metricCard("Clones", formatNumber(m.github_clones_count), "github")}
          ${metricCard("Stars", formatNumber(m.github_stars_count), "github")}
          ${metricCard("Open Issues", formatNumber(m.github_open_issues_count), "github")}
          ${metricCard("Μέγεθος Repo", formatKb(m.github_repo_size_kb), "github")}
          ${metricCard("Shared Storage", `${escapeHtml(String(m.github_shared_storage_used_gb ?? "–"))} GB / ${formatNumber(m.github_shared_storage_limit_gb)} GB`, "github")}
        </div>
      </section>

      <!-- CLOUDINARY -->
      <section class="metrics-source-section">
        <div class="metrics-source-header metrics-source-header--cloudinary">
          <span class="metrics-source-icon">☁️</span>
          <h2>Cloudinary</h2>
        </div>

        <div class="metrics-cards-grid">
          ${metricCard("Storage (σύνολο)", formatBytes(m.cloudinary_storage_bytes), "cloudinary")}
          ${metricCard("Bandwidth (σύνολο)", formatBytes(m.cloudinary_bandwidth_bytes), "cloudinary")}
          ${metricCard("Transformations (σύνολο)", formatNumber(m.cloudinary_transformations), "cloudinary")}
          ${metricCard("Storage (30 ημέρες)", formatBytes(m.cloudinary_storage_bytes_30d), "cloudinary")}
          ${metricCard("Bandwidth (30 ημέρες)", formatBytes(m.cloudinary_bandwidth_bytes_30d), "cloudinary")}
          ${metricCard("Transformations (30 ημέρες)", formatNumber(m.cloudinary_transformations_30d), "cloudinary")}
        </div>
      </section>
    `;

  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="message error">Αποτυχία φόρτωσης μετρικών: ${escapeHtml(err.message)}</div>`;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function metricCard(label, value, source) {
  return `
    <div class="metric-card metric-card--${escapeHtml(source)}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function progressBar(label, used, total, source) {
  if (used == null || total == null || total === 0) return "";

  const pct = Math.min(100, Math.round((used / total) * 100));
  const colorClass = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";

  return `
    <div class="metrics-progress">
      <div class="metrics-progress-label">
        <span>${escapeHtml(label)}</span>
        <strong>${pct}%</strong>
      </div>
      <div class="metrics-progress-track">
        <div
          class="metrics-progress-fill metrics-progress-fill--${colorClass}"
          style="width: ${pct}%"
        ></div>
      </div>
      <div class="metrics-progress-sub">
        ${formatBytes(used)} από ${formatBytes(total)}
      </div>
    </div>
  `;
}

function formatBytes(bytes) {
  if (bytes == null) return "–";
  const b = Number(bytes);
  if (isNaN(b)) return "–";
  if (b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatKb(kb) {
  if (kb == null) return "–";
  const n = Number(kb);
  if (isNaN(n)) return "–";
  if (n >= 1024) return `${(n / 1024).toFixed(2)} MB`;
  return `${n} KB`;
}

function formatNumber(n) {
  if (n == null) return "–";
  const num = Number(n);
  if (isNaN(num)) return "–";
  return new Intl.NumberFormat("el-GR").format(num);
}

function formatDateTime(value) {
  if (!value) return "–";
  try {
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
