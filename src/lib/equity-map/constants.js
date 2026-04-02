export const ROUTE_ALIAS_MAP = {
  "019L": "19L",
  "051L": "51L",
  "052L": "52L",
  "053L": "53L",
  "028X": "28X",
  "061A": "61A",
  "061B": "61B",
  "061C": "61C",
  "061D": "61D",
  "071A": "71A",
  "071B": "71B",
  "071C": "71C",
  "071D": "71D",
  BLLB: "BLUE",
  BLSV: "BLUE",
  "000": "MI",
  "0": "MI",
};

export function normalizeRouteId(id) {
  const raw = String(id || "").trim().toUpperCase();
  if (!raw) return "";
  const base = /^\d+$/.test(raw) ? String(Number(raw)) : raw;
  return ROUTE_ALIAS_MAP[base] || base;
}
