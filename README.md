# ashqeen.com

Static personal website for `ashqeen.com`, ready for Cloudflare Pages.

## Local preview

Open `index.html` in a browser, or run a tiny local server:

```sh
python3 -m http.server 8788
```

Then visit `http://localhost:8788`.

## Cloudflare Pages setup

1. Push this repository to GitHub.
2. In Cloudflare, open **Workers & Pages**.
3. Choose **Create application**.
4. Choose **Pages**.
5. Choose **Import an existing Git repository**.
6. Select the GitHub repository.
7. Use these build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `exit 0` |
| Build output directory | `.` |

8. Deploy the project.
9. Open the Pages project, go to **Custom domains**, and add `ashqeen.com`.
10. Add `www.ashqeen.com` too, if you want both addresses to work.

For an apex domain like `ashqeen.com`, Cloudflare Pages works best when the domain's nameservers are set to Cloudflare. Once the domain is active in Cloudflare DNS, Pages can add the needed DNS records for you.

## YGOPlus case study

`/ygoplus/` is a standalone static case study with a recorded demo. It does not call the YGOPlus API, database, Stripe account or image bucket. The home and Projects pages link to it; the full application remains a separate link.

Publish only the repository contents. Never add YGOPlus backups, `.env` files, user data or the application Git bundle. The private preservation archive is intentionally outside this repository.

If the full app is later paused, update the live-application links in `projects.html` and `ygoplus/index.html` to explain its status; the recorded demo will continue working.
