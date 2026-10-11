use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

// `tauri dev` (debug) → dev API, `tauri build` (release) → production API.
// Ghi đè lúc build bằng biến môi trường BUNNA_LICENSE_API, ví dụ build bản
// release nhưng vẫn trỏ về dev để test:
//   BUNNA_LICENSE_API=https://dev_api_mac.bunna.dev npm run tauri build
const LICENSE_API_BASE: &str = match option_env!("BUNNA_LICENSE_API") {
    Some(url) => url,
    None if cfg!(debug_assertions) => "https://dev_api_mac.bunna.dev",
    None => "https://api.bunna.dev",
};

#[derive(Serialize)]
pub struct LicenseResult {
    pub valid: bool,
    pub message: String,
    /// true = server đã thực sự xác nhận access key sai (nên khoá app ngay).
    /// false = lỗi mạng hoặc lỗi tạm thời phía server khi đang kiểm tra lại
    /// định kỳ — không phải key sai, nên KHÔNG được khoá phiên đang mở.
    pub definitive: bool,
}

/// Body lỗi server license trả về, dùng để phân biệt "key thật sự sai" với
/// "server đang tự gặp sự cố" (error = INTERNAL_ERROR) — 2 trường hợp cần xử
/// lý khác nhau ở phía app.
#[derive(Deserialize, Default)]
struct LicenseErrorBody {
    error: Option<String>,
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
        return Ok(LicenseResult { valid: false, message: "Chưa nhập access key.".into(), definitive: true });
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
        Err(_) => {
            return Ok(LicenseResult {
                valid: false,
                message: "Không kết nối được server license. Kiểm tra kết nối mạng, app sẽ tự thử lại.".into(),
                definitive: false,
            })
        }
    };

    if resp.status().is_success() {
        Ok(LicenseResult { valid: true, message: "OK".into(), definitive: true })
    } else {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        let parsed: LicenseErrorBody = serde_json::from_str(&body_text).unwrap_or_default();

        // "INTERNAL_ERROR" nghĩa là chính server license đang lỗi, không phải
        // access key sai — cùng với mọi lỗi 5xx, đây là lỗi tạm thời phía
        // server, KHÔNG nên khoá phiên đang mở. Chỉ 401/403 kèm lý do xác thực
        // thật sự mới coi là key sai và khoá ngay.
        let is_server_side_issue = status.is_server_error() || parsed.error.as_deref() == Some("INTERNAL_ERROR");
        let is_auth_rejection = (status.as_u16() == 401 || status.as_u16() == 403) && !is_server_side_issue;

        let message = if is_auth_rejection {
            "Access key không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại key hoặc liên hệ để được cấp key mới.".to_string()
        } else {
            "Không xác thực được access key do server license đang gặp sự cố tạm thời. App sẽ tự thử lại sau.".to_string()
        };

        Ok(LicenseResult { valid: false, message, definitive: is_auth_rejection })
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
