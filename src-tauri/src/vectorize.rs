use vtracer::{convert, ColorImage, Config};

/// Vector hoá 1 file ảnh raster (PNG/JPG...) trên đĩa thành SVG thật — dùng
/// thuật toán trace hình học (vtracer), KHÔNG qua AI, nên không giới hạn
/// token và không "bịa" toạ độ như khi nhờ LLM viết code SVG. Trả về nội
/// dung SVG dạng text để phía JS tự lưu file (giữ việc quản lý asset ở TS).
#[tauri::command]
pub fn vectorize_image_to_svg(path: String) -> Result<String, String> {
    let img = image::open(&path).map_err(|e| format!("Không đọc được ảnh: {}", e))?.to_rgba8();
    let (width, height) = img.dimensions();
    let pixels = img.into_raw();

    let color_image = ColorImage {
        pixels,
        width: width as usize,
        height: height as usize,
    };

    // Tuned cho logo/ảnh phẳng (không phải ảnh chụp) — mặc định của vtracer
    // (filter_speckle: 0, color_precision: 8) quá nhạy với nhiễu khử răng cưa/
    // hoạ tiết nền mờ, ra hàng trăm mảnh vụn thay vì vài mảng màu sạch.
    let config = Config {
        filter_speckle: 8,
        color_precision: 5,
        ..Config::default()
    };

    let svg_file = convert(color_image, config).map_err(|e| format!("Vector hoá thất bại: {}", e))?;

    Ok(svg_file.to_string())
}
