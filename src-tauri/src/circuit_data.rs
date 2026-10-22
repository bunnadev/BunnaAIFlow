//! Thư mục dữ liệu riêng cho Xưởng vẽ mạch (mạch, linh kiện tự thêm, ảnh nền) — mặc định nằm
//! trong thư mục dữ liệu app, người dùng có thể chuyển ra chỗ khác (VD ổ ngoài, để Claude Cowork
//! đọc/ghi được và còn nguyên khi cài lại máy). Đường dẫn lưu ở settings.json → "circuitDataDir".

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

pub const CIRCUIT_DIRS: [&str; 3] = ["circuits", "circuit-parts", "circuit-backgrounds"];
const SETTING_KEY: &str = "circuitDataDir";

fn read_settings(data: &Path) -> serde_json::Map<String, serde_json::Value> {
    fs::read_to_string(data.join("settings.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

/// Thư mục mạch tự chọn, hoặc None nếu đang dùng mặc định (chính thư mục dữ liệu app).
pub fn custom_dir(data: &Path) -> Option<PathBuf> {
    let p = PathBuf::from(read_settings(data).get(SETTING_KEY)?.as_str()?.trim());
    (p.is_absolute() && p != data).then_some(p)
}

pub fn copy_dir_all(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let to = dst.join(entry.file_name());
        if ft.is_dir() {
            copy_dir_all(&entry.path(), &to)?;
        } else if ft.is_file() {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

fn has_entries(dir: &Path) -> bool {
    fs::read_dir(dir).map(|mut d| d.any(|e| e.map_or(false, |e| e.file_name() != ".DS_Store"))).unwrap_or(false)
}

/// Thay `dst` bằng bản chép của `src` (có thể khác ổ đĩa nên không rename thẳng được):
/// chép ra thư mục tạm cạnh `dst` trước, xong mới đổi chỗ — hỏng giữa chừng thì `dst` còn nguyên.
pub fn replace_dir(src: &Path, dst: &Path, tag: &str) -> io::Result<()> {
    let name = dst.file_name().and_then(|n| n.to_str()).unwrap_or("dir").to_string();
    let parent = dst.parent().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "đường dẫn không hợp lệ"))?;
    fs::create_dir_all(parent)?;
    let staging = parent.join(format!("{name}.{tag}-new"));
    let old = parent.join(format!("{name}.{tag}-old"));
    let _ = fs::remove_dir_all(&staging);
    if let Err(e) = copy_dir_all(src, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    if dst.exists() {
        fs::rename(dst, &old)?;
    }
    if let Err(e) = fs::rename(&staging, dst) {
        let _ = fs::rename(&old, dst);
        return Err(e);
    }
    let _ = fs::remove_dir_all(&old);
    Ok(())
}

#[derive(Serialize, Debug)]
pub struct MoveResult {
    /// Thư mục con đã chuyển sang chỗ mới.
    moved: Vec<String>,
    /// Thư mục con mà chỗ mới đã có dữ liệu sẵn → dùng luôn, dữ liệu cũ để nguyên.
    kept: Vec<String>,
}

/// Chuyển 3 thư mục con sang `to` (None = về mặc định) rồi ghi settings.json.
/// Chỗ mới đã có dữ liệu thì không ghi đè — dùng luôn dữ liệu đó (VD cài lại máy rồi chọn lại ổ ngoài).
pub fn move_to(data: &Path, to: Option<&Path>) -> Result<MoveResult, String> {
    let from = custom_dir(data).unwrap_or_else(|| data.to_path_buf());
    let target = to.map(Path::to_path_buf).unwrap_or_else(|| data.to_path_buf());
    if !target.is_absolute() {
        return Err("Đường dẫn thư mục không hợp lệ.".into());
    }
    let mut res = MoveResult { moved: vec![], kept: vec![] };
    if target != from {
        fs::create_dir_all(&target).map_err(|e| format!("Không tạo được thư mục {}: {e}", target.display()))?;
        for sub in CIRCUIT_DIRS {
            let (src, dst) = (from.join(sub), target.join(sub));
            if has_entries(&dst) {
                res.kept.push(sub.into());
            } else if src.exists() {
                replace_dir(&src, &dst, "move").map_err(|e| format!("Không chép được {sub}: {e}"))?;
                fs::remove_dir_all(&src).map_err(|e| format!("Đã chép {sub} nhưng không xoá được bản cũ: {e}"))?;
                res.moved.push(sub.into());
            }
        }
    }
    let mut settings = read_settings(data);
    if target == data {
        settings.remove(SETTING_KEY);
    } else {
        settings.insert(SETTING_KEY.into(), target.to_string_lossy().into_owned().into());
    }
    let json = serde_json::to_string_pretty(&serde_json::Value::Object(settings)).map_err(|e| e.to_string())?;
    let tmp = data.join("settings.json.tmp");
    fs::write(&tmp, json).and_then(|_| fs::rename(&tmp, data.join("settings.json")))
        .map_err(|e| format!("Đã chuyển dữ liệu nhưng không lưu được cài đặt: {e}"))?;
    Ok(res)
}

#[tauri::command]
pub async fn circuit_data_move(app: AppHandle, to: Option<String>) -> Result<MoveResult, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || move_to(&data, to.as_deref().map(Path::new)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmpdir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("bunna-circuitdata-test-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn move_out_and_back_keeps_files_and_other_settings() {
        let root = tmpdir("mv");
        let data = root.join("app");
        let ext = root.join("ext");
        fs::create_dir_all(data.join("circuits")).unwrap();
        fs::create_dir_all(data.join("circuit-parts")).unwrap();
        fs::write(data.join("circuits/a.json"), "a").unwrap();
        fs::write(data.join("circuit-parts/p.png"), [1u8]).unwrap();
        fs::write(data.join("settings.json"), r#"{"psuName":"Sugon"}"#).unwrap();

        let r = move_to(&data, Some(&ext)).unwrap();
        assert_eq!(r.moved, vec!["circuits", "circuit-parts"]);
        assert_eq!(fs::read_to_string(ext.join("circuits/a.json")).unwrap(), "a");
        assert!(!data.join("circuits").exists());
        assert_eq!(custom_dir(&data), Some(ext.clone()));
        assert_eq!(read_settings(&data)["psuName"], "Sugon");

        move_to(&data, None).unwrap();
        assert_eq!(fs::read_to_string(data.join("circuits/a.json")).unwrap(), "a");
        assert!(!ext.join("circuits").exists());
        assert_eq!(custom_dir(&data), None);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn target_with_existing_data_is_used_not_overwritten() {
        let root = tmpdir("keep");
        let data = root.join("app");
        let ext = root.join("ext");
        fs::create_dir_all(data.join("circuits")).unwrap();
        fs::write(data.join("circuits/old.json"), "old").unwrap();
        fs::create_dir_all(ext.join("circuits")).unwrap();
        fs::write(ext.join("circuits/new.json"), "new").unwrap();

        let r = move_to(&data, Some(&ext)).unwrap();
        assert_eq!(r.kept, vec!["circuits"]);
        assert!(data.join("circuits/old.json").exists());
        assert!(!ext.join("circuits/old.json").exists());
        assert_eq!(custom_dir(&data), Some(ext));
        fs::remove_dir_all(&root).unwrap();
    }
}
