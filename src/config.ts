export interface AppConfig {
  rachioApiKey: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rachioApiKey = env.RACHIO_API_KEY?.trim();

  if (!rachioApiKey || rachioApiKey === 'your_api_key_here') {
    throw new Error('RACHIO_API_KEY is not set');
  }

  return { rachioApiKey };
}
