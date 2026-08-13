// ============================================================================
// Dummy entry point for the root Cargo package.
//
// This file exists ONLY to satisfy Cargo's requirement that every [package]
// has at least one target (src/lib.rs, src/main.rs, [lib], or [[bin]]).
//
// The actual MASOMO application code lives in src-tauri/src/main.rs.
// This file is never compiled into the final app — Cargo only builds the
// src-tauri workspace member during `tauri build`.
// ============================================================================

fn main() {
    // Intentionally empty. This binary is never invoked.
}
