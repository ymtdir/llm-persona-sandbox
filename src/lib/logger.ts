/**
 * ロガーインターフェース
 *
 * ロギング戦略の抽象化により、実装を容易に切り替え可能
 */
export interface Logger {
  log(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * コンソールロガー実装
 *
 * 標準的なconsole.log/errorを使用したロガー
 */
export class ConsoleLogger implements Logger {
  log(message: string, data?: unknown): void {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }

  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
}

/**
 * サイレントロガー実装
 *
 * テスト時に使用する、何も出力しないロガー
 */
export class SilentLogger implements Logger {
  log(_message: string, _data?: unknown): void {
    // 何もしない
  }

  error(_message: string, _error?: unknown): void {
    // 何もしない
  }
}

// デフォルトロガー
let defaultLogger: Logger = new ConsoleLogger();

/**
 * デフォルトロガーを設定
 *
 * @param logger - 使用するロガー
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * デフォルトロガーを取得
 *
 * @returns 現在のデフォルトロガー
 */
export function getDefaultLogger(): Logger {
  return defaultLogger;
}
