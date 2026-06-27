import { authApi } from "./api.js";

export async function bootstrapAuth({ onAuthenticated, onLoginRequired }) {
  try {
    const me = await authApi.me();
    if (me.authenticated) {
      onAuthenticated(me);
      return;
    }
  } catch {
    // fall through to login
  }
  onLoginRequired();
}

export function bindLoginForm(form, { onSuccess, onError }) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.querySelector("#login-username").value.trim();
    const password = form.querySelector("#login-password").value;

    try {
      await authApi.login(username, password);
      const me = await authApi.me();
      onSuccess(me);
    } catch (err) {
      onError(err.message);
    }
  });
}

export function bindLogout(button, { onLoggedOut }) {
  button.addEventListener("click", async () => {
    await authApi.logout().catch(() => {});
    onLoggedOut();
  });
}
