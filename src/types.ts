export type DeviceStatus = 'ONLINE' | 'OFFLINE' | string;

export interface Zone {
  id: string;
  zoneNumber: number;
  name?: string | null;
  enabled: boolean;
}

export interface ScheduleRule {
  id: string;
  name: string;
  enabled: boolean;
  days?: string[] | null;
  startTime?: string | null;
}

export interface Device {
  id: string;
  name: string;
  model?: string | null;
  status: DeviceStatus;
  zones: Zone[];
  scheduleRules: ScheduleRule[];
}

export interface AccountInfo {
  username: string;
  email: string;
  devices: Device[];
}

export interface CurrentSchedule {
  status: string;
  zoneNumber?: number;
  remainingDuration?: number;
}

export interface WaterUsageSummary {
  [key: string]: unknown;
}

export interface DeviceSnapshot {
  device: Device;
  currentSchedule: CurrentSchedule;
}

export interface IrrigationSnapshot {
  account: Pick<AccountInfo, 'username' | 'email'>;
  devices: DeviceSnapshot[];
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  severity: AlertSeverity;
  code: string;
  message: string;
  deviceId?: string;
  zoneId?: string;
}
