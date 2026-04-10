import { FC } from 'hono/jsx';
import { Layout } from './Layout';

interface ErrorPageProps {
  message: string;
  linkUrl?: string;
  linkText?: string;
}

/**
 * エラーページコンポーネント
 *
 * エラーメッセージとリンクを表示する共通コンポーネント
 */
export const ErrorPage: FC<ErrorPageProps> = ({ message, linkUrl, linkText }) => {
  return (
    <Layout title="エラー - 2ch風掲示板">
      <div class="error-message">{message}</div>
      {linkUrl && linkText && (
        <div style="margin-top: 20px; text-align: center;">
          <a href={linkUrl}>{linkText}</a>
        </div>
      )}
    </Layout>
  );
};
