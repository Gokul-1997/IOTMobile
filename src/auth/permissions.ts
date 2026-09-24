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
 * unrestricted company — the same reading the web and the API take.
 */
function grants(list: unknown): string[] {
  return Array.isArray(list) ? (list.filter(x => typeof x === 'string') as string[]) : [];
}

const matches = (keys: string[], key: string) => keys.includes(key) || keys.some(k => k.startsWith(key + ':'));

export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false;
  const roles = user.roles || [];
  if (user.is_snt_super || roles.includes('SNT_SUPER')) return true;

  const company = grants(user.company_permissions);
  const companyAllows = company.length === 0 || matches(company, key);
  if (roles.includes('COMPANY_ADMIN')) return companyAllows;

  return matches(user.permissions || [], key) && companyAllows;
}

/** The screens of the app, and the permission each needs. */
export const SCREEN_PERMISSION = {
  dashboard: 'page:dashboard',
  machine: 'page:dashboard:live',
  alarms: 'page:alarms',
  resolveAlarm: 'page:alarms:resolve',
} as const;
