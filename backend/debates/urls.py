from django.urls import path
from .views import DebateListCreateView, DebateDetailView, DebateSuggestionsView

urlpatterns = [
    path("", DebateListCreateView.as_view(), name="debate-list-create"),
    path("<uuid:id>/", DebateDetailView.as_view(), name="debate-detail"),
    path("suggestions/", DebateSuggestionsView.as_view(), name="debate-suggestions"),
]
