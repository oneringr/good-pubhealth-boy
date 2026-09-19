param(
    [string]$Url = 'https://virlab.swmu.edu.cn/'
)

$chromePath = 'C:\Users\ORR\AppData\Local\Programs\OCS Desktop\resources\bin\chrome\chrome\chrome.exe'
$profilePath = Join-Path $PSScriptRoot '.chrome-profile'

if (-not (Test-Path -LiteralPath $chromePath)) {
    throw "找不到 Chrome：$chromePath"
}

& $chromePath `
    "--user-data-dir=$profilePath" `
    '--no-first-run' `
    '--no-default-browser-check' `
    '--no-proxy-server' `
    "--load-extension=$PSScriptRoot" `
    '--new-window' `
    $Url
