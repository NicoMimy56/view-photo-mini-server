import { apiUpload, folderApi, photoApi, downloadZip, trashApi, authApi, setUploadLimits } from "./api.js";
import { bootstrapAuth, bindLoginForm, bindLogout } from "./auth.js";
import {
  createFolderManager,
  bindCreateFolderDialog,
  bindRenameFolderDialog
} from "./folders.js";
import {
  createGallery,
  bindLightbox,
  bindUpload,
  bindThemeToggle,
  bindConfirmDialog,
  bindInfoDialog,
  bindChoiceDialog,
  bindRenameDialog,
  bindMovePhotoDialog
} from "./gallery.js";
import { createMobileBrowse, getDirectChildren, getParentPath } from "./mobileBrowse.js";
import { splitFolderPath } from "./folderTree.js";
import { icons } from "./icons.js";
import { preferences } from "./preferences.js";
import {
  bindTrashPanel,
  bindPurgeNotificationBanner,
  bindPurgeConfirmDialog
} from "./trash.js";

const appEl = document.getElementById("app");
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const folderListEl = document.getElementById("folder-list");
const pageTitleEl = document.getElementById("page-title");
const galleryEl = document.getElementById("gallery");
const emptyEl = document.getElementById("empty-state");
const emptyTitleEl = document.getElementById("empty-title");
const emptyMessageEl = document.getElementById("empty-message");
const countEl = document.getElementById("photo-count");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const orderSelect = document.getElementById("order-select");

const selectModeBtn = document.getElementById("select-mode-btn");
const selectionBar = document.getElementById("selection-bar");
const selectionCountEl = document.getElementById("selection-count");
const selectAllBtn = document.getElementById("select-all-btn");
const moveSelectedBtn = document.getElementById("move-selected-btn");
const coverSelectedBtn = document.getElementById("cover-selected-btn");
const downloadSelectedBtn = document.getElementById("download-selected-btn");
const deleteSelectedBtn = document.getElementById("delete-selected-btn");
const cancelSelectionBtn = document.getElementById("cancel-selection-btn");
const mobileBrowseEl = document.getElementById("mobile-browse");
const mobileBackBtn = document.getElementById("mobile-back-btn");
const mobileScreenTitleEl = document.getElementById("mobile-screen-title");
const mainContentEl = document.getElementById("main-content");
const toolbarRowEl = document.querySelector(".toolbar-row");
const mainHeaderEl = document.querySelector(".main-header");

const MOBILE_MQ = window.matchMedia("(max-width: 920px)");

let currentFolder = preferences.getLastFolder() || "";
let pendingFilesForRetry = null;
let mobilePhotoView = false;

function isMobileLayout() {
  return MOBILE_MQ.matches;
}

function shouldShowMobileBrowse() {
  return isMobileLayout() && !searchInput.value.trim() && !mobilePhotoView;
}

function injectIcons() {
  document.getElementById("upload-btn-icon").innerHTML = icons.upload;
  document.getElementById("new-folder-icon").innerHTML = icons.plus;
  document.getElementById("drop-zone-icon").innerHTML = icons.upload;
  document.getElementById("empty-icon").innerHTML = icons.image;
  document.getElementById("search-icon").innerHTML = icons.search;
  document.getElementById("lightbox-download-icon").innerHTML = icons.download;
  document.getElementById("lightbox-move-icon").innerHTML = icons.move;
  document.getElementById("lightbox-delete-icon").innerHTML = icons.trash;
  document.getElementById("lightbox-rename-icon").innerHTML = icons.edit;
  document.getElementById("download-selected-icon").innerHTML = icons.download;
  document.getElementById("delete-selected-icon").innerHTML = icons.trash;
  document.getElementById("move-selected-icon").innerHTML = icons.move;
  document.getElementById("lightbox-close").innerHTML = icons.close;
  document.getElementById("lightbox-prev").innerHTML = icons.arrowLeft;
  document.getElementById("lightbox-next").innerHTML = icons.arrowRight;
  document.getElementById("trash-btn").innerHTML = icons.trashBin;
  document.getElementById("mobile-back-icon").innerHTML = icons.arrowLeft;
  logoutBtn.innerHTML = icons.logout;
}

