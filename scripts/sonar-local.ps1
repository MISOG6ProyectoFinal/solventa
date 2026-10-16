# Starts the same local SonarQube the CI jobs use and scans one project.
# The password is the local Sonarless default. It is not a deployed secret.

$ErrorActionPreference = "Stop"

$SonarRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SonarImage = "sonarqube:25.5.0.107428-community"
$ScannerImage = "sonarsource/sonar-scanner-cli:11.3"
$SonarContainer = "sonar-server"
$SonarNetwork = "sonarless"
$SonarPort = 9234
$SonarPassword = "Son@rless123"

function Get-SonarUrl {
    "http://localhost:${SonarPort}"
}

function Invoke-SonarApi {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [string]$User = "admin:${SonarPassword}",
        [string]$Body
    )

    $curlArgs = @("-s", "-u", $User, "-X", $Method, "$(Get-SonarUrl)$Path")
    if ($Body) {
        $curlArgs += @("-d", $Body)
    }
    $raw = & curl.exe @curlArgs
    if ($LASTEXITCODE -ne 0) {
        throw "SonarQube no respondió en $(Get-SonarUrl)$Path"
    }
    if (-not $raw) {
        return $null
    }
    return $raw | ConvertFrom-Json
}

function Wait-SonarUp {
    Write-Host "Esperando a SonarQube..."
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $status = Invoke-SonarApi -Path "/api/system/status"
        } catch {
            $status = $null
        }
        if ($status.status -eq "UP") {
            Write-Host "SonarQube listo en $(Get-SonarUrl)"
            return
        }
        Start-Sleep -Seconds 5
    }
    throw "SonarQube no arrancó. Revise 'docker logs ${SonarContainer}'."
}

function Start-SonarServer {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker no está en ejecución."
    }

    docker network inspect $SonarNetwork *> $null
    if ($LASTEXITCODE -ne 0) {
        docker network create $SonarNetwork | Out-Null
    }

    docker inspect $SonarContainer *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Arrancando SonarQube local..."
        docker run -d --name $SonarContainer -p "${SonarPort}:9000" --network $SonarNetwork $SonarImage | Out-Null
    } else {
        docker start $SonarContainer | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo arrancar ${SonarContainer}."
    }

    Wait-SonarUp
    try {
        Invoke-SonarApi -User "admin:admin" -Method POST -Path "/api/users/change_password" -Body "login=admin&previousPassword=admin&password=${SonarPassword}" | Out-Null
    } catch {
        # The local password was already changed on a previous run.
    }
}

function New-SonarToken {
    param([string]$ProjectName)

    try {
        Invoke-SonarApi -Method POST -Path "/api/projects/create?name=$ProjectName&project=$ProjectName" | Out-Null
    } catch {
        # The project already exists from a previous scan.
    }
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $created = Invoke-SonarApi -Method POST -Path "/api/user_tokens/generate?name=local-$ProjectName-$stamp"
    if (-not $created.token) {
        throw "No se pudo crear el token local de SonarQube."
    }
    return $created.token
}

