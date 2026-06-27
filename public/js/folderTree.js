/**
 * @typedef {import("./api.js").Folder & { children: FolderNode[] }} FolderNode
 */

/**
 * @param {Array<{ path: string, name: string, photoCount: number, subfolderCount: number }>} folders
 * @returns {FolderNode[]}
 */
export function buildFolderTree(folders) {
  const roots = [];
  const byPath = new Map();

  const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path, "it"));

  for (const folder of sorted) {
    const node = { ...folder, children: [] };
    byPath.set(folder.path, node);

    const slash = folder.path.lastIndexOf("/");
    if (slash === -1) {
      roots.push(node);
      continue;
    }

    const parentPath = folder.path.slice(0, slash);
    const parent = byPath.get(parentPath);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/**
 * @param {string} path
 * @returns {string[]}
 */
export function getAncestorPaths(path) {
  const ancestors = [];
  let current = path;

  while (current) {
    ancestors.push(current);
    const slash = current.lastIndexOf("/");
    current = slash === -1 ? "" : current.slice(0, slash);
  }

  return ancestors;
}

/**
 * @param {string} path
 * @returns {string[]}
 */
export function splitFolderPath(path) {
  return path.split("/").filter(Boolean);
}
