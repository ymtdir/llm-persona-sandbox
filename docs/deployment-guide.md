# デプロイメントガイド (Deployment Guide)

## 概要

LLM Persona Sandboxの環境構築、デプロイ、運用手順。

**関連ドキュメント**:
- [アーキテクチャ設計書](./architecture.md) - インフラ構成
- [開発ガイドライン](./development-guidelines.md) - 開発プロセス

## 環境要件

### ハードウェア要件

| 項目           | 最小要件      | 推奨要件          | 備考                           |
| -------------- | ------------- | ----------------- | ------------------------------ |
| CPU            | 4コア         | 8コア以上         | CPU推論の場合、コア数が重要    |
| メモリ         | 16GB          | 32GB以上          | Ollama 8GB + OS/App 8GB        |
| ディスク       | 20GB SSD      | 50GB SSD          | Ollamaモデル 10GB + DB 1GB     |
| GPU（オプション）| -           | NVIDIA GTX 1660以上| GPU推論で3-5倍高速化           |
| ネットワーク   | -             | -                 | 初回セットアップ時のみ必要     |

### ソフトウェア要件

| 項目           | バージョン    | インストール方法                              |
| -------------- | ------------- | --------------------------------------------- |
| OS             | Ubuntu 22.04+ | -                                             |
|                | macOS 12+     | -                                             |
|                | Windows 11    | WSL2必須                                      |
| Docker         | 24.x以上      | https://docs.docker.com/engine/install/       |
| Docker Compose | 2.x以上       | Dockerに同梱                                  |
| Git            | 2.x以上       | `apt install git` / `brew install git`        |
| Node.js        | 20.x LTS      | （開発時のみ）nodenv/nvm推奨                  |

### GPU環境（オプション）

GPU推論を使用する場合：

```bash
# NVIDIA Docker Runtimeのインストール
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt update && sudo apt install -y nvidia-docker2
sudo systemctl restart docker

# 動作確認
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

## 開発環境セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/[username]/llm-persona-sandbox.git
cd llm-persona-sandbox
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```env
# アプリケーション設定
NODE_ENV=development
PORT=3000

# Ollama設定
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b

# PostgreSQL設定
DATABASE_URL=postgresql://postgres:password@db:5432/llm_persona_sandbox
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=llm_persona_sandbox
```

### 3. Docker Composeで起動

```bash
docker-compose up -d
```

起動確認：

```bash
docker-compose ps

# 期待される出力
# NAME                IMAGE                 STATUS
# app                 llm-persona-app       Up
# db                  postgres:17           Up
# ollama              ollama/ollama:latest  Up
```

### 4. データベース初期化

```bash
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql
```

確認：

```bash
docker exec -it db psql -U postgres llm_persona_sandbox -c "\dt"

# 期待される出力
#          List of relations
#  Schema |  Name   | Type  |  Owner
# --------+---------+-------+----------
#  public | threads | table | postgres
#  public | posts   | table | postgres
```

### 5. Ollamaモデルのプリロード

```bash
# モデルのダウンロードと起動（初回のみ時間がかかる）
docker exec ollama ollama run llama3.1:8b

# Ctrl+D で終了

# モデルリストの確認
docker exec ollama ollama list
```

### 6. アプリケーション起動確認

```bash
curl http://localhost:3000
```

ブラウザで `http://localhost:3000` にアクセスし、スレッド一覧が表示されることを確認。

## 本番環境デプロイ

### VPSサーバー構築（Ubuntu 22.04）

```bash
# サーバーにSSH接続
ssh user@your-vps-server

# システム更新
sudo apt update && sudo apt upgrade -y

# Docker & Docker Composeインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose確認
docker compose version
```

### リポジトリデプロイ

```bash
# リポジトリクローン
git clone https://github.com/[username]/llm-persona-sandbox.git
cd llm-persona-sandbox

# 本番用環境変数設定
cp .env.example .env
nano .env  # 本番用の設定に変更
```

本番用 `.env` の例：

```env
NODE_ENV=production
PORT=3000

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b

DATABASE_URL=postgresql://postgres:STRONG_PASSWORD_HERE@db:5432/llm_persona_sandbox
POSTGRES_USER=postgres
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_DB=llm_persona_sandbox
```

### Docker Composeで起動

```bash
# 本番環境起動
docker-compose up -d

# ログ確認
docker-compose logs -f app
```

### データベース初期化

```bash
docker exec -i db psql -U postgres llm_persona_sandbox < db/schema.sql
```

### Ollamaモデルプリロード

```bash
docker exec ollama ollama run llama3.1:8b
```

### Nginxリバースプロキシ設定（オプション）

HTTPS対応・ドメイン設定をする場合：

```bash
sudo apt install nginx certbot python3-certbot-nginx

sudo nano /etc/nginx/sites-available/llm-persona-sandbox
```

Nginx設定例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

設定を有効化：

```bash
sudo ln -s /etc/nginx/sites-available/llm-persona-sandbox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Let's EncryptでHTTPS化
sudo certbot --nginx -d your-domain.com
```

## バックアップ戦略

### データベースバックアップ

