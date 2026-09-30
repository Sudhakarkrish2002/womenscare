<?php
require_once __DIR__ . '/config.php';

try {
    $count = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    echo json_encode([
        'status' => 'ok',
        'service' => 'WomenCare PHP + SQLite API',
        'database' => 'connected',
        'sqlite_file' => 'womencare.sqlite',
        'total_users' => (int)$count,
        'timestamp' => date('c')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'database' => 'disconnected',
        'error' => $e->getMessage()
    ]);
}
