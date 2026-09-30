<?php
require_once __DIR__ . '/config.php';

// Helper to extract userId
function getRequestedUserId() {
    if (!empty($_GET['userId'])) {
        return trim($_GET['userId']);
    }
    if (!empty($_SERVER['PATH_INFO'])) {
        $parts = explode('/', trim($_SERVER['PATH_INFO'], '/'));
        if (!empty($parts[0])) {
            return trim($parts[0]);
        }
    }
    // Also check query string if rewrite is used
    if (!empty($_SERVER['QUERY_STRING'])) {
        parse_str($_SERVER['QUERY_STRING'], $q);
        if (!empty($q['userId'])) {
            return trim($q['userId']);
        }
    }
    return null;
}

$userId = getRequestedUserId();
$method = $_SERVER['REQUEST_METHOD'];

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing userId parameter']);
    exit();
}

try {
    if ($method === 'GET') {
        // Fetch user profile
        $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :uid");
        $stmt->execute([':uid' => $userId]);
        $user = $stmt->fetch();

        if (!$user) {
            echo json_encode([
                'userId' => $userId,
                'onboarded' => false,
                'profile' => new stdClass(),
                'cycles' => [],
                'symptomLogs' => [],
                'lifestyleLogs' => []
            ]);
            exit();
        }

        // Fetch cycles
        $cStmt = $pdo->prepare("SELECT cycle_data FROM cycles WHERE user_id = :uid ORDER BY id ASC");
        $cStmt->execute([':uid' => $userId]);
        $cyclesRaw = $cStmt->fetchAll(PDO::FETCH_COLUMN);
        $cycles = array_map(function($item) { return json_decode($item, true); }, $cyclesRaw);

        // Fetch symptoms
        $sStmt = $pdo->prepare("SELECT log_data FROM symptom_logs WHERE user_id = :uid ORDER BY id ASC");
        $sStmt->execute([':uid' => $userId]);
        $symptomsRaw = $sStmt->fetchAll(PDO::FETCH_COLUMN);
        $symptomLogs = array_map(function($item) { return json_decode($item, true); }, $symptomsRaw);

        // Fetch lifestyle
        $lStmt = $pdo->prepare("SELECT log_data FROM lifestyle_logs WHERE user_id = :uid ORDER BY id ASC");
        $lStmt->execute([':uid' => $userId]);
        $lifestyleRaw = $lStmt->fetchAll(PDO::FETCH_COLUMN);
        $lifestyleLogs = array_map(function($item) { return json_decode($item, true); }, $lifestyleRaw);

        echo json_encode([
            'userId' => $userId,
            'onboarded' => (bool)$user['onboarded'],
            'profile' => json_decode($user['profile_json'], true) ?: new stdClass(),
            'cycles' => $cycles,
            'symptomLogs' => $symptomLogs,
            'lifestyleLogs' => $lifestyleLogs
        ]);
        exit();

    } elseif ($method === 'POST' || $method === 'PUT') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON payload']);
            exit();
        }

        $onboarded = !empty($payload['onboarded']) ? 1 : 0;
        $profileJson = json_encode(!empty($payload['profile']) ? $payload['profile'] : new stdClass());
        $cycles = !empty($payload['cycles']) && is_array($payload['cycles']) ? $payload['cycles'] : [];
        $symptomLogs = !empty($payload['symptomLogs']) && is_array($payload['symptomLogs']) ? $payload['symptomLogs'] : [];
        $lifestyleLogs = !empty($payload['lifestyleLogs']) && is_array($payload['lifestyleLogs']) ? $payload['lifestyleLogs'] : [];

        // Begin transaction
        $pdo->beginTransaction();

        // Upsert user
        $uStmt = $pdo->prepare("
            INSERT INTO users (user_id, onboarded, profile_json, updated_at) 
            VALUES (:uid, :onb, :prof, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET 
                onboarded = excluded.onboarded,
                profile_json = excluded.profile_json,
                updated_at = CURRENT_TIMESTAMP
        ");
        $uStmt->execute([
            ':uid' => $userId,
            ':onb' => $onboarded,
            ':prof' => $profileJson
        ]);

        // Replace cycles
        $delCycles = $pdo->prepare("DELETE FROM cycles WHERE user_id = :uid");
        $delCycles->execute([':uid' => $userId]);
        $insCycle = $pdo->prepare("INSERT INTO cycles (user_id, cycle_data) VALUES (:uid, :cdata)");
        foreach ($cycles as $c) {
            $insCycle->execute([':uid' => $userId, ':cdata' => json_encode($c)]);
        }

        // Replace symptom logs
        $delSymp = $pdo->prepare("DELETE FROM symptom_logs WHERE user_id = :uid");
        $delSymp->execute([':uid' => $userId]);
        $insSymp = $pdo->prepare("INSERT INTO symptom_logs (user_id, log_data) VALUES (:uid, :sdata)");
        foreach ($symptomLogs as $s) {
            $insSymp->execute([':uid' => $userId, ':sdata' => json_encode($s)]);
        }

        // Replace lifestyle logs
        $delLife = $pdo->prepare("DELETE FROM lifestyle_logs WHERE user_id = :uid");
        $delLife->execute([':uid' => $userId]);
        $insLife = $pdo->prepare("INSERT INTO lifestyle_logs (user_id, log_data) VALUES (:uid, :ldata)");
        foreach ($lifestyleLogs as $l) {
            $insLife->execute([':uid' => $userId, ':ldata' => json_encode($l)]);
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Data saved successfully to SQLite database',
            'data' => [
                'userId' => $userId,
                'onboarded' => (bool)$onboarded,
                'profile' => json_decode($profileJson, true),
                'cycles' => $cycles,
                'symptomLogs' => $symptomLogs,
                'lifestyleLogs' => $lifestyleLogs
            ]
        ]);
        exit();

    } elseif ($method === 'DELETE') {
        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM cycles WHERE user_id = :uid")->execute([':uid' => $userId]);
        $pdo->prepare("DELETE FROM symptom_logs WHERE user_id = :uid")->execute([':uid' => $userId]);
        $pdo->prepare("DELETE FROM lifestyle_logs WHERE user_id = :uid")->execute([':uid' => $userId]);
        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'User cycle and symptom data reset successfully'
        ]);
        exit();

    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
        exit();
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
    exit();
}
