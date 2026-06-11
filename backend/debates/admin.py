from django.contrib import admin
from .models import Debate, AgentOutput, Citation


class CitationInline(admin.TabularInline):
    model = Citation
    extra = 0
    readonly_fields = ["id", "index", "url", "title", "snippet"]


class AgentOutputInline(admin.StackedInline):
    model = AgentOutput
    extra = 0
    readonly_fields = [
        "id", "role", "round_number", "content",
        "advocate_score", "critic_score",
        "advocate_logic_score", "critic_logic_score",
        "verdict", "created_at",
    ]
    inlines = [CitationInline]


@admin.register(Debate)
class DebateAdmin(admin.ModelAdmin):
    list_display  = ["id", "topic_short", "status", "created_at"]
    list_filter   = ["status"]
    search_fields = ["topic"]
    readonly_fields = ["id", "created_at", "updated_at"]
    inlines = [AgentOutputInline]

    def topic_short(self, obj):
        return obj.topic[:80]
    topic_short.short_description = "Topic"


@admin.register(AgentOutput)
class AgentOutputAdmin(admin.ModelAdmin):
    list_display  = ["debate", "role", "round_number", "created_at"]
    list_filter   = ["role", "round_number"]
    readonly_fields = ["id", "created_at", "updated_at"]
    inlines = [CitationInline]


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ["index", "title", "url", "agent_output"]
    search_fields = ["title", "url"]
