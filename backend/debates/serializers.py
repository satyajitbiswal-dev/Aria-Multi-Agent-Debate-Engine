from rest_framework import serializers
from .models import Debate, AgentOutput, Citation


class CitationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Citation
        fields = ["id", "url", "title", "snippet", "index"]


class AgentOutputSerializer(serializers.ModelSerializer):
    citations = CitationSerializer(many=True, read_only=True)

    class Meta:
        model  = AgentOutput
        fields = [
            "id", "role", "round_number", "turn", "content",
            "advocate_score", "critic_score",
            "advocate_logic_score", "critic_logic_score",
            "verdict", "citations", "created_at",
        ]


class DebateSerializer(serializers.ModelSerializer):
    agent_outputs = AgentOutputSerializer(many=True, read_only=True)

    class Meta:
        model  = Debate
        fields = ["id", "topic", "num_rounds", "status", "agent_outputs", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "created_at", "updated_at"]


class CreateDebateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Debate
        fields = ["topic", "num_rounds"]

    def validate_topic(self, value):
        v = value.strip()
        if len(v) < 5:
            raise serializers.ValidationError("Topic must be at least 5 characters.")
        if len(v) > 500:
            raise serializers.ValidationError("Topic must be under 500 characters.")
        return v

    def validate_num_rounds(self, value):
        if value < 1 or value > 4:
            raise serializers.ValidationError("Rounds must be between 1 and 4.")
        return value
