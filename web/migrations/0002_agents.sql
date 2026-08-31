-- One Archive blob per signed-in handler. Guest play stays in localStorage;
-- this table is the bind target after CLAIM ARCHIVE.
create table if not exists agents (
  user_id    text primary key,
  handle     text not null,
  archive    jsonb not null,
  schema_ver int not null default 1,
  updated_at timestamptz not null default now()
);
