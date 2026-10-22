param(
    [ValidateSet("status", "mock", "reset-local", "reset-nuvem", "testar-local", "testar-nuvem")]
    [string]$Acao = "status"
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SshKey = "C:\Users\cezim\Desktop\estagio\chaves edubot\EduBot-cloud-01_key.pem"
$VmHost = "azureuser@68.211.113.129"

function Apply-LocalMigrations {
    Write-Host "  Verificando e aplicando migrations SQL no container local (ova_db)..." -ForegroundColor Yellow
    $sqlFiles = Get-ChildItem -Path (Join-Path $RepoRoot "Database\sql\migration_*.sql") | Sort-Object Name
    foreach ($f in $sqlFiles) {
        $sqlText = Get-Content $f.FullName -Raw -Encoding UTF8
        $sqlText | docker exec -i ova_db sh -c "mysql --default-character-set=utf8mb4 -uroot -pPassword-1 ova_db 2>/dev/null || true"
    }
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  EDUBOT HACKATHON - CENTRAL DE CONTROLE (PLANO A E PLANO B)    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

switch ($Acao) {
    "status" {
        Write-Host "`n[1] Verificando build offline do Frontend React..." -ForegroundColor Yellow
        $indexPath = Join-Path $RepoRoot "Front-End\files\app\index.html"
        if (Test-Path $indexPath) {
            Write-Host "  [OK] Bundle React pre-compilado presente em Front-End/files/app/index.html" -ForegroundColor Green
        } else {
            Write-Host "  [ALERTA] Front-End/files/app/index.html nao encontrado!" -ForegroundColor Red
        }

        Write-Host "`n[2] Verificando containers Docker locais..." -ForegroundColor Yellow
        $dockerOut = docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerOut | Out-Host
        } else {
            Write-Host "  [INFO] Docker Desktop local nao esta aberto no momento. Abra o Docker Desktop antes de subir o Plano B local." -ForegroundColor Yellow
        }
    }

    "mock" {
        Write-Host "`nAtivando MODO MOCK / 100% OFFLINE no arquivo .env local..." -ForegroundColor Yellow
        $envLines = @(
            "EDUBOT_SECRET=edubot-hackathon-secret-2026",
            "EDUBOT_CORS_ORIGINS=http://localhost:8010,http://127.0.0.1:8010",
            "EDUBOT_LLM_PROVIDER=mock",
            "EDUBOT_OFFLINE=1",
            "EDUBOT_SPEECH=off",
            "EDUBOT_GAMIFICATION=on",
            "EDUBOT_COMPANION=on"
        )
        $envPath = Join-Path $RepoRoot ".env"
        Set-Content -Path $envPath -Value $envLines -Encoding Ascii
        Write-Host "  [OK] .env configurado para Modo Mock Offline (0ms de rede externa)." -ForegroundColor Green
        Write-Host "  Subindo containers locais (ova_mysql, ova_flask, ova_apache)..." -ForegroundColor Yellow
        Push-Location $RepoRoot
        try {
            docker compose up -d
            Apply-LocalMigrations
            docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/seed_perfis_demo.py
            docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/verify_demo_ready.py
            Write-Host "`n[PRONTO] Abra no navegador: http://localhost:8010/app/" -ForegroundColor Green
        } finally {
            Pop-Location
        }
    }

    "reset-local" {
        Write-Host "`nRestaurando estado calibrado dos perfis de demonstracao (LOCAL)..." -ForegroundColor Yellow
        Apply-LocalMigrations
        docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/seed_perfis_demo.py
        Write-Host "  [OK] Perfis locais (Eduardo=1, Gabriel=2, Yasmin=3, Sanval Coord=4, Pedro=5, Thiago=6) resetados!" -ForegroundColor Green
    }

    "testar-local" {
        Write-Host "`nExecutando bateria de validacao do Plano B (LOCAL)..." -ForegroundColor Yellow
        docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/verify_demo_ready.py
    }

    "reset-nuvem" {
        Write-Host "`nRestaurando estado calibrado dos perfis de demonstracao (NUVEM AZURE)..." -ForegroundColor Yellow
        ssh -o StrictHostKeyChecking=no -i $SshKey $VmHost "docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/seed_perfis_demo.py"
        Write-Host "  [OK] Perfis na nuvem Azure resetados com sucesso!" -ForegroundColor Green
    }

    "testar-nuvem" {
        Write-Host "`nExecutando bateria de validacao do Plano B na VM (NUVEM AZURE)..." -ForegroundColor Yellow
        ssh -o StrictHostKeyChecking=no -i $SshKey $VmHost "docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/verify_demo_ready.py"
    }
}
