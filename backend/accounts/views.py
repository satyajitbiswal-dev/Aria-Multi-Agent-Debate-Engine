import os

from django.contrib.auth import get_user_model
from django.core import signing
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from allauth.socialaccount.models import SocialToken, SocialAccount

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer

User = get_user_model()


def _jwt_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access":  str(refresh.access_token),
        "refresh": str(refresh),
        "user":    UserSerializer(user).data,
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(_jwt_for_user(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(_jwt_for_user(ser.validated_data["user"]))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data["refresh"])
            token.blacklist()
        except Exception:
            pass
        return Response({"detail": "Logged out."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class GoogleOAuthStatusView(APIView):
    """GET /api/accounts/google/status/ — whether Google OAuth env vars are set."""
    permission_classes = [AllowAny]

    def get(self, request):
        configured = bool(
            os.getenv("GOOGLE_CLIENT_ID", "").strip()
            and os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        )
        return Response({"configured": configured})


class GoogleCallbackView(APIView):
    """
    After allauth completes Google OAuth it redirects to the frontend with a
    signed one-time oauth_token.  The SPA exchanges that token for JWTs.
    Falls back to session auth when cookies are available (same-origin).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        oauth_token = request.data.get("oauth_token")
        if oauth_token:
            try:
                data = signing.loads(oauth_token, salt="aria-oauth", max_age=300)
                user = User.objects.get(pk=data["uid"])
                return Response(_jwt_for_user(user))
            except Exception:
                return Response(
                    {"detail": "Invalid or expired OAuth token. Please sign in again."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        if request.user and request.user.is_authenticated:
            return Response(_jwt_for_user(request.user))

        return Response(
            {"detail": "Not authenticated. Complete Google OAuth first."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
