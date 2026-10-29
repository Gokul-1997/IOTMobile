import { Linking } from 'react-native';

/*
 * Where the app's privacy policy and support are (App Store 5.1.1(i): a link
 * to the privacy policy inside the app; Google Play User Data policy). The
 * policy is a page of the web app, open to anyone: FrontendIOT/public/privacy.html.
 */
export const PRIVACY_POLICY_URL = 'https://stmmexa.stmcnc.com/privacy.html';
export const SUPPORT_EMAIL = 'enquiry.lead.mfg@stengineers.com';

/** Open a link in the phone's browser or mail app; false when the phone has nothing that opens it. */
export async function openLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** A mail to support, the subject and body filled in. */
export function supportMail(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
