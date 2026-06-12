from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, LoginView, LogoutView, MeView, GoogleCallbackView

urlpatterns = [
    path("register/",     RegisterView.as_view(),      name="register"),
    path("login/",        LoginView.as_view(),          name="login"),
    path("logout/",       LogoutView.as_view(),         name="logout"),
    path("me/",           MeView.as_view(),             name="me"),
    path("token/refresh/",TokenRefreshView.as_view(),  name="token-refresh"),
    path("google/token/", GoogleCallbackView.as_view(), name="google-token"),
]
