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
