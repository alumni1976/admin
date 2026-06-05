import { getEventRegistrations } from "../database.js";
import { escapeHtml } from "../app.js";

export async function renderEventExportsPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Preparing exports...</div>`;

  try {
    const rows = await getEventRegistrations();
    app.innerHTML = `
      <section class="page-title">
        <div>
          <h1>EXPORTS</h1>
          <p>Download event registration data as CSV.</p>
        </div>
      </section>

      ${makeEventInfo(rows)}

      <section class="card">
        <p class="message">Available registrations: <strong>${rows.length}</strong></p>
        <button id="downloadRegistrations" class="btn btn-gold" type="button">Download registrations CSV</button>
      </section>
    `;

    document.getElementById("downloadRegistrations").addEventListener("click", () => exportCsv(rows));
  } catch (error) {
    app.innerHTML = `<div class="message error">Failed to prepare export: ${escapeHtml(error.message)}</div>`;
  }
}

function makeEventInfo(rows) {
  const events = [];
  const seen = new Set();

  rows.forEach(row => {
    if (!row.event || seen.has(row.event.id)) return;
    seen.add(row.event.id);
    events.push(row.event);
  });

  if (!events.length) return "";

  return `
    <section class="card event-info-card">
      <h2>Event information</h2>
      ${events.map(event => `
        <div class="event-info-item">
          <h3>${escapeHtml(event.title || "Event")}</h3>
          <p class="small">${escapeHtml(formatEventMeta(event))}</p>
          ${event.description ? `<p>${escapeHtml(event.description)}</p>` : `<p class="muted">No event description available.</p>`}
        </div>
      `).join("")}
    </section>
  `;
}

function formatEventMeta(event) {
  const parts = [];
  if (event.event_date) parts.push(formatDateOnly(event.event_date));
  if (event.event_time) parts.push(event.event_time);
  if (event.location) parts.push(event.location);
  return parts.join(" · ");
}

function formatDateOnly(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("el-GR", { dateStyle: "long" }).format(new Date(value));
  } catch {
    return value;
  }
}

function exportCsv(rows) {
  const headers = ["Date", "Event", "Event Description", "Member", "Email", "Phone", "Guests", "Total Participants", "Meal", "Status", "Email Sent", "Comments"];
  const lines = [headers.join(",")];

  rows.forEach(row => {
    const member = row.member || {};
    const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
    lines.push([
      formatDateTime(row.created_at),
      row.event?.title || row.event_id || "",
      row.event?.description || "",
      name,
      member.email || "",
      member.phone || "",
      Number(row.guests_count || 0),
      Number(row.guests_count || 0) + 1,
      normalizeMeal(row.meal_participation),
      row.attendance_status || "",
      row.confirmation_sent ? "YES" : "NO",
      row.comments || ""
    ].map(csvCell).join(","));
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `event-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeMeal(value) {
  if (value === true) return "yes";
  const text = String(value ?? "").toLowerCase();
  return ["yes", "y", "true", "1", "ναι"].includes(text) ? "yes" : "no";
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}
