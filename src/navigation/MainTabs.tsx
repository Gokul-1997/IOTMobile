import { useAppActive } from '../hooks/useAppActive';
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { AppBar } from '../components/AppBar';
import { hasPermission, mayUseAssistant, SCREEN_PERMISSION } from '../auth/permissions';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AlarmsScreen } from '../screens/alarms/AlarmsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AssistantScreen } from '../screens/assistant/AssistantScreen';
import { useAssistantStore } from '../store/assistantStore';
import * as notificationsApi from '../api/notifications';
import * as alarmsApi from '../api/alarms';
import { connectSocketQuietly, onUnreadCount } from '../api/socket';

export type MainTabParamList = {
  Dashboard: undefined;
  Alarms: undefined;
  Notifications: undefined;
  Assistant: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ['grid', 'grid-outline'],
  Alarms: ['warning', 'warning-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Assistant: ['sparkles', 'sparkles-outline'],
};

const BADGE_POLL_MS = 60_000;

/*
 * Primary destinations. Profile lives in the top-right account menu. AI is
 * opt-in: both company/role access and the server's feature setting must pass.
 * Alarms is there only for a role that may see
 * alarms — the web app's rule — and carries the count of alarms active right
 * now; Notifications carries the unread count, updated over the shared live
 * connection. The minute refresh also recovers counts after a network gap.
 */
export function MainTabs() {
  const theme = useTheme();
  const appActive = useAppActive();
  const focused = useIsFocused();
  const active = appActive && focused;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const canAlarms = hasPermission(user, SCREEN_PERMISSION.alarms);
  const canAssistant = mayUseAssistant(user);
  const assistantStatus = useAssistantStore(s => s.status);
  const fetchAssistantStatus = useAssistantStore(s => s.fetchStatus);
  const revokeAssistant = useAssistantStore(s => s.revoke);
  const [unread, setUnread] = useState(0);
  const [activeAlarms, setActiveAlarms] = useState(0);

  // Status also covers S&T switching the company's allowance off without
  // changing its page grants. Recheck on foreground/return and every minute;
  // an exhausted daily allowance still keeps the enabled AI destination.
  useEffect(() => {
    if (!canAssistant) { revokeAssistant(); return; }
    if (!active) return;
    void fetchAssistantStatus();
    const timer = setInterval(() => { void fetchAssistantStatus(); }, BADGE_POLL_MS);
    return () => clearInterval(timer);
  }, [active, canAssistant, user?.id, user?.company_id, user?.plant_id, user?.auth_revision,
    fetchAssistantStatus, revokeAssistant]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let liveChanges = 0;
    const stopUnread = onUnreadCount(n => { if (alive) { liveChanges++; setUnread(n); } });
    void connectSocketQuietly();
    const tick = () => {
      const requestedAt = liveChanges;
      notificationsApi.getUnreadCount().then((n) => {
        if (alive && requestedAt === liveChanges) setUnread(n);
      }).catch(() => {});
      if (canAlarms) {
        alarmsApi.getAlarms({ active: true, is_resolved: false, limit: 1 })
          .then((r) => alive && setActiveAlarms(r.pagination.total)).catch(() => {});
      }
    };
    tick();
    const t = setInterval(tick, BADGE_POLL_MS);
    return () => { alive = false; stopUnread(); clearInterval(t); };
  }, [canAlarms, active, user?.id]);

  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        // the logo and the profile, over every tab
        header: () => (
          <AppBar onProfile={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Profile')} />
        ),
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.font.medium,
          fontWeight: theme.font.medium ? 'normal' : '700', letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: theme.colors.chrome,
          borderTopColor: theme.colors.chromeBorder,
          // 64 for the icons and labels, plus the home indicator (iPhone, iPad)
          // or Android's navigation bar: the tab bar still pads by that inset,
          // but a fixed height replaces its own, so the inset must be added here
          height: 64 + insets.bottom,
          paddingTop: 6,
        },
        tabBarBadgeStyle: { backgroundColor: theme.colors.alarm, color: '#fff', fontSize: 10,
          fontFamily: theme.font.bold, fontWeight: theme.font.bold ? 'normal' : '800' },
        tabBarIcon: ({ color, size, focused }) => {
          const [on, off] = ICONS[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? on : off} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Machines' }} />
      {canAlarms && (
        <Tab.Screen name="Alarms" component={AlarmsScreen} options={{ tabBarBadge: badge(activeAlarms), tabBarAccessibilityLabel: `Alarms, ${activeAlarms} active` }} />
      )}
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarBadge: badge(unread), tabBarAccessibilityLabel: `Notifications, ${unread} unread` }} />
      {canAssistant && assistantStatus?.enabled === true && (
        <Tab.Screen name="Assistant" component={AssistantScreen}
          listeners={{ focus: () => { void fetchAssistantStatus(); } }}
          options={{ title: 'AI', tabBarAccessibilityLabel: `${assistantStatus.name || 'Mexa AI'}, company assistant` }} />
      )}
    </Tab.Navigator>
  );
}