```bash
# 手動バックアップ
docker exec db pg_dump -U postgres llm_persona_sandbox > backup_$(date +%Y%m%d).sql

# 自動バックアップ（cron設定）
crontab -e

# 毎日午前3時にバックアップ
0 3 * * * cd /path/to/llm-persona-sandbox && docker exec db pg_dump -U postgres llm_persona_sandbox > .backup/backup_$(date +\%Y\%m\%d).sql

# 7日以前のバックアップを削除
0 4 * * * find /path/to/llm-persona-sandbox/.backup/ -name "backup_*.sql" -mtime +7 -delete
```

### データベース復元

```bash
# 復元前にコンテナ停止
docker-compose down

# データベースボリューム削除
docker volume rm llm-persona-sandbox_db-data

# コンテナ再起動
docker-compose up -d db

# 待機（PostgreSQL起動まで）
sleep 10

# バックアップから復元
docker exec -i db psql -U postgres llm_persona_sandbox < backup_20250115.sql

# 全サービス起動
docker-compose up -d
```

### Ollamaモデルデータのバックアップ

```bash
# ボリュームのバックアップ
docker run --rm -v llm-persona-sandbox_ollama-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/ollama-models-backup.tar.gz -C /data .

# 復元
docker run --rm -v llm-persona-sandbox_ollama-data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/ollama-models-backup.tar.gz -C /data
```

## トラブルシューティング

### Ollamaコンテナが起動しない

**症状**: `docker-compose ps` で ollama が `Exited` 状態

**原因と対処**:

```bash
# ログ確認
docker-compose logs ollama

# メモリ不足の場合
# docker-compose.yml でメモリ制限を緩和
# mem_limit: 8g → mem_limit: 16g

# コンテナ再起動
docker-compose restart ollama
```

### PostgreSQLに接続できない

**症状**: `Error: connect ECONNREFUSED`

**原因と対処**:

```bash
# コンテナ起動確認
docker-compose ps db

# ログ確認
docker-compose logs db

# データベース接続テスト
docker exec -it db psql -U postgres llm_persona_sandbox

# 接続できない場合、環境変数確認
cat .env | grep DATABASE_URL
```

### Port 3000が既に使用されている

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**対処**:

```bash
# 使用中のプロセス確認
sudo lsof -i :3000

# ポート番号変更
# .env ファイルで PORT=3001 に変更
# docker-compose.yml でポートマッピング変更
# ports: - "3001:3000"

# 再起動
docker-compose down && docker-compose up -d
```

### Ollamaモデルが見つからない

**症状**: `model 'llama3.1:8b' not found`

**対処**:

```bash
# モデル一覧確認
docker exec ollama ollama list

# モデルがない場合、ダウンロード
docker exec ollama ollama pull llama3.1:8b

# プリロード
docker exec ollama ollama run llama3.1:8b
```

### AIレス生成が遅い（10秒以上）

**原因**: CPU推論によるパフォーマンス限界

**対処**:

1. **GPU推論に切り替え**（最も効果的）:
   - NVIDIA GPUを搭載したVPSに移行
   - NVIDIA Docker Runtimeをインストール
   - docker-compose.ymlでGPU有効化:
     ```yaml
     ollama:
       deploy:
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: 1
                 capabilities: [gpu]
     ```

2. **軽量モデルに切り替え**:
   - `.env` で `OLLAMA_MODEL=llama3.1:8b` → `llama3.1:3b`（より軽量）

3. **生成トークン数を削減**:
   - OllamaClientで `num_predict: 200` → `100`

### ディスク容量不足

**症状**: `no space left on device`

**対処**:

```bash
# ディスク使用量確認
df -h

# Dockerディスク使用量確認
docker system df

# 未使用イメージ・コンテナ削除
docker system prune -a

# 未使用ボリューム削除（注意: データ消失）
docker volume prune
```

## 監視・メンテナンス

### ログ確認

```bash
# アプリケーションログ
docker-compose logs -f app

# PostgreSQLログ
docker-compose logs -f db

# Ollamaログ
docker-compose logs -f ollama

# 全サービスログ
docker-compose logs -f
```

### リソース使用量監視

```bash
# コンテナリソース使用量
docker stats

# ディスク使用量
docker system df
```

### アップデート手順

```bash
# 最新コードを取得
git pull origin main

# コンテナ再ビルド
docker-compose build

# サービス再起動
docker-compose down && docker-compose up -d

# ログ確認
docker-compose logs -f app
```

## CI/CD（将来実装）

GitHub Actionsによる自動デプロイ例：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd llm-persona-sandbox
            git pull origin main
            docker-compose build
            docker-compose up -d
```

## セキュリティ設定

### ファイアウォール設定

```bash
# UFWインストール（Ubuntu）
sudo apt install ufw

# SSH許可
sudo ufw allow 22/tcp

# HTTP/HTTPS許可
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# PostgreSQL・Ollamaは外部公開しない（デフォルトで遮断）

# ファイアウォール有効化
sudo ufw enable
```

### 環境変数の保護

```bash
# .envファイルのパーミッション設定
chmod 600 .env

# 所有者確認
ls -l .env
# -rw------- 1 user user 256 Jan 15 14:32 .env
```

## 関連ドキュメント

- [アーキテクチャ設計書](./architecture.md) - インフラ構成
- [開発ガイドライン](./development-guidelines.md) - 開発プロセス
- [API仕様書](./api-specifications.md) - Ollama API設定
