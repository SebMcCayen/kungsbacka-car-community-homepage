#!/usr/bin/env python3
"""Hämtar de senaste inläggen från @kungsbackacarcommunity med Instaloader
och skriver data/instagram.json + bilder till assets/instagram/.

Körs av GitHub Action (.github/workflows/instagram.yml), men kan även köras
lokalt:  pip install instaloader requests  →  python scripts/fetch_instagram.py

Utan inloggning blockerar Instagram ofta anonyma hämtningar. Lägg därför in
en sessionscookie som miljövariabel IG_SESSIONID (GitHub Secret):
  1. Logga in på instagram.com i webbläsaren
  2. DevTools → Application → Cookies → instagram.com → kopiera värdet av "sessionid"
  3. GitHub-repot → Settings → Secrets and variables → Actions → New secret: IG_SESSIONID
"""

import json
import os
import sys
from datetime import datetime, timezone

import instaloader
import requests

PROFILE = "kungsbackacarcommunity"
MAX_POSTS = 9
OUT_DIR = "assets/instagram"
OUT_JSON = "data/instagram.json"


def main() -> int:
    L = instaloader.Instaloader(
        download_videos=False,
        download_video_thumbnails=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    sessionid = os.environ.get("IG_SESSIONID", "").strip()
    if sessionid:
        L.context._session.cookies.set("sessionid", sessionid, domain=".instagram.com")

    try:
        profile = instaloader.Profile.from_username(L.context, PROFILE)
    except Exception as e:
        print(f"Kunde inte hämta profilen: {e}", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    posts = []
    kept_files = set()

    try:
        for i, post in enumerate(profile.get_posts()):
            if i >= MAX_POSTS:
                break
            fname = f"{post.shortcode}.jpg"
            path = os.path.join(OUT_DIR, fname)
            kept_files.add(fname)
            if not os.path.exists(path):
                r = requests.get(post.url, timeout=30)
                r.raise_for_status()
                with open(path, "wb") as f:
                    f.write(r.content)
            caption = (post.caption or "").strip().split("\n")[0][:80]
            posts.append(
                {
                    "image": f"{OUT_DIR}/{fname}",
                    "caption": caption,
                    "url": f"https://www.instagram.com/p/{post.shortcode}/",
                }
            )
    except Exception as e:
        print(f"Avbröt hämtningen: {e}", file=sys.stderr)

    if not posts:
        print("Inga inlägg hämtade — lämnar befintlig JSON orörd.", file=sys.stderr)
        return 1

    # städa bort gamla bilder som inte längre visas
    for f in os.listdir(OUT_DIR):
        if f.endswith(".jpg") and f not in kept_files:
            os.remove(os.path.join(OUT_DIR, f))

    data = {
        "_instruktioner": "Genereras automatiskt av scripts/fetch_instagram.py — redigera inte för hand.",
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "posts": posts,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Skrev {len(posts)} inlägg till {OUT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
