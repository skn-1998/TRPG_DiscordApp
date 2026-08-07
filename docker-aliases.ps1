# 最適化されたDockerコマンドのエイリアス集

# 開発環境用Docker完全リビルド関数
function Docker-Rebuild {
    Write-Host "=== 開発環境 Docker完全リビルド開始 ===" -ForegroundColor Green
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    Write-Host "=== 開発環境起動完了！ ===" -ForegroundColor Green
}
Set-Alias -Name dcr -Value Docker-Rebuild

# 本番環境用Docker完全リビルド関数
function Docker-Rebuild-Prod {
    Write-Host "=== 本番環境 Docker完全リビルド開始 ===" -ForegroundColor Magenta
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    Write-Host "=== 本番環境起動完了！ ===" -ForegroundColor Magenta
}
Set-Alias -Name dcrp -Value Docker-Rebuild-Prod

# Docker依存関係リセット関数（compose 宣言の named volume は down -v が全削除する）
function Docker-Reset {
    Write-Host "=== Docker依存関係リセット開始 ===" -ForegroundColor Yellow
    docker-compose down -v
    docker-compose build --no-cache
    docker-compose up -d
    Write-Host "=== 依存関係リセット完了！ ===" -ForegroundColor Yellow
}
Set-Alias -Name dcrs -Value Docker-Reset

# Next キャッシュ（.next volume の中身）クリア関数
function Docker-Clear-Next-Cache {
    Write-Host "=== Next キャッシュクリア開始 ===" -ForegroundColor Cyan
    docker exec TRPG-CLIENT sh -c "rm -rf trpg-next-app/.next/*"
    docker restart TRPG-CLIENT
    Write-Host "=== Next キャッシュクリア完了！ ===" -ForegroundColor Cyan
}
Set-Alias -Name dcnc -Value Docker-Clear-Next-Cache

# Docker基本的な再起動関数
function Docker-Restart {
    Write-Host "=== Docker再起動 ===" -ForegroundColor Blue
    docker-compose down
    docker-compose up -d
    Write-Host "=== 再起動完了！ ===" -ForegroundColor Blue
}
Set-Alias -Name dcrt -Value Docker-Restart

# Docker開発環境起動（バックグラウンド）
function Docker-Start {
    Write-Host "=== Docker開発環境起動 ===" -ForegroundColor Cyan
    docker-compose up -d
}
Set-Alias -Name dcup -Value Docker-Start

# Docker本番環境起動（バックグラウンド）
function Docker-Start-Prod {
    Write-Host "=== Docker本番環境起動 ===" -ForegroundColor Magenta
    docker-compose -f docker-compose.prod.yml up -d
}
Set-Alias -Name dcupp -Value Docker-Start-Prod

# Dockerログ表示
function Docker-Logs {
    param(
        [string]$Service = ""
    )
    if ($Service) {
        docker-compose logs -f $Service
    } else {
        docker-compose logs -f
    }
}
Set-Alias -Name dcl -Value Docker-Logs

# Dockerヘルスチェック確認
function Docker-Health {
    Write-Host "=== サービス健全性チェック ===" -ForegroundColor Green
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}
Set-Alias -Name dch -Value Docker-Health

# Next アプリ（TRPG-CLIENT）の起動時間測定
function Docker-Next-Timing {
    Write-Host "=== Next 起動時間測定開始 ===" -ForegroundColor Yellow
    $startTime = Get-Date
    docker restart TRPG-CLIENT

    Write-Host "ヘルスチェック完了を待機中..." -ForegroundColor Yellow
    do {
        Start-Sleep -Seconds 5
        $status = docker inspect TRPG-CLIENT --format '{{.State.Health.Status}}'
    } while ($status -ne "healthy")

    $endTime = Get-Date
    $duration = $endTime - $startTime
    Write-Host "=== Next 起動完了！所要時間: $($duration.TotalSeconds) 秒 ===" -ForegroundColor Green
}
Set-Alias -Name dcrt-timing -Value Docker-Next-Timing

# Dockerシステム完全クリーンアップ関数
function Docker-Clean {
    Write-Host "=== Docker完全クリーンアップ（注意：全プロジェクト影響）===" -ForegroundColor Red
    $confirmation = Read-Host "本当に実行しますか？ (y/N)"
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        docker system prune -a -f
        docker volume prune -f
        docker-compose up --build -d
        Write-Host "=== クリーンアップ完了！ ===" -ForegroundColor Red
    } else {
        Write-Host "キャンセルしました" -ForegroundColor Yellow
    }
}
Set-Alias -Name dcc -Value Docker-Clean

Write-Host "最適化されたDocker エイリアス読み込み完了!" -ForegroundColor Green
Write-Host "使用可能なコマンド:" -ForegroundColor Cyan
Write-Host "  dcr   : 開発環境完全リビルド" -ForegroundColor White
Write-Host "  dcrp  : 本番環境完全リビルド" -ForegroundColor White
Write-Host "  dcrs  : 依存関係リセット" -ForegroundColor White  
Write-Host "  dcrt  : 再起動" -ForegroundColor White
Write-Host "  dcup  : 開発環境起動" -ForegroundColor White
Write-Host "  dcupp : 本番環境起動" -ForegroundColor White
Write-Host "  dcl   : ログ表示 (dcl [サービス名])" -ForegroundColor White
Write-Host "  dch   : ヘルスチェック確認" -ForegroundColor White
Write-Host "  dcnc  : Next キャッシュクリア" -ForegroundColor Cyan
Write-Host "  dcrt-timing : Next 起動時間測定" -ForegroundColor Cyan
Write-Host "  dcc   : 完全クリーンアップ" -ForegroundColor White 