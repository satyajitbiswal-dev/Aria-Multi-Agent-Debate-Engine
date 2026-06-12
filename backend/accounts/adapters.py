from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class AccountAdapter(DefaultAccountAdapter):
    """Custom adapter — redirects back to the React frontend after OAuth."""

    def get_login_redirect_url(self, request):
        return settings.FRONTEND_URL + "/auth/callback"

    def get_signup_redirect_url(self, request):
        return settings.FRONTEND_URL + "/auth/callback"
