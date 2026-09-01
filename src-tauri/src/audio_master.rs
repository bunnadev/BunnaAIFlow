use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct MasterResult {
    pub mastered: bool,
    pub note: Option<String>,
}

/// Làm "đẹp" giọng đọc bằng ffmpeg (lọc rì tần thấp, giảm tiếng xì, chuẩn hoá
/// âm lượng về mức LUFS chuẩn phát hành) — cùng filter chain với bước
/// `master()` trong skill `daoly-voice`. ffmpeg là dependency NGOÀI, không
/// đóng gói kèm app, nên đây LUÔN LÀ BƯỚC TUỲ CHỌN: nếu máy không có ffmpeg,
/// hoặc lệnh thất bại vì lý do khác, trả về `mastered: false` kèm lý do thay
/// vì lỗi cứng — audio đã tổng hợp (tốn credit Vbee) không được phép mất chỉ
/// vì thiếu một công cụ ở bước làm đẹp.
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

    let result = Command::new("ffmpeg")
        .args(["-v", "error", "-y", "-i", &input_path, "-af", &filter, "-ar", &sample_rate_str, &output_path])
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(MasterResult { mastered: true, note: None }),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let reason = if stderr.is_empty() { "không rõ nguyên nhân".to_string() } else { stderr };
            Ok(MasterResult { mastered: false, note: Some(format!("ffmpeg chạy lỗi: {}", reason)) })
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(MasterResult { mastered: false, note: Some("Chưa cài ffmpeg trên máy.".to_string()) })
        }
        Err(e) => Ok(MasterResult { mastered: false, note: Some(format!("Không chạy được ffmpeg: {}", e)) }),
    }
}
