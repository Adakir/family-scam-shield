---
name: RevenueCat mobile billing
description: Mobile subscription setup and preview constraints for this project
---

Native billing uses RevenueCat with platform-specific public keys and the `premium` entitlement. Browser previews must skip RevenueCat initialization because mobile keys are rejected by RevenueCat’s web mode.

**Why:** The app is Expo/mobile-first, while the Replit web preview is only a visual check; mixing those environments produces misleading invalid-key errors.

**How to apply:** Keep purchase logic behind the subscription provider, derive displayed pricing from the RevenueCat offering, and finish the actual $3.99 store price in App Store Connect and Google Play before launch.