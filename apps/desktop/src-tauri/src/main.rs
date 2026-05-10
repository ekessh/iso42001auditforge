// SPDX-License-Identifier: BUSL-1.1
// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let new_engagement = MenuItemBuilder::new("New Engagement")
                .id("new_engagement")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let save_wp = MenuItemBuilder::new("Save Working Paper")
                .id("save_wp")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let export_report = MenuItemBuilder::new("Export Report")
                .id("export_report")
                .accelerator("CmdOrCtrl+E")
                .build(app)?;
            let toggle_devtools = MenuItemBuilder::new("Toggle Dev Tools")
                .id("toggle_devtools")
                .accelerator("CmdOrCtrl+Shift+I")
                .build(app)?;

            let file = SubmenuBuilder::new(app, "File")
                .item(&new_engagement)
                .item(&save_wp)
                .item(&export_report)
                .separator()
                .quit()
                .build()?;
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let view = SubmenuBuilder::new(app, "View")
                .item(&toggle_devtools)
                .build()?;
            let audit = SubmenuBuilder::new(app, "Audit")
                .item(&new_engagement)
                .item(&export_report)
                .build()?;
            let help = SubmenuBuilder::new(app, "Help").build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file, &edit, &view, &audit, &help])
                .build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|_app, event| {
            // Menu events are forwarded to the web app via Tauri events.
            // Concrete handlers wired in Phase 14.
            let _ = event.id();
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
