import { getEventRegistrations } from "../database.js";
import { escapeHtml } from "../app.js";

let cachedRows = [];

export async function renderEventRegistrationsPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Loading event registrations...</div>`;

  try {
    cachedRows = await getEventRegistrations();
    renderTable(cachedRows);
  } catch (error) {
    app.innerHTML = `<div class="message error">Failed to load registrations: ${escapeHtml(error.message)}</div>`;
  }
}

function renderTable(rows) {
  const app = document.getElementById("app");
  const totals = calculateTotals(rows);

  app.innerHTML = `
    <section class="page-title">
      <div>
        <h1>EVENT REGISTRATIONS</h1>
        <p>Read-only list of event registrations.</p>
      </div>
      <button id="exportCsvBtn" class="btn btn-gold" type="button">Export CSV</button>
    </section>

    <section class="stats-grid">
      <div class="stat-card"><span>REGISTRATIONS</span><strong>${totals.registrations}</strong></div>
      <div class="stat-card"><span>TOTAL PARTICIPANTS</span><strong>${totals.participants}</strong></div>
      <div class="stat-card"><span>GUESTS</span><strong>${totals.guests}</strong></div>
      <div class="stat-card"><span>MEAL YES</span><strong>${totals.mealYes}</strong></div>
    </section>

    ${makeEventInfo(rows)}

    <section class="card">
      <div class="toolbar">
        <div class="toolbar-left">
          <input id="searchBox" class="search-input" type="search" placeholder="Search by name, email, phone, comments..." />
          <select id="mealFilter">
            <option value="all">All meals</option>
            <option value="yes">Meal: yes</option>
            <option value="no">Meal: no</option>
          </select>
        </div>
        <div class="toolbar-right small" id="rowCount"></div>
      </div>
      <div id="tableHost"></div>
    </section>
  `;

  const searchBox = document.getElementById("searchBox");
  const mealFilter = document.getElementById("mealFilter");
  const update = () => renderFilteredRows(rows, searchBox.value, mealFilter.value);

  searchBox.addEventListener("input", update);
  mealFilter.addEventListener("change", update);
  document.getElementById("exportCsvBtn").addEventListener("click", () => exportCsv(rows));

  update();
}

function renderFilteredRows(rows, searchTerm, mealFilter) {
  const normalized = searchTerm.trim().toLowerCase();
  const filtered = rows.filter(row => {
    const member = row.member || {};
    const haystack = [
      member.first_name,
      member.last_name,
      member.email,
      member.phone,
      row.comments,
      row.attendance_status,
      row.event?.title
    ].join(" ").toLowerCase();

    const matchesSearch = !normalized || haystack.includes(normalized);
    const mealValue = normalizeMeal(row.meal_participation);
    const matchesMeal = mealFilter === "all" || mealValue === mealFilter;
    return matchesSearch && matchesMeal;
  });

  document.getElementById("rowCount").textContent = `${filtered.length} registrations shown`;
  document.getElementById("tableHost").innerHTML = makeTable(filtered);
}

function makeTable(rows) {
  if (!rows.length) return `<div class="message">No registrations found.</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Member</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Guests</th>
            <th>Total Participants</th>
            <th>Meal</th>
            <th>Status</th>
            <th>Email sent</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            const member = row.member || {};
            const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || `Member #${row.member_id}`;
            const meal = normalizeMeal(row.meal_participation);
            const guests = Number(row.guests_count || 0);
            const participants = guests + 1;
            return `
              <tr>
                <td>${formatDateTime(row.created_at)}</td>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${escapeHtml(member.email || "")}</td>
                <td>${escapeHtml(member.phone || "")}</td>
                <td>${guests}</td>
                <td><strong>${participants}</strong></td>
                <td><span class="badge ${meal === "yes" ? "ok" : "no"}">${meal === "yes" ? "YES" : "NO"}</span></td>
                <td>${escapeHtml(row.attendance_status || "")}</td>
                <td><span class="badge ${row.confirmation_sent ? "ok" : "no"}">${row.confirmation_sent ? "YES" : "NO"}</span></td>
                <td>${escapeHtml(row.comments || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
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

function shortText(value, maxLength = 90) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

function calculateTotals(rows) {
  const registrations = rows.length;
  const guests = rows.reduce((sum, row) => sum + Number(row.guests_count || 0), 0);
  const participants = registrations + guests;
  const mealYes = rows.filter(row => normalizeMeal(row.meal_participation) === "yes").length;
  return { registrations, guests, participants, mealYes };
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

function exportCsv(rows) {
  const headers = ["Date", "Member", "Email", "Phone", "Guests", "Total Participants", "Meal", "Status", "Email Sent", "Comments"];
  const lines = [headers.join(",")];

  rows.forEach(row => {
    const member = row.member || {};
    const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
    lines.push([
      formatDateTime(row.created_at),
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

function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}
