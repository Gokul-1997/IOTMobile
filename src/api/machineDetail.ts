import { apiClient } from './client';
import { MachineDetailResponse } from '../types/machineDetail';
import { MachineTimeline } from '../types/timeline';

export async function getMachineDetail(machineId: number, signal?: AbortSignal): Promise<MachineDetailResponse> {
  const { data } = await apiClient.get<{ status: string; data: MachineDetailResponse }>(`/dashboard/live/${machineId}`, { signal });
  return data.data;
}

/** The current shift as Running / Idle / Alarm / Off periods, with its breaks. */
export async function getMachineTimeline(machineId: number, signal?: AbortSignal): Promise<MachineTimeline> {
  const { data } = await apiClient.get<{ status: string; data: MachineTimeline }>(`/dashboard/live/${machineId}/timeline`, { signal });
  return data.data;
}
