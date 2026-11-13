# STM MEXA: first Android release

| Item | Value |
| --- | --- |
| Google Play Console account | `it@stengineers.co.in` (existing S&T developer account) |
| Build and signing contact | `it@stmcnc.com` |
| App name | STM MEXA |
| Android package | `com.stmcnc.mexa` |
| First release | `1.0.0` (version code `1`) |
| API | `https://stmapi.stmcnc.com/api` |

The two email addresses can differ. The app was built locally without a personal Expo account. The signed files are in `release-artifacts/stm-mexa-android` beside the `MobileApp` folder:

- `STM-MEXA-1.0.0-1-STMCNC.apk`: install directly on an Android test phone.
- `STM-MEXA-1.0.0-1-STMCNC.aab`: upload for the new Play Store listing.

Use the files with the `STMCNC` suffix. Earlier files without this suffix are
superseded and must not be uploaded for this STM package. The app's displayed
name is **STM MEXA** and its package is **`com.stmcnc.mexa`**. Only upload the AAB
to a Play Console app registered with that exact package.

Both files were verified against the same upload certificate. The APK targets Android API 36, supports API 24 and later, and passed the 16 KB native library alignment check. The two files include the same JavaScript bundle and production API address. Physical phone testing is the next check.

## 1. Test the APK

Install the signed APK on a test phone. Open the app, sign in with an authorized test account, and check machine pages, alarms, notifications, dark mode, and sign-out. Check that the AI tab is visible only when enabled for that account. Use approved test data for store screenshots.

## 2. Create the new app in Play Console

1. Sign in to [Google Play Console](https://play.google.com/console/) as `it@stengineers.co.in` and select the existing S&T developer account.
2. Choose **All apps → Create app**. Enter **STM MEXA** and `com.stmcnc.mexa` where requested. Select the default language, **App**, and the distribution/pricing settings approved by S&T.
3. Add a company-managed support contact. An authorized S&T account holder should review the required declarations and Play App Signing terms before confirming creation. See [Google’s app setup guide](https://support.google.com/googleplay/android-developer/answer/9859152).

## 3. Start with internal testing

1. Open **Test and release → Testing → Internal testing**, add the company’s testers, and create a release.
2. Configure [Play App Signing](https://developer.android.com/studio/publish/app-signing) when prompted, then upload the signed AAB. Keep the dedicated STM MEXA upload keystore and its passwords in S&T’s vault. Future updates must use the same package, an accepted upload key, and a higher version code.
3. Add release notes, save the draft, resolve any Console errors, and roll out to the internal testers once S&T approves. Share the tester opt-in link with those testers. See [Google’s testing guide](https://support.google.com/googleplay/android-developer/answer/9845334).
4. Test the Play-installed version on a phone. If the sideloaded APK uses the upload certificate and Play uses a different app-signing certificate, Android may require removing the sideloaded app before installing the Play version. Save any needed local settings first.

## 4. Complete the listing and reviewer access

- **Store listing:** add the descriptions, icon, feature graphic, and screenshots. Use the company’s approved assets and contact details.
- **App access:** this app requires a company-provisioned sign-in. Supply working credentials and instructions for a dedicated reviewer account with authorized test data. Enter them in **App content → App access**, where Google requests them. Keep them out of release notes, chat, and source control.
- **Privacy and deletion:** the public [privacy policy](https://stmmexa.stmcnc.com/privacy.html) loaded without a login and contains the [web deletion instructions](https://stmmexa.stmcnc.com/privacy.html#delete). The app links to the policy and offers an account deletion request under **Profile → Privacy & support**. Check both paths on the test phone before submission.
- **Data safety and app content:** have S&T verify the declarations against the deployed service and app. Review company account data, sign-in and change records, requested emails, and the optional AI service’s question and report-data handling when enabled and authorized. Complete the ads, target audience, and content rating forms as prompted. See [Google’s review checklist](https://support.google.com/googleplay/android-developer/answer/9859455) and [Data safety guide](https://support.google.com/googleplay/android-developer/answer/10787469).

## 5. Choose distribution and submit

For a public listing, promote the tested build or create the production release in the approved countries. Review **Publishing overview**, then submit it for review after S&T approves the launch. If distribution must be limited to managed company devices, decide that before public rollout and follow [Managed Google Play private app setup](https://support.google.com/googleplay/android-developer/answer/9874937). Using a company developer account does not make a production listing private.

**Timing:** APK testing can start as soon as the signed APK is available. Internal testing commonly becomes available within minutes after publication, but the first opt-in link can take several hours and an initial release can require review. Google says review can take a few hours to seven days, sometimes longer; allow at least a week from submission to public launch. Check the actual status in [Publishing overview](https://support.google.com/googleplay/android-developer/answer/9859654).
