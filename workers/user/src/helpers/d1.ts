import { now } from "./time";

export const insertUser = async (
  db: D1Database,
  {
    app,
    aliases,
    userId,
  }: {
    app: string;
    aliases: string[];
    userId: string;
  }
) => {
  const insertUser = db.prepare(
    "INSERT INTO user (id, created_at) VALUES (?, ?)"
  );
  const insertAlias = db.prepare(
    "INSERT INTO alias (name, created_at, app_id, user_id) VALUES (?, ?, ?, ?)"
  );

  const statements = [insertUser.bind(userId, now())];
  for (const alias of aliases) {
    statements.push(insertAlias.bind(alias, now(), app, userId));
  }

  try {
    const results = await db.batch(statements);
    if (results.every((r) => r.success)) {
      return { success: true };
    }

    return { success: false };
  } catch (e) {
    return { success: false };
  }
};
