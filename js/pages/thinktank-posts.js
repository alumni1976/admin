import { supabaseFetch } from "../database.js";
import { escapeHtml } from "../app.js";

let allPosts = [];

export async function renderThinktankPostsPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Φόρτωση αναρτήσεων...</div>`;

  try {
    const [posts, members] = await Promise.all([
      supabaseFetch("/rest/v1/posts?select=*&order=created_at.desc"),
      supabaseFetch("/rest/v1/members?select=id,first_name,last_name,email")
    ]);

    const memberMap = new Map((members || []).map(m => [m.id, m]));

    allPosts = (posts || []).map(p => ({
      ...p,
      member: memberMap.get(p.member_id) || null
    }));

    renderPage();

  } catch (err) {
    app.innerHTML = `<div class="message error">Αποτυχία φόρτωσης: ${escapeHtml(err.message)}</div>`;
  }
}

function renderPage() {
  const app = document.getElementById("app");
  const pending = allPosts.filter(p => !p.is_approved).length;
  const approved = allPosts.filter(p => p.is_approved).length;

  app.innerHTML = `
    <section class="page-title">
      <div>
        <h1>ΑΝΑΡΤΗΣΕΙΣ THINKTANK</h1>
        <p>Έγκριση ή απόρριψη αναρτήσεων μελών.</p>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card"><span>ΣΥΝΟΛΟ</span><strong>${allPosts.length}</strong></div>
      <div class="stat-card"><span>ΕΚΚΡΕΜΟΥΝ</span><strong>${pending}</strong></div>
      <div class="stat-card"><span>ΕΓΚΕΚΡΙΜΕΝΕΣ</span><strong>${approved}</strong></div>
    </section>

    <section class="card">
      <div class="toolbar">
        <div class="toolbar-left">
          <input id="postSearch" class="search-input" type="search" placeholder="Αναζήτηση κειμένου, μέλους, κατηγορίας..." />
          <select id="postFilter">
            <option value="pending">Εκκρεμούν</option>
            <option value="approved">Εγκεκριμένες</option>
            <option value="all">Όλες</option>
          </select>
        </div>
        <div class="toolbar-right small" id="postCount"></div>
      </div>
      <div id="postsHost"></div>
    </section>
  `;

  const search = document.getElementById("postSearch");
  const filter = document.getElementById("postFilter");
  const update = () => renderPosts(search.value, filter.value);

  search.addEventListener("input", update);
  filter.addEventListener("change", update);
  update();
}

function renderPosts(searchTerm, filterValue) {
  const normalized = searchTerm.trim().toLowerCase();

  const filtered = allPosts.filter(p => {
    const member = p.member || {};
    const haystack = [
      member.first_name, member.last_name, member.email,
      p.body, p.category
    ].join(" ").toLowerCase();

    const matchesSearch = !normalized || haystack.includes(normalized);
    const matchesFilter =
      filterValue === "all" ||
      (filterValue === "pending" && !p.is_approved) ||
      (filterValue === "approved" && p.is_approved);

    return matchesSearch && matchesFilter;
  });

  document.getElementById("postCount").textContent = `${filtered.length} αναρτήσεις`;

  const host = document.getElementById("postsHost");

  if (!filtered.length) {
    host.innerHTML = `<div class="message">Δεν βρέθηκαν αναρτήσεις.</div>`;
    return;
  }

  host.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ημ/νία</th>
            <th>Μέλος</th>
            <th>Κατηγορία</th>
            <th>Ανάρτηση</th>
            <th>Εικόνα</th>
            <th>Κατάσταση</th>
            <th>Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => {
            const member = p.member || {};
            const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || `#${p.member_id}`;
            return `
              <tr id="post-row-${p.id}">
                <td>${formatDateTime(p.created_at)}</td>
                <td>
                  <strong>${escapeHtml(name)}</strong>
                  <div class="small muted">${escapeHtml(member.email || "")}</div>
                </td>
                <td><span class="badge neutral">${escapeHtml(p.category || "thought")}</span></td>
                <td class="post-body-cell">${escapeHtml(shortText(p.body, 120))}</td>
                <td>${p.image_url
                  ? `<a href="${escapeHtml(p.image_url)}" target="_blank" class="small link-gold">Προβολή</a>`
                  : `<span class="muted">–</span>`}
                </td>
                <td>
                  <span class="badge ${p.is_approved ? "ok" : "warn"}" id="post-badge-${p.id}">
                    ${p.is_approved ? "ΕΓΚΡΙΘΗΚΕ" : "ΕΚΚΡΕΜΕΙ"}
                  </span>
                </td>
                <td class="actions-cell">
                  ${!p.is_approved ? `
                    <button class="btn btn-sm btn-green" onclick="approvePost(${p.id})">✓ Έγκριση</button>
                  ` : ""}
                  <button class="btn btn-sm btn-danger" onclick="deletePost(${p.id})">✕ Διαγραφή</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.approvePost = async function(id) {
  try {
    await supabaseFetch(`/rest/v1/posts?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_approved: true })
    });
    const post = allPosts.find(p => p.id === id);
    if (post) post.is_approved = true;
    const badge = document.getElementById(`post-badge-${id}`);
    if (badge) {
      badge.className = "badge ok";
      badge.textContent = "ΕΓΚΡΙΘΗΚΕ";
    }
    const row = document.getElementById(`post-row-${id}`);
    const btn = row?.querySelector(".btn-green");
    if (btn) btn.remove();
  } catch (err) {
    alert(`Σφάλμα έγκρισης: ${err.message}`);
  }
};

window.deletePost = async function(id) {
  if (!confirm("Να διαγραφεί οριστικά η ανάρτηση;")) return;
  try {
    await supabaseFetch(`/rest/v1/posts?id=eq.${id}`, { method: "DELETE" });
    allPosts = allPosts.filter(p => p.id !== id);
    const row = document.getElementById(`post-row-${id}`);
    if (row) row.remove();
  } catch (err) {
    alert(`Σφάλμα διαγραφής: ${err.message}`);
  }
};

function shortText(text, max = 120) {
  const t = String(text || "").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "short", timeStyle: "short"
    }).format(new Date(value));
  } catch { return value; }
}
