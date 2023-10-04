DROP TABLE IF EXISTS applications;

CREATE TABLE
    IF NOT EXISTS app (id TEXT NOT NULL PRIMARY KEY);

CREATE TABLE
    IF NOT EXISTS user (
        id TEXT NOT NULL PRIMARY KEY,
        verified INTEGER NOT NULL DEFAULT 0
    );

CREATE TABLE
    IF NOT EXISTS alias (
        name TEXT NOT NULL,
        app_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (alias, app_id),
        FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
        FOREIGN KEY (app_id) REFERENCES application (id) ON DELETE CASCADE
    );

CREATE TABLE
    IF NOT EXISTS registration (
        id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        credential TEXT NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
        FOREIGN KEY (app_id) REFERENCES application (id) ON DELETE CASCADE
    );

CREATE TABLE
    IF NOT EXISTS challenge (
        id TEXT NOT NULL,
        expiry INTEGER NOT NULL,
        origin TEXT,
        code TEXT,
    );