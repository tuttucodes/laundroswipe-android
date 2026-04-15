const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keeps file tracing on this repo when other lockfiles exist on the machine (Vercel / local).
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
