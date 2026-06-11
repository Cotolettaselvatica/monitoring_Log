# Ispeziona e ripristina un backup MSSQL (.bak) su SQL Server locale.
#
# Uso:
#   .\restore-mssql-backup.ps1 -BackupPath "C:\path\LMS_010_....bak"
#   .\restore-mssql-backup.ps1 -BackupPath "C:\path\file.bak" -InspectOnly
#   .\restore-mssql-backup.ps1 -BackupPath "C:\path\file.bak" -RestoreDatabaseName LMS_010_test
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$SqlServer = "localhost",
    [string]$RestoreDatabaseName = "",
    [string]$DataPath = "",
    [switch]$InspectOnly,
    [switch]$UseWindowsAuth,
    [string]$User = "",
    [string]$Password = ""
)

function Write-Step([string]$Message) {
    Write-Host "[restore-mssql] $Message"
}

function Write-Err([string]$Message) {
    Write-Host "[restore-mssql] ERRORE: $Message" -ForegroundColor Red
}

function Get-SqlTool {
    if (Get-Module -ListAvailable -Name SqlServer) {
        return "Invoke-Sqlcmd"
    }

    $sqlcmd = $null
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        $sqlcmd = (Get-Command sqlcmd).Source
    }
    else {
        $candidates = @(
            "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
            "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
        )
        foreach ($path in $candidates) {
            if (Test-Path $path) { $sqlcmd = $path; break }
        }
    }

    if ($sqlcmd) { return $sqlcmd }
    throw "Serve SSMS/sqlcmd oppure: Install-Module SqlServer -Scope CurrentUser"
}

function Invoke-Sql {
    param(
        [string]$Query,
        [switch]$AsDataTable
    )

    $tool = Get-SqlTool
    if ($tool -eq "Invoke-Sqlcmd") {
        Import-Module SqlServer -ErrorAction Stop
        $params = @{
            ServerInstance = $SqlServer
            Query          = $Query
            TrustServerCertificate = $true
        }
        if ($UseWindowsAuth -or -not $User) {
            if ($AsDataTable) { return Invoke-Sqlcmd @params }
            Invoke-Sqlcmd @params | Format-Table -AutoSize
            return
        }
        $secure = ConvertTo-SecureString $Password -AsPlainText -Force
        $params.Credential = New-Object System.Management.Automation.PSCredential($User, $secure)
        if ($AsDataTable) { return Invoke-Sqlcmd @params }
        Invoke-Sqlcmd @params | Format-Table -AutoSize
        return
    }

    $args = @("-S", $SqlServer, "-C", "-Q", $Query)
    if ($UseWindowsAuth -or -not $User) { $args += @("-E") }
    else { $args += @("-U", $User, "-P", $Password) }
    & $tool @args
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd exit code $LASTEXITCODE" }
}

function Get-DefaultDataPath {
    $rows = Invoke-Sql -Query "SELECT SERVERPROPERTY('InstanceDefaultDataPath') AS DataPath, SERVERPROPERTY('InstanceDefaultLogPath') AS LogPath;" -AsDataTable
    return [pscustomobject]@{
        DataPath = [string]$rows.DataPath
        LogPath  = [string]$rows.LogPath
    }
}

try {
    $BackupPath = (Resolve-Path $BackupPath).Path
    $sizeMb = [math]::Round((Get-Item $BackupPath).Length / 1MB, 2)
    Write-Step "Backup: $BackupPath ($sizeMb MB)"

    Write-Step "RESTORE HEADERONLY ..."
    Invoke-Sql -Query "RESTORE HEADERONLY FROM DISK = N'$BackupPath';"

    Write-Step "RESTORE FILELISTONLY ..."
    $fileList = Invoke-Sql -Query "RESTORE FILELISTONLY FROM DISK = N'$BackupPath';" -AsDataTable
    $fileList | Format-Table LogicalName, PhysicalName, Type, Size -AutoSize

    $originalDb = [string]$fileList[0].LogicalName
    if (-not $RestoreDatabaseName) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($BackupPath)
        if ($baseName -match '^(LMS_\d+)') {
            $RestoreDatabaseName = "$($Matches[1])_restore"
        }
        else {
            $RestoreDatabaseName = "${baseName}_restore"
        }
    }

    if ($InspectOnly) {
        Write-Step "InspectOnly: restore non eseguito"
        Write-Step "Suggerimento database: $RestoreDatabaseName"
        exit 0
    }

    $paths = Get-DefaultDataPath
    if (-not $DataPath) { $DataPath = $paths.DataPath }
    $logPath = $paths.LogPath

    $dataFile = Join-Path $DataPath "$RestoreDatabaseName.mdf"
    $logFile = Join-Path $logPath "$RestoreDatabaseName`_log.ldf"

    $logicalData = ($fileList | Where-Object { $_.Type -eq 'D' } | Select-Object -First 1).LogicalName
    $logicalLog = ($fileList | Where-Object { $_.Type -eq 'L' } | Select-Object -First 1).LogicalName
    if (-not $logicalData) { $logicalData = $originalDb }
    if (-not $logicalLog) { $logicalLog = "$logicalData`_log" }

    Write-Step "RESTORE DATABASE [$RestoreDatabaseName] ..."
    $restoreSql = @"
ALTER DATABASE [$RestoreDatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE IF EXISTS [$RestoreDatabaseName];
RESTORE DATABASE [$RestoreDatabaseName]
FROM DISK = N'$BackupPath'
WITH MOVE N'$logicalData' TO N'$dataFile',
     MOVE N'$logicalLog' TO N'$logFile',
     REPLACE,
     RECOVERY,
     STATS = 10;
"@

    try {
        Invoke-Sql -Query $restoreSql
    }
    catch {
        # se DROP fallisce perché non esiste, riprova solo RESTORE
        $restoreSql = @"
RESTORE DATABASE [$RestoreDatabaseName]
FROM DISK = N'$BackupPath'
WITH MOVE N'$logicalData' TO N'$dataFile',
     MOVE N'$logicalLog' TO N'$logFile',
     REPLACE,
     RECOVERY,
     STATS = 10;
"@
        Invoke-Sql -Query $restoreSql
    }

    Write-Step "Tabelle nel database ripristinato:"
    Invoke-Sql -Query @"
USE [$RestoreDatabaseName];
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
"@

    Write-Step "Top tabelle per righe (stima):"
    Invoke-Sql -Query @"
USE [$RestoreDatabaseName];
SELECT t.name AS table_name, SUM(p.rows) AS row_estimate
FROM sys.tables t
JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0,1)
GROUP BY t.name
ORDER BY row_estimate DESC;
"@

    Write-Step "Restore completato: [$RestoreDatabaseName]"
    exit 0
}
catch {
    Write-Err $_.Exception.Message
    exit 1
}
