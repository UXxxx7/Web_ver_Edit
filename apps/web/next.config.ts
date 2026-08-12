import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions cap request bodies at 1MB by default — fine for the
  // brainstorm tools' text payloads, but createEditJob/createCrollJob
  // (VideoEditor.tsx, CrollCreator.tsx) send whole video/photo files as
  // FormData through a "use server" action. Any video upload silently hit
  // this wall. 200mb covers real AI-generated clips with headroom.
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
