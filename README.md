This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Elvanto Household Lookup

The portal uses a church-owned Elvanto API key to retrieve household information
without requiring each member to connect Elvanto separately. Configure this
server-only environment variable in Vercel:

```bash
ELVANTO_API_KEY=
```

The contact page searches Elvanto using the member's Supabase login email. The
portal does not use `member_mappings` for the normal trusted lookup, so the
Supabase login email must match the member's Elvanto email.

## Elvanto Giving Lookup

The giving records page uses the same `ELVANTO_API_KEY` to call Elvanto
Financial Transactions. The Elvanto API user/key must have financial access.
Tithe.ly Giving records need to be synced into Elvanto for them to appear here.

## Elvanto Group Management

The group management page uses `ELVANTO_API_KEY` to show groups where the logged
in email matches a group leader. Shared-email households are supported by
deduplicating groups across all people who match the email. Group leaders can
view members, search people, add people, and remove people from groups through
Elvanto.

## Portal Administration

Portal administrators are stored in `public.portal_users`. Apply the SQL
migration in `supabase/migrations` before using the admin page. User
management uses Supabase Auth Admin APIs, so this server-only variable must be
configured locally and in Vercel:

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

The migration seeds Steve Tipton's known portal emails as administrators so the
Administration menu appears after redeploying and applying the migration.
The follow-up password reset/audit migration adds the forced temporary password
workflow and `portal_user_audit_logs`; apply new migrations in order whenever
they are added.

## Group Email Communications

Group leaders can send email from the group management page using the same member
selection checkboxes as SMS. Messages are sent through Resend and logged in the
admin communication log.

```bash
RESEND_API_KEY=
GROUP_EMAIL_FROM=Apostolic Life <info@apostoliclifeupci.com>
```

`apostoliclifeupci.com` must be verified in Resend before production email will
deliver from `info@apostoliclifeupci.com`. Attachments support PDF, image, text,
CSV, and calendar files up to 10 MB total per send.

Apply the communication log migrations in `supabase/migrations` before using
group email in production.

## GroupMe Prayer Board

The prayer board page reads recent messages from a GroupMe conversation. It is
read-only inside the portal; members use the GroupMe link to join or reply.
Configure these server-only environment variables:

```bash
GROUPME_ACCESS_TOKEN=
GROUPME_PRAYER_GROUP_ID=
GROUPME_PRAYER_GROUP_URL=
```

## Planning Center Schedule Lookup

The dashboard shows the next three Planning Center Services assignments for the
logged-in member. Configure these server-only environment variables in Vercel:

```bash
PLANNING_CENTER_CLIENT_ID=
PLANNING_CENTER_CLIENT_SECRET=
PLANNING_CENTER_USER_AGENT=Apostolic Life Portal (admin@apostoliclifeupc.com)
PLANNING_CENTER_EMAIL_ALIASES=
```

The client ID and secret should come from a Planning Center Personal Access
Token. The lookup first matches the Supabase login email against Planning Center
People email records, then uses that person ID to fetch Services schedules,
team members, and plan order details. If the credentials are missing, sample
assignments are shown in local development so the pages can still be reviewed.
If a member logs in with a different email than their Planning Center profile,
add comma-separated alias pairs:

```bash
PLANNING_CENTER_EMAIL_ALIASES=portal-login@example.com=planning-center@example.com
```

To force sample data in another environment, set:

```bash
PLANNING_CENTER_USE_SAMPLE_DATA=true
```

## Contact Update Email Notifications

Contact update requests are saved to Supabase first. To also email the church
office when a request is submitted, configure these environment variables in
Vercel:

```bash
RESEND_API_KEY=
CONTACT_UPDATE_NOTIFICATION_EMAIL=tipton1456@gmail.com
CONTACT_UPDATE_FROM_EMAIL=onboarding@resend.dev
```

If any of those values are missing, the request is still saved, but no email is
sent.

The `onboarding@resend.dev` sender is only for temporary testing and can usually
only deliver to the email address tied to the Resend account. After
`apostoliclifeupci.com` is verified in Resend, switch production to:

```bash
CONTACT_UPDATE_NOTIFICATION_EMAIL=s.tipton@apostoliclifeupci.com
CONTACT_UPDATE_FROM_EMAIL=Apostolic Life Portal <updates@apostoliclifeupci.com>
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
