# API Usage Examples

## Примеры использования AI Admin v2 API на разных языках

### JavaScript/Node.js

```javascript
const axios = require('axios');
const crypto = require('crypto');

// Конфигурация
const API_BASE_URL = 'https://api.ai-admin.com';
const API_KEY = 'your-api-key';
const WEBHOOK_SECRET = 'your-webhook-secret';

// 1. Проверка здоровья системы
async function checkHealth() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('System health:', response.data);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// 2. Отправка сообщения
async function sendMessage(phone, message) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/send-message`,
      { phone, message, companyId: 962302 },
      { headers: { 'X-API-Key': API_KEY } }
    );
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Failed to send message:', error.message);
  }
}

// 3. Обработка webhook
function handleWebhook(req, res) {
  const signature = req.headers['x-hub-signature'];
  const payload = JSON.stringify(req.body);
  
  // Проверяем подпись
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`;
    
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Обрабатываем сообщение
  console.log('Received message:', req.body);
  res.status(200).json({ success: true });
}
```

### Python

```python
import requests
import hmac
import hashlib
import json

# Конфигурация
API_BASE_URL = 'https://api.ai-admin.com'
API_KEY = 'your-api-key'
WEBHOOK_SECRET = 'your-webhook-secret'

# 1. Проверка здоровья системы
def check_health():
    try:
        response = requests.get(f'{API_BASE_URL}/health')
        response.raise_for_status()
        print('System health:', response.json())
    except requests.exceptions.RequestException as e:
        print(f'Health check failed: {e}')

# 2. Отправка сообщения
def send_message(phone, message):
    headers = {'X-API-Key': API_KEY}
    data = {
        'phone': phone,
        'message': message,
        'companyId': 962302
    }
    
    try:
        response = requests.post(
            f'{API_BASE_URL}/api/send-message',
            json=data,
            headers=headers
        )
        response.raise_for_status()
        print('Message sent:', response.json())
    except requests.exceptions.RequestException as e:
        print(f'Failed to send message: {e}')

# 3. Проверка webhook подписи
def verify_webhook_signature(payload, signature):
    expected_signature = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)

# 4. Получение метрик
def get_metrics():
    headers = {'X-API-Key': API_KEY}
    
    try:
        response = requests.get(
            f'{API_BASE_URL}/api/metrics',
            headers=headers
        )
        response.raise_for_status()
        metrics = response.json()
        
        print(f"Queue size: {metrics['queue']['waiting']}")
        print(f"Processing: {metrics['queue']['active']}")
        print(f"Success rate: {metrics['performance']['successRate']}%")
    except requests.exceptions.RequestException as e:
        print(f'Failed to get metrics: {e}')
```

### PHP

```php
<?php
// Конфигурация
define('API_BASE_URL', 'https://api.ai-admin.com');
define('API_KEY', 'your-api-key');
define('WEBHOOK_SECRET', 'your-webhook-secret');

// 1. Проверка здоровья системы
function checkHealth() {
    $ch = curl_init(API_BASE_URL . '/health');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        echo "System status: " . $data['status'] . "\n";
    } else {
        echo "Health check failed\n";
    }
}

// 2. Отправка сообщения
function sendMessage($phone, $message) {
    $data = [
        'phone' => $phone,
        'message' => $message,
        'companyId' => 962302
    ];
    
    $ch = curl_init(API_BASE_URL . '/api/send-message');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: ' . API_KEY
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        echo "Message sent successfully\n";
    } else {
        echo "Failed to send message: " . $response . "\n";
    }
}

// 3. Проверка webhook подписи
function verifyWebhookSignature($payload, $signature) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, WEBHOOK_SECRET);
    return hash_equals($expectedSignature, $signature);
}

// 4. Обработка webhook
function handleWebhook() {
    $headers = getallheaders();
    $signature = $headers['X-Hub-Signature'] ?? '';
    $payload = file_get_contents('php://input');
    
    if (!verifyWebhookSignature($payload, $signature)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid signature']);
        return;
    }
    
    $data = json_decode($payload, true);
    
    // Обрабатываем сообщение
    error_log('Received message from: ' . $data['from']);
    error_log('Message: ' . $data['body']);
    
    http_response_code(200);
    echo json_encode(['success' => true]);
}
?>
```

### Ruby

```ruby
require 'net/http'
require 'json'
require 'openssl'

# Конфигурация
API_BASE_URL = 'https://api.ai-admin.com'
API_KEY = 'your-api-key'
WEBHOOK_SECRET = 'your-webhook-secret'

# 1. Проверка здоровья системы
def check_health
  uri = URI("#{API_BASE_URL}/health")
  response = Net::HTTP.get_response(uri)
  
  if response.code == '200'
    data = JSON.parse(response.body)
    puts "System health: #{data['status']}"
  else
    puts "Health check failed"
  end
rescue => e
  puts "Error: #{e.message}"
end

# 2. Отправка сообщения
def send_message(phone, message)
  uri = URI("#{API_BASE_URL}/api/send-message")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  request = Net::HTTP::Post.new(uri)
  request['Content-Type'] = 'application/json'
  request['X-API-Key'] = API_KEY
  request.body = {
    phone: phone,
    message: message,
    companyId: 962302
  }.to_json
  
  response = http.request(request)
  
  if response.code == '200'
    puts "Message sent successfully"
  else
    puts "Failed to send message: #{response.body}"
  end
rescue => e
  puts "Error: #{e.message}"
end

# 3. Проверка webhook подписи
def verify_webhook_signature(payload, signature)
  expected_signature = 'sha256=' + OpenSSL::HMAC.hexdigest(
    OpenSSL::Digest.new('sha256'),
    WEBHOOK_SECRET,
    payload
  )
  
  signature == expected_signature
end

# 4. Получение метрик
def get_metrics
  uri = URI("#{API_BASE_URL}/api/metrics")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  request = Net::HTTP::Get.new(uri)
  request['X-API-Key'] = API_KEY
  
  response = http.request(request)
  
  if response.code == '200'
    metrics = JSON.parse(response.body)
    puts "Queue waiting: #{metrics['queue']['waiting']}"
    puts "Success rate: #{metrics['performance']['successRate']}%"
  else
    puts "Failed to get metrics"
  end
rescue => e
  puts "Error: #{e.message}"
end
```

### Go

```go
package main

import (
    "bytes"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

const (
    API_BASE_URL   = "https://api.ai-admin.com"
    API_KEY        = "your-api-key"
    WEBHOOK_SECRET = "your-webhook-secret"
)

// HealthResponse структура ответа health check
type HealthResponse struct {
    Status   string            `json:"status"`
    Services map[string]string `json:"services"`
    Uptime   int              `json:"uptime"`
}

// MessageRequest структура запроса отправки сообщения
type MessageRequest struct {
    Phone     string `json:"phone"`
    Message   string `json:"message"`
    CompanyID int    `json:"companyId"`
}

// 1. Проверка здоровья системы
func checkHealth() error {
    resp, err := http.Get(API_BASE_URL + "/health")
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    var health HealthResponse
    if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
        return err
    }
    
    fmt.Printf("System health: %s\n", health.Status)
    return nil
}

// 2. Отправка сообщения
func sendMessage(phone, message string) error {
    payload := MessageRequest{
        Phone:     phone,
        Message:   message,
        CompanyID: 962302,
    }
    
    jsonData, err := json.Marshal(payload)
    if err != nil {
        return err
    }
    
    req, err := http.NewRequest("POST", API_BASE_URL+"/api/send-message", bytes.NewBuffer(jsonData))
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-API-Key", API_KEY)
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode == 200 {
        fmt.Println("Message sent successfully")
    } else {
        body, _ := ioutil.ReadAll(resp.Body)
        fmt.Printf("Failed to send message: %s\n", string(body))
    }
    
    return nil
}

// 3. Проверка webhook подписи
func verifyWebhookSignature(payload []byte, signature string) bool {
    h := hmac.New(sha256.New, []byte(WEBHOOK_SECRET))
    h.Write(payload)
    expectedSignature := "sha256=" + hex.EncodeToString(h.Sum(nil))
    
    return hmac.Equal([]byte(expectedSignature), []byte(signature))
}

// 4. Обработчик webhook
func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-Hub-Signature")
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Bad request", http.StatusBadRequest)
        return
    }
    
    if !verifyWebhookSignature(body, signature) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    var message map[string]interface{}
    if err := json.Unmarshal(body, &message); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }
    
    fmt.Printf("Received message from: %s\n", message["from"])
    fmt.Printf("Message: %s\n", message["body"])
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func main() {
    // Пример использования
    if err := checkHealth(); err != nil {
        fmt.Printf("Health check error: %v\n", err)
    }
    
    if err := sendMessage("79001234567", "Test message"); err != nil {
        fmt.Printf("Send message error: %v\n", err)
    }
}
```

## Обработка ошибок

Все языки должны обрабатывать следующие типы ошибок:

1. **Сетевые ошибки** - таймауты, отсутствие соединения
2. **HTTP ошибки** - 4xx и 5xx статусы
3. **Rate limiting** - 429 ошибки с Retry-After заголовком
4. **Validation errors** - неверный формат данных

## Best Practices

1. **Используйте экспоненциальный backoff** для повторных попыток
2. **Кешируйте** результаты health check на 30 секунд
3. **Логируйте** все ошибки с request ID для отладки
4. **Валидируйте** данные перед отправкой
5. **Используйте connection pooling** для производительности