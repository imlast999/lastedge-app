# Política de Privacidad de LastEdge

**Aplicación:** LastEdge (`com.lastedge.app`)  
**Ecosistema:** LastEdge Quantitative Trading Ecosystem  
**Última actualización:** Noviembre 2026  
**Versión web oficial:** [https://imlast999.github.io/lastedge-app/privacy.html](https://imlast999.github.io/lastedge-app/privacy.html)

---

## 1. Compromiso de Privacidad
En **LastEdge** nos tomamos la privacidad y la soberanía de los datos con el máximo rigor institucional. LastEdge es una aplicación cliente de monitorización cuantitativa y control de trading algorítmico conectada a MetaTrader 5 (MT5).

**No recopilamos, no vendemos, no monetizamos ni compartimos ningún dato personal, financiero ni de operativa con terceros.**

---

## 2. Datos Almacenados y Tratamiento Local
Toda la información sensible necesaria para operar con la aplicación se almacena y procesa exclusivamente de forma **local** en el dispositivo del usuario:

- **Direcciones de conexión (URL/IP) y puertos:** Se almacenan en el almacenamiento cifrado del dispositivo (SecureStore / KeyStore de Android).
- **Claves de API y credenciales de acceso:** Se guardan localmente y se transmiten únicamente de manera directa y cifrada entre el cliente móvil y el servidor privado autohospedado del usuario.
- **Historial de trades y telemetría:** Se descargan bajo demanda desde el servidor del usuario y se conservan en memoria caché local para agilizar la visualización gráfica.

---

## 3. Permisos Requeridos y Finalidad
La aplicación solicita únicamente los permisos indispensables para su operativa técnica:

| Permiso | Finalidad |
|---|---|
| `INTERNET` / `ACCESS_NETWORK_STATE` | Comunicación con la API REST y WebSockets del servidor LastEdge para consultar balance, equity y posiciones MT5. |
| `POST_NOTIFICATIONS` | Alertas en tiempo real sobre aperturas de trades, cierres por Take Profit (TP), Stop Loss (SL) y Risk Circuit Breakers. |
| `VIBRATE` | Retroalimentación háptica en la recepción de alertas de trading prioritarias. |

La aplicación **NO** solicita acceso a cámara, contactos, ubicación por GPS, micrófono ni almacenamiento de archivos externos.

---

## 4. Ausencia de Rastreadores y Publicidad de Terceros
LastEdge no contiene librerías ni SDKs de publicidad invasiva, rastreo conductual o telemetría publicitaria (sin Google AdMob, sin Meta Facebook Pixel, sin brokers comerciales integrados). La aplicación opera bajo una arquitectura limpia y orientada a la soberanía de datos del usuario.

---

## 5. Exención de Responsabilidad Financiera (Disclaimer)
**LastEdge es una herramienta de software de análisis técnico y visualización de telemetría algorítmica.**

- LastEdge **NO** es un broker ni una entidad financiera regulada.
- LastEdge **NO** custodia fondos de usuarios, depósitos ni procesa transacciones bancarias.
- LastEdge **NO** presta servicios de asesoramiento financiero personalizado ni captación de inversiones.
- El trading en mercados financieros (Forex, Criptomonedas, Materias Primas) conlleva un riesgo de capital significativo. Los rendimientos pasados de algoritmos cuantitativos no garantizan resultados futuros.

---

## 6. Control de Datos y Eliminación
El usuario mantiene el control total de sus datos en todo momento. Para borrar todos los registros, credenciales, historial en caché y configuraciones de conexión, el usuario puede pulsar el botón **"Restablecer Ajustes"** en la pestaña de Ajustes de la app o desinstalar la aplicación en cualquier momento.

---

## 7. Contacto y Soporte
Para cualquier duda o consulta sobre esta política de privacidad:  
**Repositorio GitHub:** [https://github.com/imlast999/lastedge-app/issues](https://github.com/imlast999/lastedge-app/issues)
