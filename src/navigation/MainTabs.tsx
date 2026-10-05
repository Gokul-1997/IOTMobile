import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../store/authStore';
import { AppBar } from '../components/AppBar';
import { hasPermission, SCREEN_PERMISSION } from '../auth/permissions';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AlarmsScreen } from '../screens/alarms/AlarmsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import * as notificationsApi from '../api/notifications';
import * as alarmsApi from '../api/alarms';

export type MainTabParamList = {
  Dashboard: undefined;
  Alarms: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ['grid', 'grid-outline'],
  Alarms: ['warning', 'warning-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

const BADGE_POLL_MS = 60_000;

/*
 * The four places of the app. Alarms is there only for a role that may see
 * alarms — the web app's rule — and carries the count of alarms active right
 * now; Notifications carries the unread count. Both refresh every minute.
 */
export function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const canAlarms = hasPermission(user, SCREEN_PERMISSION.alarms);
  const [unread, setUnread] = useState(0);
  const [activeAlarms, setActiveAlarms] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      notificationsApi.getUnreadCount().then((n) => alive && setUnread(n)).catch(() => {});
      if (canAlarms) {
        alarmsApi.getAlarms({ active: true, is_resolved: false, limit: 1 })
          .then((r) => alive && setActiveAlarms(r.pagination.total)).catch(() => {});
      }
    };
    tick();
    const t = setInterval(tick, BADGE_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [canAlarms]);

  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        // the logo and the profile, over every tab
        header: () => (
          <AppBar profileActive={route.name === 'Profile'} onProfile={() => navigation.navigate('Profile')} />
        ),
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
        tabBarStyle: {
          backgroundColor: theme.colors.chrome,
          borderTopColor: theme.colors.chromeBorder,
          // 64 for the icons and labels, plus the home indicator (iPhone, iPad)
          // or Android's navigation bar: the tab bar still pads by that inset,
          // but a fixed height replaces its own, so the inset must be added here
          height: 64 + insets.bottom,
          paddingTop: 6,
        },
        tabBarBadgeStyle: { backgroundColor: theme.colors.alarm, color: '#fff', fontSize: 10, fontWeight: '800' },
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
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
