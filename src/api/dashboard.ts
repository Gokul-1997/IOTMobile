import { apiClient } from './client';
import { DashboardResponse } from '../types/dashboard';

export const DASHBOARD_PAGE_SIZE = 6;

export async function getDashboard(options: { page?: number; status?: string; search?: string; signal?: AbortSignal } = {}): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/dashboard', { params: { paged: '1', page: options.page ?? 1, per_page: DASHBOARD_PAGE_SIZE, status: options.status ?? 'all', search: options.search ?? '' }, signal: options.signal });
  return data;
}
