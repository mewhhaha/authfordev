DROP TABLE IF EXISTS applications;

CREATE TABLE
    IF NOT EXISTS app (id TEXT NOT NULL PRIMARY KEY);

CREATE TABLE
    IF NOT EXISTS user (id TEXT NOT NULL PRIMARY KEY);

CREATE TABLE
    IF NOT EXISTS alias (
        name TEXT NOT NULL,
        app_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (alias, app_id),
        FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
        FOREIGN KEY (app_id) REFERENCES application (id) ON DELETE CASCADE
    );