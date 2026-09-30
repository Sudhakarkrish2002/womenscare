<?php
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if (empty($action) && !empty($input['action'])) {
    $action = $input['action'];
}

function sanitizeEmail($email) {
    return strtolower(trim($email ?? ''));
}

switch ($action) {
    case 'register':
        $name = trim($input['name'] ?? '');
        $email = sanitizeEmail($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $age = !empty($input['age']) ? intval($input['age']) : 26;
        $cycleLength = !empty($input['cycleLength']) ? intval($input['cycleLength']) : 28;
        $periodLength = !empty($input['periodLength']) ? intval($input['periodLength']) : 5;

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['error' => 'Please enter your full name']);
            exit();
        }

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Please enter a valid email address']);
            exit();
        }

        if (empty($password) || strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 6 characters']);
            exit();
        }

        // Check if email already exists
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE LOWER(email) = :email");
        $stmt->execute([':email' => $email]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'This email is already registered. Please sign in instead.']);
            exit();
        }

        $userId = 'usr_' . bin2hex(random_bytes(6));
        $sessionToken = bin2hex(random_bytes(24));
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        
        $profile = [
            'name' => $name,
            'age' => $age,
            'cycleLength' => $cycleLength,
            'periodLength' => $periodLength,
            'regularity' => $input['regularity'] ?? 'Regular (26-32 days)',
            'goals' => $input['goals'] ?? ['Track Cycle & Predict Period']
        ];
        $profileJson = json_encode($profile);

        $insertStmt = $pdo->prepare("
            INSERT INTO users (user_id, email, password_hash, name, session_token, onboarded, profile_json)
            VALUES (:uid, :email, :phash, :name, :token, 1, :pjson)
        ");
        $insertStmt->execute([
            ':uid' => $userId,
            ':email' => $email,
            ':phash' => $passwordHash,
            ':name' => $name,
            ':token' => $sessionToken,
            ':pjson' => $profileJson
        ]);

        // Insert initial baseline cycle if provided
        $lastPeriodDate = $input['lastPeriodDate'] ?? date('Y-m-d', strtotime('-14 days'));
        $cycleObj = [
            'id' => 1,
            'startDate' => $lastPeriodDate,
            'duration' => $periodLength,
            'cycleLength' => $cycleLength,
            'symptoms' => ['Mild Cramps']
        ];
        $cStmt = $pdo->prepare("INSERT INTO cycles (user_id, cycle_data) VALUES (:uid, :cdata)");
        $cStmt->execute([
            ':uid' => $userId,
            ':cdata' => json_encode($cycleObj)
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Account created successfully!',
            'user' => [
                'userId' => $userId,
                'name' => $name,
                'email' => $email,
                'onboarded' => true,
                'profile' => $profile,
                'sessionToken' => $sessionToken
            ]
        ]);
        break;

    case 'login':
        $email = sanitizeEmail($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email and password are required']);
            exit();
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = :email");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode([
                'error' => 'No account found with this email. Routing you to create a free account...',
                'code' => 'USER_NOT_FOUND',
                'email' => $email
            ]);
            exit();
        }

        if (empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode([
                'error' => 'Incorrect password. Please try again.',
                'code' => 'INVALID_PASSWORD'
            ]);
            exit();
        }

        // Generate refreshed session token
        $sessionToken = bin2hex(random_bytes(24));
        $updateToken = $pdo->prepare("UPDATE users SET session_token = :token WHERE user_id = :uid");
        $updateToken->execute([':token' => $sessionToken, ':uid' => $user['user_id']]);

        $profile = json_decode($user['profile_json'] ?? '{}', true) ?: [];

        echo json_encode([
            'status' => 'success',
            'message' => 'Welcome back, ' . htmlspecialchars($user['name'] ?? 'Friend') . '!',
            'user' => [
                'userId' => $user['user_id'],
                'name' => $user['name'] ?? ($profile['name'] ?? 'Friend'),
                'email' => $user['email'],
                'onboarded' => (bool)$user['onboarded'],
                'profile' => $profile,
                'sessionToken' => $sessionToken
            ]
        ]);
        break;

    case 'me':
        $token = '';
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        } elseif (!empty($_GET['token'])) {
            $token = trim($_GET['token']);
        } elseif (!empty($input['token'])) {
            $token = trim($input['token']);
        }

        if (empty($token)) {
            http_response_code(401);
            echo json_encode(['error' => 'Missing session token', 'authenticated' => false]);
            exit();
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE session_token = :token");
        $stmt->execute([':token' => $token]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Session expired or invalid', 'authenticated' => false]);
            exit();
        }

        $profile = json_decode($user['profile_json'] ?? '{}', true) ?: [];

        echo json_encode([
            'status' => 'success',
            'authenticated' => true,
            'user' => [
                'userId' => $user['user_id'],
                'name' => $user['name'] ?? ($profile['name'] ?? 'Friend'),
                'email' => $user['email'],
                'onboarded' => (bool)$user['onboarded'],
                'profile' => $profile
            ]
        ]);
        break;

    case 'logout':
        $token = '';
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        } elseif (!empty($input['token'])) {
            $token = trim($input['token']);
        }

        if (!empty($token)) {
            $stmt = $pdo->prepare("UPDATE users SET session_token = NULL WHERE session_token = :token");
            $stmt->execute([':token' => $token]);
        }

        echo json_encode(['status' => 'success', 'message' => 'Signed out successfully']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Supported: register, login, me, logout']);
        break;
}
