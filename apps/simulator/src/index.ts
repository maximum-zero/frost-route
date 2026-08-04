import { parseSimulatorConfig } from './config.js';
import { runMqttPublisher } from './mqtt-publisher.js';

const abortController = new AbortController();

/** 종료 signal을 publisher의 정리 흐름으로 전달한다. */
function handleShutdown(): void {
  abortController.abort();
}

/** 외부 오류에서 credential을 노출하지 않는 짧은 진단 문자열을 만든다. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return '알 수 없는 오류';
  }

  if (error.message.trim() !== '') {
    return error.message;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code === undefined ? error.name : `${error.name}: ${code}`;
}

process.once('SIGINT', handleShutdown);
process.once('SIGTERM', handleShutdown);

try {
  const config = parseSimulatorConfig(process.env);
  await runMqttPublisher(config, abortController.signal);
} catch (error: unknown) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'simulator',
      event: 'simulator_failed',
      message: describeError(error),
    }),
  );
  process.exitCode = 1;
}
