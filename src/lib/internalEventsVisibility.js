const ROLE_ALIASES = {
  admin: "admin",
  "super admin": "superadmin",
  superadmin: "superadmin",
  coordinator: "coordinator",
  teacher: "teacher",
  parent: "parent",
  parents: "parent",
  "super-admin": "superadmin",
  super_admin: "superadmin",
};

export function normalizeVisibleRole(value) {
  if (typeof value !== "string") return "";

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";

  if (ROLE_ALIASES[normalized]) return ROLE_ALIASES[normalized];

  const compact = normalized.replace(/[^a-z]+/g, "");
  if (compact === "admin") return "admin";
  if (compact === "teacher") return "teacher";
  if (compact === "parent" || compact === "parents") return "parent";
  if (compact === "coordinator") return "coordinator";
  if (compact === "superadmin") return "superadmin";

  return "";
}

export function normalizeVisibleRoles(values) {
  const inputValues = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(",")
      : [];

  const seen = new Set();
  const normalized = [];

  for (const value of inputValues) {
    const role = normalizeVisibleRole(value);
    if (!role || seen.has(role)) continue;
    seen.add(role);
    normalized.push(role);
  }

  return normalized;
}

export function isEventVisibleToRole(visibleToRoles, role) {
  const normalizedRole = normalizeVisibleRole(role);
  if (!normalizedRole) return true;

  const allowedRoles = normalizeVisibleRoles(visibleToRoles);
  if (allowedRoles.length === 0) return true;

  return allowedRoles.includes(normalizedRole);
}
