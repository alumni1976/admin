import { login } from "../auth.js";
import { escapeHtml } from "../app.js";

export function renderLoginPage() {
  const app = document.getElementById("app");
  document.body.classList.add("login-mode");

  app.className = "login-shell";
  app.innerHTML = `
    <section class="login-card">
      <h1 class="login-title">Alumni 1976 Administration</h1>
      <p class="login-note">Παρακαλώ συνδεθείτε με email και admin password.</p>

      <form id="loginForm">
        <div class="form-row">
          <label for="adminEmail">Email</label>
          <input id="adminEmail" name="email" type="email" autocomplete="username" required />
        </div>
        <div class="form-row">
          <label for="adminPassword">Admin password</label>
          <input id="adminPassword" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn-gold" type="submit">Login</button>
        <div id="loginMessage"></div>
      </form>
    </section>
  `;

  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("loginMessage");
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    message.innerHTML = `<div class="message">Checking login...</div>`;

    try {
      const session = await login(email, password);
      if (!session) {
        message.innerHTML = `<div class="message error">Invalid email or admin password.</div>`;
        return;
      }

      message.innerHTML = `<div class="message ok">Login successful.</div>`;
      window.location.hash = "#/event-registrations";
    } catch (error) {
      message.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
    }
  });
}
