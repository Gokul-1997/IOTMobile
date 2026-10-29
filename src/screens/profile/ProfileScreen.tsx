import React, { useState } from 'react';
import { View, ScrollView, Pressable, Switch } from 'react-native';
import { ThemeText as Text } from '../../components/ThemeText';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useTheme, ThemeMode } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { useAssistantStore } from '../../store/assistantStore';
import { BrandHeader } from '../../components/BrandHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { API_BASE_URL } from '../../api/config';
import { StmScreen } from '../../components/StmScreen';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, openLink, supportMail } from '../../config/legal';

const ROLE_WORDS: Record<string, string> = {
  COMPANY_ADMIN: 'Company admin', SNT_SUPER: 'S&T super admin', SUPERVISOR: 'Supervisor',
  MAINTENANCE: 'Maintenance', QUALITY: 'Quality', SETTER: 'Setter', HR: 'HR', MANAGER: 'Manager', OPERATOR: 'Operator',
};
const roleWord = (r: string) => ROLE_WORDS[r] ?? r.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** A row that opens something: a page, the mail app, or (with expanded) the part under it. */
function LinkRow({ icon, label, onPress, danger, last, expanded }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; last?: boolean; expanded?: boolean;
}) {
  const theme = useTheme();
  const ink = danger ? theme.colors.danger : theme.colors.textPrimary;
  return (
    <Pressable onPress={onPress} accessibilityRole={expanded === undefined ? 'link' : 'button'}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.border, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={18} color={danger ? theme.colors.danger : theme.colors.textMuted} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: theme.weight.semibold as any, color: ink }}>{label}</Text>
      <Ionicons name={expanded === undefined ? 'open-outline' : expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/*
 * Who is signed in, how the app looks, and which server it talks to — the
 * last so a support call can confirm the phone points at the right plant.
 * Sign out asks once, in place (an Alert is invisible on the web preview).
 * Privacy & support: the privacy policy, help, and asking for the account to
 * be deleted (App Store 5.1.1, Google Play) — accounts are made by the
 * company admin, so deleting one is a request, by email, not a button.
 * The AI assistant's agreement is taken back here as easily as it was given.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** The phone could not open the mail app: the address is shown instead. */
  const [noMail, setNoMail] = useState(false);
  const ai = useAssistantStore((s) => s.status);
  const aiConsent = useAssistantStore((s) => s.consent);

  const name = user?.username || user?.email || 'User';
  const initials = name.split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
  const roles = (user?.roles ?? []).map(roleWord).join(', ') || '—';
  let host = API_BASE_URL;
  try { host = new URL(API_BASE_URL).host; } catch { /* keep the raw value */ }

  return (
    <StmScreen>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}>
        <BrandHeader title="Profile" eyebrow={user?.company_name || 'Account'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: theme.weight.heavy as any }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 18, fontWeight: theme.weight.heavy as any }}>{name}</Text>
              <Text numberOfLines={1} style={{ color: theme.colors.onHeaderMuted, fontSize: 13 }}>{user?.email}</Text>
            </View>
          </View>
        </BrandHeader>

        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Card title="Account" padded={false} style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <Row icon="business-outline" label="Company" value={user?.company_name || '—'} />
            <Row icon="shield-checkmark-outline" label="Role" value={roles} />
            <Row icon="mail-outline" label="Email" value={user?.email || '—'} last />
          </Card>

          <Card title="Appearance">
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 4 }}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => {
                const on = theme.mode === m;
                return (
                  <Pressable key={m} onPress={() => theme.setMode(m)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={{ flex: 1, minHeight: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 6, backgroundColor: on ? theme.colors.surface : 'transparent', ...(on ? theme.shadow.card : {}) }}>
                    <Ionicons name={m === 'system' ? 'phone-portrait-outline' : m === 'light' ? 'sunny-outline' : 'moon-outline'} size={16}
                      color={on ? theme.colors.accent : theme.colors.textSecondary} />
                    <Text style={{ fontSize: 13, fontWeight: theme.weight.bold as any, color: on ? theme.colors.accent : theme.colors.textSecondary }}>
                      {m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card title="Privacy & support" padded={false} style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <LinkRow icon="document-lock-outline" label="Privacy policy" onPress={() => { void openLink(PRIVACY_POLICY_URL); }} />
            <LinkRow icon="help-buoy-outline" label="Help & support" onPress={() => mail('STM MEXA app — help', `Hello,\n\n\n— ${user?.email ?? ''} (${user?.company_name ?? ''})`)} />
            {ai?.enabled && aiConsent !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <Ionicons name="sparkles-outline" size={18} color={theme.colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: theme.weight.semibold as any, color: theme.colors.textPrimary }}>
                  Share my questions with {ai.name || 'Mexa AI'}
                </Text>
                <Switch value={aiConsent} accessibilityLabel={`Share my questions with ${ai.name || 'Mexa AI'}`}
                  onValueChange={(on) => { void (on ? useAssistantStore.getState().agree() : useAssistantStore.getState().withdraw()); }}
                  trackColor={{ true: theme.colors.accent }} />
              </View>
            ) : null}
            <LinkRow icon="trash-outline" label="Delete my account" danger last={!deleting} onPress={() => setDeleting((d) => !d)} expanded={deleting} />
            {deleting ? (
              <View style={{ gap: 10, paddingBottom: theme.spacing.lg }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary }}>
                  Your account belongs to {user?.company_name || 'your company'}’s MEXA. Deleting it removes your sign-in and your
                  personal details; your company’s machine records stay with the company. Ask your company admin, or send us the request.
                </Text>
                <Button label="Email a deletion request" variant="danger" icon="mail-outline"
                  onPress={() => mail('Delete my STM MEXA account',
                    `Please delete my STM MEXA account.\n\nEmail: ${user?.email ?? ''}\nCompany: ${user?.company_name ?? ''}`)} />
              </View>
            ) : null}
            {noMail ? (
              <Text selectable style={{ fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, paddingBottom: theme.spacing.lg }}>
                No mail app on this phone. Write to {SUPPORT_EMAIL}.
              </Text>
            ) : null}
          </Card>

          <Card title="About" padded={false} style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <Row icon="phone-portrait-outline" label="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
            <Row icon="server-outline" label="Server" value={host} last />
          </Card>

          {confirming ? (
            <View style={{ gap: 8 }}>
              <Text style={{ textAlign: 'center', color: theme.colors.onField, fontSize: 14, fontWeight: theme.weight.semibold as any }}>Sign out of this phone?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Cancel" variant="onField" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
                <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Button label="Sign out" variant="onField" icon="log-out-outline" onPress={() => setConfirming(true)} />
          )}
        </View>
      </ScrollView>
    </StmScreen>
  );

  async function mail(subject: string, body: string) {
    setNoMail(!(await openLink(supportMail(subject, body))));
  }

  function Row({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.border }}>
        <Ionicons name={icon} size={18} color={theme.colors.textMuted} />
        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, width: 96 }}>{label}</Text>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: theme.weight.bold as any, color: theme.colors.textPrimary, textAlign: 'right' }}>{value}</Text>
      </View>
    );
  }
}
