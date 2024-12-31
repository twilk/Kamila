$files = Get-ChildItem users/*.json
$total = $files.Count
$current = 0

foreach ($file in $files) {
    $current++
    $json = Get-Content $file | ConvertFrom-Json
    $url = "https://drive.google.com/uc?export=download&id=$($json.qrCodeUrl)"
    $outFile = "qrcodes/$($json.memberId).png"
    
    Write-Host "[$current/$total] Pobieranie $($file.Name) -> $outFile"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $outFile
        Write-Host "✅ Sukces" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Błąd: $_" -ForegroundColor Red
    }
} 