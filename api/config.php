<?php
// Enable error reporting during development
error_reporting(E_ALL);
ini_set('display_errors', 0);

// CORS and JSON Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($requestMethod === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dbDir = __DIR__ . '/../database';
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}

$dbPath = $dbDir . '/womencare.sqlite';

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Initialize Schema
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            name TEXT,
            session_token TEXT,
            onboarded INTEGER DEFAULT 0,
            profile_json TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            cycle_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS symptom_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            log_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS lifestyle_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            log_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Dynamic column migration for users table
    $tableColsStmt = $pdo->query("PRAGMA table_info(users)");
    $existingCols = [];
    while ($col = $tableColsStmt->fetch()) {
        $existingCols[] = strtolower($col['name']);
    }

    $neededCols = [
        'email' => 'TEXT',
        'password_hash' => 'TEXT',
        'name' => 'TEXT',
        'session_token' => 'TEXT'
    ];

    foreach ($neededCols as $colName => $colDef) {
        if (!in_array($colName, $existingCols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN {$colName} {$colDef}");
        }
    }

    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database connection failed',
        'message' => $e->getMessage()
    ]);
    exit();
}
