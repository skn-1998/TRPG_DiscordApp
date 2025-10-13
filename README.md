# TRPG-DiscordApp

TRPG（テーブルトークRPG）のオンラインセッションを、もっとスムーズで没入感のある体験にするための多機能支援アプリケーションです。Discordとのシームレスな連携を特徴とし、ゲームマスター（GM）とプレイヤー（PL）双方の負担を軽減します。

このアプリケーションは、Webブラウザ上でキャラクターシートやシナリオ情報を管理し、その内容をDiscord上のボットと連携させることで、快適なセッション運営を実現します。
煩雑になりがちな情報管理を一元化し、プレイヤーが物語に集中できる環境を提供します。

## TRPGとは

各プレイヤーが作成したキャラクターを演じ、プレイヤー同士で会話しながら物語を進めていくロールプレイングゲームです。紙とペン、サイコロなどを使って、ルールブックのルールに従ってゲームを進めていきます。

## 特徴

- **ユーザー認証**: Discordアカウントを利用した簡単ログイン。
- **キャラクター管理**: キャラクターシート作成・編集。
- **シナリオ管理**: GM向けのセッション管理機能、シナリオ作成・管理機能。
- **Discordボット連携**:
  - コマンドによるダイスロール機能。
  - キャラクターシートの情報をDiscordに呼び出し。

## アプリ作成の背景

オンラインでのTRPGセッションが主流になる中で、多くのツールはキャラクターシート管理、シナリオ管理、そして実際のプレイの場であるDiscordがそれぞれ独立していました。これにより、以下のような課題がありました。

- **情報の散逸**: キャラクター情報やシナリオのメモが様々な場所に散らばり、管理が煩雑になる。
- **手作業の多さ**: ステータス変動やダイスロールの結果を、手動でキャラクターシートに反映させる手間がかかる。
- **没入感の阻害**: プレイ中にツールを頻繁に切り替える必要があり、物語への集中が途切れてしまう。

これらの課題を解決し、「**セッションの準備から終了まで、すべてが完結するプラットフォーム**」を作りたいという思いから、このプロジェクトはスタートしました。Discordというコミュニケーションのハブを中心に、必要な情報を連携させることで、これまでにない快適なTRPG体験を提供することを目指しています。

## 技術スタック

### フロントエンド（trpg-remix-app）

- **言語**: TypeScript v5.x
- **フレームワーク**: Remix v2.x
- **UIライブラリ**: Mantine v7.x
- **状態管理**: Zustand v5.x + Immer v10.x
- **認証**: JWT + Discord OAuth2
- **HTTP通信**: Axios v1.12.x
- **スタイリング**: CSS Modules + PostCSS v8.x

### バックエンド（TRPG-SERVER）

- **言語**: TypeScript v5.x
- **フレームワーク**: NestJS v10.x
- **データベース**: MongoDB（Mongoose v8.x）
- **認証**: JWT + Discord OAuth2
- **HTTP通信**: Axios v1.12.x
- **外部API**: Discord.js v14.x

## スクリーンショット

トップページ  
<img src="https://private-user-images.githubusercontent.com/155166826/500628729-39b40834-446c-4558-a729-a81d69009bc8.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjAzODEzMTksIm5iZiI6MTc2MDM4MTAxOSwicGF0aCI6Ii8xNTUxNjY4MjYvNTAwNjI4NzI5LTM5YjQwODM0LTQ0NmMtNDU1OC1hNzI5LWE4MWQ2OTAwOWJjOC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUxMDEzJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MTAxM1QxODQzMzlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT02ZDZiNGM0MmE0NzA4MWEyYmE2NDlhMDA5NGRjNTQxYTAzNjllYzRjMzA2ZTQ5NzQ1MDVkZGYxYmEzZGM1NGY0JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.ZjFOYC6puCrlv7Zxn8qS7mcZ4bP0FannSJ6PkP11Q3U" alt="top-page" width="70%" />

キャラ作成ページ  
<img alt="chara-create" src="https://private-user-images.githubusercontent.com/155166826/500628765-93cbd9b2-ab48-4e71-9f11-2414e76d06ff.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjAzODEzMTksIm5iZiI6MTc2MDM4MTAxOSwicGF0aCI6Ii8xNTUxNjY4MjYvNTAwNjI4NzY1LTkzY2JkOWIyLWFiNDgtNGU3MS05ZjExLTI0MTRlNzZkMDZmZi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUxMDEzJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MTAxM1QxODQzMzlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT0zZTg0NTdmYzEzNDkzYWJjOTVkNTAxMDliZDY1ZDM1YTFlZTg0MDhlMWJhOGE4MDVhOTYzMWRjMGJkZTlkYjI3JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.EyKOAfK1YoCLc1xV3xFn9LZez-1KC-0kelDNS64IOjI" width="70%" />

Discord Bot ダイスロール コマンド  
<img alt="diceroll" src="https://private-user-images.githubusercontent.com/155166826/500628898-c1304e69-58d8-4d77-a481-31df02ef4a6b.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjAzODEzMTksIm5iZiI6MTc2MDM4MTAxOSwicGF0aCI6Ii8xNTUxNjY4MjYvNTAwNjI4ODk4LWMxMzA0ZTY5LTU4ZDgtNGQ3Ny1hNDgxLTMxZGYwMmVmNGE2Yi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUxMDEzJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MTAxM1QxODQzMzlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT05Nzg0OGJhNWU1NzE1ZGQ0YTg2MGM5YzZmNGFkZWIzMTkxNjk5MGVlMjFkNDg0NGU3Y2UwNjdmMzVjMjRjZDQxJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.mmjS522WCWRfYGHVZvKfWFw1soMPqVV0OYM5XDwh0xU" />

Discord Bot キャラクター情報 編集機能  
<img alt="discord-chara" src="https://private-user-images.githubusercontent.com/155166826/500628953-5d06330c-08b0-4b6c-86f2-ba1fd98539e4.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjAzODEzMTksIm5iZiI6MTc2MDM4MTAxOSwicGF0aCI6Ii8xNTUxNjY4MjYvNTAwNjI4OTUzLTVkMDYzMzBjLTA4YjAtNGI2Yy04NmYyLWJhMWZkOTg1MzllNC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUxMDEzJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MTAxM1QxODQzMzlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT0wNzM2ZmRiMDY3ZmFhZjA5MmY0YzVmMDdmNTdkN2Q3Y2UzZmI1MzIzM2YyNjY0YTFjZGJlNjMyNGE2YjJjMzYzJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.W7F9KMV-2xqwHwS4OZIgzniAVbUuWaEgfKtzQMT_zK0" width="60%" />
