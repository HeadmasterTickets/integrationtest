import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid resolving Turbopack from a parent folder that has its own package-lock.json
  // (fixes dev overlay failing to resolve next/dist/client/.../global-error).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
