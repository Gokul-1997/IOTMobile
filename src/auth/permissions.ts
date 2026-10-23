import { AuthUser } from '../types/auth';

/*
 * What a signed-in person may open — the web app's rule exactly
 * (FrontendIOT auth.service.ts hasPermission), so the phone never offers a
 * screen the server would refuse:
 *
 *  - S&T super admin: everything;
 *  - company admin: whatever S&T granted the company;
 *  - anyone else: the role must hold it AND the company must be granted it.
 *
 * `page:alarms` matches `page:alarms` itself or any action under it
 * (`page:alarms:view`). A company with no grants at all is a fresh,
 * unrestricted company — except opt-in features such as AI, which always
 * require an explicit company grant, as on the web and API.
 */
function grants(list: unknown): string[] {
  return Array.isArray(list) ? (list.filter(x => typeof x === 'string') as string[]) : [];
}

const matches = (keys: string[], key: string) => keys.includes(key) || keys.some(k => k.startsWith(key + ':'));
const isOptIn = (key: string) => key === 'page:assistant' || key.startsWith('page:assistant:');

export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  if (user.is_snt_super || roles.includes('SNT_SUPER')) return true;

  const company = grants(user.company_permissions);
  const companyAllows = (company.length === 0 && !isOptIn(key)) || matches(company, key);
  // ADMIN is the older name for the company admin role (the API reads it so)
  if (roles.includes('COMPANY_ADMIN') || roles.includes('ADMIN')) return companyAllows;

  return matches(grants(user.permissions), key) && companyAllows;
}

/** AI belongs to an explicitly enabled company account and its granted roles. */
export function mayUseAssistant(user: AuthUser | null | undefined): boolean {
  return !!user?.company_id && !user.is_snt_super && !user.roles?.includes('SNT_SUPER') &&
    hasPermission(user, SCREEN_PERMISSION.assistant);
}

/** The screens of the app, and the permission each needs. */
export const SCREEN_PERMISSION = {
  dashboard: 'page:dashboard',
  machine: 'page:dashboard:live',
  alarms: 'page:alarms',
  resolveAlarm: 'page:alarms:resolve',
  assistant: 'page:assistant:view',
} as const;
