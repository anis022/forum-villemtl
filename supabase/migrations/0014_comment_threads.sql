-- Let a reply answer another reply, so a thread reads as a conversation rather
-- than as a stack of remarks all addressed to the original post.
--
-- `on delete cascade`: withdrawing a comment takes the exchange hanging off it
-- with it. Leaving orphans re-parented to the top would silently promote
-- answers to questions nobody can see any more.

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

-- Rendering a thread walks children by parent; without this it is a scan of
-- every comment on the issue per node.
create index if not exists comments_parent_idx
  on public.comments (parent_id, created_at);

/*
 * Depth is stored rather than derived. Reading it costs one column where
 * computing it costs a recursive walk on every render, and it is the only way
 * to put a ceiling on nesting that a client cannot talk its way past.
 *
 * The ceiling matters on a phone. Every level of a thread spends horizontal
 * space that a 320px screen does not have, and a chain deep enough to squeeze
 * replies into a column two words wide is not a conversation any more.
 */
alter table public.comments
  add column if not exists depth smallint not null default 0;

alter table public.comments
  drop constraint if exists comments_depth_range;
alter table public.comments
  add constraint comments_depth_range check (depth between 0 and 4);

/*
 * Set in a trigger, not in the application. RLS lets a signed-in client insert
 * straight into this table, so anything the server action decides is advice;
 * this is the rule. It also refuses a parent from a different issue, which
 * would otherwise splice one thread into another.
 */
create or replace function public.set_comment_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_depth smallint;
  parent_issue uuid;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;

  select depth, issue_id into parent_depth, parent_issue
  from public.comments
  where id = new.parent_id;

  if parent_depth is null then
    raise exception 'parent comment does not exist';
  end if;

  if parent_issue is distinct from new.issue_id then
    raise exception 'a reply must stay on the same issue as the comment it answers';
  end if;

  if parent_depth >= 4 then
    raise exception 'this thread cannot be nested any deeper';
  end if;

  new.depth := parent_depth + 1;
  return new;
end;
$$;

drop trigger if exists comments_set_depth on public.comments;
create trigger comments_set_depth
  before insert on public.comments
  for each row execute function public.set_comment_depth();
