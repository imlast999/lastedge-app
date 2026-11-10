# Privacy Policy for LastEdge

**Application:** LastEdge (`com.lastedge.app`)  
**Ecosystem:** LastEdge Quantitative Trading Ecosystem  
**Last Updated:** November 2026  
**Official Web Mirror:** [https://imlast999.github.io/lastedge-app/privacy.html](https://imlast999.github.io/lastedge-app/privacy.html)

---

## 1. Privacy Commitment
At **LastEdge**, data privacy, confidentiality, and operational sovereignty are foundational principles. LastEdge is a client application designed for real-time quantitative monitoring and algorithmic trading telemetry interfaced with MetaTrader 5 (MT5).

**We do not collect, sell, monetize, rent, or share any personal, financial, or trading activity data with third parties.**

---

## 2. Data Storage & Local Client Processing
All sensitive configuration details and credentials necessary for operating the application are stored and processed exclusively **locally** on the user's physical device:

- **Server Connection Endpoints (URL/IP) & Ports:** Stored strictly in the device's hardware-backed encrypted keystore (SecureStore / Android KeyStore).
- **API Keys & Authentication Tokens:** Kept locally on device and transmitted exclusively via direct, encrypted HTTPS/WSS channels between the client and the user's private, self-hosted LastEdge server.
- **Historical Trades & Execution Telemetry:** Queried on demand directly from the user's private server and temporarily cached in memory to accelerate high-definition charting renders.

---

## 3. Device Permissions & Technical Justification
The application requests only the minimum set of permissions strictly necessary to execute its technical functions:

| Permission | Purpose |
|---|---|
| `INTERNET` / `ACCESS_NETWORK_STATE` | Required to establish encrypted REST and WebSocket connections with the user's private LastEdge Trading Engine and query account balance, equity, and open positions. |
| `POST_NOTIFICATIONS` | Required to deliver real-time actionable notifications regarding trade executions, Take Profit (TP), Stop Loss (SL) triggers, and Risk Engine circuit breakers. |
| `VIBRATE` | Required to provide haptic feedback when priority execution alerts and risk warnings are received. |

The application **DOES NOT** request or access device camera, contacts, GPS location, microphone, or external shared storage.

---

## 4. Zero Third-Party Advertising & Tracking
LastEdge contains zero third-party advertising SDKs, behavioral tracking frameworks, or commercial analytics pixels (no Google AdMob, no Meta Facebook Pixel, no external broker trackers). The application operates with a clean, privacy-first architecture focused on data sovereignty.

---

## 5. Financial Software Disclaimer
**LastEdge is technical software for quantitative analysis and algorithmic execution telemetry.**

- LastEdge is **NOT** a broker, dealer, investment advisor, or regulated banking institution.
- LastEdge **DOES NOT** hold client deposits, custody funds, or process fiat or cryptocurrency payment transactions.
- LastEdge **DOES NOT** provide personalized investment advice or solicitation of financial products.
- Trading foreign exchange, commodities, and digital assets carries substantial financial risk. Past quantitative performance is not indicative of future returns.

---

## 6. Data Sovereignty & Complete Erasure
The user maintains full sovereignty over all stored data at all times. To delete all cached data, connection settings, and credentials, the user can select **"Reset Settings"** within the in-app Settings modal or simply uninstall the application.

---

## 7. Contact & Developer Support
For technical inquiries, bug disclosures, or questions regarding this Privacy Policy:  
Official Repository: [https://github.com/imlast999/lastedge-app/issues](https://github.com/imlast999/lastedge-app/issues)
