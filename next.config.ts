import type { NextConfig } from "next";

const isPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isPages ? "/diffh2o" : undefined,
  assetPrefix: isPages ? "/diffh2o/" : undefined,
};

export default nextConfig;
