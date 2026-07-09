# 모션 시트 → 개별 PNG (배경 투명화)
param(
    [string]$Src,
    [string]$OutDir,
    [string]$Prefix,
    [hashtable]$Poses
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$bmp = [System.Drawing.Bitmap]::FromFile($Src)

foreach ($pose in $Poses.Keys) {
    $r = $Poses[$pose]
    $out = New-Object System.Drawing.Bitmap($r.w, $r.h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $r.h; $y++) {
        for ($x = 0; $x -lt $r.w; $x++) {
            $p = $bmp.GetPixel($r.x + $x, $r.y + $y)
            if ($p.R -gt 235 -and $p.G -gt 235 -and $p.B -gt 235) { continue }
            [void]$out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
        }
    }
    $path = Join-Path $OutDir "$Prefix-$pose.png"
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Output $path
}
$bmp.Dispose()