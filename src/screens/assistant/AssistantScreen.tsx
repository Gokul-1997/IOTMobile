import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeText as Text } from '../../components/ThemeText';
import { StmScreen } from '../../components/StmScreen';
import { BrandHeader } from '../../components/BrandHeader';
import { Button } from '../../components/Button';
import { PRIVACY_POLICY_URL, openLink } from '../../config/legal';
import { useTheme } from '../../theme/ThemeProvider';
import { useAssistantStore } from '../../store/assistantStore';
import { useAuthStore } from '../../store/authStore';
import { useAppActive } from '../../hooks/useAppActive';
import { reportAnswer } from '../../api/assistant';
import type { AssistantMessage, AssistantSource } from '../../types/assistant';

function day(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Native source cards are labels, never unvalidated server-provided URLs. */
function sourceDetail(source: AssistantSource): string {
  const parts: string[] = [];
  if (source.period?.from && source.period.to) {
    parts.push(source.period.from === source.period.to ? day(source.period.from) : `${day(source.period.from)} – ${day(source.period.to)}`);
    parts.push(source.filters?.machine || 'All machines', source.filters?.shift || 'All shifts');
  } else if (source.filters?.machine) parts.push(source.filters.machine);
  return parts.join(' · ');
}

function SourceCard({ source }: { source: AssistantSource }) {
  const theme = useTheme();
  const detail = sourceDetail(source);
  return (
    <View style={{ flexDirection: 'row', gap: 9, borderRadius: theme.radius.md, padding: 11,
      backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border }}>
      <Ionicons name="document-text-outline" size={17} color={theme.colors.accent} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{source.report}</Text>
        {detail ? <Text style={{ color: theme.colors.textMuted, fontSize: 11, lineHeight: 17 }}>{detail}</Text> : null}
      </View>
    </View>
  );
}

/** Asked once per account on each phone, before a first question goes to the AI provider (App Store 5.1.2). */
function ConsentCard({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: 22, ...theme.shadow.card }}>
      <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: theme.colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Ionicons name="shield-checkmark-outline" size={25} color={theme.colors.accent} />
      </View>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary }}>
        Before you ask
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
        To answer, {name} sends your question and the company records it needs — such as machine names, production
        figures and operator names — to Claude, the AI service of Anthropic. Anthropic uses them only to write the
        answer, not to train its AI.
      </Text>
      <Button label="Agree and continue" onPress={() => { void useAssistantStore.getState().agree(); }} style={{ marginTop: 22 }} />
      <Pressable onPress={() => { void openLink(PRIVACY_POLICY_URL); }} accessibilityRole="link" hitSlop={4}
        style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
          minHeight: 44, paddingHorizontal: 10, marginTop: 6, opacity: pressed ? 0.65 : 1 })}>
        <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>Privacy policy</Text>
        <Ionicons name="open-outline" size={14} color={theme.colors.accent} />
      </Pressable>
    </View>
  );
}

/** Flag an answer as wrong or offensive without leaving the app (Google Play's AI content policy). */
function ReportAnswer({ message, question }: { message: AssistantMessage; question?: string }) {
  const theme = useTheme();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const report = async () => {
    setState('sending');
    try { await reportAnswer(message.text, question); setState('sent'); } catch { setState('failed'); }
  };
  if (state === 'sent') {
    return (
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, marginTop: 6 }}>
        <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.textMuted} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Reported. Thank you.</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={() => { void report(); }} disabled={state === 'sending'} hitSlop={6}
      accessibilityRole="button" accessibilityLabel="Report this answer as wrong or offensive" accessibilityState={{ busy: state === 'sending' }}
      style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
        minHeight: 36, marginTop: 6, paddingRight: 10, opacity: state === 'sending' ? 0.5 : pressed ? 0.65 : 1 })}>
      <Ionicons name="flag-outline" size={14} color={state === 'failed' ? theme.colors.danger : theme.colors.textMuted} />
      <Text style={{ color: state === 'failed' ? theme.colors.danger : theme.colors.textMuted, fontSize: 12 }}>
        {state === 'failed' ? 'Not sent. Tap to try again.' : 'Report'}
      </Text>
    </Pressable>
  );
}

