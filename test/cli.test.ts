import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runCli } from '../src/cli';
import type { RachioClient } from '../src/rachio';
import type { AccountInfo } from '../src/types';

const healthyAccount: AccountInfo = {
  username: 'nik',
  email: 'nik@example.com',
  devices: [
    {
      id: 'dev-1',
      name: 'Front Controller',
      status: 'ONLINE',
      zones: [{ id: 'zone-1', zoneNumber: 1, name: 'Citrus', enabled: true }],
      scheduleRules: [{ id: 'sched-1', name: 'Morning', enabled: true }],
    },
  ],
};

describe('runCli', () => {
  it('returns 0 for healthy check output', async () => {
    const app = createTestApp();

    const exitCode = await app.run(['check']);

    assert.equal(exitCode, 0);
    assert.match(app.output.join('\n'), /OK: no irrigation alerts/);
  });

  it('returns 1 for warning check output', async () => {
    const app = createTestApp({
      ...healthyAccount,
      devices: [
        {
          ...healthyAccount.devices[0],
          scheduleRules: [],
        },
      ],
    });

    const exitCode = await app.run(['check']);

    assert.equal(exitCode, 1);
    assert.match(app.output.join('\n'), /WARNING no_enabled_schedules/);
  });

  it('returns 2 for critical check output', async () => {
    const app = createTestApp({
      ...healthyAccount,
      devices: [{ ...healthyAccount.devices[0], status: 'OFFLINE' }],
    });

    const exitCode = await app.run(['check']);

    assert.equal(exitCode, 2);
    assert.match(app.output.join('\n'), /CRITICAL device_offline/);
  });

  it('stops devices without querying current schedule', async () => {
    const app = createTestApp();

    await app.run(['stop']);

    assert.deepEqual(app.calls, ['getInfo', 'stopDevice:dev-1']);
  });
});

function createTestApp(account: AccountInfo = healthyAccount) {
  const calls: string[] = [];
  const output: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;

  async function run(argv: string[]) {
    try {
      await runCli(argv, {
        loadConfig: () => ({ rachioApiKey: 'test-token' }),
        createClient: () => fakeClient(account, calls),
        log: (message) => output.push(message),
      });
      return process.exitCode;
    } finally {
      process.exitCode = previousExitCode;
    }
  }

  return { calls, output, run };
}

function fakeClient(account: AccountInfo, calls: string[]): RachioClient {
  return {
    async getInfo() {
      calls.push('getInfo');
      return account;
    },
    async getDevice(deviceId: string) {
      calls.push(`getDevice:${deviceId}`);
      return {};
    },
    async getCurrentSchedule(deviceId: string) {
      calls.push(`getCurrentSchedule:${deviceId}`);
      return { status: 'NOT_RUNNING' };
    },
    async startZone(zoneId: string, durationSeconds: number) {
      calls.push(`startZone:${zoneId}:${durationSeconds}`);
    },
    async stopDevice(deviceId: string) {
      calls.push(`stopDevice:${deviceId}`);
    },
    async getScheduleRule(scheduleId: string) {
      calls.push(`getScheduleRule:${scheduleId}`);
      return {};
    },
    async startSchedule(scheduleId: string) {
      calls.push(`startSchedule:${scheduleId}`);
    },
    async skipSchedule(scheduleId: string) {
      calls.push(`skipSchedule:${scheduleId}`);
    },
    async getWaterUsage(deviceId: string, startTs: number, endTs: number) {
      calls.push(`getWaterUsage:${deviceId}:${startTs}:${endTs}`);
      return {};
    },
  };
}
