param(
    [ValidateSet("status", "mock", "reset-local", "reset-nuvem", "testar-local", "testar-nuvem")]
    [string]$Acao = "status"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SshKey = "C:\Users\cezim\Desktop\estagio\chaves edubot\EduBot-cloud-01_key.pem"
$VmHost = "azureuser@68.211.113.129"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  EDUBOT HACKATHON — CENTRAL DE CONTROLE (PLANO A & PLANO B)    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

switch ($Acao) {
    "status" {
        Write-Host "`n[1] Verificando build offline do Frontend React..." -ForegroundColor Yellow
        if (Test-Path "$RepoRoot\Front-End\files\app\index.html") {
            Write-Host "  [OK] Bundle React pre-compilado presente em Front-End/files/app/index.html" -ForegroundColor Green
        } else {
            Write-Host "  [ALERTA] Front-End/files/app/index.html nao encontrado!" -ForegroundColor Red
        }

        Write-Host "`n[2] Verificando containers Docker locais..." -ForegroundColor Yellow
        try {
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        } catch {
            Write-Host "  [INFO] Docker Desktop local nao esta aberto no momento. Abra o Docker Desktop antes de subir o Plano B local." -ForegroundColor Yellow
        }
    }

    "mock" {
        Write-Host "`nAtivando MODO MOCK / 100% OFFLINE no arquivo .env local..." -ForegroundColor Yellow
        $envContent = @"
EDUBOT_SECRET=edubot-hackathon-secret-2026
EDUBOT_CORS_ORIGINS=http://localhost:8010,http://127.0.0.1:8010
EDUBOT_LLM_PROVIDER=mock
EDUBOT_OFFLINE=1
EDUBOT_SPEECH=off
EDUBOT_GAMIFICATION=on
EDUBOT_COMPANION=on
"@
        Set-Content -Path "$RepoRoot\.env" -Value $envContent -Encoding UTF8
        Write-Host "  [OK] .env configurado para Modo Mock Offline (0ms de rede externa)." -ForegroundColor Green
        Write-Host "  Subindo containers locais (ova_mysql, ova_flask, ova_apache)..." -ForegroundColor Yellow
        Push-Location $RepoRoot
        docker compose up -d
        docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/seed_perfis_demo.py
        docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/verify_demo_ready.py
        Pop-Location
        Write-Host "`n[PRONTO] Abra no navegador: http://localhost:8010/app/" -ForegroundColor Green
    }

    "reset-local" {
        Write-Host "`nRestaurando estado calibrado dos perfis de demonstracao (LOCAL)..." -ForegroundColor Yellow
        docker exec -e PYTHONPATH=/api ova_back_end python /api/tools/seed_perfis_demo.py
        Write-Host "  [OK] Perfis locais (Eduardo=1, Gabriel=2, Yasmin=3, Sanval Coord=4, Pedro=5, Thiago=6, Sanval, Edon) resetados!" -ForegroundColor Green
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