function getCurrentFolder() {
  return currentFolder;
}

function updatePageTitle(folder) {
  pageTitleEl.innerHTML = "";
  if (!folder) {
    pageTitleEl.textContent = isMobileLayout() && !mobilePhotoView ? "Album" : "All photos";
    return;
  }

  const parts = splitFolderPath(folder);
  const nav = document.createElement("nav");
  nav.className = "breadcrumb";
  nav.setAttribute("aria-label", "Album path");

  const rootBtn = document.createElement("button");
  rootBtn.type = "button";
  rootBtn.className = "breadcrumb-link";
  rootBtn.textContent = "All photos";
  rootBtn.addEventListener("click", () => selectFolder(""));
  nav.append(rootBtn);

  parts.forEach((part, index) => {
    const sep = document.createElement("span");
    sep.className = "breadcrumb-sep";
    sep.innerHTML = icons.chevron;
    nav.append(sep);

    const path = parts.slice(0, index + 1).join("/");
    const isLast = index === parts.length - 1;

    if (isLast) {
      const current = document.createElement("span");
      current.className = "breadcrumb-current";
      current.textContent = part;
      nav.append(current);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "breadcrumb-link";
    btn.textContent = part;
    btn.addEventListener("click", () => selectFolder(path));
    nav.append(btn);
  });

  pageTitleEl.append(nav);
}

function showApp(me) {
  if (me?.limits?.maxFiles) {
    setUploadLimits({ maxFiles: me.limits.maxFiles });
  }
  loginScreen.classList.add("hidden");
  appEl.classList.remove("hidden");
  if (me.authEnabled) logoutBtn.classList.remove("hidden");
  dropZone.classList.remove("hidden");
  if (me.notification) purgeBanner.show(me.notification);
}

function showLogin() {
  appEl.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

const confirmDialog = bindConfirmDialog({
  dialog: document.getElementById("confirm-dialog"),
  form: document.getElementById("confirm-form"),
  titleEl: document.getElementById("confirm-title"),
  messageEl: document.getElementById("confirm-message"),
  expectedEl: document.getElementById("confirm-expected"),
  inputEl: document.getElementById("confirm-input"),
  errorEl: document.getElementById("confirm-error"),
  submitBtn: document.getElementById("confirm-submit"),
  cancelBtn: document.getElementById("confirm-cancel"),
  labelEl: document.getElementById("confirm-label"),
  labelTextEl: document.getElementById("confirm-label-text"),
  copyBtn: document.getElementById("confirm-copy")
});

const infoDialog = bindInfoDialog({
  dialog: document.getElementById("info-dialog"),
  titleEl: document.getElementById("info-title"),
  messageEl: document.getElementById("info-message"),
  okBtn: document.getElementById("info-ok")
});

const choiceDialog = bindChoiceDialog({
  dialog: document.getElementById("choice-dialog"),
  titleEl: document.getElementById("choice-title"),
  messageEl: document.getElementById("choice-message"),
  actionsEl: document.getElementById("choice-actions"),
  cancelBtn: document.getElementById("choice-cancel")
});

const renamePhotoDialog = bindRenameDialog({
  dialog: document.getElementById("rename-photo-dialog"),
  form: document.getElementById("rename-photo-form"),
  inputEl: document.getElementById("rename-photo-input"),
  errorEl: document.getElementById("rename-photo-error"),
  cancelBtn: document.getElementById("rename-photo-cancel"),
  titleEl: document.getElementById("rename-photo-title"),
  hintEl: document.getElementById("rename-photo-hint")
});

const renameFolderDialog = bindRenameFolderDialog({
  dialog: document.getElementById("rename-folder-dialog"),
  form: document.getElementById("rename-folder-form"),
  inputEl: document.getElementById("rename-folder-input"),
  errorEl: document.getElementById("rename-folder-error"),
  cancelBtn: document.getElementById("rename-folder-cancel"),
  onRenamed: async (oldPath, newPath) => {
    if (currentFolder === oldPath) currentFolder = newPath;
    else if (currentFolder.startsWith(`${oldPath}/`)) {
      currentFolder = currentFolder.replace(oldPath, newPath);
    }
    await refreshAll();
  }
});

const trashPanel = bindTrashPanel({
  dialog: document.getElementById("trash-dialog"),
  listEl: document.getElementById("trash-list"),
  emptyEl: document.getElementById("trash-empty-state"),
  countEl: document.getElementById("trash-count"),
  closeBtn: document.getElementById("trash-close-btn"),
  emptyBtn: document.getElementById("trash-empty-btn"),
  onChanged: async (payload) => {
    if (payload?.requestEmptyTrash) {
      requestEmptyTrash();
      return;
    }
    await checkPurgeNotification();
    await refreshAll();
  }
});

const purgeBanner = bindPurgeNotificationBanner({
  bannerEl: document.getElementById("purge-banner"),
  messageEl: document.getElementById("purge-banner-message"),
  reviewBtn: document.getElementById("purge-review-btn"),
  postponeBtn: document.getElementById("purge-postpone-btn"),
  onReview: async () => {
    const data = await trashApi.notification();
    if (data.notification?.pending) purgeConfirmDialog.open(data.notification);
    else trashPanel.open();
  },
  onPostpone: () => checkPurgeNotification()
});

const purgeConfirmDialog = bindPurgeConfirmDialog({
  dialog: document.getElementById("purge-dialog"),
  form: document.getElementById("purge-form"),
  listEl: document.getElementById("purge-list"),
  messageEl: document.getElementById("purge-message"),
  inputEl: document.getElementById("purge-input"),
  errorEl: document.getElementById("purge-error"),
  submitBtn: document.getElementById("purge-submit"),
  cancelBtn: document.getElementById("purge-cancel"),
  onDone: async () => {
    purgeBanner.hide();
    await trashPanel.refresh();
    await refreshAll();
    infoDialog.open({
      title: "Space freed",
      message: "Expired items have been permanently deleted from trash."
    });
  }
});

function requestDeletePhoto(photo, { fromLightbox = false } = {}) {
  confirmDialog.open({
    title: "Move to trash",
    message: `The photo "${photo.name}" will be moved to trash. You can restore it within 7 days.`,
    expectedValue: photo.name,
    submitText: "Move to trash",
    caseInsensitive: true,
    labelText: "Type the file name (you can use Copy)",
    onConfirm: async (confirmName) => {
      await photoApi.remove(photo.id, confirmName);
      if (fromLightbox) lightbox.close();
      gallery.clearSelection();
      await refreshAll();
      infoDialog.open({
        title: "Moved to trash",
        message: `"${photo.name}" is in trash. Open trash to restore it.`
      });
    }
  });
}

function requestDeleteSelected() {
  const ids = gallery.getSelectedIds();
  if (!ids.length) return;

  const selected = gallery.getPhotos().filter((photo) => ids.includes(photo.id));
  const expected = `DELETE ${ids.length}`;
  const preview = selected.slice(0, 6).map((photo) => photo.name).join(", ");
  const suffix = selected.length > 6 ? ` … (+${selected.length - 6} more)` : "";

  confirmDialog.open({
    title: "Move to trash",
    message: `${ids.length} selected photos will go to trash. You can restore them within 7 days.${preview ? ` (${preview}${suffix})` : ""}`,
    expectedValue: expected,
    submitText: `Move ${ids.length} photos to trash`,
    skipTyping: true,
    onConfirm: async (confirmPhrase) => {
      await photoApi.removeBatch(ids, confirmPhrase);
      gallery.setSelectionMode(false);
      await refreshAll();
      infoDialog.open({
        title: "Moved to trash",
        message: `${ids.length} photos moved to trash.`
      });
    }
  });
}

function requestEmptyTrash() {
  confirmDialog.open({
    title: "Empty trash",
    message: "All items in trash will be permanently deleted.",
    expectedValue: "EMPTY ALL",
    submitText: "Empty all",
    onConfirm: async (confirmPhrase) => {
      await trashApi.empty(confirmPhrase);
      await trashPanel.refresh();
      await checkPurgeNotification();
      infoDialog.open({ title: "Trash emptied", message: "All items have been permanently deleted." });
    }
  });
}

function requestRenamePhoto(photo) {
  renamePhotoDialog.open({
    title: "Rename photo",
    hint: `Confirm by typing the current name: ${photo.name}`,
    value: photo.name,
    onConfirm: async (newName) => {
      if (newName === photo.name) return;
      await photoApi.rename(photo.id, newName, photo.name);
      await refreshAll();
      lightbox.refreshList();
    }
  });
}

function updateSelectionBar({ count, selectionMode, hasPhotos, singleSelected }) {
  selectionBar.classList.toggle("hidden", !selectionMode);
  selectModeBtn.textContent = selectionMode ? "Exit selection" : "Select";
  selectModeBtn.classList.toggle("btn-primary", selectionMode);
  selectModeBtn.classList.toggle("btn-soft", !selectionMode);
  selectModeBtn.classList.toggle("hidden", !hasPhotos && !gallery.getSearchQuery());

  selectionCountEl.textContent = count === 1 ? "1 selected" : `${count} selected`;
  moveSelectedBtn.disabled = count === 0;
  downloadSelectedBtn.disabled = count === 0;
  deleteSelectedBtn.disabled = count === 0;

  const canSetCover = Boolean(currentFolder) && singleSelected;
  coverSelectedBtn.classList.toggle("hidden", !currentFolder);
  coverSelectedBtn.disabled = !canSetCover;
}

const movePhotoDialog = bindMovePhotoDialog({
  dialog: document.getElementById("move-dialog"),
  titleEl: document.getElementById("move-dialog-title"),
  nameEl: document.getElementById("move-photo-name"),
  listEl: document.getElementById("move-folder-list"),
  errorEl: document.getElementById("move-error"),
  cancelBtn: document.getElementById("move-cancel"),
  onMoved: async (_photo, targetFolder, batchIds) => {
    lightbox.close();
    gallery.setSelectionMode(false);
    await refreshAll();
    infoDialog.open({
      title: batchIds?.length ? "Photos moved" : "Photo moved",
      message: batchIds?.length
        ? `${batchIds.length} photos moved${targetFolder ? ` to "${targetFolder}"` : " to root"}.`
        : targetFolder
          ? `The photo was moved to "${targetFolder}".`
          : "The photo was moved to root."
    });
  }
});

const lightbox = bindLightbox({
  dialog: document.getElementById("lightbox"),
  imageEl: document.getElementById("lightbox-image"),
  videoEl: document.getElementById("lightbox-video"),
  titleEl: document.getElementById("lightbox-title"),
  counterEl: document.getElementById("lightbox-counter"),
  downloadEl: document.getElementById("lightbox-download"),
  closeBtn: document.getElementById("lightbox-close"),
  prevBtn: document.getElementById("lightbox-prev"),
  nextBtn: document.getElementById("lightbox-next"),
  moveBtn: document.getElementById("lightbox-move"),
  renameBtn: document.getElementById("lightbox-rename"),
  deleteBtn: document.getElementById("lightbox-delete"),
  onMovePhoto: (photo) => movePhotoDialog.open(photo),
  onRenamePhoto: requestRenamePhoto,
  onDeletePhoto: requestDeletePhoto,
  getPhotos: () => gallery.getPhotos()
});

const gallery = createGallery({
  galleryEl,
  emptyEl,
  countEl,
  selectModeBtn,
  onOpenPhoto: (photo, list) => lightbox.open(photo, list),
  onDeletePhoto: requestDeletePhoto,
  onSelectionChange: updateSelectionBar,
  getCurrentFolder
});

const folderManager = createFolderManager({
  listEl: folderListEl,
  getCurrentFolder,
  onSelectFolder: (folder) => selectFolder(folder),
  onRequestDeleteFolder: (folder) => requestDeleteFolder(folder),
  onRequestRenameFolder: (folder) => renameFolderDialog.open(folder)
});

injectIcons();

const mobileBrowse = createMobileBrowse({
  containerEl: mobileBrowseEl,
  getCurrentFolder,
  getFolders: () => folderManager.getFolders(),
  getCovers: () => folderManager.getCovers(),
  onSelectFolder: (folder) => selectFolder(folder),
  onOpenPhotos: (folder) => openPhotosView(folder),
  onOpenAllPhotos: () => openAllPhotosView()
});

mobileBackBtn.addEventListener("click", () => mobileGoBack());

function openAllPhotosView() {
  currentFolder = "";
  mobilePhotoView = true;
  preferences.set("lastFolder", "");
  gallery.setSelectionMode(false);
  updatePageTitle("");
  loadGalleryView();
}

function openPhotosView(folder) {
  currentFolder = folder;
  mobilePhotoView = true;
  preferences.set("lastFolder", folder);
  gallery.setSelectionMode(false);
  updatePageTitle(folder);
  folderManager.ensureExpandedTo(folder);
  loadGalleryView();
}

function syncMobileViewForFolder(folder) {
  if (!isMobileLayout() || searchInput.value.trim()) {
    mobilePhotoView = true;
    return;
  }

  if (folder === "") {
    mobilePhotoView = false;
    return;
  }

  const children = getDirectChildren(folder, folderManager.getFolders());
  mobilePhotoView = children.length === 0;
}

function canShowMobileBack() {
  if (!isMobileLayout()) return false;
  return !(shouldShowMobileBrowse() && currentFolder === "");
}

function updateMobileNav() {
  if (!isMobileLayout()) {
    mobileBackBtn.classList.add("hidden");
    mobileBackBtn.setAttribute("aria-hidden", "true");
    return;
  }

  const showBack = canShowMobileBack();
  mobileBackBtn.classList.toggle("hidden", !showBack);
  mobileBackBtn.setAttribute("aria-hidden", showBack ? "false" : "true");

  if (currentFolder === "") {
    mobileScreenTitleEl.textContent = mobilePhotoView ? "All photos" : "Album";
    return;
  }

  mobileScreenTitleEl.textContent = currentFolder.split("/").pop();
}

function mobileGoBack() {
  if (!isMobileLayout() || !canShowMobileBack()) return;

  gallery.setSelectionMode(false);
  searchInput.value = "";

  if (mobilePhotoView) {
    if (currentFolder === "") {
      mobilePhotoView = false;
      updatePageTitle("");
      loadGalleryView();
      return;
    }

    const children = getDirectChildren(currentFolder, folderManager.getFolders());
    if (children.length > 0) {
      mobilePhotoView = false;
      updatePageTitle(currentFolder);
      loadGalleryView();
      return;
    }

    const parent = getParentPath(currentFolder);
    if (parent !== null) {
      selectFolder(parent);
    }
    return;
  }

  const parent = getParentPath(currentFolder);
  if (parent !== null) {
    selectFolder(parent);
  }
}

function updateMobileLayout() {
  const browseMode = shouldShowMobileBrowse();
  document.body.classList.toggle("mobile-layout", isMobileLayout());
  document.body.classList.toggle("mobile-browse-mode", browseMode);
  document.body.classList.toggle("mobile-photo-mode", isMobileLayout() && mobilePhotoView);

  mobileBrowseEl.classList.toggle("hidden", !browseMode);
  mainContentEl.classList.toggle("hidden", browseMode);

  updateMobileNav();

  if (browseMode) {
    mobileBrowse.render();
  }
}

const createFolderDialog = bindCreateFolderDialog({
  dialog: document.getElementById("folder-dialog"),
  form: document.getElementById("folder-form"),
  inputEl: document.getElementById("folder-input"),
  errorEl: document.getElementById("folder-error"),
  cancelBtn: document.getElementById("folder-cancel"),
  onCreated: async (path) => {
    await folderManager.refresh();
    await selectFolder(path);
  }
});

async function loadGalleryView() {
  updateMobileLayout();

  if (shouldShowMobileBrowse()) {
    return;
  }

  const q = searchInput.value.trim();
  emptyTitleEl.textContent = q ? "No results" : "No photos";
  emptyMessageEl.textContent = q
    ? `No photos match "${q}".`
    : currentFolder
      ? "This album is empty. Upload your photos or drag them into the area above."
      : "No photos in the library. Upload your photos to get started.";

  await gallery.load(currentFolder, {
    q,
    sort: sortSelect.value,
    order: orderSelect.value
  });
}

async function selectFolder(folder) {
  currentFolder = folder;
  preferences.set("lastFolder", folder);
  gallery.setSelectionMode(false);
  syncMobileViewForFolder(folder);
  updatePageTitle(folder);
  folderManager.ensureExpandedTo(folder);
  await folderManager.refresh();
  await loadGalleryView();
}

async function refreshAll() {
  updatePageTitle(currentFolder);
  await folderManager.refresh();
  await loadGalleryView();
}

async function checkPurgeNotification() {
  const data = await trashApi.notification();
  purgeBanner.show(data.notification);
}

function handleShareQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const uploaded = params.get("uploaded");
  const shareError = params.get("share_error");
  if (uploaded == null && !shareError) return;

  if (uploaded != null) {
    infoDialog.open({
      title: "Shared photos",
      message: `${uploaded} files uploaded from share.`
    });
  } else {
    const message =
      shareError === "duplicate"
        ? "Some shared files already exist in the gallery."
        : shareError;
    infoDialog.open({ title: "Share failed", message });
  }

  params.delete("uploaded");
  params.delete("share_error");
  const next = params.toString();
  window.history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
}

async function handleUpload(folder, files, { onProgress, duplicate = "rename" } = {}) {
  const result = await apiUpload(folder, files, { onProgress, duplicate });
  await refreshAll();
  return result;
}

async function handleDuplicateConflict(data, files) {
  pendingFilesForRetry = files;
  const names = data.conflicts.join(", ");
  return new Promise((resolve) => {
    choiceDialog.open({
      title: "Files already exist",
      message: `These files already exist: ${names}. How would you like to proceed?`,
      choices: [
        {
          label: "Rename automatically",
          variant: "btn-primary",
          onClick: async () => {
            await handleUpload(getCurrentFolder(), pendingFilesForRetry, { duplicate: "rename" });
            pendingFilesForRetry = null;
            await refreshAll();
            resolve();
          }
        },
        {
          label: "Skip duplicates",
          variant: "btn-soft",
          onClick: async () => {
            await handleUpload(getCurrentFolder(), pendingFilesForRetry, { duplicate: "skip" });
            pendingFilesForRetry = null;
            await refreshAll();
            resolve();
          }
        },
        {
          label: "Replace",
          variant: "btn-danger-soft",
          onClick: async () => {
            await handleUpload(getCurrentFolder(), pendingFilesForRetry, { duplicate: "replace" });
            pendingFilesForRetry = null;
            await refreshAll();
            resolve();
          }
        }
      ]
    });
  });
}

async function requestDeleteFolder(folder) {
  let inspect;
  try {
    inspect = await folderApi.inspect(folder.path);
  } catch (err) {
    infoDialog.open({ title: "Error", message: err.message });
    return;
  }

  if (!inspect.canDelete) {
    infoDialog.open({
      title: "Cannot delete album",
      message: `"${folder.name}" contains ${inspect.photos} photos and ${inspect.subfolders} sub-albums. Empty the album before moving it to trash.`
    });
    return;
  }

  confirmDialog.open({
    title: "Move album to trash",
    message: `The album "${folder.name}" will be moved to trash.`,
    expectedValue: folder.path,
    submitText: "Move to trash",
    onConfirm: async (confirmPath) => {
      await folderApi.remove(folder.path, confirmPath);
      if (currentFolder === folder.path || currentFolder.startsWith(`${folder.path}/`)) {
        currentFolder = "";
        syncMobileViewForFolder("");
      }
      await refreshAll();
    }
  });
}

sortSelect.value = preferences.getSort();
orderSelect.value = preferences.getOrder();

sortSelect.addEventListener("change", () => {
  preferences.set("sort", sortSelect.value);
  loadGalleryView();
});

orderSelect.addEventListener("change", () => {
  preferences.set("order", orderSelect.value);
  loadGalleryView();
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (searchInput.value.trim()) {
      mobilePhotoView = true;
    } else {
      syncMobileViewForFolder(currentFolder);
    }
    loadGalleryView();
  }, 250);
});

