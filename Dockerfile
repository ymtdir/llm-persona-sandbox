FROM node:20-alpine

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをコピー
COPY . .

# ポート3000を公開
EXPOSE 3000

# 開発モードで起動
CMD ["npm", "run", "dev"]
