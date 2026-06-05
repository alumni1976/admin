import { getEventRegistrations } from "../database.js";
import { escapeHtml } from "../app.js";

export async function renderEventSummaryPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Loading event summary...</div>`;

  try {
    const rows = await getEventRegistrations();
    const totals = calculateTotals(rows);
    const latest = rows.slice(0, 8);

    app.innerHTML = `
      <section class="page-title">
        <div>
          <h1>EVENT SUMMARY</h1>
          <p>Overall picture of registrations and participation.</p>
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card"><span>REGISTRATIONS</span><strong>${totals.registrations}</strong></div>
        <div class="stat-card"><span>TOTAL PARTICIPANTS</span><strong>${totals.participants}</strong></div>
        <div class="stat-card"><span>GUESTS</span><strong>${totals.guests}</strong></div>
        <div class="stat-card"><span>MEAL YES</span><strong>${totals.mealYes}</strong></div>
      </section>

      ${makeEventInfo(rows)}

      <section class="summary-grid">
        <div class="card">
          <h2>Participation</h2>
          <ul class="summary-list">
            <li><span>Members registered</span><strong>${totals.registrations}</strong></li>
            <li><span>Guests</span><strong>${totals.guests}</strong></li>
            <li><span>Total participants</span><strong>${totals.participants}</strong></li>
            <li><span>Meal participation</span><strong>${totals.mealYes}</strong></li>
            <li><span>No meal / unknown</span><strong>${totals.mealNo}</strong></li>
            <li><span>Confirmation emails sent</span><strong>${totals.emailsSent}</strong></li>
          </ul>
        </div>
        <div class="card">
          <h2>Latest registrations</h2>
          <ul class="summary-list">
            ${latest.map(row => {
              const member = row.member || {};
              const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || `Member #${row.member_id}`;
              return `<li><span>${escapeHtml(name)}</span><strong>${formatDate(row.created_at)}</strong></li>`;
            }).join("") || `<li><span>No registrations yet</span><strong>-</strong></li>`}
          </ul>
        </div>
      </section>
    `;
  } catch (error) {
    app.innerHTML = `<div class="message error">Failed to load summary: ${escapeHtml(error.message)}</div>`;
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

function calculateTotals(rows) {
  const registrations = rows.length;
  const guests = rows.reduce((sum, row) => sum + Number(row.guests_count || 0), 0);
  const participants = registrations + guests;
  const mealYes = rows.filter(row => normalizeMeal(row.meal_participation) === "yes").length;
  const mealNo = registrations - mealYes;
  const emailsSent = rows.filter(row => row.confirmation_sent).length;
  return { registrations, guests, participants, mealYes, mealNo, emailsSent };
}

function normalizeMeal(value) {
  if (value === true) return "yes";
  const text = String(value ?? "").toLowerCase();
  return ["yes", "y", "true", "1", "ναι"].includes(text) ? "yes" : "no";
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("el-GR", { dateStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}
