from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/",        admin.site.urls),
    path("api/debates/",  include("debates.urls")),
    path("api/agents/",   include("agents.urls")),
    path("api/accounts/", include("accounts.urls")),
    # allauth handles the Google OAuth browser redirect flow
    path("accounts/",     include("allauth.urls")),
]
