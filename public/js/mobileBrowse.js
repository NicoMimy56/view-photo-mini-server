import { thumbUrl } from "./api.js";
import { icons } from "./icons.js";

function getDirectChildren(folderPath, folders) {
  const prefix = folderPath ? `${folderPath}/` : "";
  return folders.filter((folder) => {
    if (folderPath === "") return !folder.path.includes("/");
    if (!folder.path.startsWith(prefix)) return false;
    const rest = folder.path.slice(prefix.length);
    return rest.length > 0 && !rest.includes("/");
  });
}

function getFolderMeta(folderPath, folders) {
  return folders.find((folder) => folder.path === folderPath) || null;
}

function getParentPath(folderPath) {
  if (!folderPath) return null;
  const slash = folderPath.lastIndexOf("/");
  return slash === -1 ? "" : folderPath.slice(0, slash);
}

export function createMobileBrowse({
  containerEl,
  getCurrentFolder,
  getFolders,
  getCovers,
  onSelectFolder,
  onOpenPhotos,
  onOpenAllPhotos
}) {
  function render() {
    const currentFolder = getCurrentFolder();
    const folders = getFolders();
    const covers = getCovers();
    const children = getDirectChildren(currentFolder, folders);
    const currentMeta = currentFolder ? getFolderMeta(currentFolder, folders) : null;
    const directPhotos = currentMeta?.photoCount || 0;

    containerEl.innerHTML = "";

    if (currentFolder === "") {
      const intro = document.createElement("p");
      intro.className = "mobile-browse-intro";
      intro.textContent = "Scegli un album o visualizza l'intera libreria.";
      containerEl.append(intro);

      containerEl.append(
        createAlbumCard({
          title: "Tutte le foto",
          subtitle: "L'intera libreria",
          coverId: null,
          icon: icons.grid,
          accent: true,
          onClick: () => onOpenAllPhotos()
        })
      );
    } else {
      const intro = document.createElement("p");
      intro.className = "mobile-browse-intro";
      intro.textContent = children.length
        ? "Apri una sotto-cartella o le foto di questo album."
        : directPhotos
          ? "Tocca per aprire le foto."
          : "Questo album è vuoto.";
      containerEl.append(intro);

      if (directPhotos > 0) {
        containerEl.append(
          createAlbumCard({
            title: "Foto in questo album",
            subtitle: `${directPhotos} ${directPhotos === 1 ? "foto" : "foto"}`,
            coverId: covers[currentFolder],
            icon: icons.image,
            accent: true,
            onClick: () => onOpenPhotos(currentFolder)
          })
        );
      }
    }

    if (!children.length && currentFolder && directPhotos === 0) {
      const empty = document.createElement("div");
      empty.className = "mobile-browse-empty";
      empty.innerHTML = `${icons.folder}<p>Nessuna foto qui.<br>Carica dal pulsante in alto.</p>`;
      containerEl.append(empty);
      return;
    }

    if (children.length) {
      const heading = document.createElement("h3");
      heading.className = "mobile-browse-section";
      heading.textContent = currentFolder === "" ? "I tuoi album" : "Sotto-album";
      containerEl.append(heading);

      const grid = document.createElement("div");
      grid.className = "mobile-album-grid";

      for (const child of children.sort((a, b) => a.name.localeCompare(b.name, "it"))) {
        const hasNested = child.subfolderCount > 0;
        grid.append(
          createAlbumCard({
            title: child.name,
            subtitle: hasNested
              ? `${child.subfolderCount} cartelle · ${child.photoCount} foto`
              : `${child.photoCount} ${child.photoCount === 1 ? "foto" : "foto"}`,
            coverId: covers[child.path],
            icon: hasNested ? icons.folderOpen : icons.folder,
            onClick: () => {
              if (child.subfolderCount > 0 && child.photoCount === 0) {
                onSelectFolder(child.path);
                return;
              }
              if (child.subfolderCount > 0) {
                onSelectFolder(child.path);
                return;
              }
              onOpenPhotos(child.path);
            }
          })
        );
      }

      containerEl.append(grid);
    }
  }

  return { render };
}

function createAlbumCard({ title, subtitle, coverId, icon, accent = false, onClick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `mobile-album-card${accent ? " mobile-album-card-accent" : ""}`;

  const cover = document.createElement("div");
  cover.className = "mobile-album-cover";
  if (coverId) {
    const img = document.createElement("img");
    img.src = thumbUrl(coverId);
    img.alt = "";
    img.loading = "lazy";
    cover.append(img);
  } else {
    cover.innerHTML = icon;
  }

  const meta = document.createElement("div");
  meta.className = "mobile-album-meta";

  const name = document.createElement("strong");
  name.className = "mobile-album-name";
  name.textContent = title;

  const info = document.createElement("span");
  info.className = "mobile-album-count";
  info.textContent = subtitle;

  meta.append(name, info);
  btn.append(cover, meta);
  btn.addEventListener("click", onClick);
  return btn;
}

export { getDirectChildren, getParentPath };
