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

## Planning Center Schedule Lookup

The dashboard shows the next three Planning Center Services assignments for the
logged-in member. Configure these server-only environment variables in Vercel:

```bash
PLANNING_CENTER_CLIENT_ID=
PLANNING_CENTER_CLIENT_SECRET=
PLANNING_CENTER_USER_AGENT=Apostolic Life Portal (admin@apostoliclifeupc.com)
```

The client ID and secret should come from a Planning Center Personal Access
Token. The lookup first matches the Supabase login email against Planning Center
People email records, then uses that person ID to fetch Services schedules,
team members, and plan order details. If the credentials are missing, sample
assignments are shown in local development so the pages can still be reviewed.
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
