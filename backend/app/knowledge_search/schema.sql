-- Everything here is a copy of files in the repository, so the loader may replace it at any time.
-- No user data is ever stored.
-- ponytail: "if not exists" never alters an old table; after changing a column, recreate the database volume.
create extension if not exists vector;

create table if not exists scheme (id text primary key, record jsonb not null);

create table if not exists document (
    id serial primary key,
    url text not null unique,
    title text not null,
    source_type text not null,
    jurisdiction text not null,
    source_date text,
    language text
);

create table if not exists passage (
    id integer primary key,
    text text not null,
    search_text text not null,
    embedding vector(384),
    content_hash text not null unique
);

create table if not exists passage_source (
    passage_id integer not null references passage (id) on delete cascade,
    document_id integer not null references document (id) on delete cascade,
    primary key (passage_id, document_id)
);

create table if not exists meta (key text primary key, value text not null);
