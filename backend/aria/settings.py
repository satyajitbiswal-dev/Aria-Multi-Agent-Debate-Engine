import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
DEBUG = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    # Local
    "debates",
    "agents",
    "accounts.apps.AccountsConfig",
]

SITE_ID = 1

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "aria.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

ASGI_APPLICATION = "aria.asgi.application"

DATABASES = {
    "default": {
        "ENGINE":   "django.db.backends.postgresql",
        "NAME":     os.getenv("DB_NAME",     "aria_db"),
        "USER":     os.getenv("DB_USER",     "aria_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", "aria_pass"),
        "HOST":     os.getenv("DB_HOST",     "localhost"),
        "PORT":     os.getenv("DB_PORT",     "5432"),
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [os.getenv("REDIS_URL", "redis://localhost:6379/0")]},
    },
}

CELERY_BROKER_URL         = os.getenv("CELERY_BROKER_URL",     "redis://localhost:6379/1")
CELERY_RESULT_BACKEND     = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT     = ["json"]
CELERY_TASK_SERIALIZER    = "json"
CELERY_RESULT_SERIALIZER  = "json"
CELERY_TIMEZONE           = "UTC"
CELERY_TASK_TRACK_STARTED = True

# ── REST Framework + JWT ──────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES":   ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":    timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME":   timedelta(days=30),
    "ROTATE_REFRESH_TOKENS":    True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES":        ("Bearer",),
}

# ── Allauth ───────────────────────────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_EMAIL_REQUIRED        = True
ACCOUNT_USERNAME_REQUIRED     = False
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_VERIFICATION    = "optional"   # change to "mandatory" in prod
LOGIN_REDIRECT_URL            = "/"
ACCOUNT_ADAPTER               = "accounts.adapters.AccountAdapter"

# Skip django-allauth's ugly intermediate "Continue" page — go straight to Google
SOCIALACCOUNT_LOGIN_ON_GET = True
SOCIALACCOUNT_AUTO_SIGNUP  = True

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID",     ""),
            "secret":    os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "key":       "",
        },
        "SCOPE":       ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "FETCH_USERINFO": True,
    }
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# ── Email (console in dev; set SMTP vars in prod) ─────────────────────────────
EMAIL_BACKEND       = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST          = os.getenv("EMAIL_HOST",    "smtp.gmail.com")
EMAIL_PORT          = int(os.getenv("EMAIL_PORT","587"))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER",     "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.getenv("DEFAULT_FROM_EMAIL",  "Aria <noreply@aria.ai>")

STATIC_URL  = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE     = "UTC"
USE_I18N      = True
USE_TZ        = True

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
TAVILY_API_KEY     = os.getenv("TAVILY_API_KEY")
