# Email: what sends what

## The three roles, kept apart

Three different things are easy to confuse. They are not the same and they must not share a path.

- **forumcdnndg@ensemblemtl.org** is a mailbox. It is a Google Workspace account on the party domain. It is where a human reads mail and where a reply lands. It is not a sending service.
- **Resend** is the sending path. It carries the staff notification emails and, once configured, the verification codes.
- **Supabase Auth** produces the verification codes. It only knows how to speak SMTP, so it is pointed at Resend's SMTP relay.

The mailbox login you just received is used in exactly one place in the app: it is the reply-to address on outgoing mail, set in utils/notify/staff.ts. Staff who hit reply on a notification reach a monitored inbox instead of a black hole. Nothing else in the app authenticates against that mailbox.

## Why the mailbox is not the SMTP relay

Wiring smtp.gmail.com into the app with that account's app password looks like the shortest route. It does not survive contact with real traffic.

Google Workspace caps a mailbox at 2000 recipients a day and throttles per minute on top of that. A burst of signups gets 4.7.0 deferrals, which means verification codes arrive minutes late or not at all, precisely at the moment the forum is busiest. Nothing about a login code tolerates that.

The relay would also depend on an app password on a human account. Whoever rotates that password, turns on a security setting, or leaves the organisation breaks every login on the site at once, with no warning and nothing in the logs to point at.

There is no bounce handling, no complaint handling, no suppression list and no per message log. When a resident says the code never came, there is no way to tell whether it was delivered, deferred or rejected.

Mixing the two streams also mixes their reputations. Verification codes and human correspondence would leave from the same address, so one spam complaint on a forwarded thread degrades code delivery for everybody.

The domain is not set up for it either. The SPF record on ensemblemtl.org is `v=spf1 include:_spfprod.ngpvan.com ~all`. It authorises the party's campaign platform and does not include Google. There is no DKIM key at the default Google selector. Mail sent from that mailbox by a script is already leaning on nothing that a strict receiver will check.

## The blocker right now

Nothing sends at all today. The sending domain forum.ensemblemtl.org has status `not_started` in Resend, and the subdomain has no DNS records published. Every staff notification has been coming back as a 403 since the feature shipped. The notification centre on the site still works, which is why this has not been loud.

Three records need to be added to the DNS for ensemblemtl.org by whoever administers it. The values are in the Resend dashboard under domains and are reproduced here.

| Type | Name | Value |
| --- | --- | --- |
| TXT | `resend._domainkey.forum` | the DKIM public key from the dashboard, beginning `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN` |
| MX | `send.forum` | `feedback-smtp.us-east-1.amazonses.com` at priority 10 |
| TXT | `send.forum` | `v=spf1 include:amazonses.com ~all` |

These sit on the forum subdomain and touch nothing the party already runs. The apex SPF, the Google MX records and the NGP VAN setup are all left alone. That separation is the point: the forum builds its own sending reputation and cannot damage the party's, or be damaged by it.

Press verify in the Resend dashboard once the records resolve. Staff notifications start working the moment the status turns to verified, with no code change and no deploy.

## Pointing Supabase Auth at Resend

Verification codes currently go through Supabase's built in email service. That service sends two messages an hour, only to addresses on the project team, and Supabase states plainly that it is not meant for production. This is why the sign in flow cannot be opened to residents as it stands.

In the Supabase dashboard, under Project Settings, Authentication, SMTP Settings, enable custom SMTP and enter:

- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: the Resend API key, the same value as RESEND_API_KEY
- Sender email: `forum@forum.ensemblemtl.org`
- Sender name: `Forum CDN-NDG`

Port 587 upgrades to TLS with STARTTLS. Ports 465 and 2465 are available if a network blocks 587.

The sender address has to be on a domain Resend has verified, which is why the DNS work above comes first. It cannot be forumcdnndg@ensemblemtl.org, because Resend has not been given the apex domain and should not be.

Then raise the limit. Enabling custom SMTP moves the cap from two an hour to thirty an hour, which is still a protective default rather than a real setting. It lives under Authentication, Rate Limits. Set it against expected signups, not against today's traffic, and remember that a resident who does not see a code and presses resend twice counts as three.

## Capacity

Resend's free tier is 3000 messages a month with a daily ceiling of 100. The paid
tier at twenty dollars a month is 50000. A verification code is one message and a
staff notification is one message regardless of how many addresses are in the
blind copy field, so the count grows with sign in attempts rather than with
membership.

The daily ceiling is the one that bites. At around 300 members, the day the forum
is announced puts every one of them through a sign in at once, and a person who
does not see the code and presses resend twice counts as three. That is several
hundred messages against a limit of a hundred, so the paid tier has to be in place
before the announcement goes out, not after the first member reports that no code
arrived.

A normal week afterwards sits far below the free limit. The plan is worth having
for launch week specifically.

## Verifying it works

Emails sent over SMTP appear in the Resend logs alongside those sent through the API, so a code that Supabase generated can be traced end to end in one place. If a code does not arrive, the Resend log says whether it left, and the domain page says whether the domain is still verified.
