import { FC } from 'hono/jsx';
import type { Child } from 'hono/jsx';

export interface Post {
  id: string;
  number: number;
  name: string;
  email?: string;
  content: string;
  createdAt: Date;
  threadId: string;
}

export interface ThreadDetailData {
  id: string;
  title: string;
  posts: Post[];
  isLocked: boolean;
}

interface ThreadDetailProps {
  thread: ThreadDetailData;
  onSubmitPost?: (data: { name: string; email: string; content: string }) => void;
}

/**
 * スレッド詳細表示コンポーネント
 * レス一覧と投稿フォームを表示
 */
export const ThreadDetail: FC<ThreadDetailProps> = ({ thread, onSubmitPost }) => {
  /**
   * 投稿IDを生成（日付ベースの簡易ID）
   */
  const generatePostId = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const idSeed = `${year}${month}${day}${Math.floor(Math.random() * 10000)}`;
    return btoa(idSeed).substring(0, 8);
  };

  /**
   * 日時を2ch風フォーマットに変換
   */
  const formatDateTime = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekDay = weekDays[d.getDay()];

    const postId = generatePostId(d);

    return `${year}/${month}/${day}(${weekDay}) ${hour}:${minute}:${second}.${String(d.getMilliseconds()).padStart(3, '0')} ID:${postId}`;
  };

  /**
   * 投稿内容をレンダリング（アンカーリンクを変換）
   */
  const renderContent = (content: string): Child => {
    // >>番号 形式のアンカーを検出してリンクに変換
    const anchorPattern = /&gt;&gt;(\d+)/g;
    const parts: (string | Child)[] = [];
    let lastIndex = 0;
    let match;

    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    while ((match = anchorPattern.exec(escapedContent)) !== null) {
      // アンカー前のテキスト
      if (match.index > lastIndex) {
        parts.push(escapedContent.substring(lastIndex, match.index));
      }

      // アンカーリンク
      const postNumber = match[1];
      parts.push(
        <a
          href={`#post-${postNumber}`}
          class="post-anchor"
        >
          &gt;&gt;{postNumber}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // 残りのテキスト
    if (lastIndex < escapedContent.length) {
      parts.push(escapedContent.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  /**
   * 投稿者名の表示（メール欄がある場合はリンクに）
   */
  const renderName = (post: Post): Child => {
    const displayName = post.name || '名無しさん';

    if (post.email) {
      return (
        <a
          href={`mailto:${post.email}`}
          class="post-name"
          style="text-decoration: none;"
        >
          {displayName}
        </a>
      );
    }

    return <span class="post-name">{displayName}</span>;
  };

  return (
    <div class="thread-detail-container">
      {/* スレッドタイトル */}
      <h2 style="font-size: 18px; margin-bottom: 15px; padding: 10px; background-color: #e8e8e8; border: 1px solid #cccccc;">
        {thread.title}
      </h2>

      {/* レス一覧 */}
      <div class="thread-detail">
        {thread.posts.map((post) => (
          <div class="post" id={`post-${post.number}`}>
            {/* 投稿ヘッダー */}
            <div class="post-header">
              <span class="post-number">{post.number}</span>
              {' '}:
              {renderName(post)}
              {' '}:
              <span class="post-date">{formatDateTime(post.createdAt)}</span>
            </div>

            {/* 投稿内容 */}
            <div class="post-content">
              {renderContent(post.content)}
            </div>
          </div>
        ))}
      </div>

      {/* レス投稿フォーム */}
      {!thread.isLocked && thread.posts.length < 1000 ? (
        <div class="post-form">
          <h3 style="font-size: 14px; margin-bottom: 10px; font-weight: bold;">
            レスを投稿する
          </h3>
          <form
            action={`/threads/${thread.id}/posts`}
            method="post"
            onsubmit={onSubmitPost ? `event.preventDefault(); ${onSubmitPost.toString()}(this);` : undefined}
          >
            <div class="form-group">
              <label htmlFor="name" class="form-label">名前:</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="名無しさん"
                maxlength={64}
              />
            </div>

            <div class="form-group">
              <label htmlFor="email" class="form-label">E-mail:</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="sage"
                maxlength={64}
              />
              <span style="margin-left: 10px; font-size: 12px; color: #666666;">
                (省略可)
              </span>
            </div>

            <div class="form-group">
              <label htmlFor="content" class="form-label">内容:</label>
              <textarea
                id="content"
                name="content"
                required
                maxlength={2000}
                placeholder="投稿内容を入力してください"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label"></label>
              <button type="submit">
                書き込む
              </button>
              <span style="margin-left: 10px; font-size: 12px; color: #666666;">
                残り{1000 - thread.posts.length}レス
              </span>
            </div>
          </form>

          {/* 投稿時の注意事項 */}
          <div style="margin-top: 15px; padding: 10px; background-color: #fff8f0; border: 1px solid #e0d0c0; font-size: 12px;">
            <p style="margin-bottom: 5px; font-weight: bold;">投稿時の注意:</p>
            <ul style="margin-left: 20px; list-style-type: disc;">
              <li>他の投稿にレスする場合は &gt;&gt;番号 を使用してください</li>
              <li>sage進行の場合はE-mail欄に「sage」と入力してください</li>
              <li>HTMLタグは使用できません（自動的にエスケープされます）</li>
              <li>最大2000文字まで投稿可能です</li>
              <li>1000レスに到達するとスレッドは書き込み不可となります</li>
            </ul>
          </div>
        </div>
      ) : (
        <div class="error-message" style="padding: 20px; text-align: center;">
          {thread.isLocked
            ? 'このスレッドはロックされています'
            : 'このスレッドは1000レスに到達しました。新しいスレッドを立ててください。'}
        </div>
      )}

      {/* スレッド操作メニュー */}
      <div style="margin-top: 20px; text-align: center;">
        <a href="/threads" style="margin: 0 10px;">スレッド一覧に戻る</a>
        <a href={`/threads/${thread.id}`} style="margin: 0 10px;">リロード</a>
        <a href="#post-1" style="margin: 0 10px;">▲トップ</a>
        <a href="#post-form" style="margin: 0 10px;">▼レス投稿</a>
      </div>
    </div>
  );
};