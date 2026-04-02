import { promises as fs } from "fs";
import path from "path";

const ALLOWED = {
  "neighborhoods.geojson": { file: "neighborhoods.geojson", type: "application/geo+json" },
  "route_lines_current.geojson": {
    file: "route_lines_current.geojson",
    type: "application/geo+json",
  },
  "fy26_route_n_profiles_all.csv": { file: "fy26_route_n_profiles_all.csv", type: "text/csv" },
  "FY26_route_status_all.csv": { file: "FY26_route_status_all.csv", type: "text/csv" },
  "demographics.csv": { file: "demographics.csv", type: "text/csv" },
  "routes_with_demographics.csv": { file: "routes_with_demographics.csv", type: "text/csv" },
  "ridership.csv": { file: "ridership.csv", type: "text/csv" },
  "route_demographics.csv": { file: "route_demographics.csv", type: "text/csv" },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "";
  const allow = ALLOWED[name];
  if (!allow) {
    return new Response("File not allowed", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", allow.file);
  try {
    const file = await fs.readFile(filePath);
    return new Response(file, {
      status: 200,
      headers: {
        "content-type": `${allow.type}; charset=utf-8`,
        "cache-control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}
