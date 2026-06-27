import { trashApi, formatBytes, thumbUrl } from "./api.js";
import { icons } from "./icons.js";

export function bindTrashPanel({
  dialog,
  listEl,
  emptyEl,
  countEl,
  closeBtn,
  emptyBtn,
  onChanged
}) {
  async function refresh() {
    const data = await trashApi.list();
    render(data.items || []);
    return data;
  }

  function render(items) {
    listEl.innerHTML = "";
    countEl.textContent = `${items.length} ${items.length === 1 ? "elemento" : "elementi"}`;
    emptyEl.classList.toggle("hidden", items.length > 0);
    listEl.classList.toggle("hidden", !items.length);

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "trash-item";

      const icon = document.createElement("span");
      icon.className = "trash-item-icon";
      icon.innerHTML = item.type === "folder" ? icons.folder : icons.image;

      const meta = document.createElement("div");
      meta.className = "trash-item-meta";

      const title = document.createElement("strong");
      title.className = "trash-item-title";
      title.textContent = item.name;

      const path = document.createElement("span");
      path.className = "trash-item-path muted";
      path.textContent = item.originalPath;

      const info = document.createElement("span");
      info.className = "trash-item-info muted";
      info.textContent = `${item.daysInTrash} giorni fa · ${formatBytes(item.size)}`;

      meta.append(title, path, info);

      const actions = document.createElement("div");
      actions.className = "trash-item-actions";

      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className = "btn btn-soft btn-sm";
      restoreBtn.textContent = "Ripristina";
      restoreBtn.addEventListener("click", async () => {
        restoreBtn.disabled = true;
        try {
          await trashApi.restore(item.id);
          await refresh();
          await onChanged?.();
        } catch (err) {
          alert(err.message);
          restoreBtn.disabled = false;
        }
      });

      actions.append(restoreBtn);
      row.append(icon, meta, actions);
      listEl.append(row);
    }
  }

  function open() {
    refresh()
      .then(() => dialog.showModal())
      .catch((err) => alert(err.message));
  }

  closeBtn.addEventListener("click", () => dialog.close());
  emptyBtn.addEventListener("click", () => {
    dialog.close();
    onChanged?.({ requestEmptyTrash: true });
  });

  return { open, refresh };
}

export function bindPurgeNotificationBanner({
  bannerEl,
  messageEl,
  reviewBtn,
  postponeBtn,
  onReview,
  onPostpone
}) {
  function show(notification) {
    if (!notification?.pending) {
      bannerEl.classList.add("hidden");
      return;
    }

    const size = formatBytes(notification.totalSize);
    messageEl.textContent =
      `${notification.count} elementi nel cestino da oltre ${notification.retentionDays} giorni (${size}). ` +
      "Controlla prima che il cestino venga svuotato definitivamente.";
    bannerEl.classList.remove("hidden");
  }

  function hide() {
    bannerEl.classList.add("hidden");
  }

  reviewBtn.addEventListener("click", () => onReview?.());
  postponeBtn.addEventListener("click", async () => {
    await trashApi.postpone();
    hide();
    onPostpone?.();
  });

  return { show, hide };
}

export function bindPurgeConfirmDialog({
  dialog,
  form,
  listEl,
  messageEl,
  inputEl,
  errorEl,
  submitBtn,
  cancelBtn,
  onDone
}) {
  function open(notification) {
    messageEl.textContent =
      `Stai per eliminare definitivamente ${notification.count} elementi (${formatBytes(notification.totalSize)}). ` +
      'Digita SVUOTA CESTINO per confermare.';
    listEl.innerHTML = "";
    for (const item of notification.items.slice(0, 12)) {
      const row = document.createElement("div");
      row.className = "purge-item";
      row.textContent = `${item.type === "folder" ? "📁" : "🖼"} ${item.originalPath}`;
      listEl.append(row);
    }
    if (notification.items.length > 12) {
      const more = document.createElement("div");
      more.className = "purge-item muted";
      more.textContent = `… e altri ${notification.items.length - 12} elementi`;
      listEl.append(more);
    }
    inputEl.value = "";
    submitBtn.disabled = true;
    errorEl.classList.add("hidden");
    dialog.showModal();
    inputEl.focus();
  }

  inputEl.addEventListener("input", () => {
    submitBtn.disabled = inputEl.value.trim() !== "SVUOTA CESTINO";
  });

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await trashApi.confirmPurge(inputEl.value.trim());
      dialog.close();
      await onDone?.();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

  return { open };
}
