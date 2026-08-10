ALTER TABLE users RENAME COLUMN email TO username;

DROP INDEX IF EXISTS uq_users_email_ci;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_email_not_blank;

CREATE TEMPORARY TABLE migrated_usernames (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(40) NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    user_row RECORD;
    base_username TEXT;
    candidate TEXT;
    suffix TEXT;
    attempt INTEGER;
BEGIN
    FOR user_row IN
        SELECT id, username AS legacy_identifier
        FROM users
        ORDER BY id
    LOOP
        base_username := regexp_replace(
            lower(split_part(btrim(user_row.legacy_identifier), '@', 1)),
            '[^a-z0-9._-]+',
            '-',
            'g'
        );
        base_username := left(base_username, 40);

        IF base_username !~ '^[a-z0-9._-]{3,40}$' THEN
            base_username := 'user-' || user_row.id;
        END IF;

        candidate := base_username;
        attempt := 1;

        WHILE EXISTS (
            SELECT 1
            FROM migrated_usernames
            WHERE lower(username) = lower(candidate)
        ) LOOP
            suffix := '-' || user_row.id;
            IF attempt > 1 THEN
                suffix := suffix || '-' || attempt;
            END IF;
            candidate := left(base_username, 40 - char_length(suffix)) || suffix;
            attempt := attempt + 1;
        END LOOP;

        INSERT INTO migrated_usernames (user_id, username)
        VALUES (user_row.id, candidate);
    END LOOP;
END $$;

UPDATE users target_user
SET username = migrated.username
FROM migrated_usernames migrated
WHERE migrated.user_id = target_user.id;

ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(40);
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT chk_users_username_format
    CHECK (username ~ '^[a-z0-9._-]{3,40}$');

CREATE UNIQUE INDEX uq_users_username_ci ON users (lower(username));
