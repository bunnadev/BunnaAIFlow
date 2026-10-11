//! Sao lưu / khôi phục toàn bộ thư mục dữ liệu app (workflow, mạch, linh kiện tự thêm,
//! media, cài đặt) thành 1 file .zip — để cài lại máy / chuyển sang Mac khác.

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const MANIFEST: &str = "bunna-backup.json";
/// File nằm ngay gốc thư mục dữ liệu — có 1 trong số này mới coi là bản sao lưu của app.
const ROOT_MARKERS: [&str; 3] = [MANIFEST, "workspaces.json", "settings.json"];

#[derive(Serialize)]
pub struct BackupResult {
    files: usize,
    bytes: u64,
    /// Khôi phục: bản sao lưu tự động dữ liệu cũ trước khi ghi đè.
    safety_path: Option<String>,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| format!("Không tìm thấy thư mục dữ liệu: {e}"))
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn collect_files(dir: &Path, base: &Path, out: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        if name == ".DS_Store" {
            continue;
        }
        let ft = entry.file_type()?;
        if ft.is_dir() {
            collect_files(&path, base, out)?;
        } else if ft.is_file() {
            out.push(path.strip_prefix(base).unwrap_or(&path).to_path_buf());
        }
    }
    Ok(())
}

/// Media đã nén sẵn (ảnh, video, âm thanh): lưu nguyên, nén lại chỉ tốn thời gian.
fn already_compressed(rel: &Path) -> bool {
    matches!(
        rel.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "mp4" | "mov" | "webm" | "mp3" | "m4a" | "aac" | "ogg" | "zip")
    )
}

fn write_zip(src: &Path, dest: &Path) -> Result<BackupResult, String> {
    let mut files = Vec::new();
    collect_files(src, src, &mut files).map_err(|e| format!("Không đọc được thư mục dữ liệu: {e}"))?;
    files.sort();
    // Ghi ra file tạm rồi mới đổi tên: hỏng giữa chừng không để lại file .zip dở
    let tmp = dest.with_extension("zip.part");
    let out = File::create(&tmp).map_err(|e| format!("Không tạo được file sao lưu: {e}"))?;
    let mut zip = ZipWriter::new(io::BufWriter::new(out));
    let mut bytes = 0u64;
    let result = (|| -> Result<(), String> {
        let manifest = serde_json::json!({
            "app": "BUNNA AI FLOW",
            "createdAt": now_secs(),
            "files": files.len(),
        });
        zip.start_file(MANIFEST, SimpleFileOptions::default()).map_err(|e| e.to_string())?;
        zip.write_all(manifest.to_string().as_bytes()).map_err(|e| e.to_string())?;
        for rel in &files {
            let name = rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
            let method = if already_compressed(rel) { CompressionMethod::Stored } else { CompressionMethod::Deflated };
            let opts = SimpleFileOptions::default().compression_method(method).large_file(true);
            let mut f = File::open(src.join(rel)).map_err(|e| format!("{name}: {e}"))?;
            zip.start_file(name.as_str(), opts).map_err(|e| e.to_string())?;
            bytes += io::copy(&mut f, &mut zip).map_err(|e| format!("{name}: {e}"))?;
        }
        zip.finish().map_err(|e| e.to_string())?.flush().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Sao lưu thất bại: {e}"));
    }
    fs::rename(&tmp, dest).map_err(|e| format!("Không lưu được file sao lưu: {e}"))?;
    Ok(BackupResult { files: files.len(), bytes, safety_path: None })
}

#[tauri::command]
pub async fn backup_create(app: AppHandle, dest: String) -> Result<BackupResult, String> {
    let src = data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || write_zip(&src, Path::new(&dest)))
        .await
        .map_err(|e| e.to_string())?
}

/// Thư mục gốc dữ liệu bên trong file zip: "" (zip của nút Sao lưu) hoặc "dev.bunna.aiflow/"
/// (zip tự nén cả thư mục bằng Finder / lệnh zip).
fn find_root<R: Read + io::Seek>(zip: &ZipArchive<R>) -> Option<String> {
    let names: Vec<&str> = zip.file_names().collect();
    if ROOT_MARKERS.iter().any(|m| names.contains(m)) {
        return Some(String::new());
    }
    names.iter().find_map(|n| {
        let (top, rest) = n.split_once('/')?;
        (ROOT_MARKERS.contains(&rest) && !top.is_empty()).then(|| format!("{top}/"))
    })
}

