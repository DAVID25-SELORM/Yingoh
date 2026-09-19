-- LOCAL ISOLATED REHEARSAL ONLY. Never execute against production.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
