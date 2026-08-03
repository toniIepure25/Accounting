use tauri_plugin_sql::{Migration, MigrationKind};

/// Punctul de intrare comun (desktop + mobil). Inregistreaza pluginul SQL si
/// aplica migratiile SQLite din `db/migrations` la pornire (mod local, offline).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../../../../db/migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "operational",
            sql: include_str!("../../../../db/migrations/0002_operational.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "audit",
            sql: include_str!("../../../../db/migrations/0003_audit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "firme",
            sql: include_str!("../../../../db/migrations/0004_firme.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "utilizatori",
            sql: include_str!("../../../../db/migrations/0005_utilizatori.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "mijloace_fixe",
            sql: include_str!("../../../../db/migrations/0006_mijloace_fixe.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "banca",
            sql: include_str!("../../../../db/migrations/0007_banca.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "firma_scoping",
            sql: include_str!("../../../../db/migrations/0008_firma_scoping.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "reguli_configurator",
            sql: include_str!("../../../../db/migrations/0009_reguli_configurator.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "branding_firma",
            sql: include_str!("../../../../db/migrations/0010_branding_firma.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:gestiune.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("eroare la pornirea aplicatiei Tauri");
}
