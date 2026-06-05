import { isLoggedIn } from "./auth.js";
import { getAdminMenuItems, getAdminSubMenuItems } from "./database.js";
import { renderRoute } from "./router.js";

const header = document.getElementById("adminHeader");
const footer = document.getElementById("adminFooter");
const menu = document.getElementById("adminMenu");

function updateShellVisibility() {
  const loggedIn = isLoggedIn();
  header.classList.toggle("hidden", !loggedIn);
  footer.classList.toggle("hidden", !loggedIn);
}

async function buildAdminMenu() {
  menu.replaceChildren();
  if (!isLoggedIn()) return;

  try {
    const [mainItems, subItems] = await Promise.all([
      getAdminMenuItems(),
      getAdminSubMenuItems()
    ]);

    const subMap = new Map();
    (subItems || []).forEach(item => {
      const parent = item.menuitemsadminitem;
      if (!subMap.has(parent)) subMap.set(parent, []);
      subMap.get(parent).push(item);
    });

    const fragment = document.createDocumentFragment();

    (mainItems || []).forEach(item => {
      const children = subMap.get(item.item) || [];

      if (children.length) {
        const group = document.createElement("div");
        group.className = "admin-menu-group";

        const button = document.createElement("button");
        button.className = "admin-menu-button";
        button.type = "button";
        button.textContent = item.item;
        group.appendChild(button);

        const submenu = document.createElement("div");
        submenu.className = "admin-submenu";
        children.forEach(child => {
          const link = document.createElement("a");
          link.href = `#/${child.url}`;
          link.textContent = child.item;
          submenu.appendChild(link);
        });
        group.appendChild(submenu);
        fragment.appendChild(group);
      } else {
        const link = document.createElement("a");
        link.className = "admin-menu-link";
        link.href = `#/${item.url || item.item.toLowerCase()}`;
        link.textContent = item.item;
        fragment.appendChild(link);
      }
    });

    menu.replaceChildren(fragment);
  } catch (error) {
    menu.innerHTML = `<span class="message error">Menu error: ${escapeHtml(error.message)}</span>`;
  }
}

let refreshRunId = 0;

export async function refreshApp() {
  const runId = ++refreshRunId;
  updateShellVisibility();
  await buildAdminMenu();
  if (runId !== refreshRunId) return;
  await renderRoute();
  if (runId !== refreshRunId) return;
  updateShellVisibility();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.addEventListener("hashchange", refreshApp);
window.addEventListener("DOMContentLoaded", refreshApp);
