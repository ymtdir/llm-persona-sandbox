import { FC } from 'hono/jsx';
import { PropsWithChildren } from 'hono/jsx';

interface LayoutProps extends PropsWithChildren {
  title?: string;
}

/**
 * 共通レイアウトコンポーネント
 * 2ch風のスタイルを適用し、XSS対策済みのHTMLを生成
 */
export const Layout: FC<LayoutProps> = ({ title = '2ch風掲示板', children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>{`
          /* 2ch風基本スタイル */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: "MS PGothic", "Osaka-Mono", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif;
            font-size: 14px;
            line-height: 1.4;
            background-color: #efefef;
            color: #000000;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 10px;
          }

          /* ヘッダースタイル */
          .header {
            background-color: #e0e0e0;
            border-bottom: 1px solid #cccccc;
            padding: 10px;
            margin-bottom: 10px;
          }

          .header h1 {
            font-size: 18px;
            font-weight: normal;
            color: #444444;
          }

          /* スレッド一覧スタイル */
          .thread-list {
            background-color: #ffffff;
            border: 1px solid #cccccc;
            margin-bottom: 10px;
          }

          .thread-item {
            padding: 8px 12px;
            border-bottom: 1px solid #eeeeee;
          }

          .thread-item:last-child {
            border-bottom: none;
          }

          .thread-item:hover {
            background-color: #f8f8f8;
          }

          .thread-title {
            color: #0000ff;
            text-decoration: underline;
            cursor: pointer;
          }

          .thread-meta {
            color: #666666;
            font-size: 12px;
            margin-top: 4px;
          }

          /* スレッド詳細スタイル */
          .thread-detail {
            background-color: #f0e0d6;
            padding: 10px;
            border: 1px solid #d0c0a6;
          }

          .post {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d0c0a6;
          }

          .post:last-child {
            border-bottom: none;
          }

          /* 投稿ヘッダー（番号、名前、日時） */
          .post-header {
            color: #117743;
            font-size: 13px;
            margin-bottom: 4px;
          }

          .post-number {
            font-weight: bold;
          }

          .post-name {
            color: #117743;
            font-weight: bold;
          }

          .post-date {
            color: #666666;
          }

          /* 投稿内容 */
          .post-content {
            margin-left: 20px;
            word-wrap: break-word;
            white-space: pre-wrap;
          }

          /* アンカーリンク */
          .post-anchor {
            color: #0000ff;
            text-decoration: underline;
            cursor: pointer;
          }

          .post-anchor:hover {
            color: #ff0000;
          }

          /* フォームスタイル */
          .post-form {
            background-color: #f0f0f0;
            border: 1px solid #cccccc;
            padding: 10px;
            margin-top: 20px;
          }

          .form-group {
            margin-bottom: 10px;
          }

          .form-label {
            display: inline-block;
            width: 80px;
            font-weight: bold;
          }

          input[type="text"],
          input[type="email"],
          textarea {
            font-family: "MS PGothic", "Osaka-Mono", "Meiryo", sans-serif;
            font-size: 14px;
            padding: 4px;
            border: 1px solid #999999;
            background-color: #ffffff;
          }

          input[type="text"],
          input[type="email"] {
            width: 100%;
            max-width: 200px;
          }

          textarea {
            width: 100%;
            max-width: 400px;
            height: 100px;
            vertical-align: top;
          }

          button {
            font-family: "MS PGothic", "Osaka-Mono", "Meiryo", sans-serif;
            font-size: 14px;
            padding: 4px 20px;
            background-color: #f0f0f0;
            border: 2px outset #dddddd;
            cursor: pointer;
          }

          button:hover {
            background-color: #e8e8e8;
          }

          button:active {
            border-style: inset;
          }

          /* フッタースタイル */
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #cccccc;
            text-align: center;
            color: #666666;
            font-size: 12px;
          }

          /* リンクの基本スタイル */
          a {
            color: #0000ff;
            text-decoration: underline;
          }

          a:hover {
            color: #ff0000;
          }

          a:visited {
            color: #800080;
          }

          /* フォーカスインジケーター（アクセシビリティ） */
          a:focus,
          button:focus,
          input:focus,
          textarea:focus {
            outline: 2px solid #0066cc;
            outline-offset: 2px;
          }

          /* エラーメッセージ */
          .error-message {
            color: #ff0000;
            font-weight: bold;
            margin: 10px 0;
          }

          /* 成功メッセージ */
          .success-message {
            color: #008000;
            font-weight: bold;
            margin: 10px 0;
          }
        `}</style>
      </head>
      <body>
        <main class="container">
          <header class="header">
            <h1>{title}</h1>
          </header>
          {children}
          <footer class="footer">
            <p>2ch風掲示板システム - Hono + JSX実装</p>
          </footer>
        </main>
      </body>
    </html>
  );
};