fn restore_zip(dir: &Path, src: &Path) -> Result<BackupResult, String> {
    let file = File::open(src).map_err(|e| format!("Không mở được file: {e}"))?;
    let mut zip = ZipArchive::new(io::BufReader::new(file)).map_err(|_| "File này không phải file .zip hợp lệ.".to_string())?;
    let root = find_root(&zip).ok_or("File này không phải bản sao lưu của BUNNA AI FLOW.")?;

    let parent = dir.parent().ok_or("Thư mục dữ liệu không hợp lệ.")?;
    let base = dir.file_name().and_then(|n| n.to_str()).unwrap_or("data").to_string();
    let ts = now_secs();

    // 1. Giải nén vào thư mục tạm cạnh thư mục dữ liệu (hỏng giữa chừng thì dữ liệu hiện tại còn nguyên)
    let staging = parent.join(format!("{base}.restore-{ts}"));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let mut count = 0usize;
    let mut bytes = 0u64;
    let extract = (|| -> Result<(), String> {
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
            // enclosed_name chặn đường dẫn "../" thoát ra ngoài thư mục
            let Some(path) = entry.enclosed_name() else { continue };
            let Ok(rel) = path.strip_prefix(&root) else { continue };
            if rel.as_os_str().is_empty() || rel == Path::new(MANIFEST) || rel.starts_with("__MACOSX") {
                continue;
            }
            if rel.file_name().map_or(false, |n| n == ".DS_Store") {
                continue;
            }
            let out = staging.join(rel);
            if entry.is_dir() {
                fs::create_dir_all(&out).map_err(|e| e.to_string())?;
                continue;
            }
            if let Some(p) = out.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut f = File::create(&out).map_err(|e| e.to_string())?;
            bytes += io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
            count += 1;
        }
        Ok(())
    })();
    if let Err(e) = extract {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("Giải nén thất bại, dữ liệu hiện tại giữ nguyên: {e}"));
    }

    // 2. Sao lưu tự động dữ liệu hiện tại (lỡ chọn nhầm file vẫn lấy lại được)
    let safety = parent.join(format!("{base}-truoc-khoi-phuc-{ts}.zip"));
    let has_data = dir.exists() && fs::read_dir(dir).map(|mut d| d.next().is_some()).unwrap_or(false);
    if has_data {
        if let Err(e) = write_zip(dir, &safety) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Không sao lưu được dữ liệu hiện tại nên chưa khôi phục: {e}"));
        }
    }

    // 3. Đổi chỗ: dữ liệu cũ → thư mục tạm, bản khôi phục → thư mục dữ liệu
    let old = parent.join(format!("{base}.old-{ts}"));
    if dir.exists() {
        fs::rename(dir, &old).map_err(|e| {
            let _ = fs::remove_dir_all(&staging);
            format!("Không thay được thư mục dữ liệu: {e}")
        })?;
    }
    if let Err(e) = fs::rename(&staging, dir) {
        let _ = fs::rename(&old, dir); // trả lại dữ liệu cũ
        return Err(format!("Không thay được thư mục dữ liệu: {e}"));
    }
    let _ = fs::remove_dir_all(&old);
    Ok(BackupResult { files: count, bytes, safety_path: has_data.then(|| safety.to_string_lossy().into_owned()) })
}

#[tauri::command]
pub async fn backup_restore(app: AppHandle, src: String) -> Result<BackupResult, String> {
    let dir = data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || restore_zip(&dir, Path::new(&src)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmpdir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("bunna-backup-test-{tag}-{}", now_secs()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn backup_then_restore_round_trips_and_replaces_data() {
        let root = tmpdir("rt");
        let data = root.join("dev.bunna.aiflow");
        fs::create_dir_all(data.join("circuits")).unwrap();
        fs::write(data.join("workspaces.json"), "{\"a\":1}").unwrap();
        fs::write(data.join("circuits/x.json"), "circuit").unwrap();
        fs::write(data.join("photo.png"), [1u8, 2, 3]).unwrap();
        let zip_path = root.join("b.zip");
        let r = write_zip(&data, &zip_path).unwrap();
        assert_eq!(r.files, 3);

        // dữ liệu đổi sau khi sao lưu → khôi phục phải trả về đúng bản cũ, bỏ file mới thêm
        fs::write(data.join("workspaces.json"), "{\"a\":2}").unwrap();
        fs::write(data.join("new.txt"), "x").unwrap();
        let r = restore_zip(&data, &zip_path).unwrap();
        assert_eq!(r.files, 3);
        assert_eq!(fs::read_to_string(data.join("workspaces.json")).unwrap(), "{\"a\":1}");
        assert_eq!(fs::read_to_string(data.join("circuits/x.json")).unwrap(), "circuit");
        assert!(!data.join("new.txt").exists());
        assert!(!data.join(MANIFEST).exists());
        // bản an toàn chứa dữ liệu trước khi khôi phục
        let safety = PathBuf::from(r.safety_path.unwrap());
        let mut z = ZipArchive::new(File::open(&safety).unwrap()).unwrap();
        assert!(z.by_name("new.txt").is_ok());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn restore_accepts_zip_of_whole_folder_and_rejects_other_zips() {
        let root = tmpdir("folder");
        let data = root.join("dev.bunna.aiflow");
        fs::create_dir_all(&data).unwrap();
        let zp = root.join("folder.zip");
        {
            let mut z = ZipWriter::new(File::create(&zp).unwrap());
            z.start_file("dev.bunna.aiflow/settings.json", SimpleFileOptions::default()).unwrap();
            z.write_all(b"{}").unwrap();
            z.start_file("dev.bunna.aiflow/circuits/c.json", SimpleFileOptions::default()).unwrap();
            z.write_all(b"c").unwrap();
            z.finish().unwrap();
        }
        restore_zip(&data, &zp).unwrap();
        assert_eq!(fs::read_to_string(data.join("circuits/c.json")).unwrap(), "c");

        let other = root.join("other.zip");
        {
            let mut z = ZipWriter::new(File::create(&other).unwrap());
            z.start_file("readme.txt", SimpleFileOptions::default()).unwrap();
            z.write_all(b"hi").unwrap();
            z.finish().unwrap();
        }
        assert!(restore_zip(&data, &other).is_err());
        assert!(data.join("settings.json").exists()); // không đụng vào dữ liệu
        fs::remove_dir_all(&root).unwrap();
    }
}
