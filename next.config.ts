import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isProjectPagesRepo = repoName.length > 0 && !repoName.endsWith(".github.io");
const basePath =
  process.env.GITHUB_ACTIONS && isProjectPagesRepo ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
  // fetch() doesn't get basePath prefixed the way <Link> and <Image> do
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
