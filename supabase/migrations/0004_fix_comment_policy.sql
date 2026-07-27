-- The previous policy required is_official to equal the author's status
-- exactly, which blocked officials from leaving an ordinary comment.
-- The actual rule: claiming is_official=true requires being an official;
-- posting as a regular citizen is always allowed.
drop policy if exists "Authenticated users can comment" on public.comments;
create policy "Authenticated users can comment"
  on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (is_official = false or public.is_official((select auth.uid())))
  );
