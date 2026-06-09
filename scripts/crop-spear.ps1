Add-Type -AssemblyName System.Drawing

$inputPath = "d:\eco_clean_map\eco_clean_map\assets\sketches\line-spear.png"
$outputPath = "d:\eco_clean_map\eco_clean_map\assets\sketches\line-spear.png"
$tmpPath = "d:\eco_clean_map\eco_clean_map\assets\sketches\line-spear-cropped.png"

$src = [System.Drawing.Bitmap]::FromFile($inputPath)
$w = $src.Width
$h = $src.Height
Write-Output "Source: ${w}x${h}"

# Keep left panel only — seam/duplicate starts ~72% across
$cropW = [int][Math]::Floor($w * 0.72)
$rect = New-Object System.Drawing.Rectangle 0, 0, $cropW, $h
$dst = $src.Clone($rect, $src.PixelFormat)

$dst.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$dst.Dispose()

Move-Item -Force $tmpPath $outputPath
Write-Output "Cropped to ${cropW}x${h}"
