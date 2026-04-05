const basePath = process.env.BASE_PATH || "";
const staticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: "export", trailingSlash: true } : {}),
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DATA_MODE: staticExport ? "public" : "api",
  },
};

export default nextConfig;