const Message = React.memo(function Message({ message, name, disabled, question }: {
  message: AssistantMessage; name: string; disabled: boolean; question?: string;
}) {
  const theme = useTheme();
  const user = message.role === 'user';
  const error = message.kind === 'error';
  return (
    <View style={{ alignItems: user ? 'flex-end' : 'flex-start', marginTop: 16 }}>
      <Text style={{ color: theme.colors.onFieldMuted, fontSize: 10, fontWeight: '700', marginBottom: 6, marginHorizontal: 3 }}>
        {user ? 'YOU' : name.toUpperCase()}
      </Text>
      <View style={{ maxWidth: user ? '90%' : '100%', minWidth: user ? undefined : '75%',
        borderRadius: theme.radius.lg, borderTopRightRadius: user ? 4 : theme.radius.lg,
        borderTopLeftRadius: user ? theme.radius.lg : 4,
        backgroundColor: user ? theme.colors.primary : theme.colors.surface, padding: 14,
        borderWidth: error ? 1 : 0, borderColor: error ? theme.colors.danger : 'transparent' }}>
        <Text selectable style={{ color: user ? theme.colors.onPrimary : theme.colors.textPrimary, fontSize: 14, lineHeight: 22 }}>
          {message.text}
        </Text>
        {!user && !!message.sources?.length ? (
          <View style={{ gap: 7, marginTop: 14 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>SOURCES</Text>
            {message.sources.slice(0, 4).map((source, index) => <SourceCard key={`${source.report}-${index}`} source={source} />)}
          </View>
        ) : null}
        {error && message.retry ? (
          <Pressable disabled={disabled} onPress={() => { void useAssistantStore.getState().retry(message.id); }}
            accessibilityRole="button" accessibilityLabel="Retry this question" accessibilityState={{ disabled }}
            style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
              minHeight: 44, paddingRight: 14, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}>
            <Ionicons name="refresh-outline" color={theme.colors.accent} size={16} />
            <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        ) : null}
        {!user && !error && message.kind !== 'note' ? <ReportAnswer message={message} question={question} /> : null}
      </View>
    </View>
  );
});

export function AssistantScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const active = useAppActive();
  const status = useAssistantStore(state => state.status);
  const messages = useAssistantStore(state => state.messages);
  const sending = useAssistantStore(state => state.sending);
  const unavailable = useAssistantStore(state => state.unavailable);
  const statusError = useAssistantStore(state => state.statusError);
  const statusLoading = useAssistantStore(state => state.statusLoading);
  const consent = useAssistantStore(state => state.consent);
  const user = useAuthStore(state => state.user);
  const [draft, setDraft] = useState('');
  const log = useRef<FlatList<AssistantMessage>>(null);
  const name = status?.name || 'AI assistant';
  const allowance = status?.allowance;
  const limited = !!allowance && allowance.remaining <= 0;
  const closed = !status?.enabled || unavailable || limited || consent !== true;
  /** Not agreed yet to questions going to the AI provider: that is asked first. */
  const asking = !!status?.enabled && consent === false;
  const disabled = closed || sending;
  const firstName = (user?.username || '').trim().split(/\s+/)[0];

  useEffect(() => {
    if (focused && active) void useAssistantStore.getState().fetchStatus();
  }, [focused, active]);

  useEffect(() => {
    if (!status?.enabled) setDraft('');
  }, [status?.enabled]);

  const send = (text: string = draft) => {
    if (disabled || !text.trim()) return;
    void useAssistantStore.getState().send(text);
    if (useAssistantStore.getState().sending) setDraft('');
  };

  return (
    <StmScreen>
      {/* padding on Android too: edge to edge, Android no longer shrinks the
          window for the keyboard (AuthLayout); the offset is the app bar above */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={insets.top + 56}>
        <BrandHeader title={name} eyebrow="Company assistant" right={messages.length ? (
          <Pressable onPress={() => { useAssistantStore.getState().newChat(); setDraft(''); }}
            accessibilityRole="button" accessibilityLabel="Start a new chat" hitSlop={4}
            style={({ pressed }) => ({ height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: theme.colors.fieldChip, opacity: pressed ? 0.65 : 1 })}>
            <Ionicons name="create-outline" color={theme.colors.onField} size={21} />
          </Pressable>
        ) : undefined} />

        <FlatList ref={log} data={messages} keyExtractor={message => message.id}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20,
            width: '100%', maxWidth: 760, alignSelf: 'center', flexGrow: messages.length ? 0 : 1 }}
          onContentSizeChange={() => log.current?.scrollToEnd({ animated: !theme.reduceMotion })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 20 }}>
              {asking ? <ConsentCard name={name} /> : (
                <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: 22, ...theme.shadow.card }}>
                  <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: theme.colors.surfaceAlt,
                    alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <Ionicons name="sparkles-outline" size={25} color={theme.colors.accent} />
                  </View>
                  <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary }}>
                    {firstName ? `How can I help, ${firstName}?` : 'How can I help?'}
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10 }}>
                    {status?.welcome || 'Ask about your company’s records and how to use MEXA.'}
                  </Text>
                  {!!status?.suggestions?.length && !closed ? (
                    <View style={{ gap: 8, marginTop: 22 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.9, color: theme.colors.textMuted, marginBottom: 2 }}>TRY ASKING</Text>
                      {status.suggestions.slice(0, 6).map(suggestion => (
                        <Pressable key={suggestion} onPress={() => send(suggestion)} disabled={disabled}
                          accessibilityRole="button" accessibilityLabel={suggestion} accessibilityState={{ disabled }}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10,
                            paddingHorizontal: 12, paddingVertical: 12, minHeight: 48, borderRadius: theme.radius.md,
                            backgroundColor: pressed ? theme.colors.border : theme.colors.surfaceAlt })}>
                          <Ionicons name="chatbubble-outline" size={16} color={theme.colors.accent} />
                          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: 13, lineHeight: 19 }}>{suggestion}</Text>
                          <Ionicons name="arrow-up-outline" size={16} color={theme.colors.textMuted} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => <Message message={item} name={name} disabled={disabled}
            question={messages[index - 1]?.role === 'user' ? messages[index - 1].text : undefined} />}
          ListFooterComponent={sending ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
              alignSelf: 'flex-start', marginTop: 16, paddingVertical: 12, paddingHorizontal: 15,
              backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Checking your company’s records…</Text>
            </View>
          ) : null} />

        {asking && !unavailable ? null : (
        <View style={{ borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.chrome,
          paddingHorizontal: 16, paddingTop: 11, paddingBottom: Math.max(insets.bottom ? 0 : 4, 10) }}>
          <View style={{ width: '100%', maxWidth: 728, alignSelf: 'center' }}>
            {unavailable || !status?.enabled ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                  {statusError || (statusLoading ? 'Connecting…' : 'This assistant is not available for your account.')}
                </Text>
                <Pressable onPress={() => { void useAssistantStore.getState().fetchStatus(); }} disabled={statusLoading}
                  accessibilityRole="button" accessibilityLabel="Reconnect assistant" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  {statusLoading ? <ActivityIndicator color={theme.colors.accent} size="small" />
                    : <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>Try again</Text>}
                </Pressable>
              </View>
            ) : limited ? (
              <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
                Today’s allowance is used. Resets {allowance?.resets_text || 'tomorrow'}. You can still access your reports.
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderWidth: 1, borderColor: theme.colors.border,
              borderRadius: theme.radius.lg, paddingLeft: 13, paddingVertical: 5, paddingRight: 5, backgroundColor: theme.colors.surface }}>
              <TextInput value={draft} onChangeText={setDraft} placeholder={`Ask ${name}…`}
                placeholderTextColor={theme.colors.textMuted} editable={!closed} multiline maxLength={500}
                accessibilityLabel={`Message ${name}`} accessibilityHint="Ask about your company’s records or using MEXA. Maximum 500 characters."
                style={{ flex: 1, minHeight: 42, maxHeight: 112, paddingTop: 11, paddingBottom: 10,
                  fontFamily: theme.font.regular, color: theme.colors.textPrimary, fontSize: 14, lineHeight: 21 }} />
              <Pressable onPress={() => send()} disabled={disabled || !draft.trim()}
                accessibilityRole="button" accessibilityLabel="Send question" accessibilityState={{ disabled: disabled || !draft.trim() }}
                style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.primary, opacity: disabled || !draft.trim() ? 0.4 : pressed ? 0.75 : 1 })}>
                <Ionicons name="arrow-up-outline" size={23} color={theme.colors.onPrimary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 7 }}>
              <Text style={{ flex: 1, color: theme.colors.textMuted, fontSize: 10, lineHeight: 15 }}>
                {allowance ? `${allowance.remaining} of ${allowance.limit} left today` : 'Your company. Your permitted records.'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{draft.length}/500</Text>
            </View>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>
    </StmScreen>
  );
}
