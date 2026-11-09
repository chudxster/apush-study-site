# Local test server for Cram: serves this folder at http://127.0.0.1:8000/
# Run from PowerShell:   powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Other port:            ... -File .\serve.ps1 -Port 9000
# Stop with Ctrl+C. Progress saves per address, so testing here never touches
# your progress on the live site.
param([int]$Port = 8000)
$root = $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$Port/")
try { $l.Start() } catch {
  Write-Host "Port $Port is already in use (maybe Cram is already running there?)."
  Write-Host "Open http://127.0.0.1:$Port/ or run with another port: -Port 9000"
  exit 1
}
Write-Host "Cram running at http://127.0.0.1:$Port/  (Ctrl+C to stop)"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.json'='application/json'; '.mp3'='audio/mpeg'; '.wav'='audio/wav'; '.ico'='image/x-icon' }
try {
  while ($l.IsListening) {
    $c = $l.GetContext()
    try {
      $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
      if ($p -eq '') { $p = 'index.html' }
      $f = [IO.Path]::GetFullPath((Join-Path $root $p))
      if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
        $b = [IO.File]::ReadAllBytes($f)
        $ext = [IO.Path]::GetExtension($f).ToLower()
        if ($types.ContainsKey($ext)) { $c.Response.ContentType = $types[$ext] }
        $c.Response.Headers.Add('Cache-Control', 'no-store')
        $c.Response.OutputStream.Write($b, 0, $b.Length)
      } else { $c.Response.StatusCode = 404 }
    } catch { }   # the browser closed the connection early: ignore it
    finally { try { $c.Response.Close() } catch { } }
  }
} finally { if ($l.IsListening) { $l.Stop() } }
