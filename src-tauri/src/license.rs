use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

// Đổi sang URL production khi phát hành chính thức.
const LICENSE_API_BASE: &str = "https://dev_api.bunna.dev";

#[derive(Serialize)]
pub struct LicenseResult {
    pub valid: bool,
    pub message: String,
}

#[derive(Deserialize)]
struct EncryptResponse {
    encrypted: String,
}

#[derive(Deserialize)]
struct DecryptResponse {
    decrypted: String,
}

/// Ký request kiểu HMAC giống ApiKeyAuthService bên bunna/api. Chạy hoàn toàn
/// ở phía Rust (không qua JS) để logic ký request và secret key không nằm
/// trong bundle JS có thể đọc được.
fn sign(secret_key: &str, method: &str, path: &str) -> Result<(String, String), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        .to_string();

    let payload = format!("{}:{}:{}", method, path, timestamp);
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes()).map_err(|e| e.to_string())?;
    mac.update(payload.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    Ok((signature, timestamp))
}

#[tauri::command]
pub async fn validate_license(public_key: String, secret_key: String) -> Result<LicenseResult, String> {
    if public_key.trim().is_empty() || secret_key.trim().is_empty() {
        return Ok(LicenseResult { valid: false, message: "Chưa nhập access key.".into() });
    }

    let path = "/license/aiflow/validate";
    let (signature, timestamp) = sign(&secret_key, "POST", path)?;
    let url = format!("{}{}", LICENSE_API_BASE, path);
    let client = reqwest::Client::new();

    let resp = match client
        .post(&url)
        .header("x-public-key", public_key)
        .header("x-signature", signature)
        .header("x-timestamp", timestamp)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(LicenseResult {
                valid: false,
                message: format!("Không kết nối được server license: {}", e),
            })
        }
    };

    if resp.status().is_success() {
        Ok(LicenseResult { valid: true, message: "OK".into() })
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Ok(LicenseResult {
            valid: false,
            message: format!("Access key không hợp lệ ({}): {}", status, body),
        })
    }
}

/// Mã hoá nội dung file .bunnaflow lúc export — key mã hoá nằm ở server,
/// không nhúng trong app. Cần access key hợp lệ mới gọi được.
#[tauri::command]
pub async fn encrypt_aiflow_file(public_key: String, secret_key: String, content: String) -> Result<String, String> {
    let path = "/license/aiflow/encrypt-file";
    let (signature, timestamp) = sign(&secret_key, "POST", path)?;
    let url = format!("{}{}", LICENSE_API_BASE, path);
    let client = reqwest::Client::new();

    let resp = client
        .post(&url)
        .header("x-public-key", public_key)
        .header("x-signature", signature)
        .header("x-timestamp", timestamp)
        .json(&json!({ "content": content }))
        .send()
        .await
        .map_err(|e| format!("Không kết nối được server license: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Không mã hoá được file ({}): {}", status, body));
    }

    let parsed: EncryptResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed.encrypted)
}

/// Giải mã nội dung file .bunnaflow lúc import.
#[tauri::command]
pub async fn decrypt_aiflow_file(public_key: String, secret_key: String, content: String) -> Result<String, String> {
    let path = "/license/aiflow/decrypt-file";
    let (signature, timestamp) = sign(&secret_key, "POST", path)?;
    let url = format!("{}{}", LICENSE_API_BASE, path);
    let client = reqwest::Client::new();

    let resp = client
        .post(&url)
        .header("x-public-key", public_key)
        .header("x-signature", signature)
        .header("x-timestamp", timestamp)
        .json(&json!({ "content": content }))
        .send()
        .await
        .map_err(|e| format!("Không kết nối được server license: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Không giải mã được file ({}): {}", status, body));
    }

    let parsed: DecryptResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parsed.decrypted)
}