function Wait-SonarAnalysis {
    param([string]$ProjectName)

    Write-Host "Esperando el resultado del análisis..."
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $status = Invoke-SonarApi -Path "/api/qualitygates/project_status?projectKey=$ProjectName"
        if ($status.projectStatus.status -and $status.projectStatus.status -ne "NONE") {
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "El análisis de $ProjectName no terminó."
}

function Get-SonarMetric {
    param($Measures, [string]$Name)

    $found = $Measures.component.measures | Where-Object { $_.metric -eq $Name } | Select-Object -First 1
    if (-not $found -or $found.value -eq $null -or $found.value -eq "") {
        return $null
    }
    return [double]$found.value
}

function Get-SonarCodeRef {
    param($Item, [string]$ProjectName)

    $path = [string]$Item.component
    $prefix = "${ProjectName}:"
    if ($path.StartsWith($prefix)) {
        $path = $path.Substring($prefix.Length)
    }
    $start = $Item.line
    $range = $Item.textRange
    if (-not $start -and $range) {
        $start = $range.startLine
    }
    if (-not $start) {
        return $path
    }
    $end = if ($range -and $range.endLine) { $range.endLine } else { $start }
    if ($range -and $null -ne $range.startOffset -and "$end" -eq "$start") {
        $column = [int]$range.startOffset + 1
        $columnEnd = if ($null -ne $range.endOffset) { [int]$range.endOffset } else { $column }
        return "${path}:${start}:${column}-${columnEnd}"
    }
    if ("$end" -ne "$start") {
        return "${path}:${start}-${end}"
    }
    return "${path}:${start}"
}

function Write-SonarExtraLocations {
    param($Item, [string]$ProjectName, [string]$Primary)

    foreach ($flow in @($Item.flows)) {
        if (-not $flow) {
            continue
        }
        foreach ($location in @($flow.locations)) {
            if (-not $location) {
                continue
            }
            $extra = Get-SonarCodeRef -Item $location -ProjectName $ProjectName
            if ($extra -eq $Primary) {
                continue
            }
            if ($location.msg) {
                Write-Host "  $extra | $($location.msg)"
            } else {
                Write-Host "  $extra"
            }
        }
    }
}

function Get-SonarCollection {
    param(
        [string]$Path,
        [string]$ArrayName
    )

    $page = 1
    $pageSize = 500
    $items = New-Object System.Collections.Generic.List[object]
    $total = 0
    while ($page -le 40) {
        $separator = if ($Path.Contains("?")) { "&" } else { "?" }
        $payload = Invoke-SonarApi -Path "${Path}${separator}ps=${pageSize}&p=${page}"
        if ($payload.paging -and $null -ne $payload.paging.total) {
            $total = [int]$payload.paging.total
        } elseif ($null -ne $payload.total) {
            $total = [int]$payload.total
        }
        $batch = @($payload.$ArrayName | Where-Object { $_ })
        foreach ($entry in $batch) {
            $items.Add($entry) | Out-Null
        }
        if ($batch.Count -lt $pageSize) {
            break
        }
        $page++
    }
    if ($items.Count -ne $total) {
        throw "El listado de ${ArrayName} devolvió $($items.Count) de ${total}."
    }
    return ,$items
}

function Show-SonarResults {
    param(
        [string]$ProjectName,
        [array]$Gate
    )

    $metricKeys = ($Gate | ForEach-Object { $_.Metric }) -join ","
    $measures = Invoke-SonarApi -Path "/api/measures/component?component=$ProjectName&metricKeys=$metricKeys"
    $issueItems = Get-SonarCollection -Path "/api/issues/search?componentKeys=$ProjectName&issueStatuses=OPEN,CONFIRMED" -ArrayName "issues"
    $hotspotItems = Get-SonarCollection -Path "/api/hotspots/search?projectKey=$ProjectName" -ArrayName "hotspots"

    Write-Host ""
    Write-Host "Problemas"
    Write-Host "---------"
    if ($issueItems.Count -eq 0) {
        Write-Host "Ninguno."
    } else {
        foreach ($issue in $issueItems) {
            $location = Get-SonarCodeRef -Item $issue -ProjectName $ProjectName
            Write-Host "$($issue.rule) | ${location} | $($issue.message)"
            Write-SonarExtraLocations -Item $issue -ProjectName $ProjectName -Primary $location
        }
        Write-Host "Total: $($issueItems.Count)"
    }

    Write-Host ""
    Write-Host "Hotspots"
    Write-Host "--------"
    if ($hotspotItems.Count -eq 0) {
        Write-Host "Ninguno."
    } else {
        foreach ($hotspot in $hotspotItems) {
            $location = Get-SonarCodeRef -Item $hotspot -ProjectName $ProjectName
            Write-Host "$($hotspot.ruleKey) | ${location} | $($hotspot.message)"
            Write-SonarExtraLocations -Item $hotspot -ProjectName $ProjectName -Primary $location
        }
        Write-Host "Total: $($hotspotItems.Count)"
    }

    Write-Host ""
    Write-Host "Quality gate"
    Write-Host "------------"
    $failed = $false
    foreach ($rule in $Gate) {
        $value = Get-SonarMetric $measures $rule.Metric
        if ($null -eq $value) {
            Write-Host "Falta la métrica $($rule.Label)."
            $failed = $true
            continue
        }
        $comparison = if ($rule.Minimum) { "mínimo $($rule.Limit)$($rule.Suffix)" } else { "máximo $($rule.Limit)$($rule.Suffix)" }
        Write-Host "$($rule.Label): $value$($rule.Suffix) ($comparison)"
        $outside = if ($rule.Minimum) { $value -lt $rule.Limit } else { $value -gt $rule.Limit }
        if ($outside) {
            $failed = $true
        }
    }

    Write-Host ""
    if ($failed) {
        Write-Host "El quality gate no pasó."
        exit 1
    }
    Write-Host "El quality gate pasó."
}

function Invoke-SonarLocalScan {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string]$Sources,
        [hashtable]$Properties = @{},
        [Parameter(Mandatory = $true)]
        [array]$Gate
    )

    Start-SonarServer
    $token = New-SonarToken $ProjectName
    $options = @("-Dsonar.projectKey=$ProjectName", "-Dsonar.sources=$Sources")
    foreach ($key in $Properties.Keys) {
        $options += "-D${key}=$($Properties[$key])"
    }

    Write-Host "Escaneando $ProjectName..."
    docker run --rm --network $SonarNetwork `
        -e SONAR_HOST_URL="http://${SonarContainer}:9000" `
        -e SONAR_TOKEN="$token" `
        -e "SONAR_SCANNER_OPTS=$($options -join ' ')" `
        -v "${SonarRepoRoot}:/usr/src" `
        $ScannerImage
    if ($LASTEXITCODE -ne 0) {
        throw "El escáner de SonarQube falló."
    }

    Wait-SonarAnalysis $ProjectName
    Show-SonarResults -ProjectName $ProjectName -Gate $Gate
}
