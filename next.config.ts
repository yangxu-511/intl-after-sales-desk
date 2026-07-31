import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "intl-after-sales-desk";
const githubPagesBasePath = repositoryName.endsWith(".github.io")
  ? ""
  : `/${repositoryName}`;

const nextConfig: NextConfig = {
  ...(process.env.VERCEL
    ? {
        turbopack: {
          root: process.cwd(),
        },
        typescript: {
          tsconfigPath: "tsconfig.vercel.json",
        },
      }
    : {}),
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: githubPagesBasePath,
        assetPrefix: githubPagesBasePath,
        turbopack: {
          root: process.cwd(),
        },
        typescript: {
          tsconfigPath: "tsconfig.pages.json",
        },
        images: {
          unoptimized: true,
        },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
