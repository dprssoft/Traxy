$ErrorActionPreference = "Stop"

Write-Host "Starting Traxy local development environment..." -ForegroundColor Cyan

# 1. Setup frontend .env if it doesn't exist
if (-not (Test-Path "frontend/.env")) {
    Write-Host "Creating frontend .env from .env.example..."
    Copy-Item "frontend/.env.example" "frontend/.env"
}

Write-Host "`nStarting Frontend Server (Vite)..." -ForegroundColor Green
# Start the frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; pnpm dev"

Write-Host "`nAll done! The frontend will be available at http://localhost:5173" -ForegroundColor Cyan
