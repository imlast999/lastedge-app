/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    usesCleartextTraffic: true,
  },
  extra: {
    ...(appJson.expo.extra ?? {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    apiSecret: process.env.EXPO_PUBLIC_API_SECRET ?? "",
  },
});
