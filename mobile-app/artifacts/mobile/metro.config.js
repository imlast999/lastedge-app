const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro resolve modules from workspace root and pnpm store if present
const watchFolders = [workspaceRoot];
const pnpmStore = path.resolve(workspaceRoot, ".pnpm_store");
if (fs.existsSync(pnpmStore)) {
  watchFolders.push(pnpmStore);
}
config.watchFolders = watchFolders;

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
