/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-pdf's pdf.js worker isn't safe against React Strict Mode's dev-only
  // double-mount/unmount of effects — it can tear down the worker mid-flight
  // and crash with "Cannot read properties of null (reading 'sendWithPromise')".
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
