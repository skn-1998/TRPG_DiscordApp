Speak Japanese
npmコマンドの代わりにpnpmコマンドを使用して

Codexから作業委譲された場合は、最初にAGENTS.mdを確認してください
委譲メモがある場合はTRPG-SERVER/CLAUDE_HANDOFF.mdを確認してください
Codexが作成した委譲メモの範囲・触らない範囲・完了条件を守ってください


なによりも作業を開始する前にAI.mdを確認してください
AI.mdはTRPG
指示した内容によってはあなたが判断してAI.*.mdも確認して
例えばdiscord関係ならばAI.discord.mdも確認するなど
全体再設計やmodule境界に関わる作業ではTRPG-SERVER/src/ARCHITECTURE.mdを確認してください

プロジェクトの方針について
基本設計はAI.mdに記載されている
これはあなたと一緒に変更していくものであり、あなたが理解できない事項や冗長な記載がある場合は修正や削除を行ってください。


AI.*.mdはAI.domain.mdだったりAI.test.mdだったり機能ごとの設計を記載しています。
AI.mdよりも詳細に記載しているので私が質問した事項で必要だと思ったら確認してください。

作業終了後はAI.*.mdに状況を必ず記載してください

TRPG-SERVERでpnpm run buildを実行したあとはpnpm run start:devやcheck:circularを実施し、依存関係をチェックすること
循環依存はゼロ（`check:circular` は「No circular dependency found!」が正常）。かつて許容していた UserDomain⇄AuthDomain は H6（2026-06-01）で解消済み。新たな循環参照は禁止。
