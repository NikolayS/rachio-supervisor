import axios from 'axios';

const BASE = 'https://api.rach.io/1/public';

export function client(token: string) {
  const http = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    // Account & devices
    async getInfo() {
      const { data } = await http.get('/person/info');
      return data;
    },

    async getDevice(deviceId: string) {
      const { data } = await http.get(`/device/${deviceId}`);
      return data;
    },

    async getCurrentSchedule(deviceId: string) {
      const { data } = await http.get(`/device/${deviceId}/current_schedule`);
      return data;
    },

    // Zones
    async startZone(zoneId: string, durationSeconds: number) {
      await http.put('/zone/start', { id: zoneId, duration: durationSeconds });
    },

    async stopDevice(deviceId: string) {
      await http.put('/device/stop_water', { id: deviceId });
    },

    // Schedules
    async getScheduleRule(scheduleId: string) {
      const { data } = await http.get(`/schedulerule/${scheduleId}`);
      return data;
    },

    async startSchedule(scheduleId: string) {
      await http.put('/schedulerule/start', { id: scheduleId });
    },

    async skipSchedule(scheduleId: string) {
      await http.put('/schedulerule/skip', { id: scheduleId });
    },

    // Water usage (cloud-rest API)
    async getWaterUsage(deviceId: string, startTs: number, endTs: number) {
      const { data } = await axios.get(
        `https://cloud-rest.rach.io/summary/device/${deviceId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { start: startTs, end: endTs },
        }
      );
      return data;
    },
  };
}