MOBILE_MQ.addEventListener("change", () => {
  syncMobileViewForFolder(currentFolder);
  updatePageTitle(currentFolder);
  updateMobileLayout();
  if (!shouldShowMobileBrowse()) {
    loadGalleryView();
  }
});

document.getElementById("new-folder-btn").addEventListener("click", () => {
  createFolderDialog.open(currentFolder ? `${currentFolder}/` : "");
});

document.getElementById("empty-upload-btn").addEventListener("click", () => fileInput.click());
document.getElementById("trash-btn").addEventListener("click", () => trashPanel.open());

selectModeBtn.addEventListener("click", () => {
  gallery.setSelectionMode(!gallery.getSelectionMode());
});

selectAllBtn.addEventListener("click", () => gallery.selectAll());
cancelSelectionBtn.addEventListener("click", () => gallery.setSelectionMode(false));

moveSelectedBtn.addEventListener("click", () => {
  const ids = gallery.getSelectedIds();
  if (!ids.length) return;
  movePhotoDialog.open(null, ids);
});

coverSelectedBtn.addEventListener("click", async () => {
  const [photo] = gallery.getSelectedPhotos();
  if (!photo || !currentFolder) return;
  await folderApi.setCover(currentFolder, photo.id);
  await folderManager.refresh();
  infoDialog.open({ title: "Cover set", message: `"${photo.name}" is now the album cover.` });
});

