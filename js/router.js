import { isLoggedIn, logout } from "./auth.js";
import { renderLoginPage } from "./pages/login.js";
import { renderEventRegistrationsPage } from "./pages/event-registrations.js";
import { renderEventSummaryPage } from "./pages/event-summary.js";
import { renderEventExportsPage } from "./pages/event-exports.js";
import { renderMetricsPage } from "./pages/metrics.js";

const routes = {
  login: renderLoginPage,
  "event-registrations": renderEventRegistrationsPage,
  "event-summary": renderEventSummaryPage,
  "event-exports": renderEventExportsPage,
  "metrics": renderMetricsPage
};

export function getRoute() {
  const hash = window.location.hash || "#/event-registrations";
  const route = hash.replace(/^#\/?/, "").split("?")[0] || "event-registrations";
  return route;
}

export async function renderRoute() {
  const route = getRoute();

  if (route === "logout") {
    logout();
    window.location.hash = "#/login";
    return;
  }

  if (!isLoggedIn() && route !== "login") {
    window.location.hash = "#/login";
    return;
  }

  if (isLoggedIn() && route === "login") {
    window.location.hash = "#/event-registrations";
    return;
  }

  const renderer = routes[route] || renderEventRegistrationsPage;
  await renderer();
  setActiveMenu(route);
}

function setActiveMenu(route) {
  document.querySelectorAll("#adminMenu a").forEach(link => {
    const linkRoute = link.getAttribute("href")?.replace(/^#\//, "");
    link.classList.toggle("active", linkRoute === route);
  });
}
