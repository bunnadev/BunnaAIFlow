use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct MasterResult {
    pub mastered: bool,
    pub note: Option<String>,
}

/// Tên lệnh ffmpeg thử theo thứ tự, tuỳ hệ điều hành. Windows: `CreateProcess`
/// vẫn tự nối `.exe` cho tên trần, nhưng ghi rõ `ffmpeg.exe` trước để chắc chắn
/// không lệ thuộc hành vi ngầm định đó — Linux/macOS chỉ có 1 tên chuẩn.
fn ffmpeg_candidates() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["ffmpeg.exe", "ffmpeg"]
    } else {
        &["ffmpeg"]
    }
}

/// Hướng dẫn cài đặt đúng theo hệ điều hành đang chạy — hiện thẳng trong note
/// trả về cho người dùng, vì "chưa cài ffmpeg" trên Windows và macOS cần 2 câu
/// lệnh cài khác hẳn nhau (Homebrew vs winget/tải thủ công).
fn install_hint() -> &'static str {
    if cfg!(target_os = "windows") {
        "Chưa tìm thấy ffmpeg trên máy (Windows). Cài bằng: winget install ffmpeg (PowerShell), hoặc tải tại ffmpeg.org rồi thêm thư mục chứa ffmpeg.exe vào PATH."
    } else if cfg!(target_os = "macos") {
        "Chưa cài ffmpeg trên máy (macOS). Cài bằng: brew install ffmpeg."
    } else {
        "Chưa tìm thấy ffmpeg trên máy. Cài qua trình quản lý gói của hệ điều hành, ví dụ: sudo apt install ffmpeg."
    }
}

fn try_run(cmd_name: &str, input_path: &str, output_path: &str, filter: &str, sample_rate_str: &str) -> std::io::Result<std::process::Output> {
    Command::new(cmd_name)
        .args(["-v", "error", "-y", "-i", input_path, "-af", filter, "-ar", sample_rate_str, output_path])
        .output()
}

/// Làm "đẹp" giọng đọc bằng ffmpeg (lọc rì tần thấp, giảm tiếng xì, chuẩn hoá
/// âm lượng về mức LUFS chuẩn phát hành) — cùng filter chain với bước
/// `master()` trong skill `daoly-voice`. ffmpeg là dependency NGOÀI, không
/// đóng gói kèm app, nên đây LUÔN LÀ BƯỚC TUỲ CHỌN: nếu máy không có ffmpeg,
/// hoặc lệnh thất bại vì lý do khác, trả về `mastered: false` kèm lý do thay
/// vì lỗi cứng — audio đã tổng hợp (tốn credit Vbee) không được phép mất chỉ
/// vì thiếu một công cụ ở bước làm đẹp. App build trên macOS nhưng người dùng
/// cuối có thể chạy Windows, nên việc tìm ffmpeg và câu hướng dẫn cài đều phải
/// theo đúng hệ điều hành đang chạy, không giả định macOS.
#[tauri::command]
pub fn master_audio(input_path: String, output_path: String, target_lufs: f64, sample_rate: u32) -> Result<MasterResult, String> {
    let filter = format!(
        "highpass=f=75,deesser=i=0.4:m=0.5:f=0.25,loudnorm=I={}:TP=-1.5:LRA=11",
        target_lufs
    );
    // loudnorm tự ý upsample nội bộ (thấy thực tế lên tới 192kHz dù input chỉ
    // 22050Hz) nếu không ép lại -ar — file ra to gấp ~9 lần vô ích, không thêm
    // chất lượng gì vì nội dung gốc vẫn chỉ có sampleRate ban đầu.
    let sample_rate_str = sample_rate.to_string();

    // Thử lần lượt từng tên lệnh; chỉ "rơi qua" tiếp tên kế tiếp khi lỗi đúng
    // là NotFound — mọi lỗi khác (ffmpeg chạy nhưng filter/input hỏng...) trả
    // về ngay, không thử tên khác vô ích.
    for cmd_name in ffmpeg_candidates() {
        match try_run(cmd_name, &input_path, &output_path, &filter, &sample_rate_str) {
            Ok(output) if output.status.success() => return Ok(MasterResult { mastered: true, note: None }),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let reason = if stderr.is_empty() { "không rõ nguyên nhân".to_string() } else { stderr };
                return Ok(MasterResult { mastered: false, note: Some(format!("ffmpeg chạy lỗi: {}", reason)) });
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Ok(MasterResult { mastered: false, note: Some(format!("Không chạy được ffmpeg: {}", e)) }),
        }
    }

    // Hết danh sách mà tên nào cũng NotFound.
    Ok(MasterResult { mastered: false, note: Some(install_hint().to_string()) })
}
