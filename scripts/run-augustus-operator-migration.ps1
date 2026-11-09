$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$resultFile = Join-Path (Get-Location) 'work\augustus-migration-result.local'
$result = @{ status = 'WAITING_FOR_OPERATOR'; executionEnabled = $false }
$result | ConvertTo-Json | Set-Content -LiteralPath $resultFile
Write-Host 'AUGUSTUS92 Production migration only. No orders or execution enablement.'
Write-Host 'Enter the operator Neon connection at the hidden prompt. Never paste it into chat.'
$migrationSecret = Read-Host 'Migration connection URL' -AsSecureString
try {
  $env:DATABASE_MIGRATION_URL = [System.Net.NetworkCredential]::new('', $migrationSecret).Password
  node scripts/check-augustus-migration-target.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Production target verification failed.' }
  npm.cmd run augustus:hosted:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed or commit was not confirmed.' }
  $result.status = 'MIGRATION_APPLIED'; $result.next = 'Runtime grants, RLS and hosted validation remain required.'
  Write-Host 'Migration applied. Runtime-role and hosted validation remain pending.'
}
catch {
  $result.status = 'BLOCKED'; $result.next = 'Operator must verify connection and Production scope; no secret details recorded.'
  Write-Host 'Migration blocked or not confirmed. No secret details recorded.'
}
finally {
  Remove-Item Env:DATABASE_MIGRATION_URL -ErrorAction SilentlyContinue
  $migrationSecret.Dispose()
  Remove-Variable migrationSecret -ErrorAction SilentlyContinue
  $result | ConvertTo-Json | Set-Content -LiteralPath $resultFile
}
