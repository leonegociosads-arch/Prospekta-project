import type { NextConfig } from "next";

// Em produção (Vercel) os Server Actions só aceitam requisições da própria
// origem — que é o comportamento padrão e seguro do Next. As liberações abaixo
// são SÓ para o desenvolvimento local: acessar o dev server pelo IP da rede
// local e pelo navegador embutido do VS Code sem quebrar os Server Actions.
const ehDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = ehDev
  ? {
      allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.114"],
      experimental: {
        serverActions: {
          allowedOrigins: ["localhost:3100", "127.0.0.1:3100", "192.168.1.114:3100"],
        },
      },
    }
  : {};

export default nextConfig;
