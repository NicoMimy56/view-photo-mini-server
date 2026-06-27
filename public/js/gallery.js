import { photoApi, thumbUrl, viewUrl, folderApi, downloadUrl } from "./api.js";
import { buildFolderTree } from "./folderTree.js";
import { icons } from "./icons.js";
import { isVideoItem, isUploadableFile } from "./media.js";
import { preferences } from "./preferences.js";

export function createGallery({
  galleryEl,
  emptyEl,
  countEl,
  selectModeBtn,
  onOpenPhoto,
  onDeletePhoto,
  onSelectionChange,
  onSetCover,
  getCurrentFolder
}) {
  let photos = [];
  let selectionMode = false;
  let searchQuery = "";
  const selectedIds = new Set();

  function updateSelectionUi() {
    onSelectionChange?.({
      count: selectedIds.size,
      selectionMode,
      hasPhotos: photos.length > 0,
      singleSelected: selectedIds.size === 1
    });
  }

  function setSelectionMode(enabled) {
    selectionMode = enabled;
    if (!enabled) selectedIds.clear();
    galleryEl.classList.toggle("selection-mode", enabled);
    render(photos);
    updateSelectionUi();
  }

  function togglePhotoSelection(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);

    const card = galleryEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const checkbox = card?.querySelector(".photo-select-input");
    if (checkbox) checkbox.checked = selectedIds.has(id);
    card?.classList.toggle("selected", selectedIds.has(id));
    updateSelectionUi();
  }

  function selectAll() {
    for (const photo of photos) selectedIds.add(photo.id);
    render(photos);
    updateSelectionUi();
  }

  function clearSelection() {
    selectedIds.clear();
    if (selectionMode) render(photos);
    updateSelectionUi();
  }

  function render(list) {
    photos = list;
    galleryEl.innerHTML = "";

    countEl.textContent = `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`;
    selectModeBtn?.classList.toggle("hidden", !photos.length);

    if (!photos.length) {
      emptyEl.classList.remove("hidden");
      galleryEl.classList.add("hidden");
      if (!searchQuery) {
        selectionMode = false;
        selectedIds.clear();
        galleryEl.classList.remove("selection-mode");
        selectModeBtn?.classList.add("hidden");
      }
      updateSelectionUi();
      return;
    }

    emptyEl.classList.add("hidden");
    galleryEl.classList.remove("hidden");

    for (const photo of photos) {
      const card = document.createElement("figure");
      card.className = "photo-card";
      card.dataset.id = photo.id;
      if (selectedIds.has(photo.id)) card.classList.add("selected");

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "photo-delete-btn";
      deleteBtn.innerHTML = icons.trash;
      deleteBtn.title = "Move to trash";
      deleteBtn.setAttribute("aria-label", `Delete ${photo.name}`);
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        onDeletePhoto(photo, { fromLightbox: false });
      });

      const selectLabel = document.createElement("label");
      selectLabel.className = `photo-select${selectionMode ? "" : " hidden"}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "photo-select-input";
      checkbox.checked = selectedIds.has(photo.id);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => togglePhotoSelection(photo.id));
      selectLabel.append(checkbox);

      const overlay = document.createElement("figcaption");
      overlay.className = "photo-overlay";
      const name = document.createElement("span");
      name.className = "photo-name";
      name.textContent = photo.name;
      if (!searchQuery && !getCurrentFolder?.() && photo.folder) {
        const album = document.createElement("span");
        album.className = "photo-album";
        album.textContent = photo.folder;
        overlay.append(album);
      }
      overlay.append(name);

      if (isVideoItem(photo)) {
        card.classList.add("video-card");
        const preview = document.createElement("div");
        preview.className = "photo-thumb video-thumb";
        preview.innerHTML = icons.video;
        card.append(deleteBtn, selectLabel, preview, overlay);
      } else {
        const img = document.createElement("img");
        img.className = "photo-thumb";
        img.src = thumbUrl(photo.id);
        img.alt = photo.name;
        img.loading = "lazy";
        img.draggable = false;
        img.addEventListener("error", () => {
          img.src = viewUrl(photo.id);
        }, { once: true });
        card.append(deleteBtn, selectLabel, img, overlay);
      }

      card.addEventListener("click", () => {
        if (selectionMode) {
          togglePhotoSelection(photo.id);
          return;
        }
        onOpenPhoto(photo, photos);
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (selectionMode) togglePhotoSelection(photo.id);
        else onOpenPhoto(photo, photos);
      });

      if (!selectionMode) card.tabIndex = 0;
      galleryEl.append(card);
    }

    updateSelectionUi();
  }

  async function load(folder, { q = "", sort, order } = {}) {
    searchQuery = q.trim();
    const sortBy = sort || preferences.getSort();
    const sortOrder = order || preferences.getOrder();

    const data = searchQuery
      ? await photoApi.search(searchQuery, folder, { sort: sortBy, order: sortOrder })
      : await photoApi.list(folder, { sort: sortBy, order: sortOrder });

    if (selectionMode) selectedIds.clear();
    render(data.photos || []);
    return data.photos || [];
  }

  return {
    load,
    render,
    getPhotos: () => photos,
    setSelectionMode,
    getSelectionMode: () => selectionMode,
    getSelectedIds: () => [...selectedIds],
    getSelectedPhotos: () => photos.filter((photo) => selectedIds.has(photo.id)),
    selectAll,
    clearSelection,
    getSearchQuery: () => searchQuery
  };
}

export function bindLightbox({
  dialog,
  imageEl,
  videoEl,
  titleEl,
  counterEl,
  downloadEl,
  closeBtn,
  prevBtn,
  nextBtn,
  moveBtn,
  renameBtn,
  deleteBtn,
  onMovePhoto,
  onDeletePhoto,
  onRenamePhoto,
  getPhotos
}) {
  let photos = [];
  let index = 0;
  let touchStartX = 0;

  function currentPhoto() {
    return photos[index] || null;
  }

  function updateNav() {
    const hasPrev = index > 0;
    const hasNext = index < photos.length - 1;
    prevBtn.disabled = !hasPrev;
    nextBtn.disabled = !hasNext;
    counterEl.textContent = photos.length ? `${index + 1} / ${photos.length}` : "";
  }

  function showMedia(photo) {
    const isVideo = isVideoItem(photo);
    imageEl.classList.toggle("hidden", isVideo);
    videoEl.classList.toggle("hidden", !isVideo);

    if (isVideo) {
      imageEl.removeAttribute("src");
      videoEl.src = viewUrl(photo.id);
      videoEl.load();
    } else {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      imageEl.src = viewUrl(photo.id);
    }
  }

  function showAt(newIndex) {
    if (!photos.length) return;
    index = Math.max(0, Math.min(newIndex, photos.length - 1));
    const photo = currentPhoto();
    if (!photo) return;

    titleEl.textContent = photo.name;
    showMedia(photo);
    downloadEl.href = downloadUrl(photo.id);
    downloadEl.download = photo.name;
    updateNav();
  }

  function open(photo, list = null) {
    photos = list?.length ? list : getPhotos?.() || [photo];
    index = Math.max(0, photos.findIndex((item) => item.id === photo.id));
    showAt(index);
    dialog.showModal();
    document.addEventListener("keydown", onKeyDown);
  }

  function close() {
    document.removeEventListener("keydown", onKeyDown);
    videoEl.pause();
    videoEl.removeAttribute("src");
    dialog.close();
    imageEl.removeAttribute("src");
    photos = [];
    index = 0;
  }

  function step(delta) {
    if (!photos.length) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    showAt(nextIndex);
  }

  function onKeyDown(event) {
    if (!dialog.open) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  moveBtn.addEventListener("click", () => {
    const photo = currentPhoto();
    if (photo) onMovePhoto(photo);
  });
  renameBtn.addEventListener("click", () => {
    const photo = currentPhoto();
    if (photo) onRenamePhoto(photo);
  });
  deleteBtn.addEventListener("click", () => {
    const photo = currentPhoto();
    if (photo) onDeletePhoto(photo, { fromLightbox: true });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  imageEl.addEventListener("touchstart", onTouchStart, { passive: true });
  imageEl.addEventListener("touchend", onTouchEnd, { passive: true });
  videoEl.addEventListener("touchstart", onTouchStart, { passive: true });
  videoEl.addEventListener("touchend", onTouchEnd, { passive: true });

  function onTouchStart(event) {
    touchStartX = event.changedTouches[0]?.clientX || 0;
  }

  function onTouchEnd(event) {
    const delta = (event.changedTouches[0]?.clientX || 0) - touchStartX;
    if (Math.abs(delta) < 50) return;
    step(delta > 0 ? -1 : 1);
  }

  return {
    open,
    close,
    getCurrentPhoto: currentPhoto,
    refreshList: () => {
      photos = getPhotos?.() || photos;
      updateNav();
    }
  };
}

export function bindUpload({
  uploadBtn,
  fileInput,
  dropZone,
  progressEl,
  progressBarEl,
  progressTextEl,
  getCurrentFolder,
  onUploaded,
  onDuplicateConflict
}) {
  function showProgress(visible, { percent = 0, text = "" } = {}) {
    progressEl.classList.toggle("hidden", !visible);
    progressBarEl.style.width = `${percent}%`;
    progressTextEl.textContent = text;
  }

  async function processFiles(files) {
    if (!files.length) return;
    showProgress(true, { percent: 0, text: "Uploading…" });

    try {
      const result = await onUploaded(getCurrentFolder(), files, {
        onProgress: ({ percent, batchIndex, batchCount }) => {
          const batchLabel = batchCount > 1 ? ` — batch ${batchIndex}/${batchCount}` : "";
          showProgress(true, { percent, text: `Uploading… ${percent}%${batchLabel}` });
        }
      });
      showProgress(true, { percent: 100, text: `${result.count || 0} files uploaded` });
      setTimeout(() => showProgress(false), 1200);
    } catch (err) {
      showProgress(false);
      if (err.status === 409 && err.data?.conflicts?.length) {
        await onDuplicateConflict?.(err.data, files);
        return;
      }
      throw err;
    }
  }

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files?.length) return;
    try {
      await processFiles([...fileInput.files]);
    } catch (err) {
      alert(err.message);
    }
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("active");
    });
  });

  dropZone.addEventListener("drop", async (event) => {
    const files = [...event.dataTransfer.files].filter(isUploadableFile);
    if (!files.length) return;
    try {
      await processFiles(files);
    } catch (err) {
      alert(err.message);
    }
  });
}

export function bindThemeToggle(button) {
  const saved = localStorage.getItem("viewphoto-theme") || "light";
  document.documentElement.dataset.theme = saved;

  function renderIcon() {
    const isDark = document.documentElement.dataset.theme === "dark";
    button.innerHTML = isDark ? icons.sun : icons.moon;
    button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  }

  renderIcon();

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("viewphoto-theme", next);
    renderIcon();
  });
}

export function bindConfirmDialog({
  dialog,
  form,
  titleEl,
  messageEl,
  expectedEl,
  inputEl,
  errorEl,
  submitBtn,
  cancelBtn,
  labelEl,
  copyBtn,
  labelTextEl
}) {
  let expected = "";
  let onConfirm = null;
  let caseInsensitive = false;
  let skipTyping = false;

  function matchesExpected(value) {
    const typed = value.trim();
    if (!expected) return true;
    if (caseInsensitive) {
      return typed.localeCompare(expected, undefined, { sensitivity: "accent" }) === 0;
    }
    if (/^DELETE \d+$/i.test(expected)) {
      return typed.replace(/\s+/g, " ").toUpperCase() === expected.toUpperCase();
    }
    return typed === expected;
  }

  function open({
    title,
    message,
    expectedValue,
    onConfirm: callback,
    submitText = "Delete",
    caseInsensitive: ignoreCase = false,
    skipTyping: noTyping = false,
    labelText = "Type the text below to confirm"
  }) {
    expected = expectedValue;
    onConfirm = callback;
    caseInsensitive = ignoreCase;
    skipTyping = noTyping;
    titleEl.textContent = title;
    messageEl.textContent = message;
    expectedEl.textContent = expectedValue;
    if (labelTextEl) labelTextEl.textContent = labelText;
    inputEl.value = skipTyping ? expectedValue : "";
    inputEl.placeholder = expectedValue;
    submitBtn.textContent = submitText;
    labelEl.classList.toggle("hidden", !expectedValue || skipTyping);
    copyBtn?.classList.toggle("hidden", !expectedValue || !ignoreCase || skipTyping);
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    submitBtn.disabled = skipTyping ? false : !!expectedValue;
    dialog.showModal();
    if (expectedValue && !skipTyping) inputEl.focus();
  }

  inputEl.addEventListener("input", () => {
    submitBtn.disabled = expected && !matchesExpected(inputEl.value);
  });

  copyBtn?.addEventListener("click", async () => {
    if (!expected) return;
    try {
      await navigator.clipboard.writeText(expected);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    } catch {
      inputEl.value = expected;
      inputEl.dispatchEvent(new Event("input"));
    }
  });

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const confirmValue = skipTyping ? expected : inputEl.value.trim();
    if (!skipTyping && expected && !matchesExpected(confirmValue)) {
      errorEl.textContent = "Text does not match.";
      errorEl.classList.remove("hidden");
      return;
    }

    try {
      submitBtn.disabled = true;
      await onConfirm(confirmValue);
      dialog.close();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
      submitBtn.disabled = skipTyping ? false : !matchesExpected(inputEl.value);
    }
  });

  return { open };
}

export function bindInfoDialog({ dialog, titleEl, messageEl, okBtn }) {
  function open({ title, message }) {
    titleEl.textContent = title;
    messageEl.textContent = message;
    dialog.showModal();
  }

  okBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return { open };
}

export function bindChoiceDialog({ dialog, titleEl, messageEl, actionsEl, cancelBtn }) {
  function open({ title, message, choices }) {
    titleEl.textContent = title;
    messageEl.textContent = message;
    actionsEl.innerHTML = "";

    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn ${choice.variant || "btn-soft"} btn-sm`;
      btn.textContent = choice.label;
      btn.addEventListener("click", async () => {
        dialog.close();
        await choice.onClick?.();
      });
      actionsEl.append(btn);
    }

    dialog.showModal();
  }

  cancelBtn.addEventListener("click", () => dialog.close());
  return { open };
}

