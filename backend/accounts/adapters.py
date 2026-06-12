from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.core import signing


class AccountAdapter(DefaultAccountAdapter):
    """Custom adapter — redirects back to the React frontend after OAuth."""

    def _frontend_callback_url(self, request):
        """Signed one-time token avoids cross-origin session cookie issues (5173 → 8000)."""
        token = signing.dumps({"uid": request.user.pk}, salt="aria-oauth")
        return f"{settings.FRONTEND_URL}/auth/callback?oauth_token={token}"

    def get_login_redirect_url(self, request):
        return self._frontend_callback_url(request)

    def get_signup_redirect_url(self, request):
        return self._frontend_callback_url(request)
