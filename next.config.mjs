// next.config.mjs
export default {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack(config, { isServer }) {
    // If this is the server-side bundle, we don’t need to process worker files
    if (!isServer) {
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: { loader: 'worker-loader' },
      });
    }
    return config;
  },
};
