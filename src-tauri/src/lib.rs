mod audio_master;
mod backup;
mod license;
mod vectorize;

use tauri::menu::{Menu, MenuItem, MenuItemKind};
use tauri::Emitter;

const ABOUT_MENU_ID: &str = "show-about";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            license::validate_license,
            license::encrypt_aiflow_file,
            license::decrypt_aiflow_file,
            vectorize::vectorize_image_to_svg,
            audio_master::master_audio,
            backup::backup_create,
            backup::backup_restore
        ])
        .setup(|app| {
            let handle = app.handle();
            let menu = Menu::default(handle)?;

            // Trên macOS, submenu đầu tiên luôn là submenu "App" (About/Hide/Quit...).
            // Thay item About mặc định (panel gốc macOS, không hỗ trợ link bấm được)
            // bằng 1 item thường — bấm vào sẽ phát sự kiện cho frontend mở modal
            // "About" tự làm trong app (xem AboutModal.tsx), có link bấm được thật.
            if let Some(MenuItemKind::Submenu(app_submenu)) = menu.items()?.first() {
                let about_item = MenuItem::with_id(
                    handle,
                    ABOUT_MENU_ID,
                    "About BUNNA AI FLOW",
                    true,
                    None::<&str>,
                )?;
                app_submenu.remove_at(0)?;
                app_submenu.insert(&about_item, 0)?;
            }

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == ABOUT_MENU_ID {
                let _ = app.emit(ABOUT_MENU_ID, ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
