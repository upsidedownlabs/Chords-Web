
import nextPwa from 'next-pwa';

/** @type {import('next').NextConfig} */
const withPWA = nextPwa({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

const config = {
  reactStrictMode: true,
  output: "export",  // Ensures it works with static export
  basePath: "/Chords-Web",
  assetPrefix: "/Chords-Web/",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  ...withPWA,
};

export default config;