export function bindRenameDialog({ dialog, form, inputEl, errorEl, cancelBtn, titleEl, hintEl }) {
  let onSubmit = null;

  function open({ title, hint, value, onConfirm }) {
    titleEl.textContent = title;
    hintEl.textContent = hint;
    inputEl.value = value;
    errorEl.classList.add("hidden");
    onSubmit = onConfirm;
    dialog.showModal();
    inputEl.focus();
    inputEl.select();
  }

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onSubmit(inputEl.value.trim());
      dialog.close();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

  return { open };
}

export function bindMovePhotoDialog({ dialog, nameEl, listEl, errorEl, cancelBtn, onMoved, titleEl }) {
  let photo = null;
  let batchIds = null;

  function renderMoveNode(node, depth) {
    renderOption(node.path, node.name, getCurrentFolderPath() === node.path, depth);
    for (const child of node.children) {
      renderMoveNode(child, depth + 1);
    }
  }

  function getCurrentFolderPath() {
    if (batchIds?.length) return "";
    return photo?.folder || "";
  }

  function renderOption(path, label, isCurrent, depth = 0) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `move-folder-option${isCurrent ? " current" : ""}`;
    btn.style.setProperty("--depth", String(depth));
    btn.setAttribute("role", "option");
    btn.disabled = isCurrent;
    if (path) btn.title = path;

    const icon = document.createElement("span");
    icon.className = "move-folder-icon";
    icon.innerHTML = isCurrent ? icons.folderOpen : icons.folder;

    const labelEl = document.createElement("span");
    labelEl.className = "move-folder-label";
    labelEl.textContent = label;
    btn.append(icon, labelEl);

    if (isCurrent) {
      const tag = document.createElement("span");
      tag.className = "move-folder-tag";
      tag.textContent = "Current";
      btn.append(tag);
    }

    btn.addEventListener("click", async () => {
      if (isCurrent) return;
      errorEl.classList.add("hidden");
      btn.disabled = true;

      try {
        if (batchIds?.length) {
          await photoApi.moveBatch(batchIds, path);
        } else if (photo) {
          await photoApi.move(photo.id, path);
        }
        dialog.close();
        await onMoved(photo, path, batchIds);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
        btn.disabled = isCurrent;
      }
    });

    listEl.append(btn);
  }

  async function open(currentPhoto, ids = null) {
    photo = currentPhoto;
    batchIds = ids;
    titleEl.textContent = ids?.length ? `Move ${ids.length} photos` : "Move photo";
    nameEl.textContent = ids?.length
      ? `Moving ${ids.length} selected photos`
      : `"${currentPhoto.name}"`;
    errorEl.classList.add("hidden");
    listEl.innerHTML = "";

    try {
      const data = await folderApi.list();
      const folders = data.folders || [];

      renderOption("", "All photos", getCurrentFolderPath() === "", 0);
      const tree = buildFolderTree(folders);
      for (const node of tree) {
        renderMoveNode(node, 0);
      }

      dialog.showModal();
    } catch (err) {
      alert(err.message);
    }
  }

  cancelBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return { open };
}
