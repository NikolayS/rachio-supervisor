import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  AccountInfo,
  CurrentSchedule,
  DeviceEvent,
  WaterUsageSummary,
} from './types';

const PUBLIC_API_BASE = 'https://api.rach.io/1/public';
const CLOUD_REST_API_BASE = 'https://cloud-rest.rach.io';

export interface HttpTransport {
  get<T>(url: string, options?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, body?: unknown, options?: AxiosRequestConfig): Promise<T>;
}

export interface RachioClient {
  getInfo(): Promise<AccountInfo>;
  getDevice(deviceId: string): Promise<unknown>;
  getCurrentSchedule(deviceId: string): Promise<CurrentSchedule>;
  startZone(zoneId: string, durationSeconds: number): Promise<void>;
  stopDevice(deviceId: string): Promise<void>;
  getScheduleRule(scheduleId: string): Promise<unknown>;
  startSchedule(scheduleId: string): Promise<void>;
  skipSchedule(scheduleId: string): Promise<void>;
  getWaterUsage(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<WaterUsageSummary>;
  getDeviceEvents(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<DeviceEvent[]>;
}

interface PersonInfo {
  id: string;
}

class AxiosTransport implements HttpTransport {
  private readonly publicApi: AxiosInstance;
  private readonly cloudApi: AxiosInstance;

  constructor(token: string) {
    const headers = { Authorization: `Bearer ${token}` };
    this.publicApi = axios.create({ baseURL: PUBLIC_API_BASE, headers });
    this.cloudApi = axios.create({ baseURL: CLOUD_REST_API_BASE, headers });
  }

  async get<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
    const api = url.startsWith('/summary/') ? this.cloudApi : this.publicApi;
    const response = await api.get<T>(url, options);
    return response.data as T;
  }

  async put<T>(
    url: string,
    body?: unknown,
    options?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.publicApi.put<T>(url, body, options);
    return response.data as T;
  }
}

export function createRachioClient(
  token: string,
  transport: HttpTransport = new AxiosTransport(token)
): RachioClient {
  return {
    async getInfo() {
      const person = await transport.get<PersonInfo>('/person/info');
      return transport.get<AccountInfo>(`/person/${person.id}`);
    },

    getDevice(deviceId: string) {
      return transport.get<unknown>(`/device/${deviceId}`);
    },

    getCurrentSchedule(deviceId: string) {
      return transport.get<CurrentSchedule>(
        `/device/${deviceId}/current_schedule`
      );
    },

    async startZone(zoneId: string, durationSeconds: number) {
      await transport.put('/zone/start', {
        id: zoneId,
        duration: durationSeconds,
      });
    },

    async stopDevice(deviceId: string) {
      await transport.put('/device/stop_water', { id: deviceId });
    },

    getScheduleRule(scheduleId: string) {
      return transport.get<unknown>(`/schedulerule/${scheduleId}`);
    },

    async startSchedule(scheduleId: string) {
      await transport.put('/schedulerule/start', { id: scheduleId });
    },

    async skipSchedule(scheduleId: string) {
      await transport.put('/schedulerule/skip', { id: scheduleId });
    },

    getWaterUsage(deviceId: string, startTs: number, endTs: number) {
      return transport.get<WaterUsageSummary>(
        `/summary/device/${deviceId}`,
        { params: { start: startTs, end: endTs } }
      );
    },

    getDeviceEvents(deviceId: string, startTs: number, endTs: number) {
      return transport.get<DeviceEvent[]>(
        `/device/${deviceId}/event`,
        { params: { startTime: startTs, endTime: endTs } }
      );
    },
  };
}
