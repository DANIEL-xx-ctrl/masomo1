#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ============================================================================
// MASOMO Tauri main entry
//
// This launches a bundled Next.js standalone server as a child process and
// loads it in the Tauri webview. The server (Node.js + Next.js standalone
// output) is bundled as a Tauri resource under `server/`.
//
// IMPORTANT: A Node.js binary is BUNDLED inside the app at `server/node-bin/`.
// This means the app does NOT depend on the user having Node.js installed.
// The bundled binary is used to spawn `node server.js` on 127.0.0.1.
//
// Flow:
//   1. Resolve the bundled server directory (platform-dependent path).
//   2. Find the bundled Node.js binary (fall back to system node/bun).
//   3. Spawn `node server.js` with stdout/stderr redirected to a log file.
//   4. Poll http://127.0.0.1:{port} until it responds (max ~30s).
//   5. Tauri navigates the window to 127.0.0.1:{port}.
//   6. When the app window closes, the server child is killed.
//
// Log file location:
//   Windows: %APPDATA%\com.masomo.app\masomo-server.log
//   macOS:   ~/Library/Application Support/com.masomo.app/masomo-server.log
//   Linux:   ~/.config/com.masomo.app/masomo-server.log
// ============================================================================

use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

/// Find a free port between 3000 and 3020 — avoids "port in use" failures
/// if the user already runs something on 3000.
fn find_free_port() -> u16 {
    for port in 3000..3020 {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    3000
}

/// Wait for the server to respond on the given port (max 30 seconds).
fn wait_for_server(port: u16) -> bool {
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(30) {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            // Port is open — give Next.js a moment to finish booting
            thread::sleep(Duration::from_millis(800));
            return true;
        }
        thread::sleep(Duration::from_millis(300));
    }
    false
}

/// Resolve the bundled server directory.
/// In dev: ../.next/standalone (relative to src-tauri)
/// In production (bundled): the `server/` resource directory.
fn resolve_server_dir(app: &tauri::App) -> std::path::PathBuf {
    // Try the bundled resource path first (production)
    if let Ok(server_dir) = app.path().resolve("server", tauri::path::BaseDirectory::Resource) {
        if server_dir.join("server.js").exists() {
            return server_dir;
        }
    }
    // Dev fallback: .next/standalone at the project root
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("..")
        .join(".next")
        .join("standalone");
    dev_path
}

/// Resolve the Node.js binary to use for spawning the server.
/// Priority:
///   1. Bundled Node binary at {server_dir}/node-bin/node (or node.exe)
///   2. System "node" (if available in PATH)
///   3. System "bun" (if available in PATH)
/// Returns (path_or_name, label) or None if nothing is available.
fn resolve_node_binary(server_dir: &std::path::Path) -> Option<(std::path::PathBuf, &'static str)> {
    // 1. Try the bundled Node binary
    let node_exe_name = if cfg!(windows) { "node.exe" } else { "node" };
    let bundled_node = server_dir.join("node-bin").join(node_exe_name);
    if bundled_node.exists() {
        return Some((bundled_node, "bundled-node"));
    }

    // 2. Try system node
    if Command::new("node")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
    {
        return Some((std::path::PathBuf::from("node"), "system-node"));
    }

    // 3. Try system bun
    if Command::new("bun")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
    {
        return Some((std::path::PathBuf::from("bun"), "system-bun"));
    }

    None
}

/// Get the path to the log file where server stdout/stderr will be written.
/// Uses the Tauri app data directory so it survives across runs.
fn get_log_path(app: &tauri::App) -> std::path::PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let _ = std::fs::create_dir_all(&dir);
    dir.join("masomo-server.log")
}

/// Append a message to the log file (timestamped).
fn log_line(log_path: &std::path::Path, msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(f, "[{}] {}", now, msg);
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // In dev mode, the beforeDevCommand (bun run dev) already starts
            // the Next.js dev server. We only spawn our own server in release.
            if cfg!(debug_assertions) {
                return Ok(());
            }

            let log_path = get_log_path(app);
            log_line(&log_path, "=== MASOMO server launcher starting ===");
            log_line(&log_path, &format!("Log file: {}", log_path.display()));

            let server_dir = resolve_server_dir(app);
            log_line(&log_path, &format!("Server dir: {}", server_dir.display()));

            let server_js = server_dir.join("server.js");
            if !server_js.exists() {
                log_line(&log_path, &format!("ERROR: server.js not found at {}", server_js.display()));
                return Ok(());
            }
            log_line(&log_path, &format!("server.js found: {}", server_js.display()));

            // Find the Node.js binary (bundled first, then system)
            let (node_bin, runtime_label) = match resolve_node_binary(&server_dir) {
                Some((p, label)) => {
                    log_line(&log_path, &format!("Using runtime: {} ({})", label, p.display()));
                    (p, label)
                }
                None => {
                    log_line(&log_path, "ERROR: No Node.js or Bun runtime available!");
                    log_line(&log_path, "  Neither bundled node-bin nor system node/bun found.");
                    log_line(&log_path, "  Please install Node.js LTS from https://nodejs.org/");
                    return Ok(());
                }
            };

            let port = find_free_port();
            log_line(&log_path, &format!("Using port: {}", port));

            // Open log file for redirecting server stdout/stderr
            let log_file = match std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                Ok(f) => f,
                Err(e) => {
                    log_line(&log_path, &format!("ERROR: cannot open log file: {}", e));
                    return Ok(());
                }
            };
            let log_file_err = log_file.try_clone().unwrap();

            // Spawn the server with stdout+stderr redirected to the log file
            // (NOT Stdio::null() — so we can see errors)
            let child = Command::new(&node_bin)
                .arg(&server_js)
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .env("NODE_ENV", "production")
                .current_dir(&server_dir)
                .stdout(Stdio::from(log_file))
                .stderr(Stdio::from(log_file_err))
                .spawn();

            let child = match child {
                Ok(c) => {
                    log_line(&log_path, &format!("Server process spawned (PID: {}, runtime: {})", c.id(), runtime_label));
                    c
                }
                Err(e) => {
                    log_line(&log_path, &format!("ERROR: Failed to spawn server: {}", e));
                    log_line(&log_path, &format!("  Tried to run: {} {}", node_bin.display(), server_js.display()));
                    return Ok(());
                }
            };

            // Store the child handle so we can kill it on exit
            app.manage(std::sync::Mutex::new(child));

            // Wait for the server to be ready
            log_line(&log_path, "Waiting for server to be ready (max 30s)...");
            if !wait_for_server(port) {
                log_line(&log_path, "ERROR: MASOMO server did not start within 30s");
                log_line(&log_path, "Check the log above for Node.js / Prisma errors.");
            } else {
                log_line(&log_path, "Server is ready!");
            }

            // Update the window URL to our port
            if let Some(window) = app.get_webview_window("main") {
                let url = format!("http://127.0.0.1:{}", port);
                let _ = window.set_title(&format!("MASOMO - Système de Gestion Scolaire"));
                log_line(&log_path, &format!("Navigating window to: {}", url));
                let _ = window.eval(&format!(
                    "window.location.replace('{}')",
                    url
                ));
            }

            log_line(&log_path, "=== Setup complete ===");
            Ok(())
        })
        .on_window_event(|window, event| {
            // When the main window closes, kill the server child process
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<std::sync::Mutex<Child>>() {
                    if let Ok(mut guard) = state.lock() {
                        let _ = guard.kill();
                        let _ = guard.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
