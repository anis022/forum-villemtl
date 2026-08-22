# Notifications for the borough office

## What this does

A resident posts a new topic on the forum. The borough office now finds out in two ways. The office sees a new item in the notification centre on the site. The office also gets an email.

Before this, nobody was told. A staff member had to open the forum and scroll to see if anything was new. If nobody looked, nobody knew.

## Who gets notified

Only staff get notified. A staff member is an active address in the staff table in the database.

Two lists are in play and they are not the same.

- The notification centre needs an account. Only staff who have signed in and confirmed their address get a row in the centre. Right now that is six people.
- The email only needs an address. Every active address in the staff table gets the email, even if that person has never signed in. Right now that is nine people.

That gap is on purpose. A notice has to belong to an account. An email only needs a mailbox. Someone who has not signed in yet is still on the staff, and the email is often how they learn there is something to sign in for.

A topic written by a staff member notifies nobody. The office does not need to be told about its own posts.

Polls count as topics. A poll is stored as a topic with a ballot attached, so a poll from a resident notifies the office the same way a plain topic does.

Replies do not notify anyone. Only new topics do. Mailing nine people every time a thread moves is how a notification turns into something people filter away.

## The notification centre

Staff see a bell in the top bar. The bell shows how many notices are unread. The count stops at 9 plus.

The bell opens the notifications page. Each row shows who posted, the title of the topic, the category and the date. An unread row has a red line down its left side. Clicking a row opens the topic.

The page does not clear itself when you open it. You clear it with the button that says mark all as read. This is on purpose. Someone can open the page, read two lines and lock their phone. If the page cleared itself, that person would lose the rest.

Only staff can open the page. Everyone else sees a short message saying the page is for the borough office. The database also refuses to hand notification rows to anyone but their owner, so the check on the page is not the only guard.

If a topic is deleted, its notices go with it. A notice that points at a page that no longer exists is a dead end.

## The email

The email goes out after the resident has already been sent to their own post. It never runs before. A slow mail provider must not make a resident wait.

One email is sent for each new topic. Every staff address sits in the blind copy field. This sends one request instead of nine, and it keeps the staff list out of a header on a message that might be forwarded outside the office.

The email is written in French only. It is internal mail between the site and the office, so it does not need to carry both languages.

Each topic can only be mailed once. Before sending, the code writes a row into the notification emails table. Only the caller that wins that write gets the address list back. Any other caller gets an empty list and sends nothing. The request to the mail provider also carries a key built from the topic id, so a request that gets retried on the way out does not arrive as two messages.

If the send fails, that row is removed. The next attempt is then free to try again, so a topic is never marked as delivered on the strength of a request that never landed.

If the mail provider is down, or the key is missing, nothing breaks. The post is saved. The notification centre still has its rows. Only the email is lost, and the reason is written to the logs.

## What you need to set up

The email needs Resend. Resend is installed through the Vercel marketplace and is already connected to this project. It writes two values into the project environment. One is the API key. The other is the sending domain.

Resend will not send from a domain it has not checked. That domain needs three DNS records. You can find the exact records in the Resend dashboard under domains. Until those records are in place, every send comes back as a 403 error and the office only gets notified on the site.

You can change the from address with an environment value named NOTIFY_FROM_EMAIL. The domain in that address has to be a domain Resend has already checked, or the send will keep failing.

## Where the code lives

- supabase/migrations/0040_staff_notifications.sql holds the tables, the trigger and the database functions.
- utils/notify/staff.ts builds the email and sends it.
- utils/supabase/notifications.ts reads the centre and counts unread rows.
- app/actions/notifications.ts marks everything as read.
- app/[lang]/notifications/page.tsx is the page itself.
- components/notifications/notification-bell.tsx is the bell in the top bar.

The trigger sits on the issues table and runs after every insert. The database writes the notices, not the app. That means any path that creates a topic notifies the office, including the poll path and anything added later.
