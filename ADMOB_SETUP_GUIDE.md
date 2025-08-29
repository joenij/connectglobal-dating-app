# Google AdMob Setup Guide - ConnectGlobal Dating App

## 🎯 Task 1: Google AdMob Konto erstellen

### Schritt 1: AdMob Konto Registrierung
1. Gehe zu https://admob.google.com/
2. Klicke auf **"Get started"**
3. Melde dich mit deinem Google Account an (oder erstelle einen neuen)
4. Wähle dein Land/Region aus
5. Akzeptiere die AdMob Terms & Conditions

### Schritt 2: Konto-Informationen vervollständigen
1. **Business Information:**
   - Company Name: `ConnectGlobal Dating`
   - Business Type: `Mobile App Developer`
   - Website: `https://connectglobal-dating.com` (wenn vorhanden)

2. **Payment Information:**
   - Land: Deutschland
   - Steuerliche Angaben nach deutschen Gesetzen
   - Bankverbindung für Auszahlungen

### Schritt 3: AdMob Policies Review
- **WICHTIG:** AdMob hat strenge Richtlinien für Dating Apps
- Dating Apps sind erlaubt, aber mit besonderen Auflagen:
  - Keine expliziten sexuellen Inhalte
  - Altersverifikation erforderlich (18+)
  - Klare Community Guidelines
  - Moderierte Inhalte

### Schritt 4: Konto Verifizierung
- Email-Verifizierung abschließen
- Telefonnummer bestätigen
- Identity Verification (kann bis zu 48h dauern)

---

## 📱 Task 2: AdMob App Registrierung

### App Details für ConnectGlobal
- **App Name:** `ConnectGlobal Dating`
- **Platform:** iOS & Android
- **Category:** Social/Lifestyle
- **Content Rating:** 17+ (Mature)
- **App Store Links:** (werden später hinzugefügt)

### iOS App Registration
1. AdMob Console → Apps → Add App
2. Wähle "iOS"
3. App Name: `ConnectGlobal Dating`
4. Bundle ID: `com.connectglobal.dating` (anpassen falls anders)
5. App Store ID: (nach App Store Submission)

### Android App Registration  
1. AdMob Console → Apps → Add App
2. Wähle "Android"
3. App Name: `ConnectGlobal Dating`
4. Package Name: `com.connectglobal.dating` (anpassen falls anders)
5. Play Store URL: (nach Play Store Submission)

---

## 🆔 Ad Unit IDs erstellen

### iOS Ad Units (Task 3)
Nach App-Registrierung für jede App erstellen:

1. **Banner Ad Unit**
   - Name: `iOS_Banner_Home`
   - Ad Format: Banner
   - Placement: Home Screen

2. **Interstitial Ad Unit** 
   - Name: `iOS_Interstitial_Navigation`
   - Ad Format: Interstitial
   - Placement: Between Screens

3. **Rewarded Video Ad Unit**
   - Name: `iOS_RewardedVideo_VideoUnlock`
   - Ad Format: Rewarded
   - Reward: 1 Video Upload

### Android Ad Units (Task 4)
Identische Struktur für Android App erstellen.

---

## 🔧 Development Setup

### Test Ad Unit IDs (bereits implementiert)
Die App nutzt bereits TestIds von react-native-google-mobile-ads für Development:

```typescript
// In AdService.ts bereits implementiert:
private testAdUnits = {
  banner: TestIds.BANNER,
  interstitial: TestIds.INTERSTITIAL,  
  rewarded: TestIds.REWARDED_VIDEO,
};
```

### Production Ad Unit IDs
Nach AdMob Setup diese Environment Variables setzen:

```bash
# iOS Production Ad Unit IDs
ADMOB_IOS_BANNER_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX
ADMOB_IOS_INTERSTITIAL_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX  
ADMOB_IOS_REWARDED_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX

# Android Production Ad Unit IDs
ADMOB_ANDROID_BANNER_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX
ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX
ADMOB_ANDROID_REWARDED_ID=ca-app-pub-XXXXXXXX~XXXXXXXXXX
```

---

## ⚠️ Wichtige Compliance-Hinweise

### Dating App Spezifische Anforderungen
1. **Age Gate Implementation:**
   - Nutzer müssen mindestens 18 Jahre alt sein
   - Age Verification vor Ad-Anzeige

2. **Content Moderation:**  
   - Alle User-generierten Inhalte moderieren
   - Explizite Inhalte blockieren
   - Community Guidelines durchsetzen

3. **GDPR Compliance:** 
   - ✅ Bereits implementiert via ConsentManager.ts
   - User Consent für Ads erforderlich
   - EU User Tracking Restrictions

4. **Ad Placement Guidelines:**
   - Keine Ads während intimen Conversations
   - Respectful Ad Placements
   - Clear Reward Explanations

### Revenue Sharing
- Google AdMob behält 30% der Werbeeinnahmen
- 70% gehen an den App-Entwickler
- Minimum Auszahlung: $100

---

## 🚀 Next Steps nach Account Setup

1. ✅ **Account Approved** → App Registration
2. ✅ **Apps Registered** → Ad Unit Creation  
3. ✅ **Ad Units Created** → SDK Integration Testing
4. ✅ **Testing Complete** → Store Submissions
5. ✅ **Apps Live** → Production Ad Units Activation
6. ✅ **Revenue Tracking** → Analytics & Optimization

---

## 📞 Support & Resources

- **AdMob Help Center:** https://support.google.com/admob/
- **Dating App Policies:** https://support.google.com/admob/answer/6162477
- **React Native Integration:** https://docs.page/invertase/react-native-google-mobile-ads
- **GDPR Guidelines:** https://support.google.com/admob/answer/9742753

**Status:** 🔄 Account Setup in Progress
**Next:** App Registration nach Account Approval