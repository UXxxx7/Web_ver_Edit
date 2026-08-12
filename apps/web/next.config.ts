import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 主视频 + 参考视频 + 多段 b-roll 的合计请求体上限。Next.js 的 Server
      // Action 默认上限是 1MB，单个真实视频就会超；本地开发按素材体量给足。
      // 注意：走公网/部署时宿主（Vercel 等）自身也有 body 限制，届时可能需要
      // 换成「前端直传 apps/api」的方案（见 armb_web_wiring_plan.md §3 备选）。
      bodySizeLimit: "512mb",
    },
    // 上传的 POST 会先经过 proxy.ts（鉴权中间件）。Next.js 16 的代理层默认只
    // 缓冲 10MB 请求体，超了会截断 -> 下游 Server Action 解析 multipart 报
    // "Unexpected end of form"。设成与 serverActions.bodySizeLimit 一致。
    // （旧名 middlewareClientMaxBodySize 已废弃，用 proxyClientMaxBodySize。）
    proxyClientMaxBodySize: "512mb",
  },
};

export default nextConfig;
