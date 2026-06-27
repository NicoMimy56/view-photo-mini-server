const KEY = "viewphoto-prefs";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const preferences = {
  getAll() {
    return read();
  },

  get(key, fallback = null) {
    const data = read();
    return data[key] ?? fallback;
  },

  set(key, value) {
    const data = read();
    data[key] = value;
    write(data);
  },

  getSort() {
    return this.get("sort", "modified");
  },

  getOrder() {
    return this.get("order", "desc");
  },

  getLastFolder() {
    return this.get("lastFolder", "");
  },

  getCollapsedFolders() {
    return this.get("collapsedFolders", []);
  },

  setCollapsedFolders(list) {
    this.set("collapsedFolders", list);
  }
};

export function loadCollapsedSet() {
  return new Set(preferences.getCollapsedFolders());
}

export function saveCollapsedSet(set) {
  preferences.setCollapsedFolders([...set]);
}
