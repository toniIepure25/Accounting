// Ascunde consola pe Windows in build de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gestiune_lib::run()
}
