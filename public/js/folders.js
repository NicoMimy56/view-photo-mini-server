import { folderApi, thumbUrl } from "./api.js";
import { icons } from "./icons.js";
import { buildFolderTree, getAncestorPaths } from "./folderTree.js";
import { loadCollapsedSet, saveCollapsedSet } from "./preferences.js";

export function createFolderManager({
  listEl,
  onSelectFolder,
  onRequestDeleteFolder,
  onRequestRenameFolder,
  getCurrentFolder
}) {
  let folders = [];
  let covers = {};
  const collapsedPaths = loadCollapsedSet();

  function persistCollapsed() {
    saveCollapsedSet(collapsedPaths);
  }

  function isExpanded(path) {
    return !collapsedPaths.has(path);
  }

  function toggleExpanded(path) {
    if (collapsedPaths.has(path)) collapsedPaths.delete(path);
    else collapsedPaths.add(path);
    persistCollapsed();
    render();
  }

  function ensureExpandedTo(path) {
    for (const ancestor of getAncestorPaths(path)) {
      collapsedPaths.delete(ancestor);
    }
    persistCollapsed();
  }

  async function refresh() {
    try {
      const data = await folderApi.list();
      folders = data.folders || [];
      covers = data.covers || {};
    } catch (err) {
      console.error("Impossibile caricare gli album:", err);
      folders = [];
      covers = {};
    }
    ensureExpandedTo(getCurrentFolder());
    render();
  }

  function renderRootItem() {
    const rootItem = document.createElement("div");
    rootItem.className = `folder-item folder-item-root${getCurrentFolder() === "" ? " active" : ""}`;

    const row = document.createElement("div");
    row.className = "folder-row";

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML = icons.grid;

    const rootBtn = document.createElement("button");
    rootBtn.type = "button";
    rootBtn.className = "folder-link";
    rootBtn.textContent = "Tutte le foto";
    rootBtn.addEventListener("click", () => onSelectFolder(""));

    row.append(icon, rootBtn);
    rootItem.append(row);
    listEl.append(rootItem);
  }

  function renderFolderIcon(node, isActive) {
    const coverId = covers[node.path];
    if (coverId) {
      const img = document.createElement("img");
      img.className = "folder-cover-thumb";
      img.src = thumbUrl(coverId);
      img.alt = "";
      img.loading = "lazy";
      return img;
    }

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML = isActive ? icons.folderOpen : icons.folder;
    return icon;
  }

  function renderNode(node, depth) {
    const hasChildren = node.children.length > 0;
    const expanded = !hasChildren || isExpanded(node.path);
    const isActive = getCurrentFolder() === node.path;
    const canDelete = node.photoCount === 0 && node.subfolderCount === 0;

    const branch = document.createElement("div");
    branch.className = "folder-branch";
    branch.style.setProperty("--depth", String(depth));

    const item = document.createElement("div");
    item.className = `folder-item${isActive ? " active" : ""}${canDelete ? "" : " not-deletable"}`;

    const row = document.createElement("div");
    row.className = "folder-row";

    if (hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = `folder-toggle${expanded ? " expanded" : ""}`;
      toggle.innerHTML = icons.chevron;
      toggle.setAttribute("aria-label", expanded ? "Comprimi album" : "Espandi album");
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleExpanded(node.path);
      });
      row.append(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "folder-toggle-spacer";
      row.append(spacer);
    }

    row.append(renderFolderIcon(node, isActive));

    const link = document.createElement("button");
    link.type = "button";
    link.className = "folder-link";
    link.textContent = node.name;
    link.title = node.path;
    link.addEventListener("click", () => onSelectFolder(node.path));

    const meta = document.createElement("span");
    meta.className = "folder-meta";
    meta.textContent = String(node.photoCount);
    meta.title = `${node.photoCount} foto`;

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "folder-menu-btn folder-rename-btn";
    renameBtn.innerHTML = icons.edit;
    renameBtn.title = "Rinomina album";
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onRequestRenameFolder(node);
    });

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "folder-menu-btn";
    menu.innerHTML = icons.trash;
    menu.title = canDelete ? "Sposta nel cestino" : "Svuota l'album prima";
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      onRequestDeleteFolder(node);
    });

    row.append(link, meta, renameBtn, menu);
    item.append(row);
    branch.append(item);

    if (hasChildren) {
      const childrenEl = document.createElement("div");
      childrenEl.className = `folder-children${expanded ? "" : " collapsed"}`;
      for (const child of node.children) {
        childrenEl.append(renderNode(child, depth + 1));
      }
      branch.append(childrenEl);
    }

    return branch;
  }

  function render() {
    listEl.innerHTML = "";
    renderRootItem();

    const tree = buildFolderTree(folders);
    for (const node of tree) {
      listEl.append(renderNode(node, 0));
    }
  }

  return {
    refresh,
    ensureExpandedTo,
    getFolders: () => folders,
    getCovers: () => covers
  };
}

export async function createFolder(path) {
  return folderApi.create(path);
}

export function bindCreateFolderDialog({ dialog, form, inputEl, errorEl, cancelBtn, onCreated }) {
  function open(prefill = "") {
    inputEl.value = prefill;
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    dialog.showModal();
    inputEl.focus();
    inputEl.select();
  }

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const path = inputEl.value.trim();
    if (!path) {
      errorEl.textContent = "Inserisci un nome per la cartella.";
      errorEl.classList.remove("hidden");
      return;
    }

    try {
      await createFolder(path);
      dialog.close();
      await onCreated(path);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

  return { open };
}

export function bindRenameFolderDialog({ dialog, form, inputEl, errorEl, cancelBtn, onRenamed }) {
  let folder = null;

  function open(currentFolder) {
    folder = currentFolder;
    inputEl.value = currentFolder.name;
    errorEl.classList.add("hidden");
    dialog.showModal();
    inputEl.focus();
    inputEl.select();
  }

  cancelBtn.addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newName = inputEl.value.trim();
    if (!newName) return;

    const parent = folder.path.includes("/")
      ? folder.path.slice(0, folder.path.lastIndexOf("/"))
      : "";
    const newPath = parent ? `${parent}/${newName}` : newName;

    try {
      await folderApi.rename(folder.path, newPath);
      dialog.close();
      await onRenamed(folder.path, newPath);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

  return { open };
}
