# xcognix Publication Operations

This document describes how to operate `xcognix` as a multi-author Ghost publication.

## Model

`xcognix` is one Ghost publication. It is closer to one Substack publication or one Medium publication than to the whole Substack platform.

Ghost provides one frontend, one admin backend, one member database, one email configuration, and one publication identity for this site. Multiple people can collaborate inside that publication, but Ghost is not a full multi-tenant creator platform where unrelated creators self-serve their own isolated channels.

Use one Ghost site when the desired structure is:

```txt
xcognix
  - AI column
  - cognition column
  - interviews column
  - essays column
```

Use multiple Ghost sites, or build a platform layer above Ghost, when the desired structure is:

```txt
metacognix platform
  - alice.metacognix.xyz with its own admin, members, billing, and brand
  - bob.metacognix.xyz with its own admin, members, billing, and brand
  - carol.metacognix.xyz with its own admin, members, billing, and brand
```

## Recommended Organization

For a single publication with several hosts or editors, use this structure:

```txt
xcognix
  - Site owner: controls infrastructure, billing, email, domain, and final permissions
  - Editor/admin: manages editorial calendar and cross-column publishing
  - Host A: writes the AI column
  - Host B: writes the cognition column
  - Host C: writes the interview column
```

Map the structure to Ghost like this:

```txt
Host/person        -> Staff user and author page
Column/channel     -> Tag
Email list         -> Newsletter
Access level       -> Tier
Subscriber         -> Member
```

## Staff And Permissions

Invite collaborators from:

```txt
/ghost/ -> Settings -> Staff
```

Use roles conservatively:

| Role | Recommended Use |
| --- | --- |
| Owner | One core operator only. Full control. |
| Administrator | Trusted operators who can change site settings, members, email, and billing-related configuration. |
| Editor | Editorial lead. Can manage content across authors. |
| Author | Column host. Can write and manage their own posts. |
| Contributor | Draft-only collaborator when review is required before publishing. |

For column hosts who should not manage the whole publication, start with `Author`.

Important limitation: Ghost roles are not strict per-column isolation. Authors can be limited compared with editors/admins, but Ghost is still one shared publication. If each host needs hard isolation for members, billing, settings, and content, split into separate Ghost sites.

## Columns With Tags

Use tags as columns or channels.

Open tags directly at:

```txt
https://anvil.metacognix.xyz/ghost/#/tags
```

In the admin UI, `Tags` may appear in the content/navigation area rather than under `Settings`, depending on the Ghost admin version. If it is not visible, use the direct URL above or search for `Tags` in the admin.

Recommended tag setup:

| Column | Tag Name | Suggested Slug |
| --- | --- | --- |
| AI | AI | `ai` |
| Cognition | Cognition | `cognition` |
| Interviews | Interviews | `interviews` |
| Essays | Essays | `essays` |

Each column host should apply their assigned tag to every post.

Public column pages are available at:

```txt
/tag/ai/
/tag/cognition/
/tag/interviews/
/tag/essays/
```

Add these tag URLs to the site navigation if they should behave like top-level sections.

## Author Pages

Each staff author has an author page:

```txt
/author/{author-slug}/
```

Use author pages when the audience follows people. Use tag pages when the audience follows subjects or columns.

Recommended pattern:

```txt
Column page: /tag/ai/
Host page:   /author/{host-slug}/
```

## Newsletters

Use newsletters when different columns need separate email subscriptions.

Configure newsletters from the admin email/newsletter settings area.

Example structure:

| Newsletter | Purpose |
| --- | --- |
| xcognix Weekly | Main publication digest |
| AI Notes | AI column emails |
| Mind & Cognition | Cognition column emails |
| Interviews | Interview releases |

When publishing a post, choose the newsletter audience carefully. A post can be published on the website without emailing every member.

## Members And Tiers

Members are shared across the whole Ghost publication.

Use tiers for access levels, not for hard channel ownership:

| Tier | Use |
| --- | --- |
| Free | Public newsletter and free member posts |
| Paid | Premium posts across the publication |
| Column-specific paid tier | Only if the operating model really needs per-column paid access |

Be careful with column-specific paid tiers because they add operational complexity. A simpler model is one paid membership for all premium content.

## Email Configuration

For member signup and login emails, Ghost uses the members support address.

Set it to the verified Resend domain:

```txt
noreply@mail.metacognix.xyz
```

Do not leave it as only:

```txt
noreply
```

If it is only `noreply`, Ghost expands it to the site domain:

```txt
noreply@anvil.metacognix.xyz
```

That fails unless `anvil.metacognix.xyz` is verified in Resend.

Newsletter sender settings are separate from the members support address. The newsletter sender affects newsletters; the members support address affects member signup, login, and support-related member emails.

## Operating Rules

Use these rules to keep a shared publication orderly:

1. Each host owns one primary tag.
2. Each host publishes under their own staff author account.
3. Only editors/admins create or rename tags.
4. Only admins change email, domain, payment, and membership settings.
5. Newsletter sends should be reviewed until the editorial workflow is stable.
6. Use draft review for new hosts before granting publish rights.

## When To Split Into Multiple Sites

Split into separate Ghost sites if any of these become requirements:

- Each host needs their own domain or subdomain.
- Each host needs separate members and subscriber exports.
- Each host needs separate Stripe billing.
- Each host needs separate email sending reputation and sender identity.
- Hosts should not see or affect each other's publication settings.
- The product should let outside creators self-serve channel creation.

At that point, `xcognix` should either become one publication in a larger platform, or the platform should orchestrate multiple Ghost instances.
