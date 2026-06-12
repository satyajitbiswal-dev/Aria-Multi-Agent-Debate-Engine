from django.contrib.auth import get_user_model
from django.conf import settings
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


class GoogleCallbackView(APIView):
    """
    After allauth completes the Google OAuth browser flow it redirects to
    FRONTEND_URL/auth/callback.  The frontend then hits this endpoint with
    the allauth session cookie to exchange it for JWT tokens.
    Called with: POST /api/accounts/google/token/  (no body needed — user is
    already authenticated via session from the allauth redirect).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # At this point allauth has already set request.user if the session
        # cookie is present.  If not, return 401.
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"detail": "Not authenticated. Complete Google OAuth first."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(_jwt_for_user(request.user))
