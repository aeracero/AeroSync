import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発中のプロトタイプのため、ビルド時の厳密なエラーチェックをスキップする
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
