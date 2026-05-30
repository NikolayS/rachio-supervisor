import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('loads Rachio API key from environment', () => {
    assert.deepEqual(loadConfig({ RACHIO_API_KEY: ' token ' }), {
      rachioApiKey: 'token',
    });
  });

  it('rejects missing or placeholder API keys', () => {
    assert.throws(() => loadConfig({}), /RACHIO_API_KEY/);
    assert.throws(
      () => loadConfig({ RACHIO_API_KEY: 'your_api_key_here' }),
      /RACHIO_API_KEY/
    );
  });
});
