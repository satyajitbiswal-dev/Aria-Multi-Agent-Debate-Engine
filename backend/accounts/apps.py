import os

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        self._sync_google_social_app()

    def _sync_google_social_app(self):
        """Register Google OAuth credentials from env into django-allauth SocialApp."""
        client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        if not client_id or not secret:
            return

        try:
            from django.conf import settings
            from django.contrib.sites.models import Site
            from allauth.socialaccount.models import SocialApp

            site, _ = Site.objects.get_or_create(
                id=settings.SITE_ID,
                defaults={"domain": "localhost:8000", "name": "Aria"},
            )
            app, _ = SocialApp.objects.get_or_create(
                provider="google",
                defaults={"name": "Google", "client_id": client_id, "secret": secret, "key": ""},
            )
            changed = False
            if app.client_id != client_id:
                app.client_id = client_id
                changed = True
            if app.secret != secret:
                app.secret = secret
                changed = True
            if changed:
                app.save(update_fields=["client_id", "secret"])
            if not app.sites.filter(pk=site.pk).exists():
                app.sites.add(site)
        except Exception:
            # DB may not be ready during initial migrate
            pass
