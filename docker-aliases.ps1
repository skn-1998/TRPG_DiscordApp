# Dockerコマンドのエイリアス集

# Docker完全リビルド関数
function Docker-Rebuild {
    Write-Host "=== Docker完全リビルド開始 ===" -ForegroundColor Green
    docker-compose down
    docker-compose build --no-cache app
    docker-compose up
}
Set-Alias -Name dcr -Value Docker-Rebuild

# Docker依存関係リセット関数
function Docker-Reset {
    Write-Host "=== Docker依存関係リセット開始 ===" -ForegroundColor Yellow
    docker-compose down -v
    docker-compose build --no-cache
    docker-compose up
}
Set-Alias -Name dcrs -Value Docker-Reset

# Docker基本的な再起動関数
function Docker-Restart {
    Write-Host "=== Docker再起動 ===" -ForegroundColor Blue
    docker-compose down
    docker-compose up
}
Set-Alias -Name dcrt -Value Docker-Restart

# Dockerシステム完全クリーンアップ関数
function Docker-Clean {
    Write-Host "=== Docker完全クリーンアップ（注意：全プロジェクト影響）===" -ForegroundColor Red
    $confirmation = Read-Host "本当に実行しますか？ (y/N)"
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        docker system prune -a -f
        docker-compose up --build
    } else {
        Write-Host "キャンセルしました" -ForegroundColor Yellow
    }
}
Set-Alias -Name dcc -Value Docker-Clean

Write-Host "Docker エイリアス読み込み完了!" -ForegroundColor Green
Write-Host "使用可能なコマンド:" -ForegroundColor Cyan
Write-Host "  dcr  : Docker完全リビルド (down → build --no-cache app → up)" -ForegroundColor White
Write-Host "  dcrs : Docker依存関係リセット (down -v → build --no-cache → up)" -ForegroundColor White  
Write-Host "  dcrt : Docker再起動 (down → up)" -ForegroundColor White
Write-Host "  dcc  : Docker完全クリーンアップ (system prune → up --build)" -ForegroundColor White 