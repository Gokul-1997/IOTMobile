import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MainTabParamList } from './MainTabs';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  /** the tabs; a screen may name the tab to open (the app bar's profile) */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  MachineDetail: { machineId: number; machineName: string };
};