downloadSelectedBtn.addEventListener("click", async () => {
  const ids = gallery.getSelectedIds();
  if (!ids.length) return;
  downloadSelectedBtn.disabled = true;
  try {
    await downloadZip(ids);
    infoDialog.open({ title: "Download started", message: `Downloading ${ids.length} photos in a ZIP file.` });
  } catch (err) {
    infoDialog.open({ title: "Download error", message: err.message });
  } finally {
    downloadSelectedBtn.disabled = gallery.getSelectedIds().length === 0;
  }
});

deleteSelectedBtn.addEventListener("click", () => requestDeleteSelected());

bindUpload({
  uploadBtn: document.getElementById("upload-btn"),
  fileInput,
  dropZone,
  progressEl: document.getElementById("upload-progress"),
  progressBarEl: document.getElementById("upload-progress-bar"),
  progressTextEl: document.getElementById("upload-progress-text"),
  getCurrentFolder,
  onUploaded: handleUpload,
  onDuplicateConflict: handleDuplicateConflict
});

bindThemeToggle(document.getElementById("theme-toggle"));

bindLoginForm(loginForm, {
  onSuccess: async (me) => {
    loginError.classList.add("hidden");
    showApp({ authEnabled: true, ...me });
    await folderManager.refresh();
    syncMobileViewForFolder(currentFolder);
    await refreshAll();
    await checkPurgeNotification();
  },
  onError: (message) => {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
  }
});

bindLogout(logoutBtn, {
  onLoggedOut: () => showLogin()
});

bootstrapAuth({
  onAuthenticated: async (me) => {
    showApp(me);
    await folderManager.refresh();
    syncMobileViewForFolder(currentFolder);
    await refreshAll();
    await checkPurgeNotification();
    handleShareQueryParams();
  },
  onLoginRequired: () => showLogin()
});
