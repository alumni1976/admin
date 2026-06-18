import { supabaseFetch } from "../database.js";
import { escapeHtml } from "../app.js";

let allComments = [];

export async function renderThinktankCommentsPage() {
  document.body.classList.remove("login-mode");
  const app = document.getElementById("app");
  app.className = "admin-app";
  app.innerHTML = `<div class="loading-box">Φόρτωση σχολίων...</div>`;

  try {
    const [comments, posts, members] = await Promise.all([
      supabaseFetch("/rest/v1/post_comments?select=*&order=created_at.desc"),
      supabaseFetch("/rest/v1/posts?select=id,body,category,member_id"),
      supabaseFetch("/rest/v1/members?select=id,first_name,last_name,email")
    ]);

    const memberMap = new Map((members || []).map(m => [m.id, m]));
    const postMap = new Map((posts || []).map(p => [p.id, p]));

    allComments = (comments || []).map(c => ({
      ...c,
      member: memberMap.get(c.member_id) || null,
      post: postMap.get(c.post_id) || null
    }));

    renderPage();

  } catch (err) {
    app.innerHTML = `<div class="message error">Αποτυχία φόρτωσης: ${escapeHtml(err.message)}</div>`;
  }
}

function renderPage() {
  const app = document.getElementById("app");
  const pending = allComments.filter(c => !c.is_approved).length;
  const approved = allComments.filter(c => c.is_approved).length;

  app.innerHTML = `
    <section class="page-title">
      <div>
        <h1>ΣΧΟΛΙΑ THINKTANK</h1>
        <p>Έγκριση ή απόρριψη σχολίων μελών.</p>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card"><span>ΣΥΝΟΛΟ</span><strong>${allComments.length}</strong></div>
      <div class="stat-card"><span>ΕΚΚΡΕΜΟΥΝ</span><strong>${pending}</strong></div>
      <div class="stat-card"><span>ΕΓΚΕΚΡΙΜΕΝΑ</span><strong>${approved}</strong></div>
    </section>

    <section class="card">
      <div class="toolbar">
        <div class="toolbar-left">
          <input id="commentSearch" class="search-input" type="search" placeholder="Αναζήτηση κειμένου, μέλους..." />
          <select id="commentFilter">
            <option value="pending">Εκκρεμούν</option>
            <option value="approved">Εγκεκριμένα</option>
            <option value="all">Όλα</option>
          </select>
        </div>
        <div class="toolbar-right small" id="commentCount"></div>
      </div>
      <div id="commentsHost"></div>
    </section>
  `;

  const search = document.getElementById("commentSearch");
  const filter = document.getElementById("commentFilter");
  const update = () => renderComments(search.value, filter.value);

  search.addEventListener("input", update);
  filter.addEventListener("change", update);
  update();
}

function renderComments(searchTerm, filterValue) {
  const normalized = searchTerm.trim().toLowerCase();

  const filtered = allComments.filter(c => {
    const member = c.member || {};
    const post = c.post || {};
    const haystack = [
      member.first_name, member.last_name, member.email,
      c.comment_text, post.body
    ].join(" ").toLowerCase();

    const matchesSearch = !normalized || haystack.includes(normalized);
    const matchesFilter =
      filterValue === "all" ||
      (filterValue === "pending" && !c.is_approved) ||
      (filterValue === "approved" && c.is_approved);

    return matchesSearch && matchesFilter;
  });

  document.getElementById("commentCount").textContent = `${filtered.length} σχόλια`;

  const host = document.getElementById("commentsHost");

  if (!filtered.length) {
    host.innerHTML = `<div class="message">Δεν βρέθηκαν σχόλια.</div>`;
    return;
  }

  host.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ημ/νία</th>
            <th>Μέλος</th>
            <th>Σχόλιο</th>
            <th>Ανάρτηση</th>
            <th>Κατάσταση</th>
            <th>Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const member = c.member || {};
            const post = c.post || {};
            const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || `#${c.member_id}`;
            return `
              <tr id="comment-row-${c.id}">
                <td>${formatDateTime(c.created_at)}</td>
                <td>
                  <strong>${escapeHtml(name)}</strong>
                  <div class="small muted">${escapeHtml(member.email || "")}</div>
                </td>
                <td class="post-body-cell">${escapeHtml(shortText(c.comment_text, 120))}</td>
                <td class="post-body-cell muted small">${escapeHtml(shortText(post.body || `Post #${c.post_id}`, 80))}</td>
                <td>
                  <span class="badge ${c.is_approved ? "ok" : "warn"}" id="comment-badge-${c.id}">
                    ${c.is_approved ? "ΕΓΚΡΙΘΗΚΕ" : "ΕΚΚΡΕΜΕΙ"}
                  </span>
                </td>
                <td class="actions-cell">
                  ${!c.is_approved ? `
                    <button class="btn btn-sm btn-green" onclick="approveComment(${c.id})">✓ Έγκριση</button>
                  ` : ""}
                  <button class="btn btn-sm btn-danger" onclick="deleteComment(${c.id})">✕ Διαγραφή</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.approveComment = async function(id) {
  try {
    await supabaseFetch(`/rest/v1/post_comments?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_approved: true })
    });
    const comment = allComments.find(c => c.id === id);
    if (comment) comment.is_approved = true;
    const badge = document.getElementById(`comment-badge-${id}`);
    if (badge) {
      badge.className = "badge ok";
      badge.textContent = "ΕΓΚΡΙΘΗΚΕ";
    }
    const row = document.getElementById(`comment-row-${id}`);
    const btn = row?.querySelector(".btn-green");
    if (btn) btn.remove();
  } catch (err) {
    alert(`Σφάλμα έγκρισης: ${err.message}`);
  }
};

window.deleteComment = async function(id) {
  if (!confirm("Να διαγραφεί οριστικά το σχόλιο;")) return;
  try {
    await supabaseFetch(`/rest/v1/post_comments?id=eq.${id}`, { method: "DELETE" });
    allComments = allComments.filter(c => c.id !== id);
    const row = document.getElementById(`comment-row-${id}`);
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
