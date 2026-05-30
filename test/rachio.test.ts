import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRachioClient, type HttpTransport } from '../src/rachio';

class FakeTransport implements HttpTransport {
  readonly calls: Array<{ method: string; url: string; body?: unknown; options?: unknown }> = [];
  readonly responses = new Map<string, unknown>();

  async get<T>(url: string, options?: unknown): Promise<T> {
    this.calls.push({ method: 'GET', url, options });
    return this.responses.get(url) as T;
  }

  async put<T>(url: string, body?: unknown, options?: unknown): Promise<T> {
    this.calls.push({ method: 'PUT', url, body, options });
    return undefined as T;
  }
}

describe('createRachioClient', () => {
  it('maps account and schedule calls to documented Rachio endpoints', async () => {
    const transport = new FakeTransport();
    transport.responses.set('/person/info', { id: 'person-1' });
    transport.responses.set('/person/person-1', { username: 'nik', email: 'n@example.com', devices: [] });
    transport.responses.set('/device/dev-1/current_schedule', { status: 'NOT_RUNNING' });

    const client = createRachioClient('token', transport);

    assert.equal((await client.getInfo()).username, 'nik');
    assert.equal((await client.getCurrentSchedule('dev-1')).status, 'NOT_RUNNING');

    assert.deepEqual(
      transport.calls.map((call) => `${call.method} ${call.url}`),
      [
        'GET /person/info',
        'GET /person/person-1',
        'GET /device/dev-1/current_schedule',
      ]
    );
  });

  it('sends command payloads without leaking transport details to callers', async () => {
    const transport = new FakeTransport();
    const client = createRachioClient('token', transport);

    await client.startZone('zone-1', 300);
    await client.stopDevice('device-1');
    await client.skipSchedule('schedule-1');

    assert.deepEqual(transport.calls, [
      { method: 'PUT', url: '/zone/start', body: { id: 'zone-1', duration: 300 }, options: undefined },
      { method: 'PUT', url: '/device/stop_water', body: { id: 'device-1' }, options: undefined },
      { method: 'PUT', url: '/schedulerule/skip', body: { id: 'schedule-1' }, options: undefined },
    ]);
  });

  it('uses cloud-rest summary endpoint for water usage', async () => {
    const transport = new FakeTransport();
    transport.responses.set('/summary/device/device-1', { gallons: 42 });

    const client = createRachioClient('token', transport);
    const usage = await client.getWaterUsage('device-1', 10, 20);

    assert.deepEqual(usage, { gallons: 42 });
    assert.deepEqual(transport.calls[0], {
      method: 'GET',
      url: '/summary/device/device-1',
      options: { params: { start: 10, end: 20 } },
    });
  });
});
