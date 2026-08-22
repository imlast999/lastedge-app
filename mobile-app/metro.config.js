// Workspace-level Metro config for pnpm monorepo builds (Gradle/EAS).
// Delegates to the mobile app package so bundling resolves from artifacts/mobile.
module.exports = require("./artifacts/mobile/metro.config.js");
