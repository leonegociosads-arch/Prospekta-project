import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acessar o dev server tambem pelo IP da rede local e pelo
  // navegador embutido do VS Code, sem bloquear os Server Actions.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.114"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3100", "127.0.0.1:3100", "192.168.1.114:3100"],
    },
  },
};

export default nextConfig;
