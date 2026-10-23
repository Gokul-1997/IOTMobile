import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MainTabParamList } from './MainTabs';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  /** Primary destinations; Profile opens separately from the top-right avatar. */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Profile: undefined;
  MachineDetail: { machineId: number; machineName: string };
};
