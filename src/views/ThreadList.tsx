import { JSX, FC } from 'hono/jsx';

export interface Thread {
  id: string;
  title: string;
  resCount: number;
  lastResAt: Date;
  createdAt: Date;
}

interface ThreadListProps {
  threads: Thread[];
  onNewThread?: () => void;
}

/**
 * スレッド一覧表示コンポーネント
 * 各スレッドのタイトル、レス数、最終レス日時を表示
 */
export const ThreadList: FC<ThreadListProps> = ({ threads, onNewThread }) => {
  /**
   * 日時を2ch風フォーマットに変換
   */
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    // 2ch風の日時フォーマット: YYYY/MM/DD(曜) HH:MM:SS
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekDay = weekDays[d.getDay()];

    return `${year}/${month}/${day}(${weekDay}) ${hour}:${minute}:${second}`;
  };

  /**
   * スレッドの勢いを計算（レス数/経過時間）
   */
  const calculateMomentum = (thread: Thread): string => {
    const now = new Date();
    const created = new Date(thread.createdAt);
    const hoursPassed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (hoursPassed < 1) {
      return '新';
    }

    const momentum = thread.resCount / hoursPassed;
    if (momentum > 100) return '🔥';
    if (momentum > 50) return '⬆';
    if (momentum > 10) return '→';
    return '↓';
  };

  return (
    <div class="thread-list-container">
      {/* 新規スレッド作成ボタン */}
      <div style="margin-bottom: 15px; text-align: right;">
        <button
          type="button"
          onclick={onNewThread ? `window.location.href='/threads/new'` : undefined}
          style="font-weight: bold;"
        >
          新しいスレッドを立てる
        </button>
      </div>

      {/* スレッド一覧 */}
      <div class="thread-list">
        {threads.length === 0 ? (
          <div style="padding: 20px; text-align: center; color: #666666;">
            スレッドがありません
          </div>
        ) : (
          threads.map((thread, index) => (
            <div class="thread-item">
              <div style="display: flex; align-items: baseline;">
                {/* スレッド番号 */}
                <span style="color: #666666; margin-right: 8px;">
                  {index + 1}:
                </span>

                {/* 勢い表示 */}
                <span style="margin-right: 8px;" title="スレッドの勢い">
                  {calculateMomentum(thread)}
                </span>

                {/* スレッドタイトル */}
                <a
                  href={`/threads/${thread.id}`}
                  class="thread-title"
                  style="flex-grow: 1;"
                >
                  {thread.title}
                </a>

                {/* レス数 */}
                <span style="color: #ff0000; margin-left: 8px;">
                  ({thread.resCount})
                </span>
              </div>

              {/* メタ情報 */}
              <div class="thread-meta">
                最終レス: {formatDate(thread.lastResAt)}
                {thread.resCount >= 1000 && (
                  <span style="color: #ff0000; font-weight: bold; margin-left: 10px;">
                    【1000到達】
                  </span>
                )}
                {thread.resCount >= 900 && thread.resCount < 1000 && (
                  <span style="color: #ff6600; font-weight: bold; margin-left: 10px;">
                    【残り{1000 - thread.resCount}】
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* スレッド一覧の説明 */}
      <div style="margin-top: 20px; padding: 10px; background-color: #f8f8f8; border: 1px solid #dddddd;">
        <div style="font-size: 12px; color: #666666;">
          <p style="margin-bottom: 5px;">
            <strong>表示について:</strong>
          </p>
          <ul style="margin-left: 20px; list-style-type: disc;">
            <li>🔥: 勢いが強い（100レス/時以上）</li>
            <li>⬆: 勢いあり（50-100レス/時）</li>
            <li>→: 普通（10-50レス/時）</li>
            <li>↓: 過疎（10レス/時未満）</li>
            <li>新: 作成から1時間以内</li>
          </ul>
          <p style="margin-top: 10px;">
            ※ 1000レスに到達したスレッドは書き込みができません
          </p>
        </div>
      </div>
    </div>
  );
};