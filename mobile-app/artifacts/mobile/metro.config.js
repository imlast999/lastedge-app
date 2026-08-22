const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro resolve modules from both the package, workspace root, and pnpm store
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, ".pnpm_store"),
  path.resolve("C:/v"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
