CREATE TABLE
    IF NOT EXISTS app (
        id TEXT NOT NULL PRIMARY KEY,
        created_at TEXT NOT NULL
    );

DROP TABLE IF EXISTS user;

CREATE TABLE
    IF NOT EXISTS user (
        id TEXT NOT NULL PRIMARY KEY,
        created_at TEXT NOT NULL,
    );

DROP TABLE IF EXISTS alias;

CREATE TABLE
    IF NOT EXISTS alias (
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        app_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (name, app_id),
        FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
        FOREIGN KEY (app_id) REFERENCES app (id) ON DELETE CASCADE
    );

DROP TABLE IF EXISTS passkey;