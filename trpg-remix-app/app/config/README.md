# Next.js設定値

フロントエンドのserver-only環境変数を型検証する補助モジュール。

```dotenv
DISCORD_APPLICATIONID=...
SERVER_DOMAIN=http://127.0.0.1:3000
HOST_DOMAIN=http://127.0.0.1:5173
```

`DISCORD_SECRET`はフロントエンドで使用しない。ブラウザへ公開する必要がある値だけに`NEXT_PUBLIC_`を使うが、現在の認証・API構成では上記3値はいずれもserver-onlyで扱う。
