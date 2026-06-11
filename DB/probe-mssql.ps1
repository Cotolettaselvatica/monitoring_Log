# Probe MSSQL: rete (TCP) + query opzionale (Windows auth o SQL auth).
#
# Uso (PowerShell):
#   .\probe-mssql.ps1
#   .\probe-mssql.ps1 -SqlHost 10.0.0.241
#   .\probe-mssql.ps1 -SqlHost 10.0.0.241 -UseWindowsAuth
#   .\probe-mssql.ps1 -SqlHost 10.0.0.241 -User sa -Password secret
param(
    [string]$SqlHost = "10.0.0.241",
    [int]$Port = 1433,
    [string]$Instance = "",
    [string]$Database = "master",
    [string]$User = "",
    [string]$Password = "",
    [switch]$UseWindowsAuth,
    [int]$TimeoutSec = 5
)

function Write-Probe([string]$Message) {
    Write-Host "[probe-mssql] $Message"
}

function Write-ProbeError([string]$Message) {
    Write-Host "[probe-mssql] ERRORE: $Message" -ForegroundColor Red
}

function Get-SqlServerName {
    param(
        [string]$SqlHost,
        [string]$Instance,
        [int]$Port
    )
    if ($Instance) {
        return "$SqlHost\$Instance"
    }
    if ($Port -ne 1433) {
        return "$SqlHost,$Port"
    }
    return $SqlHost
}

function Test-SqlTcp {
    param(
        [string]$SqlHost,
        [int]$Port,
        [int]$TimeoutSec
    )

    Write-Probe "Test TCP ${SqlHost}:${Port} (timeout ${TimeoutSec}s) ..."
    $result = Test-NetConnection -ComputerName $SqlHost -Port $Port -WarningAction SilentlyContinue
    if (-not $result.TcpTestSucceeded) {
        throw "TCP FAIL: ${SqlHost}:${Port} non raggiungibile"
    }
    Write-Probe "TCP OK: porta ${Port} raggiungibile su ${SqlHost}"
}

function Find-SqlCmd {
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        return (Get-Command sqlcmd).Source
    }

    $candidates = @(
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
        "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\130\Tools\Binn\SQLCMD.EXE"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Test-SqlQuery {
    param(
        [string]$Server,
        [string]$Database,
        [string]$User,
        [string]$Password,
        [bool]$UseWindowsAuth
    )

    $query = @"
SET NOCOUNT ON;
SELECT @@VERSION AS version;
SELECT name FROM sys.databases ORDER BY name;
"@

    if (Get-Module -ListAvailable -Name SqlServer) {
        Import-Module SqlServer -ErrorAction Stop
        Write-Probe "Test SQL via Invoke-Sqlcmd su ${Server}/${Database} ..."
        if ($UseWindowsAuth -or (-not $User)) {
            Invoke-Sqlcmd -ServerInstance $Server -Database $Database -Query $query -TrustServerCertificate
        }
        else {
            $secure = ConvertTo-SecureString $Password -AsPlainText -Force
            $cred = New-Object System.Management.Automation.PSCredential($User, $secure)
            Invoke-Sqlcmd -ServerInstance $Server -Database $Database -Query $query -Credential $cred -TrustServerCertificate
        }
        Write-Probe "SQL OK"
        return
    }

    $sqlcmd = Find-SqlCmd
    if (-not $sqlcmd) {
        Write-Probe "ATTENZIONE: sqlcmd/Invoke-Sqlcmd non disponibile; solo test TCP eseguito"
        Write-Probe "Installa SSMS oppure: Install-Module SqlServer -Scope CurrentUser"
        return
    }

    Write-Probe "Test SQL via sqlcmd su ${Server}/${Database} ..."
    if ($UseWindowsAuth -or (-not $User)) {
        & $sqlcmd -S $Server -d $Database -E -C -Q $query
    }
    else {
        & $sqlcmd -S $Server -d $Database -U $User -P $Password -C -Q $query
    }

    if ($LASTEXITCODE -ne 0) {
        throw "SQL FAIL: sqlcmd exit code $LASTEXITCODE"
    }

    Write-Probe "SQL OK"
}

try {
    $server = Get-SqlServerName -SqlHost $SqlHost -Instance $Instance -Port $Port
    Write-Probe "Target: $server (porta $Port)"
    Test-SqlTcp -SqlHost $SqlHost -Port $Port -TimeoutSec $TimeoutSec
    Test-SqlQuery -Server $server -Database $Database -User $User -Password $Password -UseWindowsAuth:$UseWindowsAuth.IsPresent
    Write-Probe "Probe completato"
    exit 0
}
catch {
    Write-ProbeError $_.Exception.Message
    exit 1
}
