# analog_api/serializers.py
from rest_framework import serializers
from .models import PlanetaryTarget, EarthAnalog

class EarthAnalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarthAnalog
        fields = ['id', 'name', 'match_score', 'spectral_fit', 'topography_score', 'description']

class PlanetaryTargetSerializer(serializers.ModelSerializer):
    analogs = EarthAnalogSerializer(many=True, read_only=True)

    class Meta:
        model = PlanetaryTarget
        fields = ['id', 'name', 'body', 'latitude', 'longitude', 'analogs']