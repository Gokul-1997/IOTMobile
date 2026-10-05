import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, SCREEN_PERMISSION } from '../../auth/permissions';
import { BrandHeader } from '../../components/BrandHeader';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import * as notificationsApi from '../../api/notifications';
import { AppNotification } from '../../types/notification';
import { StmScreen } from '../../components/StmScreen';

const IST = 330 * 60000;
const dayOf = (iso: string) => new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 10);
function stamp(iso: string) {
  const d = new Date(new Date(iso).getTime() + IST);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const t = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return dayOf(iso) === dayOf(new Date().toISOString()) ? t : `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${t}`;
}

/*
 * What the system told this person. Unread ones are bold with a dot; a tap
 * marks it read and, where the alert points at a screen the app has (an
 * alarm → Alarms, a machine → Shop Floor), opens it.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await notificationsApi.getNotifications()); setError(null); }
    catch { setError('Cannot load notifications. Pull down to try again.'); }
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const open = useCallback(async (n: AppNotification) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    const link = n.link || '';
    if (/^\/(alarms|alarm-report)/.test(link) && hasPermission(user, SCREEN_PERMISSION.alarms)) navigation.navigate('Alarms');
    else if (/^\/dashboard/.test(link) && hasPermission(user, SCREEN_PERMISSION.dashboard)) navigation.navigate('Dashboard');
  }, [navigation, user]);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    notificationsApi.markAllRead().catch(() => load());
  }, [load]);

  const sections = useMemo(() => {
    const today = dayOf(new Date().toISOString());
    const t = items.filter((n) => dayOf(n.created_at) === today), e = items.filter((n) => dayOf(n.created_at) !== today);
    return [...(t.length ? [{ title: 'Today', data: t }] : []), ...(e.length ? [{ title: 'Earlier', data: e }] : [])];
  }, [items]);

  const kind = (type: string) => {
    switch (type) {
      case 'ALARM': return { icon: 'warning' as const, ink: theme.colors.alarm, bg: theme.colors.alarmBg };
      case 'WARNING': return { icon: 'alert-circle' as const, ink: theme.colors.idleInk, bg: theme.colors.idleBg };
      case 'MAINTENANCE': return { icon: 'construct' as const, ink: theme.colors.accent, bg: theme.colors.surfaceAlt };
      default: return { icon: 'information-circle' as const, ink: theme.colors.textSecondary, bg: theme.colors.surfaceAlt };
    }
  };

  return (
    <StmScreen>
      <SectionList
        sections={loading ? [] : sections}
        keyExtractor={(n) => String(n.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.onField} />}
        ListHeaderComponent={
          <View>
            <BrandHeader title="Notifications" eyebrow={loading ? 'Inbox' : unread ? `${unread} unread` : 'All read'}
              right={unread ? (
                <Pressable onPress={markAll} accessibilityRole="button" accessibilityLabel="Mark all as read" hitSlop={8}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34, borderRadius: 99,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.16)' })}>
                  <Ionicons name="checkmark-done" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: theme.weight.bold as any }}>Mark all read</Text>
                </Pressable>
              ) : undefined} />
            {loading && <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={72} radius={theme.radius.lg} />)}</View>}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 8,
            fontSize: 11, fontWeight: theme.weight.heavy as any, letterSpacing: 1, color: theme.colors.onFieldMuted, textTransform: 'uppercase' }}>
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item: n }) => {
          const k = kind(n.type);
          return (
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              <Pressable onPress={() => open(n)} accessibilityRole="button"
                accessibilityLabel={`${n.is_read ? '' : 'Unread. '}${n.title}. ${n.message ?? ''}. ${stamp(n.created_at)}`}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: theme.spacing.md, borderRadius: theme.radius.lg,
                  backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface, ...theme.shadow.card })}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: k.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={k.icon} size={20} color={k.ink} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  {/* two lines: on a small phone one line cut the alarm's name off ("VMC-2-M: AIR PRESSU…") */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, color: theme.colors.textPrimary, fontWeight: (n.is_read ? theme.weight.semibold : theme.weight.heavy) as any }}>{n.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>{stamp(n.created_at)}</Text>
                  </View>
                  {n.message ? <Text numberOfLines={2} style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>{n.message}</Text> : null}
                </View>
                {!n.is_read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.accent, marginTop: 6 }} />}
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={loading ? null : error
          ? <EmptyState icon="cloud-offline-outline" tone="danger" title="Notifications not loaded" message={error} actionLabel="Try again" onAction={onRefresh} />
          : <EmptyState icon="notifications-off-outline" title="No notifications yet" message="Alarms and program transfers you follow appear here. Choose which in Settings on the web app." />}
      />
    </StmScreen>
  );
}
