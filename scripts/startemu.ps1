param(
    [Parameter(Position = 0)]
    [string]$Avd = "Pixel_8"
)

emulator -avd $Avd -no-snapshot-load
